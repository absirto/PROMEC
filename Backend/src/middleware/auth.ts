import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/security';
import prisma from '../services/prisma';

export interface AuthRequest extends Request {
  user?: {
    id?: number;
    role?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    permissions?: string[];
    [key: string]: unknown;
  };
}

function expandLegacyPermissions(permissionNames: string[]): string[] {
  const set = new Set(permissionNames);
  const expanded = new Set(permissionNames);

  if (set.has('admin')) {
    expanded.add('usuarios:gerenciar');
    expanded.add('configuracoes:gerenciar');
    expanded.add('dashboard:visualizar');
    expanded.add('relatorios:visualizar');
    expanded.add('financeiro:visualizar');
    expanded.add('financeiro:gerenciar');
    expanded.add('estoque:visualizar');
    expanded.add('estoque:gerenciar');
    expanded.add('materiais:visualizar');
    expanded.add('materiais:gerenciar');
    expanded.add('pessoas:visualizar');
    expanded.add('pessoas:gerenciar');
    expanded.add('funcionarios:visualizar');
    expanded.add('funcionarios:gerenciar');
    expanded.add('os:visualizar');
    expanded.add('os:gerenciar');
    expanded.add('qualidade:visualizar');
    expanded.add('qualidade:gerenciar');
    expanded.add('auxiliares');
  }
  if (set.has('cadastro')) {
    expanded.add('pessoas:visualizar');
    expanded.add('pessoas:gerenciar');
    expanded.add('funcionarios:visualizar');
    expanded.add('funcionarios:gerenciar');
  }
  if (set.has('operacao')) {
    expanded.add('os:visualizar');
    expanded.add('os:gerenciar');
    expanded.add('qualidade:visualizar');
    expanded.add('qualidade:gerenciar');
    expanded.add('dashboard:visualizar');
  }
  if (set.has('auxiliares')) {
    expanded.add('materiais:visualizar');
    expanded.add('materiais:gerenciar');
    expanded.add('estoque:visualizar');
  }

  // "gerenciar" implica "visualizar" para a mesma chave base
  for (const p of Array.from(expanded)) {
    if (p.endsWith(':gerenciar')) {
      expanded.add(p.replace(':gerenciar', ':visualizar'));
    }
  }

  return Array.from(expanded);
}

function hasPermission(userPermissions: string[], required: string): boolean {
  if (userPermissions.includes(required)) return true;
  if (required.endsWith(':visualizar')) {
    const manageKey = required.replace(':visualizar', ':gerenciar');
    if (userPermissions.includes(manageKey)) return true;
  }
  return false;
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token não fornecido' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthRequest['user'];
    const authUser = { ...(decoded || {}) };

    if (authUser.id) {
      const dbUser = await prisma.user.findUnique({
        where: { id: Number(authUser.id) },
        include: {
          group: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      });

      if (dbUser?.group?.permissions) {
        const names = dbUser.group.permissions.map((gp) => gp.permission.name);
        authUser.permissions = expandLegacyPermissions(names);
      }
      if (dbUser?.firstName) authUser.firstName = dbUser.firstName;
      if (dbUser?.lastName) authUser.lastName = dbUser.lastName;
      if (dbUser?.email) authUser.email = dbUser.email;
    }

    req.user = authUser;
    next();
  } catch {
    return res.status(403).json({ message: 'Token inválido' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ message: 'Acesso restrito' });
    }
    next();
  };
}

export function requirePermission(...permissions: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'Não autenticado' });
    if (req.user.role === 'admin') return next();

    const userPermissions = req.user.permissions || [];
    const allowed = permissions.some((p) => hasPermission(userPermissions, p));
    if (!allowed) {
      return res.status(403).json({ message: 'Permissão insuficiente' });
    }
    next();
  };
}
