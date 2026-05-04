import { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '../services/prisma';
import { addToQueue } from '../utils/queueHelper';

export const UserController = {
  async list(req: Request, res: Response) {
    const users = await prisma.user.findMany({
      select: { id: true, firstName: true, lastName: true, email: true, role: true, groupId: true },
    });
    res.json(users);
  },

  async get(req: Request, res: Response) {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, groupId: true },
    });
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.json(user);
  },

  async create(req: Request, res: Response) {
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
    });
    await addToQueue('user_created', { userId: user.id, email: user.email });
    res.status(201).json({ id: user.id, email: user.email });
  },

  async update(req: Request, res: Response) {
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
    const user = await prisma.user.update({ where: { id }, data });
    res.json({ id: user.id, email: user.email, firstName: user.firstName, groupId: user.groupId });
  },

  async delete(req: Request, res: Response) {
    const id = Number(req.params.id);
    await prisma.user.delete({ where: { id } });
    res.status(204).end();
  },
};
