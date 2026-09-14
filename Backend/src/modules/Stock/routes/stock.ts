import { Router } from 'express';
import { StockController } from '../controllers/StockController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validateBody';
import { stockSchema } from '../stockSchema';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     StockLog:
 *       type: object
 *       description: >
 *         Registro individual de uma movimentação de estoque (entrada ou saída) de um
 *         material — não é um "estoque atual" mutável, e sim o log de cada IN/OUT, usado
 *         para custeio FIFO (ver ATENÇÃO ESPECÍFICA no módulo Stock).
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         materialId:
 *           type: integer
 *           example: 10
 *         quantity:
 *           type: number
 *           format: float
 *           example: 50
 *         type:
 *           type: string
 *           enum: [IN, OUT]
 *           example: IN
 *         description:
 *           type: string
 *           nullable: true
 *           example: Compra mensal
 *         supplierPersonId:
 *           type: integer
 *           nullable: true
 *           description: Preenchido apenas em movimentações type=IN (fornecedor da compra); null em type=OUT.
 *           example: 5
 *         unitCost:
 *           type: number
 *           format: float
 *           nullable: true
 *           description: >
 *             Custo unitário do lote (type=IN) ou custo médio ponderado dos lotes
 *             consumidos via FIFO (type=OUT). O endpoint de criação sempre preenche este
 *             campo; é nullable no modelo por não ser garantido para dados legados.
 *           example: 12.5
 *         totalPaid:
 *           type: number
 *           format: float
 *           nullable: true
 *           example: 625
 *         remainingQty:
 *           type: number
 *           format: float
 *           nullable: true
 *           description: Saldo do lote ainda não consumido por saídas FIFO. Sempre 0 em registros type=OUT.
 *           example: 30
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         material:
 *           $ref: '#/components/schemas/Material'
 *         supplierPerson:
 *           type: object
 *           nullable: true
 *           description: >
 *             Pessoa fornecedora (módulo People, incluída sem sanitização — price do
 *             material aninhado em `material` acima também não é sanitizado). Null quando a
 *             movimentação não tem fornecedor associado (ex.: type=OUT).
 *           properties:
 *             id:
 *               type: integer
 *               example: 5
 *             type:
 *               type: string
 *               description: Tipo de pessoa (física/jurídica).
 *             createdAt:
 *               type: string
 *               format: date-time
 *             updatedAt:
 *               type: string
 *               format: date-time
 *             naturalPerson:
 *               type: object
 *               nullable: true
 *               properties:
 *                 name:
 *                   type: string
 *                   example: João Fornecedor
 *             legalPerson:
 *               type: object
 *               nullable: true
 *               properties:
 *                 corporateName:
 *                   type: string
 *                   example: Fornecedora Industrial Ltda
 *       required:
 *         - id
 *         - materialId
 *         - quantity
 *         - type
 *         - createdAt
 *         - updatedAt
 *         - material
 *     StockLogInput:
 *       type: object
 *       description: >
 *         Registra uma movimentação de estoque. Em type=IN é obrigatório informar
 *         supplierPersonId e ao menos um de unitCost/totalPaid (o outro é derivado). Em
 *         type=OUT o custo é calculado automaticamente pelo consumo FIFO dos lotes de
 *         entrada disponíveis; supplierPersonId/unitCost/totalPaid enviados são ignorados.
 *       properties:
 *         materialId:
 *           type: integer
 *           minimum: 0
 *           exclusiveMinimum: true
 *           example: 10
 *         quantity:
 *           type: number
 *           format: float
 *           minimum: 0
 *           exclusiveMinimum: true
 *           example: 50
 *         type:
 *           type: string
 *           enum: [IN, OUT]
 *           example: IN
 *         description:
 *           type: string
 *           maxLength: 255
 *           example: Compra mensal
 *         supplierPersonId:
 *           type: integer
 *           minimum: 0
 *           exclusiveMinimum: true
 *           description: Obrigatório quando type=IN.
 *           example: 5
 *         unitCost:
 *           type: number
 *           format: float
 *           minimum: 0
 *           exclusiveMinimum: true
 *           description: Custo unitário da compra. Se omitido em type=IN, é derivado de totalPaid / quantity.
 *           example: 12.5
 *         totalPaid:
 *           type: number
 *           format: float
 *           minimum: 0
 *           exclusiveMinimum: true
 *           example: 625
 *       required:
 *         - materialId
 *         - quantity
 *         - type
 */

