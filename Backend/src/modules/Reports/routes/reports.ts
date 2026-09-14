import { Router } from 'express';
import { ReportsController } from '../controllers/ReportsController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ReportEmission:
 *       type: object
 *       description: Registro de emissão/exportação de um relatório (auditoria de geração).
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         reportKey:
 *           type: string
 *           description: Identificador do relatório emitido (ex. "purchases").
 *           example: purchases
 *         exportFormat:
 *           type: string
 *           example: PDF
 *         fileName:
 *           type: string
 *           nullable: true
 *           example: relatorio_compras.pdf
 *         fileHash:
 *           type: string
 *           nullable: true
 *           description: SHA-256 do arquivo gerado, quando registrado pelo endpoint de PDF correspondente.
 *           example: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a0
 *         filters:
 *           type: object
 *           nullable: true
 *           description: Filtros usados para gerar o relatório (JSON livre, definido por quem registra a emissão).
 *           additionalProperties: true
 *         generatedByUserId:
 *           type: integer
 *           nullable: true
 *         generatedByEmail:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         generatedBy:
 *           type: object
 *           nullable: true
 *           description: Usuário que gerou a emissão (subconjunto id/firstName/lastName/email).
 *           properties:
 *             id:
 *               type: integer
 *             firstName:
 *               type: string
 *             lastName:
 *               type: string
 *             email:
 *               type: string
 *               format: email
 *         generatedByName:
 *           type: string
 *           description: Nome completo calculado a partir de generatedBy, ou generatedByEmail quando não há usuário resolvido.
 *           example: Maria Silva
 *       required:
 *         - id
 *         - reportKey
 *         - exportFormat
 *         - createdAt
 *     ReportEmissionInput:
 *       type: object
 *       description: Corpo usado para registrar manualmente uma emissão de relatório no histórico.
 *       properties:
 *         reportKey:
 *           type: string
 *           example: purchases
 *         exportFormat:
 *           type: string
 *           example: PDF
 *         fileName:
 *           type: string
 *           nullable: true
 *         fileHash:
 *           type: string
 *           nullable: true
 *         filters:
 *           type: object
 *           nullable: true
 *           additionalProperties: true
 *       required:
 *         - reportKey
 *         - exportFormat
 *     ReportServiceOrdersByStatusItem:
 *       type: object
 *       description: Quantidade de ordens de serviço agrupadas por status (prisma groupBy).
 *       properties:
 *         status:
 *           type: string
 *           example: Concluída
 *         _count:
 *           type: object
 *           properties:
 *             _all:
 *               type: integer
 *               example: 12
 *     ReportMaterialSummary:
 *       type: object
 *       description: Material (dump completo do model, sem filtragem de campos).
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         price:
 *           type: number
 *         unit:
 *           type: string
 *         active:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     ReportSupplierPersonSummary:
 *       type: object
 *       description: Fornecedor (Person) vinculado a uma entrada de estoque.
 *       properties:
 *         id:
 *           type: integer
 *         type:
 *           type: string
 *           example: LEGAL
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         naturalPerson:
 *           type: object
 *           nullable: true
 *           properties:
 *             name:
 *               type: string
 *         legalPerson:
 *           type: object
 *           nullable: true
 *           properties:
 *             corporateName:
 *               type: string
 *     ReportPurchaseRequestItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         purchaseRequestId:
 *           type: integer
 *         materialId:
 *           type: integer
 *         requestedQty:
 *           type: number
 *         stockQty:
 *           type: number
 *         shortageQty:
 *           type: number
 *         unit:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *           example: PENDING
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         material:
 *           type: object
 *           description: Subconjunto do material (id, name, unit, price).
 *           properties:
 *             id:
 *               type: integer
 *             name:
 *               type: string
 *             unit:
 *               type: string
 *             price:
 *               type: number
 *     ReportPurchaseRequestSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         code:
 *           type: string
 *         serviceOrderId:
 *           type: integer
 *           nullable: true
 *         status:
 *           type: string
 *           example: OPEN
 *         notes:
 *           type: string
 *           nullable: true
 *         requestedByEmail:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         serviceOrder:
 *           type: object
 *           nullable: true
 *           description: Subconjunto da ordem de serviço vinculada (id, traceCode, description).
 *           properties:
 *             id:
 *               type: integer
 *             traceCode:
 *               type: string
 *               nullable: true
 *             description:
 *               type: string
 *               nullable: true
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ReportPurchaseRequestItem'
 *     ReportStockPurchaseHistoryItem:
 *       type: object
 *       description: >
 *         Entrada de estoque (StockLog do tipo IN, com custo unitário informado) usada como
 *         histórico de compras. supplierPerson e supplierName são nulos quando a entrada não
 *         tem fornecedor vinculado.
 *       properties:
 *         id:
 *           type: integer
 *         materialId:
 *           type: integer
 *         quantity:
 *           type: number
 *         type:
 *           type: string
 *           example: IN
 *         description:
 *           type: string
 *           nullable: true
 *         supplierPersonId:
 *           type: integer
 *           nullable: true
 *         unitCost:
 *           type: number
 *           nullable: true
 *         totalPaid:
 *           type: number
 *           nullable: true
 *         remainingQty:
 *           type: number
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         material:
 *           $ref: '#/components/schemas/ReportMaterialSummary'
 *         supplierPerson:
 *           $ref: '#/components/schemas/ReportSupplierPersonSummary'
 *         supplierName:
 *           type: string
 *           nullable: true
 *           example: Fornecedor Exemplo LTDA
 *     ReportPurchasesResponse:
 *       type: object
 *       properties:
 *         purchaseRequests:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ReportPurchaseRequestSummary'
 *         purchaseHistory:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ReportStockPurchaseHistoryItem'
 *     ReportStockMovementLogItem:
 *       type: object
 *       description: Movimentação de estoque (StockLog) com o material relacionado.
 *       properties:
 *         id:
 *           type: integer
 *         materialId:
 *           type: integer
 *         quantity:
 *           type: number
 *         type:
 *           type: string
 *           example: OUT
 *         description:
 *           type: string
 *           nullable: true
 *         supplierPersonId:
 *           type: integer
 *           nullable: true
 *         unitCost:
 *           type: number
 *           nullable: true
 *         totalPaid:
 *           type: number
 *           nullable: true
 *         remainingQty:
 *           type: number
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         material:
 *           $ref: '#/components/schemas/ReportMaterialSummary'
 *     ReportOperationalProductionEntry:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         employeeId:
 *           type: integer
 *           nullable: true
 *         employeeName:
 *           type: string
 *           example: João Souza
 *         workAreaName:
 *           type: string
 *           example: Usinagem
 *         jobRoleName:
 *           type: string
 *           example: Técnico Mecânico
 *         serviceName:
 *           type: string
 *         serviceDescription:
 *           type: string
 *           nullable: true
 *         serviceOrderId:
 *           type: integer
 *           nullable: true
 *         serviceOrderCode:
 *           type: string
 *           nullable: true
 *         serviceOrderDescription:
 *           type: string
 *           nullable: true
 *         serviceOrderStatus:
 *           type: string
 *           nullable: true
 *         openingDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         hoursWorked:
 *           type: number
 *         unitPrice:
 *           type: number
 *         totalPrice:
 *           type: number
 *     ReportQualityControlEntry:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         inspectionDate:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *         finalVerdict:
 *           type: string
 *           nullable: true
 *         serviceOrderId:
 *           type: integer
 *           nullable: true
 *         serviceOrderCode:
 *           type: string
 *           nullable: true
 *         serviceOrderDescription:
 *           type: string
 *           nullable: true
 *         serviceOrderStatus:
 *           type: string
 *           nullable: true
 *         inspectorId:
 *           type: integer
 *           nullable: true
 *         inspectorName:
 *           type: string
 *         inspectorArea:
 *           type: string
 *         measurementsCount:
 *           type: integer
 *         approvedMeasurements:
 *           type: integer
 *         nonConformitiesCount:
 *           type: integer
 *         openNonConformities:
 *           type: integer
 *         photosCount:
 *           type: integer
 *     ReportFinancialFlowSummary:
 *       type: object
 *       properties:
 *         totalIncome:
 *           type: number
 *           example: 15000.5
 *         totalExpense:
 *           type: number
 *           example: 8000
 *         balance:
 *           type: number
 *           example: 7000.5
 *     ReportTransactionEntry:
 *       type: object
 *       description: Lançamento financeiro (Transaction) bruto, sem cálculo agregado.
 *       properties:
 *         id:
 *           type: integer
 *         type:
 *           type: string
 *           example: RECEIVABLE
 *         amount:
 *           type: number
 *         category:
 *           type: string
 *         date:
 *           type: string
 *           format: date-time
 *         description:
 *           type: string
 *           nullable: true
 *         orderId:
 *           type: integer
 *           nullable: true
 *     ReportTeamPerformanceEntry:
 *       type: object
 *       properties:
 *         employeeId:
 *           type: integer
 *         employeeName:
 *           type: string
 *         workAreaName:
 *           type: string
 *         jobRoleName:
 *           type: string
 *         servicesCount:
 *           type: integer
 *         totalHours:
 *           type: number
 *         totalRevenue:
 *           type: number
 *     ReportUsersSummary:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *         admins:
 *           type: integer
 *         users:
 *           type: integer
 *     ReportProfitabilityEntry:
 *       type: object
 *       description: Rentabilidade de uma ordem de serviço com status "Concluída".
 *       properties:
 *         id:
 *           type: integer
 *         customer:
 *           type: string
 *         subtotal:
 *           type: number
 *         estimatedProfit:
 *           type: number
 *         taxes:
 *           type: number
 *         finalTotal:
 *           type: number
 *         margin:
 *           type: number
 *           nullable: true
 *           description: Percentual de lucro configurado na OS (profitPercent).
 */

