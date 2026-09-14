import { Router } from 'express';
import { FinanceController } from '../controllers/FinanceController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validateBody';
import { financeSchema } from '../financeSchema';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Transaction:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         type:
 *           type: string
 *           maxLength: 30
 *           example: RECEIVABLE
 *           description: >
 *             Convencionalmente 'RECEIVABLE' (a receber) ou 'PAYABLE' (a pagar), conforme uso
 *             em FinanceController/FinancialService — o schema Joi não impõe um enum.
 *         amount:
 *           type: number
 *           format: float
 *           example: 1500.5
 *         category:
 *           type: string
 *           maxLength: 80
 *           example: Peças
 *         date:
 *           type: string
 *           format: date-time
 *         description:
 *           type: string
 *           nullable: true
 *           example: Compra de rolamentos
 *         orderId:
 *           type: integer
 *           nullable: true
 *           example: 12
 *         serviceOrder:
 *           type: object
 *           nullable: true
 *           description: >
 *             Ordem de serviço vinculada (orderId), incluída via Prisma include. Presente
 *             apenas em GET /v1/finance; ausente (não apenas null) na resposta de
 *             POST /v1/finance, que não usa include. Mostrados aqui só os campos mais
 *             relevantes — o schema completo de ordem de serviço é documentado na tag
 *             ServiceOrders.
 *           properties:
 *             id:
 *               type: integer
 *               example: 12
 *             traceCode:
 *               type: string
 *               nullable: true
 *               example: OS-2024-0012
 *             status:
 *               type: string
 *               example: Em andamento
 *             openingDate:
 *               type: string
 *               format: date-time
 *       required:
 *         - id
 *         - type
 *         - amount
 *         - category
 *         - date
 *     TransactionInput:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           minLength: 2
 *           maxLength: 30
 *           example: RECEIVABLE
 *         amount:
 *           type: number
 *           format: float
 *           exclusiveMinimum: true
 *           minimum: 0
 *           example: 1500.5
 *         category:
 *           type: string
 *           minLength: 2
 *           maxLength: 80
 *           example: Peças
 *         description:
 *           type: string
 *           maxLength: 255
 *           example: Compra de rolamentos
 *         orderId:
 *           type: integer
 *           minimum: 1
 *           nullable: true
 *           example: 12
 *       required:
 *         - type
 *         - amount
 *         - category
 */

/**
 * @swagger
 * /v1/finance:
 *   get:
 *     summary: Lista todas as transações financeiras
 *     description: >
 *       Requer a permissão `financeiro:visualizar`. Retorna as transações ordenadas por data
 *       decrescente; cada uma inclui a ordem de serviço vinculada (orderId), quando houver.
 *     tags: [Finance]
 *     responses:
 *       200:
 *         description: Lista de transações financeiras.
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
 *                     $ref: '#/components/schemas/Transaction'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     summary: Registra uma nova transação financeira
 *     description: Requer a permissão `financeiro:gerenciar`.
 *     tags: [Finance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransactionInput'
 *     responses:
 *       201:
 *         description: >
 *           Transação criada. A resposta não inclui a ordem de serviço vinculada (o create()
 *           não usa include).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Transaction'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', authenticateToken, requirePermission('financeiro:visualizar'), FinanceController.list);

/**
 * @swagger
 * /v1/finance/summary:
 *   get:
 *     summary: Retorna o resumo financeiro consolidado
 *     description: >
 *       Requer a permissão `financeiro:visualizar`. Soma todas as transações (receitas x
 *       despesas) e calcula a margem prevista com base nas ordens de serviço não canceladas
 *       (materiais + serviços, percentuais de lucro e imposto de cada ordem).
 *     tags: [Finance]
 *     responses:
 *       200:
 *         description: Resumo financeiro.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalIncome:
 *                       type: number
 *                       format: float
 *                       description: Soma de amount de todas as transações do tipo RECEIVABLE.
 *                       example: 25000
 *                     totalExpense:
 *                       type: number
 *                       format: float
 *                       description: Soma de amount de todas as transações que não são RECEIVABLE.
 *                       example: 8000
 *                     balance:
 *                       type: number
 *                       format: float
 *                       example: 17000
 *                     predictedMargin:
 *                       type: number
 *                       format: float
 *                       description: Margem prevista (%) das ordens de serviço não canceladas.
 *                       example: 22.5
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/summary', authenticateToken, requirePermission('financeiro:visualizar'), FinanceController.getSummary);
router.post('/', authenticateToken, requirePermission('financeiro:gerenciar'), validateBody(financeSchema), FinanceController.create);

export default router;