/**
 * @swagger
 * /v1/stock:
 *   get:
 *     summary: Lista o histórico de movimentações de estoque
 *     description: >
 *       Requer a permissão `estoque:visualizar`. Retorna todos os registros de StockLog
 *       (entradas e saídas de todos os materiais), mais recentes primeiro.
 *     tags: [Stock]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Lista paginada de movimentações de estoque.
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
 *                     $ref: '#/components/schemas/StockLog'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     summary: Registra uma movimentação de estoque (entrada ou saída)
 *     description: >
 *       Requer a permissão `estoque:gerenciar`. Não cria um "item de estoque": cria um
 *       registro de movimentação (StockLog). Em type=IN, exige supplierPersonId válido e
 *       unitCost ou totalPaid; o preço padrão do material (Material.price) passa a refletir
 *       o custo unitário do lote recém-comprado. Em type=OUT, consome os lotes IN
 *       disponíveis em ordem FIFO (mais antigos primeiro) e falha se o saldo total
 *       disponível for insuficiente.
 *     tags: [Stock]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StockLogInput'
 *     responses:
 *       201:
 *         description: Movimentação registrada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/StockLog'
 *       400:
 *         description: Dados inválidos, custo de compra ausente/inválido, ou saldo insuficiente para saída.
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/ValidationErrorResponse'
 *                 - $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               dadosInvalidos:
 *                 summary: materialId/quantity inválidos
 *                 value: { error: 'Dados de movimentação inválidos.' }
 *               tipoInvalido:
 *                 summary: type diferente de IN/OUT
 *                 value: { error: 'Tipo de movimentação inválido. Use IN ou OUT.' }
 *               fornecedorObrigatorio:
 *                 summary: Fornecedor não informado em type=IN
 *                 value: { error: 'Fornecedor é obrigatório para entrada de compra.' }
 *               custoInvalido:
 *                 summary: unitCost/totalPaid ausentes ou inválidos em type=IN
 *                 value: { error: 'Informe unitCost ou totalPaid válidos para a compra.' }
 *               estoqueInsuficiente:
 *                 summary: Saldo insuficiente em type=OUT
 *                 value: { error: 'Estoque insuficiente para a saída informada.' }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Fornecedor informado (supplierPersonId) não encontrado na tabela de pessoas.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               fornecedorNaoEncontrado:
 *                 value: { error: 'Fornecedor não encontrado na tabela de pessoas.' }
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', authenticateToken, requirePermission('estoque:visualizar'), StockController.list);

/**
 * @swagger
 * /v1/stock/purchases:
 *   get:
 *     summary: Lista o histórico de compras de materiais
 *     description: >
 *       Requer a permissão `estoque:visualizar`. Subconjunto de StockLog filtrado para
 *       type=IN com unitCost preenchido (movimentações de compra). Cada item inclui o
 *       campo calculado `supplierName`.
 *     tags: [Stock]
 *     parameters:
 *       - in: query
 *         name: materialId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: supplierPersonId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filtra por createdAt >= startDate (00:00:00). Ignorado se não for uma data válida.
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filtra por createdAt <= endDate (23:59:59.999). Ignorado se não for uma data válida.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Lista paginada de compras.
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
 *                     allOf:
 *                       - $ref: '#/components/schemas/StockLog'
 *                       - type: object
 *                         properties:
 *                           supplierName:
 *                             type: string
 *                             nullable: true
 *                             description: naturalPerson.name ou legalPerson.corporateName do fornecedor; null se não determinável.
 *                             example: João Fornecedor
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/purchases', authenticateToken, requirePermission('estoque:visualizar'), StockController.purchaseHistory);
router.post('/', authenticateToken, requirePermission('estoque:gerenciar'), validateBody(stockSchema), StockController.create);

export default router;
