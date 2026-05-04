import { Router } from 'express';
import { StockController } from '../controllers/StockController';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { validateBody } from '../middleware/validation/validateBody';
import { stockSchema } from '../middleware/validation/stockSchema';

const router = Router();
router.get('/', authenticateToken, requirePermission('estoque:visualizar'), StockController.list);
router.get('/purchases', authenticateToken, requirePermission('estoque:visualizar'), StockController.purchaseHistory);
router.post('/', authenticateToken, requirePermission('estoque:gerenciar'), validateBody(stockSchema), StockController.create);

export default router;
