import { Router } from 'express';
import { authenticateToken } from '../../../middleware/auth';
import prisma from '../../../core/prisma';

const router = Router();

// Listar notificações do usuário
router.get('/', authenticateToken, async (req: any, res) => {
  const userId = req.user?.id;
  const notifications = await (prisma as any).notification.findMany({
    where: {
      OR: [
        { userId },
        { userId: null }
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 30
  });
  res.json(notifications);
});

// Marcar como lida
router.put('/:id/read', authenticateToken, async (req, res) => {
  const { id } = req.params;
  await (prisma as any).notification.update({
    where: { id: Number(id) },
    data: { read: true }
  });
  res.sendStatus(200);
});

// Marcar todas como lidas
router.put('/read-all', authenticateToken, async (req: any, res) => {
  const userId = req.user?.id;
  await (prisma as any).notification.updateMany({
    where: { userId, read: false },
    data: { read: true }
  });
  res.sendStatus(200);
});

export default router;
