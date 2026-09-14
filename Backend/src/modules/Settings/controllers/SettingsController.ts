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

export class SettingsController {
  static async get(req: Request, res: Response) {
    try {
      let settings = await prisma.settings.findFirst();
      if (!settings) {
        // Bootstrap automático do singleton, não é uma ação do usuário: não gera log de auditoria.
        settings = await prisma.settings.create({
          data: { id: 1, companyName: 'ProMEC' }
        });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar configurações.' });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      const data = req.body;
      const oldSettings = await prisma.settings.findUnique({ where: { id: 1 } });
      const settings = await prisma.settings.upsert({
        where: { id: 1 },
        update: data,
        create: { id: 1, ...data }
      });

      await AuditService.log({
        entity: 'Settings',
        entityId: settings.id,
        action: oldSettings ? 'UPDATE' : 'CREATE',
        userId: actor.id,
        userEmail: actor.email,
        oldData: oldSettings || undefined,
        newData: settings,
      });

      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar configurações.' });
    }
  }

  static async uploadLogo(req: Request, res: Response) {
    try {
      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
      }
      const logoUrl = `/uploads/public/logo/${file.filename}`;
      res.status(201).json({ logoUrl });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao fazer upload do logotipo.' });
    }
  }
}
