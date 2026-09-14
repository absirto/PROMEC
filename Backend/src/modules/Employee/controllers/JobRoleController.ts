import { Request, Response } from 'express';
import prisma from '../../../core/prisma';
import { AuditService } from '../../Audit/services/AuditService';
import { AuthRequest } from '../../../middleware/auth';

function getActor(req: Request) {
  const authReq = req as AuthRequest;
  return {
    id: authReq.user?.id ? Number(authReq.user.id) : undefined,
    email: authReq.user?.email ? String(authReq.user.email) : undefined,
  };
}

export const JobRoleController = {
  async list(req: Request, res: Response) {
    try {
      const roles = await prisma.jobRole.findMany();
      res.json(roles);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar cargos.' });
    }
  },

  async get(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const role = await prisma.jobRole.findUnique({ where: { id } });
      if (!role) return res.status(404).json({ error: 'Cargo não encontrado.' });
      res.json(role);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar cargo.' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });
      const role = await prisma.jobRole.create({ data: { name } });

      await AuditService.log({
        entity: 'JobRole',
        entityId: role.id,
        action: 'CREATE',
        userId: actor.id,
        userEmail: actor.email,
        newData: role,
      });

      res.status(201).json(role);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao criar cargo.' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const actor = getActor(req);

      const exists = await prisma.jobRole.findUnique({ where: { id } });
      if (!exists) {
        return res.status(404).json({ error: 'Cargo não encontrado.' });
      }

      const { name } = req.body;
      const role = await prisma.jobRole.update({
        where: { id },
        data: { name }
      });

      await AuditService.log({
        entity: 'JobRole',
        entityId: role.id,
        action: 'UPDATE',
        userId: actor.id,
        userEmail: actor.email,
        oldData: exists,
        newData: role,
      });

      res.json(role);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar cargo.' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const actor = getActor(req);

      const exists = await prisma.jobRole.findUnique({ where: { id } });
      if (!exists) {
        return res.status(404).json({ error: 'Cargo não encontrado.' });
      }

      // 1. Verificar se há funcionários vinculados
      const usageCount = await prisma.employee.count({
        where: { jobRoleId: id }
      });

      if (usageCount > 0) {
        return res.status(400).json({
          message: `Não é possível excluir: este cargo está vinculado a ${usageCount} funcionário(s).`
        });
      }

      await prisma.jobRole.delete({ where: { id } });

      await AuditService.log({
        entity: 'JobRole',
        entityId: id,
        action: 'DELETE',
        userId: actor.id,
        userEmail: actor.email,
        oldData: exists,
      });

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: 'Erro ao deletar cargo.', details: error.message });
    }
  }
};
