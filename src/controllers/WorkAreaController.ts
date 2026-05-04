import { Request, Response } from 'express';
import prisma from '../services/prisma';

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
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });
      const area = await prisma.workArea.create({ data: { name } });
      res.status(201).json(area);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao criar área.' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { name } = req.body;
      const area = await prisma.workArea.update({
        where: { id },
        data: { name }
      });
      res.json(area);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar área.' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await prisma.workArea.delete({ where: { id } });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Erro ao deletar área.' });
    }
  }
};
