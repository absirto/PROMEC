import { Router } from 'express';
import { ServiceOrderController } from '../controllers/ServiceOrderController';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.list);
router.get('/pcp/overview', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.pcpOverview);
router.get('/:id', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.get);
router.post('/', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.create);
router.patch('/plan/batch', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.updatePlanBatch);
router.patch('/:id/plan', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.updatePlan);
router.put('/:id', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.update);
router.delete('/:id', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.delete);

export default router;
