import { Router } from 'express';
import { ServiceOrderController } from '../controllers/ServiceOrderController';
import { authenticateToken, requirePermission } from '../middleware/auth';

import { validateBody } from '../middleware/validation/validateBody';
import { serviceOrderCreateSchema, serviceOrderUpdateSchema } from '../middleware/validation/serviceOrderSchema';

const router = Router();
const ensureNumericId = (req: any, _res: any, next: any) => (/^\d+$/.test(String(req.params.id)) ? next() : next('route'));

router.get('/', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.list);
router.post('/materials/check', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.checkMaterialsCoverage);
router.get('/pcp/overview', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.pcpOverview);
router.get('/pcp/calendar', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.pcpCalendar);
router.get('/operations/efficiency', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.operationsEfficiency);
router.post('/purchase-requests', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.createPurchaseRequest);
router.get('/purchase-requests', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.listPurchaseRequests);
router.post('/purchase-requests/:id/fulfill', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.fulfillPurchaseRequest);
router.post('/purchase-quotations', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.createPurchaseQuotation);
router.get('/purchase-quotations', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.listPurchaseQuotations);
router.post('/purchase-quotations/:id/approve', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.approvePurchaseQuotation);
router.get('/purchase-quotations/:id/pdf', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.getPurchaseQuotationPDF);
router.get('/:id/operations', ensureNumericId, authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.listOperations);
router.get('/:id', ensureNumericId, authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.get);
router.post('/', authenticateToken, requirePermission('os:gerenciar'), validateBody(serviceOrderCreateSchema), ServiceOrderController.create);
router.post('/:id/operations', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.addOperation);
router.patch('/plan/batch', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.updatePlanBatch);
router.patch('/:id/plan', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.updatePlan);
router.put('/:id', authenticateToken, requirePermission('os:gerenciar'), validateBody(serviceOrderUpdateSchema), ServiceOrderController.update);
router.delete('/:id', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.delete);

export default router;
