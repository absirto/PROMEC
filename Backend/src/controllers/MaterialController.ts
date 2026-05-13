import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { cacheGet, cacheSet, cacheDel } from '../utils/cache';
import { logger } from '../utils/logger';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination';
import { AuditService } from '../services/AuditService';
import { AuthRequest } from '../middleware/auth';

function getActor(req: Request) {
  const authReq = req as AuthRequest;
  return {
    id: authReq.user?.id ? Number(authReq.user.id) : undefined,
    email: authReq.user?.email ? String(authReq.user.email) : undefined,
  };
}

export const MaterialController = {
  async list(req: Request, res: Response) {
    try {
      const pagination = getPaginationParams(req);
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const cacheKey = `materials:list:p${pagination.page}:l${pagination.limit}:s${search}`;
      
      const cached = await cacheGet(cacheKey);
      if (cached) return res.json(cached);

      const where: any = {};
      if (search) {
        where.name = { contains: search, mode: 'insensitive' };
      }

      const [materials, total] = await Promise.all([
        prisma.material.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { name: 'asc' },
        }),
        prisma.material.count({ where }),
      ]);

      const response = formatPaginatedResponse(materials, total, pagination);
      await cacheSet(cacheKey, response, 120); // cache por 2 minutos
      res.json(response);
    } catch (error: any) {
      logger.error('MaterialController.list falhou: %s', error?.message || 'erro desconhecido', { stack: error?.stack });
      res.status(500).json({ status: 'error', message: 'Erro ao buscar materiais.' });
    }
  },

  async get(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ status: 'error', message: 'ID de material inválido.' });
      }
      const material = await prisma.material.findUnique({ where: { id } });
      if (!material) return res.status(404).json({ status: 'error', message: 'Material não encontrado.' });
      res.json(material);
    } catch (error: any) {
      logger.error('MaterialController.get falhou: %s', error?.message || 'erro desconhecido', { stack: error?.stack });
      res.status(500).json({ status: 'error', message: 'Erro ao buscar material.' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      const { name, description, price, unit, active } = req.body;
      const numericPrice = Number(price);
      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        return res.status(400).json({ status: 'error', message: 'Preço do material inválido.' });
      }
      const material = await prisma.material.create({
        data: { name, description, price: numericPrice, unit, active }
      });
      
      await AuditService.log({
        entity: 'Material',
        entityId: material.id,
        action: 'CREATE',
        userId: actor.id,
        userEmail: actor.email,
        newData: material,
      });

      await cacheDel('materials:list');
      res.status(201).json(material);
    } catch (error: any) {
      logger.error('MaterialController.create falhou: %s', error?.message || 'erro desconhecido', { stack: error?.stack });
      res.status(500).json({ status: 'error', message: 'Erro ao criar material.' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ status: 'error', message: 'ID de material inválido.' });
      }
      const actor = getActor(req);
      const oldMaterial = await prisma.material.findUnique({ where: { id } });
      if (!oldMaterial) return res.status(404).json({ status: 'error', message: 'Material não encontrado.' });

      const { name, description, price, unit, active } = req.body;
      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description;
      if (price !== undefined) {
        const numericPrice = Number(price);
        if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
          return res.status(400).json({ status: 'error', message: 'Preço do material inválido.' });
        }
        data.price = numericPrice;
      }
      if (unit !== undefined) data.unit = unit;
      if (active !== undefined) data.active = active;
      
      const material = await prisma.material.update({
        where: { id },
        data,
      });

      await AuditService.log({
        entity: 'Material',
        entityId: material.id,
        action: 'UPDATE',
        userId: actor.id,
        userEmail: actor.email,
        oldData: oldMaterial,
        newData: material,
      });

      await cacheDel('materials:list');
      res.json(material);
    } catch (error: any) {
      if (error?.code === 'P2025') {
        return res.status(404).json({ status: 'error', message: 'Material não encontrado.' });
      }
      logger.error('MaterialController.update falhou: %s', error?.message || 'erro desconhecido', { stack: error?.stack });
      res.status(500).json({ status: 'error', message: 'Erro ao atualizar material.' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const actor = getActor(req);
      const oldMaterial = await prisma.material.findUnique({ where: { id } });
      if (!oldMaterial) return res.status(404).json({ status: 'error', message: 'Material não encontrado.' });

      // 1. Verificar se o material está em alguma OS
      const usageCount = await prisma.serviceOrderMaterial.count({
        where: { materialId: id }
      });

      if (usageCount > 0) {
        return res.status(400).json({ 
          status: 'error',
          message: `Não é possível excluir: este material está sendo usado em ${usageCount} Ordem(ns) de Serviço.` 
        });
      }

      await prisma.material.delete({ where: { id } });

      await AuditService.log({
        entity: 'Material',
        entityId: id,
        action: 'DELETE',
        userId: actor.id,
        userEmail: actor.email,
        oldData: oldMaterial,
      });

      await cacheDel('materials:list');
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: 'Erro ao deletar material.', details: error.message });
    }
  }
};
