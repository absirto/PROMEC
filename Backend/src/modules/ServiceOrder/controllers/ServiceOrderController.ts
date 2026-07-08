import { Request, Response } from 'express';
import prisma from '../../../core/prisma';
import { AuthRequest } from '../../../middleware/auth';
import { logger } from '../../../utils/logger';
import { generateSingleServiceOrderPDF } from '../../../utils/pdfSingleServiceOrder';
import { getSettings } from '../../../utils/pdfSettings';
import { getPaginationParams, formatPaginatedResponse } from '../../../utils/pagination';
import { FinancialService } from '../../Finance/services/FinancialService';
import { ServiceOrderService } from '../services/ServiceOrderService';
import { NotificationService } from '../../Notification/services/NotificationService';

function getActor(req: Request) {
  const authReq = req as AuthRequest;
  const id = authReq.user?.id ? Number(authReq.user.id) : undefined;
  const email = authReq.user?.email ? String(authReq.user.email) : undefined;
  const permissions = authReq.user?.permissions || [];
  const isAdmin = authReq.user?.role === 'admin';
  return { id, email, permissions, isAdmin };
}

export const ServiceOrderController = {
  async list(req: Request, res: Response) {
    try {
      const pagination = getPaginationParams(req);
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const excludeCancelled = req.query.excludeCancelled === 'true';
      const startDate = typeof req.query.startDate === 'string' ? new Date(req.query.startDate) : undefined;
      const endDate = typeof req.query.endDate === 'string' ? new Date(req.query.endDate) : undefined;

      const where: any = {};
      if (status) {
        where.status = status;
      } else if (excludeCancelled) {
        where.status = { not: 'Cancelada' };
      }
      if (startDate && !Number.isNaN(startDate.getTime())) {
        where.openingDate = { ...where.openingDate, gte: startDate };
      }
      if (endDate && !Number.isNaN(endDate.getTime())) {
        const inclusiveEndDate = new Date(endDate);
        inclusiveEndDate.setHours(23, 59, 59, 999);
        where.openingDate = { ...where.openingDate, lte: inclusiveEndDate };
      }
      if (search) {
        where.OR = [
          { traceCode: { contains: search, mode: 'insensitive' } },
          { partCode: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { person: { naturalPerson: { name: { contains: search, mode: 'insensitive' } } } },
          { person: { legalPerson: { corporateName: { contains: search, mode: 'insensitive' } } } },
        ];
      }

      if (req.query.all === 'true') {
        const orders = await prisma.serviceOrder.findMany({
          where,
          include: {
            person: { include: { naturalPerson: true, legalPerson: true } },
            services: { include: { service: true, employee: true } },
            materials: { include: { material: true } },
            qualityControls: true,
            transactions: true,
          },
          orderBy: { openingDate: 'desc' },
        });

        const enriched = orders.map(o => FinancialService.enrichFinancials(o));
        const sanitized = enriched.map(o => FinancialService.sanitizeOrder(o, req));
        return res.json(sanitized);
      }

      const [orders, total] = await Promise.all([
        prisma.serviceOrder.findMany({
          where,
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
          orderBy: { openingDate: 'desc' },
          skip: pagination.skip,
          take: pagination.limit,
        }),
        prisma.serviceOrder.count({ where }),
      ]);

      const enriched = orders.map(o => FinancialService.enrichFinancials(o));
      const sanitized = enriched.map(o => FinancialService.sanitizeOrder(o, req));
      return res.json(formatPaginatedResponse(sanitized, total, pagination));
    } catch (error) {
      return res.status(500).json({ status: 'error', message: 'Erro ao listar ordens de serviço.' });
    }
  },

  async get(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const order = await prisma.serviceOrder.findUnique({
        where: { id: Number(id) },
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

      if (!order) {
        return res.status(404).json({ status: 'error', message: 'Ordem de serviço não encontrada' });
      }

      const enriched = FinancialService.enrichFinancials(order);
      const sanitized = FinancialService.sanitizeOrder(enriched, req);
      return res.json(sanitized);
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: 'Erro ao buscar ordem de serviço.' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      const order = await ServiceOrderService.create(req.body, actor);

      await NotificationService.notify({
        title: 'Nova OS Aberta',
        message: `A Ordem de Serviço ${order?.traceCode} foi registrada com sucesso.`,
        type: 'SUCCESS',
        link: `/operations/service-orders/${order?.id}`
      });

      return res.status(201).json(FinancialService.enrichFinancials(order));
    } catch (error: any) {
      return res.status(400).json({ status: 'error', message: 'Erro ao criar ordem de serviço.', details: error.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const actor = getActor(req);
      const order = await ServiceOrderService.update(id, req.body, actor);

      return res.json(FinancialService.enrichFinancials(order));
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        return res.status(404).json({ status: 'error', message: 'Ordem de serviço não encontrada.' });
      }
      return res.status(400).json({ status: 'error', message: 'Erro ao atualizar ordem de serviço.', details: error.message });
    }
  },

  async updatePlan(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ status: 'error', message: 'ID de OS inválido.' });

      const actor = getActor(req);
      const order = await ServiceOrderService.updatePlan(id, req.body, actor);

      const enriched = FinancialService.enrichFinancials(order);
      const sanitized = FinancialService.sanitizeOrder(enriched, req);
      return res.json(sanitized);
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') return res.status(404).json({ status: 'error', message: 'Ordem de serviço não encontrada.' });
      if (error.message === 'INVALID_PLAN_WINDOW') return res.status(400).json({ status: 'error', message: 'Janela de planejamento inválida: início maior que fim.' });
      if (error.message === 'PLAN_CONFLICT') {
        return res.status(409).json({
          status: 'error',
          message: 'Conflito de agenda no centro de trabalho para o período informado.',
          conflicts: error.conflicts || [],
        });
      }
      return res.status(400).json({ status: 'error', message: 'Erro ao atualizar planejamento da OS.', details: error.message });
    }
  },

  async updatePlanBatch(req: Request, res: Response) {
    try {
      const data = req.body || {};
      const actor = getActor(req);
      const idsInput = Array.isArray(data.ids) ? data.ids : [];
      const ids = idsInput.map((v: unknown) => Number(v)).filter((v: number) => Number.isFinite(v) && v > 0);

      if (!ids.length) return res.status(400).json({ status: 'error', message: 'Informe ao menos uma OS para replanejamento em lote.' });

      const result = await ServiceOrderService.updatePlanBatch(ids, data, actor);
      return res.json(result);
    } catch (error: any) {
      if (error.message === 'NO_DATA') return res.status(400).json({ status: 'error', message: 'Nenhum campo de planejamento foi informado para atualização.' });
      if (error.message === 'NOT_FOUND') return res.status(404).json({ status: 'error', message: 'Nenhuma OS encontrada para os IDs enviados.' });
      if (error.message === 'INVALID_PLAN_WINDOW') return res.status(400).json({ status: 'error', message: 'Janela de planejamento inválida: início maior que fim.' });
      if (error.message === 'PLAN_CONFLICT') {
        return res.status(409).json({
          status: 'error',
          message: 'Conflito de agenda detectado para o replanejamento em lote.',
          externalConflicts: error.externalConflicts || [],
          internalConflicts: error.internalConflicts || [],
        });
      }
      return res.status(400).json({ status: 'error', message: 'Erro ao atualizar planejamento em lote.', details: error.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const actor = getActor(req);
      await ServiceOrderService.delete(id, actor);
      return res.status(204).end();
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        return res.status(404).json({ status: 'error', message: 'Ordem de serviço não encontrada.' });
      }
      return res.status(500).json({ status: 'error', message: 'Erro ao excluir ordem de serviço.' });
    }
  },

  async listOperations(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ status: 'error', message: 'ID de OS inválido.' });

      const exists = await prisma.serviceOrder.findUnique({ where: { id }, select: { id: true } });
      if (!exists) return res.status(404).json({ status: 'error', message: 'Ordem de serviço não encontrada.' });

      const logs = await prisma.serviceOrderOperationLog.findMany({
        where: { serviceOrderId: id },
        include: { employee: { include: { person: { include: { naturalPerson: true, legalPerson: true } } } } },
        orderBy: { startAt: 'desc' },
      });

      return res.json(logs);
    } catch (error) {
      return res.status(500).json({ status: 'error', message: 'Erro ao listar apontamentos operacionais.' });
    }
  },

  async addOperation(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ status: 'error', message: 'ID de OS inválido.' });

      const actor = getActor(req);
      const result = await ServiceOrderService.addOperation(id, req.body, actor);
      return res.status(201).json(result);
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') return res.status(404).json({ status: 'error', message: 'Ordem de serviço não encontrada.' });
      if (error.message === 'EMPLOYEE_NOT_FOUND') return res.status(404).json({ status: 'error', message: 'Funcionário não encontrado.' });
      if (error.message === 'INVALID_OPERATION_TYPE') return res.status(400).json({ status: 'error', message: 'Tipo de operação inválido.' });
      if (error.message === 'INVALID_SHIFT') return res.status(400).json({ status: 'error', message: 'Turno inválido.' });
      if (error.message === 'INVALID_DOWNTIME_CATEGORY') return res.status(400).json({ status: 'error', message: 'Categoria de parada inválida.' });
      if (error.message === 'INVALID_START_DATE') return res.status(400).json({ status: 'error', message: 'Data/hora de início inválida.' });
      if (error.message === 'INVALID_END_DATE') return res.status(400).json({ status: 'error', message: 'Data/hora de fim inválida.' });
      if (error.message === 'END_BEFORE_START') return res.status(400).json({ status: 'error', message: 'Fim não pode ser menor que início.' });
      if (error.message === 'INVALID_EMPLOYEE') return res.status(400).json({ status: 'error', message: 'Funcionário inválido.' });

      return res.status(400).json({ status: 'error', message: 'Erro ao registrar apontamento operacional.', details: error.message });
    }
  },

  async getServiceOrderPDF(req: Request, res: Response) {
    try {
      const orderId = Number(req.params.id);
      if (!Number.isFinite(orderId) || orderId <= 0) {
        return res.status(400).json({ status: 'error', message: 'Ordem de serviço inválida.' });
      }

      const order = await prisma.serviceOrder.findUnique({
        where: { id: orderId },
        include: {
          person: { include: { naturalPerson: true, legalPerson: true } },
          services: { include: { service: true, employee: { include: { person: { include: { naturalPerson: true } } } } } },
          materials: { include: { material: true } },
          qualityControls: true,
          transactions: true,
        }
      });

      if (!order) {
        return res.status(404).json({ status: 'error', message: 'Ordem de serviço não encontrada.' });
      }

      const settings = await getSettings();
      const companyInfo = settings
        ? {
            companyName: settings.companyName ?? undefined,
            cnpj: settings.cnpj ?? undefined,
            phone: settings.phone ?? undefined,
            address: settings.address ?? undefined,
            companyLogo: settings.logoUrl ?? undefined,
            email: settings.contactEmail ?? undefined,
          }
        : undefined;

      const pdfBuffer = await generateSingleServiceOrderPDF(order, companyInfo);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="os-${orderId}.pdf"`
      );
      return res.end(pdfBuffer);
    } catch (error: any) {
      logger.error('getServiceOrderPDF falhou: %s', error?.message || 'erro desconhecido', { stack: error?.stack });
      return res.status(500).json({ status: 'error', message: 'Erro ao gerar PDF da ordem de serviço.' });
    }
  }
};
