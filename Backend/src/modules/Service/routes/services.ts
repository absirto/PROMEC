import { Router } from 'express';
import { ServiceController } from '../controllers/ServiceController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validateBody';
import { serviceSchema } from '../serviceSchema';

const router = Router();

router.get('/', authenticateToken, requirePermission('auxiliares'), ServiceController.list);
router.get('/:id', authenticateToken, requirePermission('auxiliares'), ServiceController.get);
router.post('/', authenticateToken, requirePermission('auxiliares'), validateBody(serviceSchema), ServiceController.create);
router.put('/:id', authenticateToken, requirePermission('auxiliares'), validateBody(serviceSchema), ServiceController.update);
router.delete('/:id', authenticateToken, requirePermission('auxiliares'), ServiceController.delete);

export default router;
