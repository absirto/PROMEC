import { Router } from 'express';
import { JobRoleController } from '../controllers/JobRoleController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validateBody';
import { jobRoleSchema } from '../jobRoleSchema';

const router = Router();

router.get('/', authenticateToken, requirePermission('auxiliares'), JobRoleController.list);
router.get('/:id', authenticateToken, requirePermission('auxiliares'), JobRoleController.get);
router.post('/', authenticateToken, requirePermission('auxiliares'), validateBody(jobRoleSchema), JobRoleController.create);
router.put('/:id', authenticateToken, requirePermission('auxiliares'), validateBody(jobRoleSchema), JobRoleController.update);
router.delete('/:id', authenticateToken, requirePermission('auxiliares'), JobRoleController.delete);

export default router;
