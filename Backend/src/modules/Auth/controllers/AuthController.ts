import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../../core/prisma';
import { JWT_SECRET } from '../../../config/security';
import { expandPermissions } from '../../../utils/permissions';

/** Opções padrão para o cookie de autenticação */
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 8 * 60 * 60 * 1000, // 8 horas (mesmo tempo do JWT)
};

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

    // Setar o JWT em um Cookie HttpOnly seguro
    res.cookie('token', token, COOKIE_OPTIONS);

    // Monta lista de permissões do grupo de forma segura
    const group = user.group ? {
      id: user.group.id,
      name: user.group.name,
      description: user.group.description,
      permissions: expandPermissions(user.group.permissions.map(gp => gp.permission.name))
    } : { id: 0, name: 'Sem Grupo', permissions: user.role === 'admin' ? expandPermissions(['admin']) : [] };
    return res.json({
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

  async logout(_req: Request, res: Response) {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
    });
    return res.json({ message: 'Logout realizado com sucesso' });
  },
};
