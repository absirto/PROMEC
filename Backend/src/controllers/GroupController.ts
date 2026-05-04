import { Request, Response } from 'express';
import prisma from '../services/prisma';

export const GroupController = {
  async list(req: Request, res: Response) {
    const groups = await prisma.group.findMany({
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
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
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });
    if (!group) return res.status(404).json({ message: 'Grupo não encontrado' });
    res.json(group);
  },

  async create(req: Request, res: Response) {
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
      }
    });
    res.status(201).json(group);
  },

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
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
      }
    });
    res.json(group);
  },

  async delete(req: Request, res: Response) {
    const id = Number(req.params.id);

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
    
    res.status(204).end();
  },

  async listPermissions(req: Request, res: Response) {
    const permissions = await prisma.permission.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(permissions);
  }
};
