import { Router } from 'express';
import { ServiceController } from '../controllers/ServiceController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validateBody';
import { serviceSchema } from '../serviceSchema';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Service:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: Solda de precisão
 *         description:
 *           type: string
 *           nullable: true
 *           example: Solda TIG em peças de precisão
 *         price:
 *           type: number
 *           format: float
 *           example: 250
 *           description: >
 *             Ausente (chave omitida, não null) em GET /v1/services e GET /v1/services/{id}
 *             quando o usuário autenticado não possui a permissão financeiro:visualizar,
 *             financeiro:gerenciar ou financeiro:*, e não é admin. Sempre presente nas
 *             respostas de POST e PUT, que não passam pela sanitização financeira.
 *         active:
 *           type: boolean
 *           example: true
 *       required:
 *         - id
 *         - name
 *         - active
 *     ServiceInput:
 *       type: object
 *       description: >
 *         Payload usado tanto em POST quanto em PUT. Diferente de Material, a atualização
 *         (PUT) não é parcial: name e price são reenviados/sobrescritos a cada chamada com
 *         o mesmo schema de validação da criação.
 *       properties:
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           example: Solda de precisão
 *         description:
 *           type: string
 *           maxLength: 1000
 *           example: Solda TIG em peças de precisão
 *         price:
 *           type: number
 *           format: float
 *           minimum: 0
 *           exclusiveMinimum: true
 *           example: 250
 *         active:
 *           type: boolean
 *           description: 'Se omitido: em POST assume true; em PUT mantém o valor atual (não é alterado).'
 *       required:
 *         - name
 *         - price
 */

/**
 * @swagger
 * /v1/services:
 *   get:
 *     summary: Lista serviços
 *     description: Requer a permissão `auxiliares`.
 *     tags: [Services]
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
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filtro por substring no nome (case-insensitive).
 *     responses:
 *       200:
 *         description: Lista paginada de serviços.
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
 *                     $ref: '#/components/schemas/Service'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     summary: Cria um novo serviço
 *     description: Requer a permissão `auxiliares`.
 *     tags: [Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceInput'
 *     responses:
 *       201:
 *         description: Serviço criado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Service'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', authenticateToken, requirePermission('auxiliares'), ServiceController.list);

/**
 * @swagger
 * /v1/services/{id}:
 *   get:
 *     summary: Busca um serviço pelo ID
 *     description: Requer a permissão `auxiliares`.
 *     tags: [Services]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Serviço encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Service'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   put:
 *     summary: Atualiza um serviço existente
 *     description: >
 *       Requer a permissão `auxiliares`. Não é uma atualização parcial: name e price são
 *       sempre reenviados (mesmo schema de validação do POST).
 *     tags: [Services]
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
 *             $ref: '#/components/schemas/ServiceInput'
 *     responses:
 *       200:
 *         description: Serviço atualizado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Service'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   delete:
 *     summary: Remove um serviço
 *     description: >
 *       Requer a permissão `auxiliares`. Falha com 400 se o serviço estiver referenciado em
 *       alguma Ordem de Serviço (ServiceOrderService).
 *     tags: [Services]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       204:
 *         description: Serviço removido com sucesso (sem conteúdo).
 *       400:
 *         description: Serviço em uso em uma ou mais Ordens de Serviço.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               emUso:
 *                 summary: Serviço em uso
 *                 value: { status: 'error', message: 'Não é possível excluir: este serviço está registrado em 2 Ordem(ns) de Serviço.' }
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
router.get('/:id', authenticateToken, requirePermission('auxiliares'), ServiceController.get);
router.post('/', authenticateToken, requirePermission('auxiliares'), validateBody(serviceSchema), ServiceController.create);
router.put('/:id', authenticateToken, requirePermission('auxiliares'), validateBody(serviceSchema), ServiceController.update);
router.delete('/:id', authenticateToken, requirePermission('auxiliares'), ServiceController.delete);

export default router;
