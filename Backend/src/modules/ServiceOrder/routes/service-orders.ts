import { Router } from 'express';
import { ServiceOrderController } from '../controllers/ServiceOrderController';
import { PurchaseController } from '../controllers/PurchaseController';
import { PCPController } from '../controllers/PCPController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';

import { validateBody } from '../../../middleware/validateBody';
import { serviceOrderCreateSchema, serviceOrderUpdateSchema } from '../serviceOrderSchema';

const router = Router();
const ensureNumericId = (req: any, _res: any, next: any) => (/^\d+$/.test(String(req.params.id)) ? next() : next('route'));

router.get('/', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.list);

// PCP Endpoints
router.post('/materials/check', authenticateToken, requirePermission('os:visualizar'), PCPController.checkMaterialsCoverage);
router.get('/pcp/overview', authenticateToken, requirePermission('os:visualizar'), PCPController.pcpOverview);
router.get('/pcp/calendar', authenticateToken, requirePermission('os:visualizar'), PCPController.pcpCalendar);
router.get('/operations/efficiency', authenticateToken, requirePermission('os:visualizar'), PCPController.operationsEfficiency);

// Purchase Endpoints
router.post('/purchase-requests', authenticateToken, requirePermission('os:gerenciar'), PurchaseController.createPurchaseRequest);
router.get('/purchase-requests', authenticateToken, requirePermission('os:visualizar'), PurchaseController.listPurchaseRequests);
router.post('/purchase-requests/:id/fulfill', authenticateToken, requirePermission('os:gerenciar'), PurchaseController.fulfillPurchaseRequest);
router.post('/purchase-quotations', authenticateToken, requirePermission('os:gerenciar'), PurchaseController.createPurchaseQuotation);
router.get('/purchase-quotations', authenticateToken, requirePermission('os:visualizar'), PurchaseController.listPurchaseQuotations);
router.post('/purchase-quotations/:id/approve', authenticateToken, requirePermission('os:gerenciar'), PurchaseController.approvePurchaseQuotation);
router.get('/purchase-quotations/:id/pdf', authenticateToken, requirePermission('os:visualizar'), PurchaseController.getPurchaseQuotationPDF);

// Service Order Endpoints
router.get('/:id/operations', ensureNumericId, authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.listOperations);
router.get('/:id/pdf', ensureNumericId, authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.getServiceOrderPDF);
router.get('/:id', ensureNumericId, authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.get);
router.post('/', authenticateToken, requirePermission('os:gerenciar'), validateBody(serviceOrderCreateSchema), ServiceOrderController.create);
router.post('/:id/operations', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.addOperation);
router.patch('/plan/batch', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.updatePlanBatch);
router.patch('/:id/plan', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.updatePlan);
router.put('/:id', authenticateToken, requirePermission('os:gerenciar'), validateBody(serviceOrderUpdateSchema), ServiceOrderController.update);
router.delete('/:id', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.delete);

export default router;
