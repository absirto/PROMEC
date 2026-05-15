import { Router } from 'express';
import { GroupController } from '../controllers/GroupController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validateBody';
import { groupSchema } from '../groupSchema';

const router = Router();

router.get('/', authenticateToken, requirePermission('usuarios:gerenciar'), GroupController.list);
router.get('/permissions', authenticateToken, requirePermission('usuarios:gerenciar'), GroupController.listPermissions);
router.get('/:id', authenticateToken, requirePermission('usuarios:gerenciar'), GroupController.get);
router.post('/', authenticateToken, requirePermission('usuarios:gerenciar'), validateBody(groupSchema), GroupController.create);
router.put('/:id', authenticateToken, requirePermission('usuarios:gerenciar'), validateBody(groupSchema), GroupController.update);
router.delete('/:id', authenticateToken, requirePermission('usuarios:gerenciar'), GroupController.delete);

export default router;
