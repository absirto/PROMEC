import { Router } from 'express';
import { WorkAreaController } from '../controllers/WorkAreaController';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { validateBody } from '../middleware/validation/validateBody';
import { workAreaSchema } from '../middleware/validation/workAreaSchema';

const router = Router();

router.get('/', authenticateToken, requirePermission('auxiliares'), WorkAreaController.list);
router.get('/:id', authenticateToken, requirePermission('auxiliares'), WorkAreaController.get);
router.post('/', authenticateToken, requirePermission('auxiliares'), validateBody(workAreaSchema), WorkAreaController.create);
router.put('/:id', authenticateToken, requirePermission('auxiliares'), validateBody(workAreaSchema), WorkAreaController.update);
router.delete('/:id', authenticateToken, requirePermission('auxiliares'), WorkAreaController.delete);

export default router;
