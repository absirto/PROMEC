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

export const WorkAreaController = {
  async list(req: Request, res: Response) {
    try {
      const areas = await prisma.workArea.findMany();
      res.json(areas);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar áreas.' });
    }
  },

  async get(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const area = await prisma.workArea.findUnique({ where: { id } });
      if (!area) return res.status(404).json({ error: 'Área não encontrada.' });
      res.json(area);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar área.' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });
      const area = await prisma.workArea.create({ data: { name } });

      await AuditService.log({
        entity: 'WorkArea',
        entityId: area.id,
        action: 'CREATE',
        userId: actor.id,
        userEmail: actor.email,
        newData: area,
      });

      res.status(201).json(area);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao criar área.' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const actor = getActor(req);

      const exists = await prisma.workArea.findUnique({ where: { id } });
      if (!exists) {
        return res.status(404).json({ error: 'Área não encontrada.' });
      }

      const { name } = req.body;
      const area = await prisma.workArea.update({
        where: { id },
        data: { name }
      });

      await AuditService.log({
        entity: 'WorkArea',
        entityId: area.id,
        action: 'UPDATE',
        userId: actor.id,
        userEmail: actor.email,
        oldData: exists,
        newData: area,
      });

      res.json(area);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar área.' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const actor = getActor(req);

      const exists = await prisma.workArea.findUnique({ where: { id } });
      if (!exists) {
        return res.status(404).json({ error: 'Área não encontrada.' });
      }

      // 1. Verificar se há funcionários vinculados
      const usageCount = await prisma.employee.count({
        where: { workAreaId: id }
      });

      if (usageCount > 0) {
        return res.status(400).json({
          message: `Não é possível excluir: esta área está vinculada a ${usageCount} funcionário(s).`
        });
      }

      await prisma.workArea.delete({ where: { id } });

      await AuditService.log({
        entity: 'WorkArea',
        entityId: id,
        action: 'DELETE',
        userId: actor.id,
        userEmail: actor.email,
        oldData: exists,
      });

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: 'Erro ao deletar área.', details: error.message });
    }
  }
};
