
import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { validateBody } from '../middleware/validation/validateBody';
import { userSchema } from '../middleware/validation/userSchema';

const router = Router();

router.get('/', authenticateToken, requirePermission('usuarios:gerenciar'), UserController.list);
router.get('/:id', authenticateToken, requirePermission('usuarios:gerenciar'), UserController.get);
router.post('/', authenticateToken, requirePermission('usuarios:gerenciar'), validateBody(userSchema), UserController.create);
router.put('/:id', authenticateToken, requirePermission('usuarios:gerenciar'), UserController.update);
router.delete('/:id', authenticateToken, requirePermission('usuarios:gerenciar'), UserController.delete);

export default router;
