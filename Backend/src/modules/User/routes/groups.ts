import { Router } from 'express';
import { GroupController } from '../controllers/GroupController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validateBody';
import { groupSchema } from '../groupSchema';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Permission:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 3
 *         name:
 *           type: string
 *           example: 'usuarios:gerenciar'
 *         description:
 *           type: string
 *           nullable: true
 *           example: Gerenciar usuários do sistema
 *       required:
 *         - id
 *         - name
 *     Group:
 *       type: object
 *       description: >
 *         Grupo de acesso. As propriedades `permissions` e `permissionKeys` só existem em
 *         algumas respostas: GET /v1/groups (listagem) inclui as duas; GET /v1/groups/{id}
 *         inclui apenas `permissions`; as respostas de POST /v1/groups e PUT /v1/groups/{id}
 *         não incluem nenhuma das duas (a query Prisma de criação/atualização não recarrega essa
 *         relação) — ver descrições de cada operação.
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: Administradores
 *         description:
 *           type: string
 *           nullable: true
 *           example: Acesso total ao sistema
 *         permissions:
 *           type: array
 *           description: >
 *             Vínculos grupo-permissão (tabela de junção GroupPermission), cada um com a
 *             permissão completa aninhada — não é um array plano de strings.
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *                 example: 1
 *               groupId:
 *                 type: integer
 *                 example: 1
 *               permissionId:
 *                 type: integer
 *                 example: 3
 *               permission:
 *                 $ref: '#/components/schemas/Permission'
 *         permissionKeys:
 *           type: array
 *           description: Nomes das permissões (`permissions[].permission.name`), presente apenas na listagem.
 *           items:
 *             type: string
 *           example: ['usuarios:gerenciar', 'estoque:visualizar']
 *       required:
 *         - id
 *         - name
 *     GroupInput:
 *       type: object
 *       description: >
 *         Usado tanto na criação (POST) quanto na atualização (PUT) — no PUT, o conjunto de
 *         permissões é substituído integralmente pelo `permissionKeys` enviado.
 *       properties:
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 80
 *           example: Supervisores
 *         permissionKeys:
 *           type: array
 *           minItems: 1
 *           items:
 *             type: string
 *             minLength: 1
 *             maxLength: 120
 *           example: ['usuarios:gerenciar', 'estoque:visualizar']
 *       required:
 *         - name
 *         - permissionKeys
 */

/**
 * @swagger
 * /v1/groups:
 *   get:
 *     summary: Lista todos os grupos de acesso
 *     description: Requer a permissão `usuarios:gerenciar`. Não é paginado.
 *     tags: [Groups]
 *     responses:
 *       200:
 *         description: Lista de grupos, cada um com `permissions` e `permissionKeys` preenchidos.
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
 *                     $ref: '#/components/schemas/Group'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     summary: Cria um novo grupo de acesso
 *     description: >
 *       Requer a permissão `usuarios:gerenciar`. Se algum item de `permissionKeys` não
 *       corresponder a uma permissão existente, a operação falha com 500 (não há validação
 *       prévia de existência).
 *     tags: [Groups]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GroupInput'
 *     responses:
 *       201:
 *         description: >
 *           Grupo criado. A resposta contém apenas id/name/description — não inclui
 *           `permissions` nem `permissionKeys` (a query de criação não recarrega a relação).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Group'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', authenticateToken, requirePermission('usuarios:gerenciar'), GroupController.list);

/**
 * @swagger
 * /v1/groups/permissions:
 *   get:
 *     summary: Lista todas as permissões disponíveis no sistema
 *     description: Requer a permissão `usuarios:gerenciar`. Não é paginado.
 *     tags: [Groups]
 *     responses:
 *       200:
 *         description: Lista de permissões, ordenada por nome.
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
 *                     $ref: '#/components/schemas/Permission'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/permissions', authenticateToken, requirePermission('usuarios:gerenciar'), GroupController.listPermissions);

/**
 * @swagger
 * /v1/groups/{id}:
 *   get:
 *     summary: Busca um grupo de acesso pelo ID
 *     description: Requer a permissão `usuarios:gerenciar`.
 *     tags: [Groups]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: >
 *           Grupo encontrado, com `permissions` preenchido. Diferente da listagem, esta resposta
 *           não inclui `permissionKeys`.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Group'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   put:
 *     summary: Atualiza um grupo de acesso existente
 *     description: >
 *       Requer a permissão `usuarios:gerenciar`. Substitui integralmente as permissões do grupo
 *       (remove todos os vínculos GroupPermission existentes e recria a partir de
 *       `permissionKeys`). Se algum item de `permissionKeys` não corresponder a uma permissão
 *       existente, a operação falha com 500.
 *     tags: [Groups]
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
 *             $ref: '#/components/schemas/GroupInput'
 *     responses:
 *       200:
 *         description: >
 *           Grupo atualizado. A resposta contém apenas id/name/description — não inclui
 *           `permissions` nem `permissionKeys` (a query de atualização não recarrega a relação).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Group'
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
 *     summary: Remove um grupo de acesso
 *     description: >
 *       Requer a permissão `usuarios:gerenciar`. Falha com 400 se ainda houver usuários
 *       vinculados a este grupo; caso contrário, remove os vínculos GroupPermission e o grupo.
 *     tags: [Groups]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       204:
 *         description: Grupo removido com sucesso (sem conteúdo).
 *       400:
 *         description: Existem usuários vinculados a este grupo.
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
router.get('/:id', authenticateToken, requirePermission('usuarios:gerenciar'), GroupController.get);
router.post('/', authenticateToken, requirePermission('usuarios:gerenciar'), validateBody(groupSchema), GroupController.create);
router.put('/:id', authenticateToken, requirePermission('usuarios:gerenciar'), validateBody(groupSchema), GroupController.update);
router.delete('/:id', authenticateToken, requirePermission('usuarios:gerenciar'), GroupController.delete);

export default router;
