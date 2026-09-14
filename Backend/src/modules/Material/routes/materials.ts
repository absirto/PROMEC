import { Router } from 'express';
import { MaterialController } from '../controllers/MaterialController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validateBody';
import { materialCreateSchema, materialUpdateSchema } from '../materialSchema';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Material:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: Rolamento 6205
 *         description:
 *           type: string
 *           nullable: true
 *           example: Rolamento rígido de esferas
 *         price:
 *           type: number
 *           format: float
 *           example: 45.9
 *           description: >
 *             Ausente (chave omitida, não null) em GET /v1/materials e GET /v1/materials/{id}
 *             quando o usuário autenticado não possui a permissão financeiro:visualizar,
 *             financeiro:gerenciar ou financeiro:*, e não é admin. Sempre presente nas
 *             respostas de POST e PUT, que não passam pela sanitização financeira.
 *         unit:
 *           type: string
 *           example: UN
 *         active:
 *           type: boolean
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - id
 *         - name
 *         - unit
 *         - active
 *         - createdAt
 *         - updatedAt
 *     MaterialInput:
 *       type: object
 *       description: Payload de criação (POST). Para atualização parcial (PUT), ver o requestBody de PUT /v1/materials/{id}.
 *       properties:
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 255
 *           example: Rolamento 6205
 *         description:
 *           type: string
 *           nullable: true
 *           maxLength: 1000
 *           example: Rolamento rígido de esferas
 *         price:
 *           type: number
 *           format: float
 *           minimum: 0
 *           exclusiveMinimum: true
 *           example: 45.9
 *           description: Obrigatoriamente positivo, com até 2 casas decimais.
 *         unit:
 *           type: string
 *           maxLength: 10
 *           example: UN
 *           description: 'Unidade de medida (ex: UN, KG, M).'
 *         active:
 *           type: boolean
 *           default: true
 *       required:
 *         - name
 *         - price
 *         - unit
 */

/**
 * @swagger
 * /v1/materials:
 *   get:
 *     summary: Lista materiais
 *     description: >
 *       Requer a permissão `materiais:visualizar`. Por padrão retorna uma lista paginada.
 *       Se `all=true`, ignora a paginação (page/limit são descartados) e retorna todos os
 *       materiais que casam com `search` em um array simples dentro de `data`, sem `meta`.
 *     tags: [Materials]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Ignorado quando `all=true`.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Ignorado quando `all=true`.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filtro por substring no nome (case-insensitive).
 *       - in: query
 *         name: all
 *         schema:
 *           type: boolean
 *           example: true
 *         description: Quando `true`, retorna todos os materiais sem paginação (comparação estrita com a string "true").
 *     responses:
 *       200:
 *         description: Lista de materiais.
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   description: Resposta padrão (paginada).
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: success
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Material'
 *                     meta:
 *                       $ref: '#/components/schemas/PaginationMeta'
 *                 - type: object
 *                   description: Resposta quando `all=true` (sem paginação, sem meta).
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: success
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Material'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     summary: Cria um novo material
 *     description: Requer a permissão `materiais:gerenciar`.
 *     tags: [Materials]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MaterialInput'
 *     responses:
 *       201:
 *         description: Material criado. A resposta não passa pela sanitização financeira (price sempre presente).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Material'
 *       400:
 *         description: Payload inválido (Joi) ou preço não-positivo.
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/ValidationErrorResponse'
 *                 - $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               precoInvalido:
 *                 summary: Preço inválido
 *                 value: { status: 'error', message: 'Preço do material inválido.' }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', authenticateToken, requirePermission('materiais:visualizar'), MaterialController.list);

/**
 * @swagger
 * /v1/materials/{id}:
 *   get:
 *     summary: Busca um material pelo ID
 *     description: Requer a permissão `materiais:visualizar`.
 *     tags: [Materials]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Material encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Material'
 *       400:
 *         description: ID de material inválido (não é um inteiro positivo).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               idInvalido:
 *                 value: { status: 'error', message: 'ID de material inválido.' }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   put:
 *     summary: Atualiza um material existente
 *     description: >
 *       Requer a permissão `materiais:gerenciar`. Atualização parcial: qualquer subconjunto
 *       dos campos abaixo pode ser enviado, desde que ao menos um esteja presente. A resposta
 *       não passa pela sanitização financeira (price sempre presente).
 *     tags: [Materials]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Mesmos campos de MaterialInput, porém todos opcionais (ao menos um é obrigatório).
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 255
 *               description:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 1000
 *               price:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 exclusiveMinimum: true
 *               unit:
 *                 type: string
 *                 maxLength: 10
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Material atualizado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Material'
 *       400:
 *         description: ID inválido, payload inválido (Joi exige ao menos 1 campo) ou preço não-positivo.
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/ValidationErrorResponse'
 *                 - $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               idInvalido:
 *                 summary: ID inválido
 *                 value: { status: 'error', message: 'ID de material inválido.' }
 *               precoInvalido:
 *                 summary: Preço inválido
 *                 value: { status: 'error', message: 'Preço do material inválido.' }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   delete:
 *     summary: Remove um material
 *     description: >
 *       Requer a permissão `materiais:gerenciar`. Falha com 400 se o material estiver
 *       referenciado em alguma Ordem de Serviço (ServiceOrderMaterial).
 *     tags: [Materials]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       204:
 *         description: Material removido com sucesso (sem conteúdo).
 *       400:
 *         description: Material em uso em uma ou mais Ordens de Serviço.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               emUso:
 *                 summary: Material em uso
 *                 value: { status: 'error', message: 'Não é possível excluir: este material está sendo usado em 3 Ordem(ns) de Serviço.' }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: >
 *           Erro interno inesperado. Neste endpoint o corpo inclui também `details` com a
 *           mensagem da exceção original.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 */
router.get('/:id', authenticateToken, requirePermission('materiais:visualizar'), MaterialController.get);
router.post('/', authenticateToken, requirePermission('materiais:gerenciar'), validateBody(materialCreateSchema), MaterialController.create);
router.put('/:id', authenticateToken, requirePermission('materiais:gerenciar'), validateBody(materialUpdateSchema), MaterialController.update);
router.delete('/:id', authenticateToken, requirePermission('materiais:gerenciar'), MaterialController.delete);

export default router;
