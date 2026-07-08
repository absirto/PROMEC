import { Request, Response } from 'express';
import prisma from '../../../core/prisma';
import { AuthRequest } from '../../../middleware/auth';
import { logger } from '../../../utils/logger';
import { generateQuotationPDF } from '../../../utils/pdfQuotation';
import { getPaginationParams, formatPaginatedResponse } from '../../../utils/pagination';
import { PurchaseService } from '../services/PurchaseService';
import { NotificationService } from '../../Notification/services/NotificationService';

function getActor(req: Request) {
  const authReq = req as AuthRequest;
  const id = authReq.user?.id ? Number(authReq.user.id) : undefined;
  const email = authReq.user?.email ? String(authReq.user.email) : undefined;
  const permissions = authReq.user?.permissions || [];
  const isAdmin = authReq.user?.role === 'admin';
  return { id, email, permissions, isAdmin };
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function generatePurchaseRequestCode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SC-${y}${m}${d}-${h}${min}-${rand}`;
}

export const PurchaseController = {
  async createPurchaseQuotation(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      const data = req.body || {};
      
      const quotation = await prisma.$transaction(async (tx) => {
         return PurchaseService.createQuotation(tx, data, actor);
      });

      return res.status(201).json(quotation);
    } catch (error: any) {
      return res.status(400).json({ status: 'error', message: error.message });
    }
  },

  async listPurchaseQuotations(req: Request, res: Response) {
    try {
      const purchaseRequestId = req.query.purchaseRequestId ? Number(req.query.purchaseRequestId) : null;
      const status = req.query.status ? String(req.query.status) : null;

      const where: any = {};
      if (purchaseRequestId && Number.isFinite(purchaseRequestId) && purchaseRequestId > 0) {
        where.purchaseRequestId = purchaseRequestId;
      }
      if (status) where.status = status;

      const pagination = getPaginationParams(req);
      const [quotations, total] = await Promise.all([
        prisma.purchaseQuotation.findMany({
          where,
          include: {
            supplierPerson: { include: { naturalPerson: true, legalPerson: true } },
            purchaseRequest: {
              include: {
                serviceOrder: { select: { id: true, traceCode: true, description: true } },
                items: { include: { material: true } },
              }
            },
            items: {
              include: {
                material: true,
                purchaseRequestItem: true,
              },
              orderBy: { id: 'asc' },
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: pagination.skip,
          take: pagination.limit,
        }),
        prisma.purchaseQuotation.count({ where }),
      ]);

      return res.json(formatPaginatedResponse(quotations, total, pagination));
    } catch (error: any) {
      logger.error('PurchaseController.listPurchaseQuotations falhou: %s', error?.message || 'erro desconhecido', { stack: error?.stack });
      return res.json([]);
    }
  },

  async approvePurchaseQuotation(req: Request, res: Response) {
    try {
      const quotationId = Number(req.params.id);
      const actor = getActor(req);

      const result = await prisma.$transaction(async (tx) => {
        const approved = await PurchaseService.approveQuotation(tx, quotationId, actor);
        
        await NotificationService.notify({
          title: 'Cotação Aprovada',
          message: `A cotação ${approved.code} foi aprovada e os itens foram integrados ao estoque.`,
          type: 'SUCCESS',
          link: `/service-orders/${approved.purchaseRequest.serviceOrderId}`
        });

        return approved;
      });

      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ status: 'error', message: error.message });
    }
  },

  async getPurchaseQuotationPDF(req: Request, res: Response) {
    try {
      const quotationId = Number(req.params.id);
      if (!Number.isFinite(quotationId) || quotationId <= 0) {
        return res.status(400).json({ status: 'error', message: 'Cotação inválida.' });
      }

      const prismaAny = prisma as any;

      const quotation = await prismaAny.purchaseQuotation.findUnique({
        where: { id: quotationId },
        include: {
          supplierPerson: { include: { naturalPerson: true, legalPerson: true } },
          purchaseRequest: {
            include: {
              serviceOrder: { select: { id: true, traceCode: true, description: true } },
              items: { include: { material: true } }
            }
          },
          items: { include: { material: true, purchaseRequestItem: { include: { material: true } } } }
        }
      });

      if (!quotation) {
        return res.status(404).json({ status: 'error', message: 'Cotação não encontrada.' });
      }

      const settings = await prisma.settings.findFirst();
      const companyInfo = settings
        ? {
            companyName: settings.companyName ?? undefined,
            cnpj: settings.cnpj ?? undefined,
            phone: settings.phone ?? undefined,
            address: settings.address ?? undefined,
            companyLogo: settings.logoUrl ?? undefined,
          }
        : undefined;

      const pdfBuffer = await generateQuotationPDF(quotation, companyInfo);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="cotacao-${quotation.code || quotationId}.pdf"`
      );
      return res.end(pdfBuffer);
    } catch (error: any) {
      logger.error('getPurchaseQuotationPDF falhou: %s', error?.message || 'erro desconhecido', { stack: error?.stack });
      return res.status(500).json({ status: 'error', message: 'Erro ao gerar PDF da cotação.' });
    }
  },

  async createPurchaseRequest(req: Request, res: Response) {
    try {
      type PurchaseRequestInputItem = {
        materialId: number;
        requestedQty: number;
        stockQty: number;
        shortageQty: number;
        unit: string | null;
      };

      const data = req.body || {};
      const actor = getActor(req);
      const serviceOrderId = data.serviceOrderId ? Number(data.serviceOrderId) : null;

      const inputItems = Array.isArray(data.items) ? data.items : [];
      const items: PurchaseRequestInputItem[] = inputItems
        .map((item: any) => ({
          materialId: Number(item.materialId),
          requestedQty: Math.max(0, toNumber(item.requestedQty)),
          stockQty: Math.max(0, toNumber(item.stockQty)),
          shortageQty: Math.max(0, toNumber(item.shortageQty)),
          unit: item.unit ? String(item.unit) : null,
        }))
        .filter((item: any) => Number.isFinite(item.materialId) && item.materialId > 0 && item.shortageQty > 0);

      if (!items.length) {
        return res.status(400).json({ status: 'error', message: 'Não há itens em ruptura para gerar solicitação de compra.' });
      }

      const created = await prisma.$transaction(async (tx) => {
        if (serviceOrderId) {
          const order = await tx.serviceOrder.findUnique({ where: { id: serviceOrderId }, select: { id: true, traceCode: true } });
          if (!order) throw new Error('ORDER_NOT_FOUND');
        }

        const materialIds: number[] = Array.from(new Set(items.map((i) => i.materialId)));
        const materialsFound = await tx.material.findMany({
          where: { id: { in: materialIds } },
          select: { id: true, unit: true }
        });
        const foundIds = materialsFound.map((m) => m.id);
        const missingMaterial = materialIds.find((id) => !foundIds.includes(id));
        if (missingMaterial) throw new Error('MATERIAL_NOT_FOUND');

        const requestCode = generatePurchaseRequestCode();
        const txAny = tx as any;

        const createdRequest = await txAny.purchaseRequest.create({
          data: {
            code: requestCode,
            serviceOrderId,
            status: 'OPEN',
            notes: data.notes ? String(data.notes) : null,
            requestedByEmail: actor.email,
            items: {
              create: items.map((item: any) => {
                const material = materialsFound.find((m) => m.id === item.materialId);
                return {
                  materialId: item.materialId,
                  requestedQty: item.requestedQty,
                  stockQty: item.stockQty,
                  shortageQty: item.shortageQty,
                  unit: item.unit || material?.unit || null,
                  status: 'PENDING',
                };
              })
            }
          },
          include: {
            items: {
              include: { material: true }
            },
            serviceOrder: {
              select: { id: true, traceCode: true }
            }
          }
        });

        if (serviceOrderId) {
          await (tx.serviceOrderTrace as any).create({
            data: {
              serviceOrderId,
              serviceOrderCode: createdRequest.serviceOrder?.traceCode || null,
              action: 'PURCHASE_REQUEST_CREATE',
              changedByUserId: actor.id,
              changedByEmail: actor.email,
              payload: {
                purchaseRequestCode: createdRequest.code,
                items: createdRequest.items.map((i: any) => ({ materialId: i.materialId, shortageQty: i.shortageQty })),
              }
            }
          });
        }

        return createdRequest;
      });

      return res.status(201).json(created);
    } catch (error: any) {
      if (error.message === 'ORDER_NOT_FOUND') {
        return res.status(404).json({ status: 'error', message: 'OS não encontrada para vincular solicitação de compra.' });
      }
      if (error.message === 'MATERIAL_NOT_FOUND') {
        return res.status(404).json({ status: 'error', message: 'Um ou mais materiais não foram encontrados.' });
      }
      return res.status(400).json({ status: 'error', message: 'Erro ao gerar solicitação de compra.', details: error.message });
    }
  },

  async listPurchaseRequests(req: Request, res: Response) {
    try {
      const serviceOrderId = req.query.serviceOrderId ? Number(req.query.serviceOrderId) : null;
      const status = req.query.status ? String(req.query.status) : null;
      const startDate = typeof req.query.startDate === 'string' ? new Date(req.query.startDate) : null;
      const endDate = typeof req.query.endDate === 'string' ? new Date(req.query.endDate) : null;

      const where: any = {};
      if (serviceOrderId && Number.isFinite(serviceOrderId) && serviceOrderId > 0) {
        where.serviceOrderId = serviceOrderId;
      }
      if (status) {
        where.status = status;
      }
      if (startDate && !Number.isNaN(startDate.getTime())) {
        where.createdAt = {
          ...(where.createdAt || {}),
          gte: startDate,
        };
      }
      if (endDate && !Number.isNaN(endDate.getTime())) {
        const inclusiveEndDate = new Date(endDate);
        inclusiveEndDate.setHours(23, 59, 59, 999);
        where.createdAt = {
          ...(where.createdAt || {}),
          lte: inclusiveEndDate,
        };
      }

      const pagination = getPaginationParams(req);
      const [requests, total] = await Promise.all([
        prisma.purchaseRequest.findMany({
          where,
          include: {
            serviceOrder: { select: { id: true, traceCode: true, description: true } },
            items: {
              include: {
                material: { select: { id: true, name: true, unit: true, price: true } }
              },
              orderBy: { id: 'asc' }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: pagination.skip,
          take: pagination.limit,
        }),
        prisma.purchaseRequest.count({ where }),
      ]);

      return res.json(formatPaginatedResponse(requests, total, pagination));
    } catch (error: any) {
      logger.error('PurchaseController.listPurchaseRequests falhou: %s', error?.message || 'erro desconhecido', { stack: error?.stack });
      return res.status(500).json({ status: 'error', message: 'Erro ao listar solicitações de compra.' });
    }
  },

  async fulfillPurchaseRequest(req: Request, res: Response) {
    try {
      const requestId = Number(req.params.id);
      const data = req.body || {};
      const actor = getActor(req);
      const supplierPersonId = Number(data.supplierPersonId);
      const description = data.description ? String(data.description) : null;

      if (!Number.isFinite(requestId) || requestId <= 0) {
        return res.status(400).json({ status: 'error', message: 'Solicitação de compra inválida.' });
      }
      if (!Number.isFinite(supplierPersonId) || supplierPersonId <= 0) {
        return res.status(400).json({ status: 'error', message: 'Fornecedor é obrigatório para registrar a compra.' });
      }

      const inputItems = Array.isArray(data.items) ? data.items : [];
      if (!inputItems.length) {
        return res.status(400).json({ status: 'error', message: 'Informe ao menos um item para registrar compra.' });
      }

      const items = inputItems
        .map((item: any) => ({
          purchaseRequestItemId: Number(item.purchaseRequestItemId),
          quantity: Number(item.quantity),
          unitCost: item.unitCost !== undefined && item.unitCost !== null ? Number(item.unitCost) : null,
          totalPaid: item.totalPaid !== undefined && item.totalPaid !== null ? Number(item.totalPaid) : null,
          notes: item.notes ? String(item.notes) : null,
        }))
        .filter((item: any) => Number.isFinite(item.purchaseRequestItemId) && item.purchaseRequestItemId > 0 && Number.isFinite(item.quantity) && item.quantity > 0);

      if (!items.length) {
        return res.status(400).json({ status: 'error', message: 'Itens de compra inválidos.' });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const txAny = tx as any;

        const supplier = await tx.person.findUnique({
          where: { id: supplierPersonId },
          select: { id: true }
        });
        if (!supplier) throw new Error('SUPPLIER_NOT_FOUND');

        const request = await txAny.purchaseRequest.findUnique({
          where: { id: requestId },
          include: {
            serviceOrder: { select: { id: true, traceCode: true } },
            items: { include: { material: { select: { id: true, unit: true, price: true } } } }
          }
        });

        if (!request) throw new Error('REQUEST_NOT_FOUND');

        const requestItemsMap = new Map<number, any>(request.items.map((ri: any) => [ri.id, ri]));

        for (const item of items) {
          const requestItem = requestItemsMap.get(item.purchaseRequestItemId);
          if (!requestItem) throw new Error('REQUEST_ITEM_NOT_FOUND');
          if (requestItem.status === 'PURCHASED') continue;

          await tx.material.update({
            where: { id: requestItem.materialId },
            data: { updatedAt: new Date() }
          });

          const availableShortage = Math.max(0, Number(requestItem.shortageQty || 0));
          if (availableShortage <= 0) continue;
          const qtyToBuy = Math.min(item.quantity, availableShortage);
          if (qtyToBuy <= 0) continue;

          const finalUnitCost = item.unitCost && item.unitCost > 0
            ? item.unitCost
            : (item.totalPaid && item.totalPaid > 0 ? item.totalPaid / qtyToBuy : null);

          if (!finalUnitCost || finalUnitCost <= 0) {
            throw new Error('ITEM_COST_REQUIRED');
          }

          const finalTotalPaid = item.totalPaid && item.totalPaid > 0 ? item.totalPaid : finalUnitCost * qtyToBuy;

          await txAny.stockLog.create({
            data: {
              materialId: requestItem.materialId,
              quantity: qtyToBuy,
              type: 'IN',
              description: item.notes || description || `Compra vinculada à solicitação ${request.code}`,
              supplierPersonId,
              unitCost: finalUnitCost,
              totalPaid: finalTotalPaid,
              remainingQty: qtyToBuy,
            }
          });

          await tx.material.update({
            where: { id: requestItem.materialId },
            data: { price: finalUnitCost }
          });

          const newStockQty = Number(requestItem.stockQty || 0) + qtyToBuy;
          const newShortageQty = Math.max(0, Number(requestItem.shortageQty || 0) - qtyToBuy);
          const newStatus = newShortageQty <= 0 ? 'PURCHASED' : 'PARTIAL';

          await txAny.purchaseRequestItem.update({
            where: { id: requestItem.id },
            data: {
              stockQty: newStockQty,
              shortageQty: newShortageQty,
              status: newStatus,
            }
          });
        }

        const refreshedItems = await txAny.purchaseRequestItem.findMany({
          where: { purchaseRequestId: requestId },
          select: { id: true, status: true }
        });

        const allPurchased = refreshedItems.every((ri: any) => ri.status === 'PURCHASED');
        const hasAnyPurchased = refreshedItems.some((ri: any) => ri.status === 'PURCHASED' || ri.status === 'PARTIAL');

        await txAny.purchaseRequest.update({
          where: { id: requestId },
          data: {
            status: allPurchased ? 'CLOSED' : (hasAnyPurchased ? 'PARTIAL' : 'OPEN')
          }
        });

        if (request.serviceOrderId) {
          await txAny.serviceOrderTrace.create({
            data: {
              serviceOrderId: request.serviceOrderId,
              serviceOrderCode: request.serviceOrder?.traceCode || null,
              action: 'PURCHASE_REQUEST_FULFILL',
              changedByUserId: actor.id,
              changedByEmail: actor.email,
              payload: {
                purchaseRequestId: request.id,
                purchaseRequestCode: request.code,
                supplierPersonId,
                items: items.map((i: any) => ({
                  purchaseRequestItemId: i.purchaseRequestItemId,
                  quantity: i.quantity,
                  unitCost: i.unitCost,
                  totalPaid: i.totalPaid,
                }))
              }
            }
          });
        }

        return txAny.purchaseRequest.findUnique({
          where: { id: requestId },
          include: {
            serviceOrder: { select: { id: true, traceCode: true, description: true } },
            items: {
              include: {
                material: { select: { id: true, name: true, unit: true, price: true } }
              },
              orderBy: { id: 'asc' }
            }
          }
        });
      });

      return res.json(updated);
    } catch (error: any) {
      if (error.message === 'REQUEST_NOT_FOUND') {
        return res.status(404).json({ status: 'error', message: 'Solicitação de compra não encontrada.' });
      }
      if (error.message === 'REQUEST_ITEM_NOT_FOUND') {
        return res.status(404).json({ status: 'error', message: 'Item da solicitação não encontrado.' });
      }
      if (error.message === 'SUPPLIER_NOT_FOUND') {
        return res.status(404).json({ status: 'error', message: 'Fornecedor não encontrado.' });
      }
      if (error.message === 'ITEM_COST_REQUIRED') {
        return res.status(400).json({ status: 'error', message: 'Informe custo unitário ou total pago para os itens da compra.' });
      }
      return res.status(400).json({ status: 'error', message: 'Erro ao registrar compra da solicitação.', details: error.message });
    }
  }
};
