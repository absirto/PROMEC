import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../services/prisma';
import { JWT_SECRET } from '../config/security';

export const AuthController = {
  async login(req: Request, res: Response) {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        group: {
          include: {
            permissions: {
              include: { permission: true }
            }
          }
        }
      }
    });
    // Mensagem genérica para prevenir user enumeration (OWASP A07)
    const invalidMsg = { message: 'E-mail ou senha inválidos' };
    if (!user) return res.status(401).json(invalidMsg);
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json(invalidMsg);
    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
    // Monta lista de permissões do grupo
    const group = user.group ? {
      id: user.group.id,
      name: user.group.name,
      description: user.group.description,
      permissions: user.group.permissions.map(gp => gp.permission.name)
    } : null;
    return res.json({
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        email: user.email,
        group
      }
    });
  },

  async register(req: Request, res: Response) {
    const { firstName, lastName, email, password } = req.body;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ message: 'Email já cadastrado' });
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { firstName, lastName, email, password: hash, role: 'user' },
    });
    return res.status(201).json({ id: user.id, email: user.email });
  },

  async me(req: any, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Não autenticado' });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
    return res.json({ id: user.id, firstName: user.firstName, role: user.role, email: user.email });
  },
};
