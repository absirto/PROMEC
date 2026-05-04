import { Router } from 'express';
import { FinanceController } from '../controllers/FinanceController';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { validateBody } from '../middleware/validation/validateBody';
import { financeSchema } from '../middleware/validation/financeSchema';

const router = Router();
router.get('/', authenticateToken, requirePermission('financeiro:visualizar'), FinanceController.list);
router.get('/summary', authenticateToken, requirePermission('financeiro:visualizar'), FinanceController.getSummary);
router.post('/', authenticateToken, requirePermission('financeiro:gerenciar'), validateBody(financeSchema), FinanceController.create);

export default router;
