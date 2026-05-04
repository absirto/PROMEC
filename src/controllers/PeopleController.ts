import { Request, Response } from 'express';
import prisma from '../services/prisma';

export const PeopleController = {
  async list(req: Request, res: Response) {
    try {
      const people = await prisma.person.findMany({
        include: {
          naturalPerson: true,
          legalPerson: { include: { representatives: true } },
          addresses: true,
          contacts: true
        },
        orderBy: { updatedAt: 'desc' }
      });
      res.json(people);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar pessoas' });
    }
  },

  async get(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const person = await prisma.person.findUnique({
        where: { id },
        include: {
          naturalPerson: true,
          legalPerson: { include: { representatives: true } },
          addresses: true,
          contacts: true
        }
      });
      if (!person) return res.status(404).json({ message: 'Pessoa não encontrada' });
      res.json(person);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar pessoa' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { type, naturalPerson, legalPerson, addresses, contacts } = req.body;
      console.log('Criando nova pessoa:', { type, naturalPerson, legalPerson });

      const person = await prisma.person.create({
        data: {
          type,
          naturalPerson: (type === 'F' && naturalPerson) ? { create: naturalPerson } : undefined,
          legalPerson: (type === 'J' && legalPerson) ? { 
            create: { 
              ...legalPerson, 
              representatives: { create: legalPerson?.representatives || [] } 
            } 
          } : undefined,
          addresses: (addresses && addresses.length > 0) ? { create: addresses } : undefined,
          contacts: (contacts && contacts.length > 0) ? { create: contacts } : undefined
        },
        include: {
          naturalPerson: true,
          legalPerson: { include: { representatives: true } },
          addresses: true,
          contacts: true
        }
      });
      res.status(201).json(person);
    } catch (error: any) {
      res.status(400).json({ error: 'Erro ao criar pessoa', details: error.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { type, naturalPerson, legalPerson, addresses, contacts } = req.body;

      // Deletar endereços e contatos antigos e recriar (estratégia simples)
      await prisma.address.deleteMany({ where: { personId: id } });
      await prisma.contact.deleteMany({ where: { personId: id } });

      const person = await prisma.person.update({
        where: { id },
        data: {
          type,
          naturalPerson: type === 'F' ? {
            upsert: {
              create: naturalPerson,
              update: naturalPerson
            }
          } : { delete: true },
          legalPerson: type === 'J' ? {
            upsert: {
              create: {
                ...legalPerson,
                representatives: { create: legalPerson?.representatives || [] }
              },
              update: {
                ...legalPerson,
                representatives: {
                  deleteMany: {},
                  create: legalPerson?.representatives || []
                }
              }
            }
          } : { delete: true },
          addresses: { create: addresses || [] },
          contacts: { create: contacts || [] }
        },
        include: {
          naturalPerson: true,
          legalPerson: { include: { representatives: true } },
          addresses: true,
          contacts: true
        }
      });
      res.json(person);
    } catch (error: any) {
      res.status(400).json({ error: 'Erro ao atualizar pessoa', details: error.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      // 1. Verificar se há Ordens de Serviço vinculadas
      const soCount = await prisma.serviceOrder.count({
        where: { personId: id }
      });

      if (soCount > 0) {
        return res.status(400).json({ 
          message: `Não é possível excluir: este cliente possui ${soCount} Ordens de Serviço vinculadas.` 
        });
      }

      // 2. Deletar dependências manuais
      await prisma.naturalPerson.deleteMany({ where: { personId: id } });
      await prisma.legalPerson.deleteMany({ where: { personId: id } });
      await prisma.address.deleteMany({ where: { personId: id } });
      await prisma.contact.deleteMany({ where: { personId: id } });
      
      await prisma.person.delete({ where: { id } });
      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ error: 'Erro ao excluir pessoa', details: error.message });
    }
  },
};
