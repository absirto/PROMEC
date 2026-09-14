import { Router } from 'express';
import { WorkAreaController } from '../controllers/WorkAreaController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validateBody';
import { workAreaSchema } from '../workAreaSchema';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     WorkArea:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: Usinagem
 *       required:
 *         - id
 *         - name
 *     WorkAreaInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 80
 *           example: Usinagem
 *       required:
 *         - name
 */

/**
 * @swagger
 * /v1/work-areas:
 *   get:
 *     summary: Lista todas as áreas de trabalho
 *     tags: [WorkAreas]
 *     responses:
 *       200:
 *         description: Lista de áreas de trabalho.
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
 *                     $ref: '#/components/schemas/WorkArea'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     summary: Cria uma nova área de trabalho
 *     tags: [WorkAreas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WorkAreaInput'
 *     responses:
 *       201:
 *         description: Área de trabalho criada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/WorkArea'
 *       400:
 *         description: Nome não informado ou inválido.
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
router.get('/', authenticateToken, requirePermission('auxiliares'), WorkAreaController.list);

/**
 * @swagger
 * /v1/work-areas/{id}:
 *   get:
 *     summary: Busca uma área de trabalho pelo ID
 *     tags: [WorkAreas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Área de trabalho encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/WorkArea'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   put:
 *     summary: Atualiza uma área de trabalho existente
 *     tags: [WorkAreas]
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
 *             $ref: '#/components/schemas/WorkAreaInput'
 *     responses:
 *       200:
 *         description: Área de trabalho atualizada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/WorkArea'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   delete:
 *     summary: Remove uma área de trabalho
 *     description: Falha com 400 se ainda houver funcionários vinculados à área.
 *     tags: [WorkAreas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       204:
 *         description: Área de trabalho removida com sucesso (sem conteúdo).
 *       400:
 *         description: Existem funcionários vinculados a esta área.
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
router.get('/:id', authenticateToken, requirePermission('auxiliares'), WorkAreaController.get);
router.post('/', authenticateToken, requirePermission('auxiliares'), validateBody(workAreaSchema), WorkAreaController.create);
router.put('/:id', authenticateToken, requirePermission('auxiliares'), validateBody(workAreaSchema), WorkAreaController.update);
router.delete('/:id', authenticateToken, requirePermission('auxiliares'), WorkAreaController.delete);

export default router;
