import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { cacheGet, cacheSet, cacheDel } from '../utils/cache';
import { logger } from '../utils/logger';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination';
import { AuditService } from '../services/AuditService';
import { AuthRequest } from '../middleware/auth';

function getActor(req: Request) {
  const authReq = req as AuthRequest;
  const id = authReq.user?.id ? Number(authReq.user.id) : undefined;
  const email = authReq.user?.email ? String(authReq.user.email) : undefined;
  const permissions = authReq.user?.permissions || [];
  const isAdmin = authReq.user?.role === 'ADMIN';
  return { id, email, permissions, isAdmin };
}

function canSeeFinance(req: Request) {
  const { permissions, isAdmin } = getActor(req);
  if (isAdmin) return true;
  return permissions.some(p => p === 'financeiro:visualizar' || p === 'financeiro:gerenciar' || p === 'financeiro:*');
}

function sanitizeService(service: any, req: Request) {
  if (!service) return service;
  if (canSeeFinance(req)) return service;

  const { price, ...rest } = service;
  return rest;
}

export const ServiceController = {
  async list(req: Request, res: Response) {
    try {
      const pagination = getPaginationParams(req);
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const cacheKey = `services:list:p${pagination.page}:l${pagination.limit}:s${search}`;

      const cached = await cacheGet(cacheKey);
      if (cached) return res.json(cached);

      const where: any = {};
      if (search) {
        where.name = { contains: search, mode: 'insensitive' };
      }

      const [services, total] = await Promise.all([
        prisma.service.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { name: 'asc' },
        }),
        prisma.service.count({ where }),
      ]);

      const response = formatPaginatedResponse(services, total, pagination);
      
      if (Array.isArray(response.data)) {
        response.data = response.data.map((s: any) => sanitizeService(s, req));
      }

      await cacheSet(cacheKey, response, 300);
      res.json(response);
    } catch (error: any) {
      logger.error('ServiceController.list falhou: %s', error?.message);
      res.status(500).json({ status: 'error', message: 'Erro ao buscar serviços.' });
    }
  },

  async get(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const service = await prisma.service.findUnique({ where: { id } });
      if (!service) return res.status(404).json({ status: 'error', message: 'Serviço não encontrado.' });
      res.json(sanitizeService(service, req));
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao buscar serviço.' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      const { name, description, price, active } = req.body;
      const service = await prisma.service.create({
        data: { name, description, price: Number(price), active: active !== undefined ? active : true }
      });

      await AuditService.log({
        entity: 'Service',
        entityId: service.id,
        action: 'CREATE',
        userId: actor.id,
        userEmail: actor.email,
        newData: service,
      });

      await cacheDel('services:list*');
      res.status(201).json(service);
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao criar serviço.' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const actor = getActor(req);
      const oldService = await prisma.service.findUnique({ where: { id } });
      if (!oldService) return res.status(404).json({ status: 'error', message: 'Serviço não encontrado.' });

      const { name, description, price, active } = req.body;
      const data: any = {
        name,
        description,
        price: Number(price),
      };
      if (active !== undefined) {
        data.active = active;
      }
      const service = await prisma.service.update({
        where: { id },
        data,
      });

      await AuditService.log({
        entity: 'Service',
        entityId: service.id,
        action: 'UPDATE',
        userId: actor.id,
        userEmail: actor.email,
        oldData: oldService,
        newData: service,
      });

      await cacheDel('services:list*');
      res.json(service);
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao atualizar serviço.' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const actor = getActor(req);
      const oldService = await prisma.service.findUnique({ where: { id } });
      if (!oldService) return res.status(404).json({ status: 'error', message: 'Serviço não encontrado.' });

      // 1. Verificar se o serviço está em alguma OS
      const usageCount = await prisma.serviceOrderService.count({
        where: { serviceId: id }
      });

      if (usageCount > 0) {
        return res.status(400).json({ 
          status: 'error',
          message: `Não é possível excluir: este serviço está registrado em ${usageCount} Ordem(ns) de Serviço.` 
        });
      }

      await prisma.service.delete({ where: { id } });

      await AuditService.log({
        entity: 'Service',
        entityId: id,
        action: 'DELETE',
        userId: actor.id,
        userEmail: actor.email,
        oldData: oldService,
      });

      await cacheDel('services:list*');
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: 'Erro ao deletar serviço.', details: error.message });
    }
  }
};
