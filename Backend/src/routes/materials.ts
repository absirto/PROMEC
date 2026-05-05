import { Router } from 'express';
import { MaterialController } from '../controllers/MaterialController';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { validateBody } from '../middleware/validation/validateBody';
import { materialSchema } from '../middleware/validation/materialSchema';

const router = Router();

router.get('/', authenticateToken, requirePermission('materiais:visualizar'), MaterialController.list);
router.get('/:id', authenticateToken, requirePermission('materiais:visualizar'), MaterialController.get);
router.post('/', authenticateToken, requirePermission('materiais:gerenciar'), validateBody(materialSchema), MaterialController.create);
router.put('/:id', authenticateToken, requirePermission('materiais:gerenciar'), validateBody(materialSchema), MaterialController.update);
router.delete('/:id', authenticateToken, requirePermission('materiais:gerenciar'), MaterialController.delete);

export default router;
