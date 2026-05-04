import { Request, Response } from 'express';
import prisma from '../services/prisma';

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
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });
      const role = await prisma.jobRole.create({ data: { name } });
      res.status(201).json(role);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao criar cargo.' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { name } = req.body;
      const role = await prisma.jobRole.update({
        where: { id },
        data: { name }
      });
      res.json(role);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar cargo.' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await prisma.jobRole.delete({ where: { id } });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Erro ao deletar cargo.' });
    }
  }
};
