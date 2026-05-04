import { Request, Response } from 'express';
import prisma from '../services/prisma';

export const StockController = {
  async list(req: Request, res: Response) {
    try {
      const logs = await (prisma as any).stockLog.findMany({
        include: { material: true },
        orderBy: { createdAt: 'desc' }
      });
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar histórico de estoque.' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { materialId, quantity, type, description } = req.body;
      const log = await (prisma as any).stockLog.create({
        data: {
          materialId: Number(materialId),
          quantity: Number(quantity),
          type,
          description
        },
        include: { material: true }
      });
      res.status(201).json(log);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao registrar movimentação de estoque.' });
    }
  }
};