/**
 * @swagger
 * /v1/reports/emissions:
 *   get:
 *     summary: Lista o histórico de emissões de relatórios
 *     description: >
 *       Requer permissão `relatorios:visualizar`. Retorna as emissões mais recentes primeiro
 *       (orderBy createdAt desc), opcionalmente filtradas por reportKey.
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: reportKey
 *         schema:
 *           type: string
 *         example: purchases
 *         description: Filtra pelo identificador do relatório.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Quantidade máxima de registros retornados.
 *     responses:
 *       200:
 *         description: Histórico de emissões.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ReportEmission'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     summary: Registra uma emissão de relatório no histórico
 *     description: >
 *       Requer permissão `relatorios:visualizar`. Usado para registrar manualmente a auditoria
 *       de geração/exportação de um relatório.
 *     tags: [Reports]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReportEmissionInput'
 *     responses:
 *       201:
 *         description: >
 *           Emissão registrada. Resposta literal `{ "status": "success" }`, sem campo `data`
 *           — o controller já retorna um objeto com `status: 'success'`, então o
 *           responseWrapperMiddleware o repassa sem alterações.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *       400:
 *         description: '`reportKey` ou `exportFormat` não informados no body.'
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/emissions', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.listEmissions);
router.post('/emissions', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.registerEmission);

// Relatórios Operacionais

/**
 * @swagger
 * /v1/reports/operational/service-orders:
 *   get:
 *     summary: Relatório de ordens de serviço agrupadas por status
 *     description: >
 *       Requer permissão `relatorios:visualizar`. Filtra por openingDate quando start e end
 *       são informados juntos (o filtro só é aplicado se ambos estiverem presentes).
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inicial (openingDate >=). Só tem efeito se end também for informado.
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *           format: date
 *         description: Data final (openingDate <=). Só tem efeito se start também for informado.
 *     responses:
 *       200:
 *         description: Contagem de ordens de serviço por status.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ReportServiceOrdersByStatusItem'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/operational/service-orders', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.operationalServiceOrders);

/**
 * @swagger
 * /v1/reports/operational/service-orders/pdf:
 *   get:
 *     summary: Relatório de ordens de serviço por status e período, em PDF
 *     description: >
 *       Requer permissão `relatorios:visualizar`. Mesma consulta de
 *       GET /v1/reports/operational/service-orders (start/end filtram openingDate, ambos
 *       precisam estar presentes), renderizada em PDF.
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Arquivo PDF do relatório (relatorio_ordens_servico.pdf).
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/operational/service-orders/pdf', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.operationalServiceOrdersPDF);

/**
 * @swagger
 * /v1/reports/operational/purchases:
 *   get:
 *     summary: Relatório operacional de compras (solicitações e histórico de entradas)
 *     description: >
 *       Requer permissão `relatorios:visualizar`. start/end filtram por createdAt tanto as
 *       solicitações de compra quanto o histórico de entradas de estoque — cada parâmetro é
 *       aplicado de forma independente (não é necessário informar os dois). status filtra o
 *       status da solicitação de compra (PurchaseRequest.status). supplierPersonId filtra
 *       apenas o histórico de entradas de estoque (StockLog) pelo fornecedor.
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         example: OPEN
 *         description: Status da solicitação de compra (PurchaseRequest.status).
 *       - in: query
 *         name: supplierPersonId
 *         schema:
 *           type: integer
 *         description: Filtra apenas o histórico de entradas de estoque (StockLog.supplierPersonId).
 *     responses:
 *       200:
 *         description: Solicitações de compra e histórico de entradas de estoque com custo unitário.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/ReportPurchasesResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/operational/purchases', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.operationalPurchases);

/**
 * @swagger
 * /v1/reports/operational/purchases/pdf:
 *   get:
 *     summary: Relatório operacional de compras, em PDF
 *     description: >
 *       Requer permissão `relatorios:visualizar`. Mesma consulta e mesmos parâmetros de
 *       GET /v1/reports/operational/purchases, renderizada em PDF. Diferente dos demais
 *       relatórios em PDF deste módulo, este endpoint também registra automaticamente uma
 *       ReportEmission (reportKey "purchases", exportFormat "PDF") com o hash SHA-256 do
 *       arquivo gerado.
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: supplierPersonId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Arquivo PDF do relatório (relatorio_compras.pdf).
 *         headers:
 *           X-Report-Hash:
 *             description: SHA-256 do PDF gerado (mesmo valor gravado em ReportEmission.fileHash).
 *             schema:
 *               type: string
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/operational/purchases/pdf', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.operationalPurchasesPDF);

/**
 * @swagger
 * /v1/reports/operational/stock-movements:
 *   get:
 *     summary: Relatório de movimentações de estoque no período
 *     description: >
 *       Requer permissão `relatorios:visualizar`. Filtra por createdAt quando start e end são
 *       informados juntos (o filtro só é aplicado se ambos estiverem presentes).
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Movimentações de estoque (StockLog) do período, com o material relacionado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ReportStockMovementLogItem'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/operational/stock-movements', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.operationalStockMovements);

/**
 * @swagger
 * /v1/reports/operational/stock-movements/pdf:
 *   get:
 *     summary: Relatório de movimentações de estoque no período, em PDF
 *     description: >
 *       Requer permissão `relatorios:visualizar`. Mesma consulta de
 *       GET /v1/reports/operational/stock-movements (start/end filtram createdAt, ambos
 *       precisam estar presentes), renderizada em PDF.
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Arquivo PDF do relatório (relatorio_movimentacao_estoque.pdf).
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/operational/stock-movements/pdf', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.operationalStockMovementsPDF);

/**
 * @swagger
 * /v1/reports/operational/production:
 *   get:
 *     summary: Relatório de produção por funcionário/área de trabalho
 *     description: >
 *       Requer permissão `relatorios:visualizar`. start/end filtram pela openingDate da ordem
 *       de serviço vinculada ao lançamento; cada parâmetro é aplicado de forma independente.
 *       employeeId filtra o funcionário responsável pelo lançamento; workAreaId filtra pela
 *       área de trabalho do funcionário. Não possui variante em PDF.
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: employeeId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: workAreaId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lançamentos de serviço executado, um por funcionário/serviço/OS.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ReportOperationalProductionEntry'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/operational/production', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.operationalProduction);

/**
 * @swagger
 * /v1/reports/operational/quality:
 *   get:
 *     summary: Relatório de controle de qualidade
 *     description: >
 *       Requer permissão `relatorios:visualizar`. start/end filtram pela inspectionDate; cada
 *       parâmetro é aplicado de forma independente. status filtra o status do controle de
 *       qualidade. inspectorId filtra pelo funcionário inspetor responsável. Não possui
 *       variante em PDF.
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: inspectorId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Controles de qualidade do período, com contadores de medições e não conformidades.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ReportQualityControlEntry'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/operational/quality', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.operationalQuality);

// Relatórios Administrativos

/**
 * @swagger
 * /v1/reports/admin/financial-flow:
 *   get:
 *     summary: Relatório de fluxo financeiro (entradas/saídas) no período
 *     description: >
 *       Requer permissão `relatorios:visualizar`. Filtra Transaction.date quando start e end
 *       são informados juntos (o filtro só é aplicado se ambos estiverem presentes).
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Totais de receita, despesa e saldo do período.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/ReportFinancialFlowSummary'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/admin/financial-flow', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.adminFinancialFlow);

/**
 * @swagger
 * /v1/reports/admin/financial-flow/pdf:
 *   get:
 *     summary: Relatório de fluxo financeiro no período, em PDF
 *     description: >
 *       Requer permissão `relatorios:visualizar`. Mesma consulta de
 *       GET /v1/reports/admin/financial-flow (start/end filtram Transaction.date, ambos
 *       precisam estar presentes), renderizada em PDF.
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Arquivo PDF do relatório (relatorio_fluxo_financeiro.pdf).
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/admin/financial-flow/pdf', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.adminFinancialFlowPDF);

/**
 * @swagger
 * /v1/reports/admin/accounts:
 *   get:
 *     summary: Relatório de contas (lançamentos financeiros)
 *     description: >
 *       Requer permissão `relatorios:visualizar`. O parâmetro de query `status` filtra, na
 *       implementação atual, o campo `type` do lançamento financeiro (ex. RECEIVABLE/PAYABLE)
 *       — nome do parâmetro mantido conforme o controller.
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         example: RECEIVABLE
 *         description: Filtra por Transaction.type, apesar do nome do parâmetro.
 *     responses:
 *       200:
 *         description: Lançamentos financeiros, ordenados por data (asc).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ReportTransactionEntry'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/admin/accounts', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.adminAccounts);

/**
 * @swagger
 * /v1/reports/admin/accounts/pdf:
 *   get:
 *     summary: Relatório de contas, em PDF
 *     description: >
 *       Requer permissão `relatorios:visualizar`. Mesma consulta de
 *       GET /v1/reports/admin/accounts, renderizada em PDF.
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filtra por Transaction.type, apesar do nome do parâmetro.
 *     responses:
 *       200:
 *         description: Arquivo PDF do relatório (relatorio_contas.pdf).
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/admin/accounts/pdf', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.adminAccountsPDF);

/**
 * @swagger
 * /v1/reports/admin/team-performance:
 *   get:
 *     summary: Relatório de desempenho de equipes
 *     description: >
 *       Requer permissão `relatorios:visualizar`. Sem parâmetros de filtro — agrega todos os
 *       lançamentos de serviço (ServiceOrderService) por funcionário (employeeId not null).
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: Quantidade de serviços, horas e receita totais por funcionário.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ReportTeamPerformanceEntry'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/admin/team-performance', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.adminTeamPerformance);

/**
 * @swagger
 * /v1/reports/admin/team-performance/pdf:
 *   get:
 *     summary: Relatório de desempenho de equipes, em PDF
 *     description: >
 *       Requer permissão `relatorios:visualizar`. Sem parâmetros de filtro. Observação: esta
 *       variante em PDF agrega apenas a quantidade de serviços por employeeId (sem nome do
 *       funcionário, horas ou receita) — dados menos completos que os de
 *       GET /v1/reports/admin/team-performance.
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: Arquivo PDF do relatório (relatorio_desempenho_equipes.pdf).
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/admin/team-performance/pdf', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.adminTeamPerformancePDF);

/**
 * @swagger
 * /v1/reports/admin/users-summary:
 *   get:
 *     summary: Resumo de usuários do sistema
 *     description: >
 *       Requer permissão `relatorios:visualizar`. Sem parâmetros de filtro. Conta o total de
 *       usuários e a quantidade por role (admin/user) — apesar do nome do arquivo PDF
 *       associado ("resumo_usuarios_ativos"), não há filtro por status/atividade: o total
 *       inclui todos os usuários cadastrados.
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: Totais de usuários por role.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/ReportUsersSummary'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/admin/users-summary', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.adminUsersSummary);

/**
 * @swagger
 * /v1/reports/admin/users-summary/pdf:
 *   get:
 *     summary: Resumo de usuários do sistema, em PDF
 *     description: >
 *       Requer permissão `relatorios:visualizar`. Mesma consulta de
 *       GET /v1/reports/admin/users-summary, renderizada em PDF.
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: Arquivo PDF do relatório (resumo_usuarios_ativos.pdf).
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/admin/users-summary/pdf', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.adminUsersSummaryPDF);

/**
 * @swagger
 * /v1/reports/admin/profitability:
 *   get:
 *     summary: Relatório de rentabilidade por ordem de serviço
 *     description: >
 *       Requer permissão `relatorios:visualizar`. Considera apenas ordens de serviço com
 *       status "Concluída" (filtro fixo). start/end filtram openingDate quando informados
 *       juntos (o filtro só é aplicado se ambos estiverem presentes). Não possui variante
 *       em PDF.
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Rentabilidade calculada por ordem de serviço concluída.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ReportProfitabilityEntry'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/admin/profitability', authenticateToken, requirePermission('relatorios:visualizar'), ReportsController.adminProfitability);

export default router;
