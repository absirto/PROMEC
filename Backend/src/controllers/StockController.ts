import { Request, Response } from 'express';
import prisma from '../services/prisma';

export const StockController = {
  async list(req: Request, res: Response) {
    try {
      const logs = await (prisma as any).stockLog.findMany({
        include: {
          material: true,
          supplierPerson: {
            include: {
              naturalPerson: { select: { name: true } },
              legalPerson: { select: { corporateName: true } },
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar histórico de estoque.' });
    }
  },

  async purchaseHistory(req: Request, res: Response) {
    try {
      const materialId = req.query.materialId ? Number(req.query.materialId) : null;
      const where: any = { type: 'IN', unitCost: { not: null } };
      if (materialId && Number.isFinite(materialId) && materialId > 0) {
        where.materialId = materialId;
      }

      const logs = await (prisma as any).stockLog.findMany({
        where,
        include: {
          material: true,
          supplierPerson: {
            include: {
              naturalPerson: { select: { name: true } },
              legalPerson: { select: { corporateName: true } },
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json(logs.map((log: any) => ({
        ...log,
        supplierName: log.supplierPerson?.naturalPerson?.name || log.supplierPerson?.legalPerson?.corporateName || null,
      })));
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar histórico de compras de peças.' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { materialId, quantity, type, description, supplierPersonId, totalPaid, unitCost } = req.body;
      const parsedMaterialId = Number(materialId);
      const parsedQuantity = Number(quantity);

      if (!Number.isFinite(parsedMaterialId) || parsedMaterialId <= 0 || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
        return res.status(400).json({ error: 'Dados de movimentação inválidos.' });
      }

      const movementType = String(type || '').toUpperCase();
      if (movementType !== 'IN' && movementType !== 'OUT') {
        return res.status(400).json({ error: 'Tipo de movimentação inválido. Use IN ou OUT.' });
      }

      const createdLog = await prisma.$transaction(async (tx) => {
        const txAny = tx as any;

        if (movementType === 'IN') {
          const parsedTotalPaid = totalPaid !== undefined && totalPaid !== null ? Number(totalPaid) : null;
          const parsedUnitCost = unitCost !== undefined && unitCost !== null ? Number(unitCost) : null;

          const finalUnitCost = parsedUnitCost && parsedUnitCost > 0
            ? parsedUnitCost
            : (parsedTotalPaid && parsedTotalPaid > 0 ? parsedTotalPaid / parsedQuantity : null);

          if (!finalUnitCost || finalUnitCost <= 0) {
            throw new Error('INVALID_PURCHASE_COST');
          }

          const parsedSupplierPersonId = supplierPersonId ? Number(supplierPersonId) : null;
          if (!parsedSupplierPersonId || !Number.isFinite(parsedSupplierPersonId) || parsedSupplierPersonId <= 0) {
            throw new Error('SUPPLIER_REQUIRED');
          }

          const supplierExists = await tx.person.findUnique({ where: { id: parsedSupplierPersonId }, select: { id: true } });
          if (!supplierExists) {
            throw new Error('SUPPLIER_NOT_FOUND');
          }

          const totalForLog = parsedTotalPaid && parsedTotalPaid > 0 ? parsedTotalPaid : finalUnitCost * parsedQuantity;
          const inLog = await txAny.stockLog.create({
            data: {
              materialId: parsedMaterialId,
              quantity: parsedQuantity,
              type: 'IN',
              description,
              supplierPersonId: parsedSupplierPersonId,
              unitCost: finalUnitCost,
              totalPaid: totalForLog,
              remainingQty: parsedQuantity,
            },
            include: {
              material: true,
              supplierPerson: {
                include: {
                  naturalPerson: { select: { name: true } },
                  legalPerson: { select: { corporateName: true } },
                }
              }
            }
          });

          // O custo padrão do material passa a refletir o lote recém-comprado.
          await tx.material.update({
            where: { id: parsedMaterialId },
            data: { price: finalUnitCost }
          });

          return inLog;
        }

        const inLots = await txAny.stockLog.findMany({
          where: {
            materialId: parsedMaterialId,
            type: 'IN',
            remainingQty: { gt: 0 }
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
        });

        const totalAvailable = inLots.reduce((acc: number, lot: any) => acc + Number(lot.remainingQty || 0), 0);
        if (totalAvailable < parsedQuantity) {
          throw new Error('INSUFFICIENT_STOCK');
        }

        let remainingToConsume = parsedQuantity;
        let movementCost = 0;

        for (const lot of inLots) {
          if (remainingToConsume <= 0) break;
          const lotRemaining = Number(lot.remainingQty || 0);
          if (lotRemaining <= 0) continue;

          const consumeQty = Math.min(lotRemaining, remainingToConsume);
          const costPerUnit = Number(lot.unitCost || 0);
          movementCost += consumeQty * costPerUnit;

          await txAny.stockLog.update({
            where: { id: lot.id },
            data: { remainingQty: lotRemaining - consumeQty }
          });

          remainingToConsume -= consumeQty;
        }

        const movementUnitCost = movementCost / parsedQuantity;

        const outLog = await txAny.stockLog.create({
          data: {
            materialId: parsedMaterialId,
            quantity: parsedQuantity,
            type: 'OUT',
            description,
            unitCost: movementUnitCost,
            totalPaid: movementCost,
            remainingQty: 0,
          },
          include: {
            material: true,
            supplierPerson: {
              include: {
                naturalPerson: { select: { name: true } },
                legalPerson: { select: { corporateName: true } },
              }
            }
          }
        });

        const nextLot = await txAny.stockLog.findFirst({
          where: {
            materialId: parsedMaterialId,
            type: 'IN',
            remainingQty: { gt: 0 }
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
        });

        if (nextLot?.unitCost && Number(nextLot.unitCost) > 0) {
          await tx.material.update({
            where: { id: parsedMaterialId },
            data: { price: Number(nextLot.unitCost) }
          });
        }

        return outLog;
      });

      res.status(201).json(createdLog);
    } catch (error) {
      if ((error as any).message === 'SUPPLIER_REQUIRED') {
        return res.status(400).json({ error: 'Fornecedor é obrigatório para entrada de compra.' });
      }
      if ((error as any).message === 'SUPPLIER_NOT_FOUND') {
        return res.status(404).json({ error: 'Fornecedor não encontrado na tabela de pessoas.' });
      }
      if ((error as any).message === 'INVALID_PURCHASE_COST') {
        return res.status(400).json({ error: 'Informe unitCost ou totalPaid válidos para a compra.' });
      }
      if ((error as any).message === 'INSUFFICIENT_STOCK') {
        return res.status(400).json({ error: 'Estoque insuficiente para a saída informada.' });
      }
      res.status(500).json({ error: 'Erro ao registrar movimentação de estoque.' });
    }
  }
};
