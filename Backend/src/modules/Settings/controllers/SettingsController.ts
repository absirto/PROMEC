import { Request, Response } from 'express';
import prisma from '../../../core/prisma';

export class SettingsController {
  static async get(req: Request, res: Response) {
    try {
      let settings = await prisma.settings.findFirst();
      if (!settings) {
        // Cria um registro padrão se não existir
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
      const data = req.body;
      const settings = await prisma.settings.upsert({
        where: { id: 1 },
        update: data,
        create: { id: 1, ...data }
      });
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar configurações.' });
    }
  }
}
