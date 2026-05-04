import { Request, Response } from 'express';
import prisma from '../services/prisma';

export const ServiceOrderController = {
  async list(req: Request, res: Response) {
    try {
      const orders = await prisma.serviceOrder.findMany({
        include: {
          person: { include: { naturalPerson: true, legalPerson: true } },
          services: { include: { service: true, employee: true } },
          materials: { include: { material: true } },
          qualityControls: true
        },
        orderBy: { openingDate: 'desc' }
      });
      res.json(orders);
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
          qualityControls: true
        }
      });
      if (!order) return res.status(404).json({ status: 'error', message: 'Ordem de serviço não encontrada' });
      res.json(order);
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao buscar ordem de serviço.' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const data = req.body;
      const order = await (prisma.serviceOrder as any).create({
        data: {
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
        },
        include: {
          person: { include: { naturalPerson: true, legalPerson: true } },
          services: { include: { service: true, employee: true } },
          materials: { include: { material: true } },
          qualityControls: true
        }
      });
      res.status(201).json(order);
    } catch (error: any) {
      console.error('Erro ao criar OS:', error);
      res.status(400).json({ status: 'error', message: 'Erro ao criar ordem de serviço.', details: error.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const data = req.body;

      const order = await prisma.$transaction(async (tx) => {
        await (tx.serviceOrder as any).update({
          where: { id },
          data: {
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

        return tx.serviceOrder.findUnique({
          where: { id },
          include: {
            person: { include: { naturalPerson: true, legalPerson: true } },
            services: { include: { service: true, employee: true } },
            materials: { include: { material: true } },
            qualityControls: true
          }
        });
      });

      res.json(order);
    } catch (error: any) {
      console.error('Erro ao atualizar OS:', error);
      res.status(400).json({ status: 'error', message: 'Erro ao atualizar ordem de serviço.', details: error.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await prisma.serviceOrder.delete({ where: { id } });
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao excluir ordem de serviço.' });
    }
  },
};
