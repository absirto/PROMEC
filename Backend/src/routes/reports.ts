import { Router } from 'express';
import { ReportsController } from '../controllers/ReportsController';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();

// Relatórios Operacionais
router.get('/operational/service-orders', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.operationalServiceOrders);
router.get('/operational/service-orders/pdf', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.operationalServiceOrdersPDF);
router.get('/operational/purchases', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.operationalPurchases);
router.get('/operational/purchases/pdf', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.operationalPurchasesPDF);
router.get('/operational/stock-movements', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.operationalStockMovements);
router.get('/operational/stock-movements/pdf', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.operationalStockMovementsPDF);
router.get('/operational/production', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.operationalProduction);

// Relatórios Administrativos
router.get('/admin/financial-flow', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.adminFinancialFlow);
router.get('/admin/financial-flow/pdf', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.adminFinancialFlowPDF);
router.get('/admin/accounts', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.adminAccounts);
router.get('/admin/accounts/pdf', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.adminAccountsPDF);
router.get('/admin/team-performance', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.adminTeamPerformance);
router.get('/admin/team-performance/pdf', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.adminTeamPerformancePDF);
router.get('/admin/users-summary', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.adminUsersSummary);
router.get('/admin/users-summary/pdf', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.adminUsersSummaryPDF);
router.get('/admin/profitability', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.adminProfitability);

export default router;
