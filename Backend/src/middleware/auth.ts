import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/security';
import prisma from '../core/prisma';
import { expandPermissions } from '../utils/permissions';

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


export function checkPermission(userPermissions: string[], required: string): boolean {
  if (userPermissions.includes(required)) return true;

  // Se o requisito é apenas visualizar, mas ele pode gerenciar, libera.
  if (required.endsWith(':visualizar')) {
    const manageKey = required.replace(':visualizar', ':gerenciar');
    if (userPermissions.includes(manageKey)) return true;
  }

  // Permissão curinga (futuro)
  const [module] = required.split(':');
  if (userPermissions.includes(`${module}:*`)) return true;

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
        authUser.permissions = expandPermissions(names);
      } else {
        authUser.permissions = [];
      }

      // Override de Admin Global
      if (dbUser?.role === 'admin') {
        authUser.role = 'admin';
        authUser.permissions = expandPermissions(['admin']);
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
    if (role === 'admin') return next(); // Admin passa em tudo

    if (!role || !roles.includes(role)) {
      return res.status(403).json({ message: 'Acesso restrito (Role)' });
    }
    next();
  };
}

export function requirePermission(...permissions: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'Não autenticado' });

    // Admin global sempre tem acesso
    if (req.user.role === 'admin') return next();

    const userPermissions = req.user.permissions || [];
    const allowed = permissions.some((p) => checkPermission(userPermissions, p));

    if (!allowed) {
      return res.status(403).json({
        message: 'Permissão insuficiente',
        required: permissions
      });
    }
    next();
  };
}
