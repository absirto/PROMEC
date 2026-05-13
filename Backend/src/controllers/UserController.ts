import { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '../services/prisma';
import { addToQueue } from '../utils/queueHelper';

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  groupId: true,
  group: {
    select: {
      id: true,
      name: true,
      description: true,
    },
  },
} satisfies Prisma.UserSelect;

export const UserController = {
  async list(req: Request, res: Response) {
    try {
      const users = await prisma.user.findMany({
        select: userSelect,
      });
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao listar usuários', error: error.message });
    }
  },

  async get(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const user = await prisma.user.findUnique({
        where: { id },
        select: userSelect,
      });
      if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao buscar usuário', error: error.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { firstName, lastName, email, password, role, groupId } = req.body;
      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) return res.status(400).json({ message: 'Email já cadastrado' });
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          firstName,
          lastName,
          email,
          password: hashedPassword,
          role: role || 'user',
          groupId: Number(groupId),
        },
        select: userSelect,
      });
      await addToQueue('user_created', { userId: user.id, email: user.email });
      res.status(201).json(user);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao criar usuário', error: error.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { firstName, lastName, email, role, groupId, password } = req.body;
      const data: Prisma.UserUpdateInput = {};
      if (firstName !== undefined) data.firstName = firstName;
      if (lastName !== undefined) data.lastName = lastName;
      if (email !== undefined) data.email = email;
      if (role !== undefined) data.role = role;
      if (groupId !== undefined) data.group = { connect: { id: Number(groupId) } };
      if (password && String(password).length > 0) {
        data.password = await bcrypt.hash(String(password), 10);
      }
      const user = await prisma.user.update({ where: { id }, data, select: userSelect });
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao atualizar usuário', error: error.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      // 1. Verificar se é um funcionário
      const employee = await prisma.employee.findUnique({
        where: { userId: id }
      });
      if (employee) {
        return res.status(400).json({ 
          message: 'Não é possível excluir: este usuário está vinculado a um registro de funcionário.' 
        });
      }

      // 2. Verificar se gerou relatórios
      const reportCount = await prisma.reportEmission.count({
        where: { generatedByUserId: id }
      });
      if (reportCount > 0) {
        return res.status(400).json({ 
          message: `Não é possível excluir: este usuário gerou ${reportCount} relatório(s) no sistema.` 
        });
      }

      // 3. Verificar se há rastros de OS
      const traceCount = await prisma.serviceOrderTrace.count({
        where: { changedByUserId: id }
      });
      if (traceCount > 0) {
        return res.status(400).json({ 
          message: `Não é possível excluir: este usuário possui ${traceCount} registro(s) de alteração em Ordens de Serviço.` 
        });
      }

      await prisma.user.delete({ where: { id } });
      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao excluir usuário', error: error.message });
    }
  },
};
