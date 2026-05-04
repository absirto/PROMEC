import { Router } from 'express';
import { ServiceOrderController } from '../controllers/ServiceOrderController';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.list);
router.post('/materials/check', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.checkMaterialsCoverage);
router.get('/pcp/overview', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.pcpOverview);
router.get('/pcp/calendar', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.pcpCalendar);
router.get('/operations/efficiency', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.operationsEfficiency);
router.get('/:id/operations', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.listOperations);
router.get('/:id', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.get);
router.post('/', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.create);
router.post('/:id/operations', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.addOperation);
router.patch('/plan/batch', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.updatePlanBatch);
router.patch('/:id/plan', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.updatePlan);
router.put('/:id', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.update);
router.delete('/:id', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.delete);
router.post('/purchase-requests', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.createPurchaseRequest);

export default router;
