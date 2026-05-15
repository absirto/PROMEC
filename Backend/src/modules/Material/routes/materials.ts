import { Router } from 'express';
import { MaterialController } from '../controllers/MaterialController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validateBody';
import { materialCreateSchema, materialUpdateSchema } from '../materialSchema';

const router = Router();

router.get('/', authenticateToken, requirePermission('materiais:visualizar'), MaterialController.list);
router.get('/:id', authenticateToken, requirePermission('materiais:visualizar'), MaterialController.get);
router.post('/', authenticateToken, requirePermission('materiais:gerenciar'), validateBody(materialCreateSchema), MaterialController.create);
router.put('/:id', authenticateToken, requirePermission('materiais:gerenciar'), validateBody(materialUpdateSchema), MaterialController.update);
router.delete('/:id', authenticateToken, requirePermission('materiais:gerenciar'), MaterialController.delete);

export default router;
