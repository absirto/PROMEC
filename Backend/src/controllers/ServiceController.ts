import { Request, Response } from 'express';
import prisma from '../services/prisma';

export const ServiceController = {
  async list(req: Request, res: Response) {
    try {
      const services = await prisma.service.findMany();
      res.json(services);
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao buscar serviços.' });
    }
  },

  async get(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const service = await prisma.service.findUnique({ where: { id } });
      if (!service) return res.status(404).json({ status: 'error', message: 'Serviço não encontrado.' });
      res.json(service);
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao buscar serviço.' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { name, description, price, active } = req.body;
      const service = await prisma.service.create({
        data: { name, description, price: Number(price), active }
      });
      res.status(201).json(service);
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao criar serviço.' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { name, description, price, active } = req.body;
      const service = await prisma.service.update({
        where: { id },
        data: { name, description, price: Number(price), active }
      });
      res.json(service);
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao atualizar serviço.' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      // 1. Verificar se o serviço está em alguma OS
      const usageCount = await prisma.serviceOrderService.count({
        where: { serviceId: id }
      });

      if (usageCount > 0) {
        return res.status(400).json({ 
          message: `Não é possível excluir: este serviço está registrado em ${usageCount} Ordem(ns) de Serviço.` 
        });
      }

      await prisma.service.delete({ where: { id } });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: 'Erro ao deletar serviço.', details: error.message });
    }
  }
};
