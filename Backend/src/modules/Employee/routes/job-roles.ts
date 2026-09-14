import { Router } from 'express';
import { JobRoleController } from '../controllers/JobRoleController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validateBody';
import { jobRoleSchema } from '../jobRoleSchema';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     JobRole:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: Soldador
 *       required:
 *         - id
 *         - name
 *     JobRoleInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 80
 *           example: Soldador
 *       required:
 *         - name
 */

/**
 * @swagger
 * /v1/job-roles:
 *   get:
 *     summary: Lista todos os cargos/funções
 *     description: Requer a permissão `auxiliares`.
 *     tags: [JobRoles]
 *     responses:
 *       200:
 *         description: Lista de cargos.
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
 *                     $ref: '#/components/schemas/JobRole'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     summary: Cria um novo cargo
 *     description: Requer a permissão `auxiliares`.
 *     tags: [JobRoles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/JobRoleInput'
 *     responses:
 *       201:
 *         description: Cargo criado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/JobRole'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', authenticateToken, requirePermission('auxiliares'), JobRoleController.list);

/**
 * @swagger
 * /v1/job-roles/{id}:
 *   get:
 *     summary: Busca um cargo pelo ID
 *     description: Requer a permissão `auxiliares`.
 *     tags: [JobRoles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Cargo encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/JobRole'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   put:
 *     summary: Atualiza um cargo existente
 *     description: Requer a permissão `auxiliares`.
 *     tags: [JobRoles]
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
 *             $ref: '#/components/schemas/JobRoleInput'
 *     responses:
 *       200:
 *         description: Cargo atualizado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/JobRole'
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
 *     summary: Remove um cargo
 *     description: >
 *       Requer a permissão `auxiliares`. Falha com 400 se ainda houver funcionários vinculados
 *       a este cargo.
 *     tags: [JobRoles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       204:
 *         description: Cargo removido com sucesso (sem conteúdo).
 *       400:
 *         description: Existem funcionários vinculados a este cargo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:id', authenticateToken, requirePermission('auxiliares'), JobRoleController.get);
router.post('/', authenticateToken, requirePermission('auxiliares'), validateBody(jobRoleSchema), JobRoleController.create);
router.put('/:id', authenticateToken, requirePermission('auxiliares'), validateBody(jobRoleSchema), JobRoleController.update);
router.delete('/:id', authenticateToken, requirePermission('auxiliares'), JobRoleController.delete);

export default router;
