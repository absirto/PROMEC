import { Request, Response } from 'express';
import prisma from '../../../core/prisma';
import { AuditService } from '../../Audit/services/AuditService';
import { AuthRequest } from '../../../middleware/auth';

function getActor(req: Request) {
  const authReq = req as AuthRequest;
  return {
    id: authReq.user?.id ? Number(authReq.user.id) : undefined,
    email: authReq.user?.email ? String(authReq.user.email) : undefined,
  };
}

const groupPermissionsInclude = {
  permissions: {
    include: {
      permission: true
    }
  }
};

export const GroupController = {
  async list(req: Request, res: Response) {
    const groups = await prisma.group.findMany({
      include: groupPermissionsInclude
    });
    // Formata para o frontend esperar strings simples de permissão se necessário
    const formattedGroups = groups.map(g => ({
      ...g,
      permissionKeys: g.permissions.map(gp => gp.permission.name)
    }));
    res.json(formattedGroups);
  },

  async get(req: Request, res: Response) {
    const id = Number(req.params.id);
    const group = await prisma.group.findUnique({
      where: { id },
      include: groupPermissionsInclude
    });
    if (!group) return res.status(404).json({ message: 'Grupo não encontrado' });
    res.json(group);
  },

  async create(req: Request, res: Response) {
    const actor = getActor(req);
    const { name, permissionKeys } = req.body;

    const group = await prisma.group.create({
      data: {
        name,
        permissions: {
          create: permissionKeys.map((key: string) => ({
            permission: {
              connect: { name: key }
            }
          }))
        }
      },
      include: groupPermissionsInclude
    });

    await AuditService.log({
      entity: 'Group',
      entityId: group.id,
      action: 'CREATE',
      userId: actor.id,
      userEmail: actor.email,
      newData: group,
    });

    res.status(201).json(group);
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const actor = getActor(req);

      const oldGroup = await prisma.group.findUnique({ where: { id }, include: groupPermissionsInclude });
      if (!oldGroup) {
        return res.status(404).json({ message: 'Grupo não encontrado' });
      }

      const { name, permissionKeys } = req.body;

      // Primeiro remove todas as permissões antigas
      await prisma.groupPermission.deleteMany({
        where: { groupId: id }
      });

      const group = await prisma.group.update({
        where: { id },
        data: {
          name,
          permissions: {
            create: permissionKeys.map((key: string) => ({
              permission: {
                connect: { name: key }
              }
            }))
          }
        },
        include: groupPermissionsInclude
      });

      await AuditService.log({
        entity: 'Group',
        entityId: group.id,
        action: 'UPDATE',
        userId: actor.id,
        userEmail: actor.email,
        oldData: oldGroup,
        newData: group,
      });

      res.json(group);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao atualizar grupo', error: error.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const actor = getActor(req);

      const oldGroup = await prisma.group.findUnique({ where: { id }, include: groupPermissionsInclude });
      if (!oldGroup) {
        return res.status(404).json({ message: 'Grupo não encontrado' });
      }

      // 1. Verificar se há usuários vinculados
      const userCount = await prisma.user.count({
        where: { groupId: id }
      });

      if (userCount > 0) {
        return res.status(400).json({
          message: `Não é possível excluir: existem ${userCount} usuário(s) vinculado(s) a este grupo.`
        });
      }

      // 2. Remover permissões vinculadas
      await prisma.groupPermission.deleteMany({
        where: { groupId: id }
      });

      // 3. Deletar o grupo
      await prisma.group.delete({ where: { id } });

      await AuditService.log({
        entity: 'Group',
        entityId: id,
        action: 'DELETE',
        userId: actor.id,
        userEmail: actor.email,
        oldData: oldGroup,
      });

      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao deletar grupo', error: error.message });
    }
  },

  async listPermissions(req: Request, res: Response) {
    const permissions = await prisma.permission.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(permissions);
  }
};
