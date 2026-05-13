import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();

router.get('/stats', authenticateToken, requirePermission('dashboard:visualizar'), DashboardController.getStats);
router.get('/audit-logs', authenticateToken, requirePermission('dashboard:visualizar'), DashboardController.getAuditLogs);

export default router;
