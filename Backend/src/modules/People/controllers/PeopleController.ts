import { Request, Response } from 'express';
import prisma from '../../../core/prisma';
import { getPaginationParams, formatPaginatedResponse } from '../../../utils/pagination';
import { AuditService } from '../../Audit/services/AuditService';
import { AuthRequest } from '../../../middleware/auth';

function getActor(req: Request) {
  const authReq = req as AuthRequest;
  return {
    id: authReq.user?.id ? Number(authReq.user.id) : undefined,
    email: authReq.user?.email ? String(authReq.user.email) : undefined,
  };
}

export const PeopleController = {
  async list(req: Request, res: Response) {
    try {
      const pagination = getPaginationParams(req);
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const type = typeof req.query.type === 'string' ? req.query.type : undefined;

      const where: any = {};
      if (type) where.type = type;
      if (search) {
        where.OR = [
          { naturalPerson: { name: { contains: search, mode: 'insensitive' } } },
          { legalPerson: { corporateName: { contains: search, mode: 'insensitive' } } },
          { legalPerson: { tradeName: { contains: search, mode: 'insensitive' } } },
          { naturalPerson: { cpf: { contains: search } } },
          { legalPerson: { cnpj: { contains: search } } },
        ];
      }

      const [people, total] = await Promise.all([
        prisma.person.findMany({
          where,
          include: {
            naturalPerson: true,
            legalPerson: { include: { representatives: true } },
            addresses: true,
            contacts: true
          },
          orderBy: { updatedAt: 'desc' },
          skip: pagination.skip,
          take: pagination.limit,
        }),
        prisma.person.count({ where }),
      ]);

      res.json(formatPaginatedResponse(people, total, pagination));
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao listar pessoas' });
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
      if (!person) return res.status(404).json({ status: 'error', message: 'Pessoa não encontrada' });
      res.json(person);
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao buscar pessoa' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      const { type, naturalPerson, legalPerson, addresses, contacts } = req.body;
      
      const person = await prisma.person.create({
        data: {
          type,
          naturalPerson: naturalPerson ? { create: naturalPerson } : undefined,
          legalPerson: legalPerson ? {
            create: {
              ...legalPerson,
              representatives: { create: legalPerson.representatives || [] }
            }
          } : undefined,
          addresses: { create: addresses },
          contacts: { create: contacts }
        },
        include: { naturalPerson: true, legalPerson: { include: { representatives: true } }, addresses: true, contacts: true }
      });

      await AuditService.log({
        entity: 'Person',
        entityId: person.id,
        action: 'CREATE',
        userId: actor.id,
        userEmail: actor.email,
        newData: person,
      });

      res.status(201).json(person);
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: 'Erro ao criar pessoa', details: error.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const actor = getActor(req);
      const oldPerson = await prisma.person.findUnique({ 
        where: { id },
        include: { naturalPerson: true, legalPerson: { include: { representatives: true } }, addresses: true, contacts: true }
      });
      if (!oldPerson) return res.status(404).json({ status: 'error', message: 'Pessoa não encontrada' });

      const { type, naturalPerson, legalPerson, addresses, contacts } = req.body;
      
      const person = await prisma.person.update({
        where: { id },
        data: {
          type,
          naturalPerson: naturalPerson ? { update: naturalPerson } : undefined,
          legalPerson: legalPerson ? {
            update: {
              ...legalPerson,
              representatives: legalPerson.representatives ? {
                deleteMany: {},
                create: legalPerson.representatives
              } : undefined
            }
          } : undefined,
          addresses: addresses ? {
            deleteMany: {},
            create: addresses
          } : undefined,
          contacts: contacts ? {
            deleteMany: {},
            create: contacts
          } : undefined
        },
        include: { naturalPerson: true, legalPerson: { include: { representatives: true } }, addresses: true, contacts: true }
      });

      await AuditService.log({
        entity: 'Person',
        entityId: person.id,
        action: 'UPDATE',
        userId: actor.id,
        userEmail: actor.email,
        oldData: oldPerson,
        newData: person,
      });

      res.json(person);
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: 'Erro ao atualizar pessoa', details: error.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const actor = getActor(req);
      const oldPerson = await prisma.person.findUnique({ 
        where: { id },
        include: { naturalPerson: true, legalPerson: true }
      });
      if (!oldPerson) return res.status(404).json({ status: 'error', message: 'Pessoa não encontrada' });

      // 1. Verificar se há Ordens de Serviço vinculadas
      const soCount = await prisma.serviceOrder.count({
        where: { personId: id }
      });

      if (soCount > 0) {
        return res.status(400).json({ 
          status: 'error',
          message: `Não é possível excluir: este cliente possui ${soCount} Ordens de Serviço vinculadas.` 
        });
      }

      // 2. Verificar se é um funcionário cadastrado
      const employee = await prisma.employee.findUnique({
        where: { personId: id }
      });

      if (employee) {
        return res.status(400).json({
          status: 'error',
          message: 'Não é possível excluir: esta pessoa está cadastrada como funcionário. Exclua o registro de funcionário primeiro.'
        });
      }

      // 3. Verificar se há compras de estoque vinculadas (como fornecedor)
      const stockCount = await prisma.stockLog.count({
        where: { supplierPersonId: id }
      });

      if (stockCount > 0) {
        return res.status(400).json({
          status: 'error',
          message: `Não é possível excluir: este fornecedor possui ${stockCount} registro(s) de entrada de estoque.`
        });
      }

      // 4. Verificar se há cotações de compra vinculadas
      const quotationCount = await prisma.purchaseQuotation.count({
        where: { supplierPersonId: id }
      });

      if (quotationCount > 0) {
        return res.status(400).json({
          status: 'error',
          message: `Não é possível excluir: este fornecedor possui ${quotationCount} cotação(ões) de compra vinculada(s).`
        });
      }

      // 5. Deletar dependências manuais (detalhes da pessoa, endereços, contatos)
      await prisma.naturalPerson.deleteMany({ where: { personId: id } });
      await prisma.legalPerson.deleteMany({ where: { personId: id } });
      await prisma.address.deleteMany({ where: { personId: id } });
      await prisma.contact.deleteMany({ where: { personId: id } });
      
      await prisma.person.delete({ where: { id } });

      await AuditService.log({
        entity: 'Person',
        entityId: id,
        action: 'DELETE',
        userId: actor.id,
        userEmail: actor.email,
        oldData: oldPerson,
      });

      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: 'Erro ao excluir pessoa', details: error.message });
    }
  },
};
