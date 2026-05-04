import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middleware/auth';

function generateTraceCode() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `OS-${y}${m}${day}-${rand}`;
}

function getActor(req: Request) {
  const authReq = req as AuthRequest;
  const id = authReq.user?.id ? Number(authReq.user.id) : null;
  const email = authReq.user?.email ? String(authReq.user.email) : null;
  return { id, email };
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function enrichFinancials(order: any) {
  const materials = Array.isArray(order.materials) ? order.materials : [];
  const services = Array.isArray(order.services) ? order.services : [];
  const transactions = Array.isArray(order.transactions) ? order.transactions : [];

  const materialCost = materials.reduce((acc: number, m: any) => acc + toNumber(m.totalPrice), 0);
  const laborCost = services.reduce((acc: number, s: any) => acc + toNumber(s.totalPrice), 0);
  const directCost = materialCost + laborCost;

  const profitPercent = toNumber(order.profitPercent);
  const taxPercent = toNumber(order.taxPercent);
  const profitAmount = directCost * (profitPercent / 100);
  const baseForTax = directCost + profitAmount;
  const taxAmount = baseForTax * (taxPercent / 100);
  const totalEstimated = baseForTax + taxAmount;

  const receivables = transactions
    .filter((t: any) => t.type === 'RECEIVABLE')
    .reduce((acc: number, t: any) => acc + toNumber(t.amount), 0);
  const payables = transactions
    .filter((t: any) => t.type === 'PAYABLE')
    .reduce((acc: number, t: any) => acc + toNumber(t.amount), 0);
  const realizedMargin = receivables - payables - directCost;

  return {
    ...order,
    financials: {
      materialCost,
      laborCost,
      directCost,
      profitPercent,
      profitAmount,
      taxPercent,
      taxAmount,
      totalEstimated,
      receivables,
      payables,
      realizedMargin,
    },
  };
}

export const ServiceOrderController = {
  async pcpOverview(req: Request, res: Response) {
    try {
      const startQuery = typeof req.query.startDate === 'string' ? req.query.startDate : '';
      const endQuery = typeof req.query.endDate === 'string' ? req.query.endDate : '';
      const dailyCapacityRaw = typeof req.query.dailyCapacityHours === 'string' ? Number(req.query.dailyCapacityHours) : 8;
      const dailyCapacityHours = Number.isFinite(dailyCapacityRaw) && dailyCapacityRaw > 0 ? dailyCapacityRaw : 8;

      const periodStart = startQuery ? new Date(startQuery) : new Date();
      const periodEnd = endQuery ? new Date(endQuery) : new Date(periodStart.getTime() + (6 * 24 * 60 * 60 * 1000));

      if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Período inválido para visão PCP.' });
      }

      const orders = await prisma.serviceOrder.findMany({
        where: {
          status: { notIn: ['Concluída', 'Cancelada'] },
          plannedStartDate: { lte: periodEnd },
          plannedEndDate: { gte: periodStart },
        },
        select: {
          id: true,
          traceCode: true,
          description: true,
          status: true,
          workCenter: true,
          plannedStartDate: true,
          plannedEndDate: true,
          plannedHours: true,
        }
      });

      const days = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000)) + 1);
      const overviewByCenter: Record<string, any> = {};

      orders.forEach((order) => {
        const centerName = order.workCenter?.trim() || 'Sem centro definido';
        if (!overviewByCenter[centerName]) {
          overviewByCenter[centerName] = {
            workCenter: centerName,
            ordersCount: 0,
            plannedHours: 0,
            capacityHours: days * dailyCapacityHours,
            loadPercent: 0,
            orders: [],
          };
        }

        overviewByCenter[centerName].ordersCount += 1;
        overviewByCenter[centerName].plannedHours += toNumber(order.plannedHours);
        overviewByCenter[centerName].orders.push(order);
      });

      const centers = Object.values(overviewByCenter).map((center: any) => {
        const loadPercent = center.capacityHours > 0
          ? (center.plannedHours / center.capacityHours) * 100
          : 0;
        return {
          ...center,
          loadPercent,
        };
      });

      return res.json({
        periodStart,
        periodEnd,
        dailyCapacityHours,
        days,
        centers,
      });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: 'Erro ao gerar visão PCP.' });
    }
  },

  async list(req: Request, res: Response) {
    try {
      const orders = await prisma.serviceOrder.findMany({
        include: {
          person: { include: { naturalPerson: true, legalPerson: true } },
          services: { include: { service: true, employee: true } },
          materials: { include: { material: true } },
          qualityControls: true,
          transactions: true,
          traces: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              action: true,
              changedByEmail: true,
              createdAt: true,
            },
          }
        },
        orderBy: { openingDate: 'desc' }
      });
      res.json(orders.map(enrichFinancials));
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao listar ordens de serviço.' });
    }
  },

  async get(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const order = await prisma.serviceOrder.findUnique({
        where: { id },
        include: {
          person: { include: { naturalPerson: true, legalPerson: true } },
          services: { include: { service: true, employee: true } },
          materials: { include: { material: true } },
          qualityControls: true,
          transactions: true,
          traces: {
            orderBy: { createdAt: 'desc' },
          }
        }
      });
      if (!order) return res.status(404).json({ status: 'error', message: 'Ordem de serviço não encontrada' });
      res.json(enrichFinancials(order));
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao buscar ordem de serviço.' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const data = req.body;
      const actor = getActor(req);
      const traceCode = typeof data.traceCode === 'string' && data.traceCode.trim()
        ? data.traceCode.trim().toUpperCase()
        : generateTraceCode();

      const order = await prisma.$transaction(async (tx) => {
        const created = await (tx.serviceOrder as any).create({
          data: {
            traceCode,
            partCode: data.partCode || null,
            batchCode: data.batchCode || null,
            workCenter: data.workCenter || null,
            plannedStartDate: data.plannedStartDate ? new Date(data.plannedStartDate) : null,
            plannedEndDate: data.plannedEndDate ? new Date(data.plannedEndDate) : null,
            plannedHours: data.plannedHours !== undefined && data.plannedHours !== null ? Number(data.plannedHours) : null,
            description: data.description,
            personId: Number(data.personId),
            status: data.status,
            openingDate: data.openingDate ? new Date(data.openingDate) : new Date(),
            closingDate: data.closingDate ? new Date(data.closingDate) : undefined,
            problemDescription: data.problemDescription,
            technicalDiagnosis: data.technicalDiagnosis,
            taxPercent: Number(data.taxPercent) || 0,
            profitPercent: Number(data.profitPercent) || 0,
            services: { create: (data.services || []).map((s: any) => ({
              serviceId: Number(s.serviceId),
              employeeId: s.employeeId ? Number(s.employeeId) : null,
              description: s.description,
              hoursWorked: Number(s.hoursWorked) || 0,
              unitPrice: Number(s.unitPrice) || 0,
              totalPrice: Number(s.totalPrice) || 0
            })) },
            materials: { create: (data.materials || []).map((m: any) => ({
              materialId: Number(m.materialId),
              quantity: Number(m.quantity) || 0,
              unitPrice: Number(m.unitPrice) || 0,
              totalPrice: Number(m.totalPrice) || 0
            })) },
          }
        });

        await (tx.serviceOrderTrace as any).create({
          data: {
            serviceOrderId: created.id,
            serviceOrderCode: created.traceCode,
            action: 'CREATE',
            changedByUserId: actor.id,
            changedByEmail: actor.email,
            payload: {
              status: created.status,
              partCode: created.partCode,
              batchCode: created.batchCode,
              workCenter: created.workCenter,
              plannedStartDate: created.plannedStartDate,
              plannedEndDate: created.plannedEndDate,
              plannedHours: created.plannedHours,
            }
          }
        });

        return tx.serviceOrder.findUnique({
          where: { id: created.id },
          include: {
            person: { include: { naturalPerson: true, legalPerson: true } },
            services: { include: { service: true, employee: true } },
            materials: { include: { material: true } },
            qualityControls: true,
            transactions: true,
            traces: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            }
          }
        });
      });

      res.status(201).json(enrichFinancials(order));
    } catch (error: any) {
      console.error('Erro ao criar OS:', error);
      res.status(400).json({ status: 'error', message: 'Erro ao criar ordem de serviço.', details: error.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const data = req.body;
      const actor = getActor(req);

      const order = await prisma.$transaction(async (tx) => {
        const updated = await (tx.serviceOrder as any).update({
          where: { id },
          data: {
            traceCode: data.traceCode ? String(data.traceCode).trim().toUpperCase() : undefined,
            partCode: data.partCode !== undefined ? data.partCode : undefined,
            batchCode: data.batchCode !== undefined ? data.batchCode : undefined,
            workCenter: data.workCenter !== undefined ? data.workCenter : undefined,
            plannedStartDate: data.plannedStartDate !== undefined
              ? (data.plannedStartDate ? new Date(data.plannedStartDate) : null)
              : undefined,
            plannedEndDate: data.plannedEndDate !== undefined
              ? (data.plannedEndDate ? new Date(data.plannedEndDate) : null)
              : undefined,
            plannedHours: data.plannedHours !== undefined
              ? (data.plannedHours !== null ? Number(data.plannedHours) : null)
              : undefined,
            description: data.description,
            personId: Number(data.personId),
            status: data.status,
            openingDate: data.openingDate ? new Date(data.openingDate) : undefined,
            closingDate: data.closingDate ? new Date(data.closingDate) : undefined,
            problemDescription: data.problemDescription,
            technicalDiagnosis: data.technicalDiagnosis,
            taxPercent: Number(data.taxPercent) || 0,
            profitPercent: Number(data.profitPercent) || 0
          }
        });

        if (data.services) {
          await tx.serviceOrderService.deleteMany({ where: { serviceOrderId: id } });
          await tx.serviceOrderService.createMany({
            data: data.services.map((s: any) => ({
              serviceOrderId: id,
              serviceId: Number(s.serviceId),
              employeeId: s.employeeId ? Number(s.employeeId) : null,
              description: s.description,
              hoursWorked: Number(s.hoursWorked) || 0,
              unitPrice: Number(s.unitPrice) || 0,
              totalPrice: Number(s.totalPrice) || 0
            }))
          });
        }

        if (data.materials) {
          await tx.serviceOrderMaterial.deleteMany({ where: { serviceOrderId: id } });
          await tx.serviceOrderMaterial.createMany({
            data: data.materials.map((m: any) => ({
              serviceOrderId: id,
              materialId: Number(m.materialId),
              quantity: Number(m.quantity) || 0,
              unitPrice: Number(m.unitPrice) || 0,
              totalPrice: Number(m.totalPrice) || 0
            }))
          });
        }

        await (tx.serviceOrderTrace as any).create({
          data: {
            serviceOrderId: id,
            serviceOrderCode: updated.traceCode,
            action: 'UPDATE',
            changedByUserId: actor.id,
            changedByEmail: actor.email,
            payload: {
              status: updated.status,
              partCode: updated.partCode,
              batchCode: updated.batchCode,
              workCenter: updated.workCenter,
              plannedStartDate: updated.plannedStartDate,
              plannedEndDate: updated.plannedEndDate,
              plannedHours: updated.plannedHours,
            }
          }
        });

        return tx.serviceOrder.findUnique({
          where: { id },
          include: {
            person: { include: { naturalPerson: true, legalPerson: true } },
            services: { include: { service: true, employee: true } },
            materials: { include: { material: true } },
            qualityControls: true,
            transactions: true,
            traces: {
              orderBy: { createdAt: 'desc' },
              take: 20,
            }
          }
        });
      });

      res.json(enrichFinancials(order));
    } catch (error: any) {
      console.error('Erro ao atualizar OS:', error);
      res.status(400).json({ status: 'error', message: 'Erro ao atualizar ordem de serviço.', details: error.message });
    }
  },

  async updatePlan(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ status: 'error', message: 'ID de OS inválido.' });
      }

      const data = req.body || {};
      const actor = getActor(req);

      const order = await prisma.$transaction(async (tx) => {
        const existing = await tx.serviceOrder.findUnique({ where: { id } });
        if (!existing) {
          throw new Error('NOT_FOUND');
        }

        const updated = await tx.serviceOrder.update({
          where: { id },
          data: {
            workCenter: data.workCenter !== undefined ? (data.workCenter || null) : undefined,
            plannedStartDate: data.plannedStartDate !== undefined
              ? (data.plannedStartDate ? new Date(data.plannedStartDate) : null)
              : undefined,
            plannedEndDate: data.plannedEndDate !== undefined
              ? (data.plannedEndDate ? new Date(data.plannedEndDate) : null)
              : undefined,
            plannedHours: data.plannedHours !== undefined
              ? (data.plannedHours !== null ? Number(data.plannedHours) : null)
              : undefined,
          }
        });

        await (tx.serviceOrderTrace as any).create({
          data: {
            serviceOrderId: id,
            serviceOrderCode: updated.traceCode,
            action: 'PLAN_UPDATE',
            changedByUserId: actor.id,
            changedByEmail: actor.email,
            payload: {
              workCenter: updated.workCenter,
              plannedStartDate: updated.plannedStartDate,
              plannedEndDate: updated.plannedEndDate,
              plannedHours: updated.plannedHours,
            }
          }
        });

        return tx.serviceOrder.findUnique({
          where: { id },
          include: {
            person: { include: { naturalPerson: true, legalPerson: true } },
            services: { include: { service: true, employee: true } },
            materials: { include: { material: true } },
            qualityControls: true,
            transactions: true,
            traces: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            }
          }
        });
      });

      return res.json(enrichFinancials(order));
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        return res.status(404).json({ status: 'error', message: 'Ordem de serviço não encontrada.' });
      }

      return res.status(400).json({ status: 'error', message: 'Erro ao atualizar planejamento da OS.', details: error.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const actor = getActor(req);

      await prisma.$transaction(async (tx) => {
        const existing = await tx.serviceOrder.findUnique({ where: { id } });
        if (!existing) {
          throw new Error('NOT_FOUND');
        }

        await (tx.serviceOrderTrace as any).create({
          data: {
            serviceOrderId: id,
            serviceOrderCode: existing.traceCode,
            action: 'DELETE',
            changedByUserId: actor.id,
            changedByEmail: actor.email,
            payload: {
              status: existing.status,
              partCode: existing.partCode,
              batchCode: existing.batchCode,
            }
          }
        });

        await tx.serviceOrder.delete({ where: { id } });
      });

      res.status(204).end();
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        return res.status(404).json({ status: 'error', message: 'Ordem de serviço não encontrada.' });
      }
      res.status(500).json({ status: 'error', message: 'Erro ao excluir ordem de serviço.' });
    }
  },
};
