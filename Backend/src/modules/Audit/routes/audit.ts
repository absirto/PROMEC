import { Router } from 'express';
import { authenticateToken } from '../../../middleware/auth';
import prisma from '../../../core/prisma';

const router = Router();

// Buscar logs de auditoria de uma entidade específica
router.get('/:entity/:entityId', authenticateToken, async (req, res) => {
  const { entity, entityId } = req.params;
  
  const logs = await prisma.auditLog.findMany({
    where: {
      entity: String(entity),
      entityId: Number(entityId)
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  res.json(logs);
});

export default router;
