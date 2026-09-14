
import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validateBody';
import { userSchema, userUpdateSchema } from '../userSchema';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       description: >
 *         Usuário do sistema. O campo `password` (hash bcrypt) nunca é retornado pela API — o
 *         controller usa `select` no Prisma para omiti-lo explicitamente em todas as respostas
 *         deste módulo.
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         firstName:
 *           type: string
 *           example: Maria
 *         lastName:
 *           type: string
 *           example: Silva
 *         email:
 *           type: string
 *           format: email
 *           example: maria.silva@promec.com
 *         role:
 *           type: string
 *           example: user
 *         groupId:
 *           type: integer
 *           nullable: true
 *           example: 2
 *         group:
 *           type: object
 *           nullable: true
 *           description: >
 *             Subconjunto de campos do grupo vinculado (id/name/description apenas — não inclui
 *             a lista de permissões; compare com o schema Group, usado em /v1/groups).
 *           properties:
 *             id:
 *               type: integer
 *               example: 2
 *             name:
 *               type: string
 *               example: Administradores
 *             description:
 *               type: string
 *               nullable: true
 *       required:
 *         - id
 *         - firstName
 *         - lastName
 *         - email
 *         - role
 *     UserInput:
 *       type: object
 *       description: Payload de criação (POST /v1/users).
 *       properties:
 *         firstName:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           example: Maria
 *         lastName:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           example: Silva
 *         email:
 *           type: string
 *           format: email
 *           example: maria.silva@promec.com
 *         password:
 *           type: string
 *           minLength: 6
 *           example: senha-secreta
 *         groupId:
 *           type: integer
 *           example: 2
 *         role:
 *           type: string
 *           enum: [admin, user]
 *           default: user
 *       required:
 *         - firstName
 *         - lastName
 *         - email
 *         - password
 *         - groupId
 *     UserUpdateInput:
 *       type: object
 *       description: >
 *         Payload de atualização (PUT /v1/users/{id}). Todos os campos são opcionais.
 *       properties:
 *         firstName:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *         lastName:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minLength: 6
 *           nullable: true
 *           description: Mín. 6 caracteres quando enviado; vazio ('') ou omitido preserva a senha atual.
 *         groupId:
 *           type: integer
 *           nullable: true
 *           description: >
 *             Atenção: no código atual, enviar explicitamente `null` para desvincular o grupo
 *             não funciona — o controller tenta `connect` a um grupo de id 0 e a operação falha
 *             com 500, em vez de desvincular o usuário do grupo.
 *         role:
 *           type: string
 *           enum: [admin, user]
 */

/**
 * @swagger
 * /v1/users:
 *   get:
 *     summary: Lista todos os usuários
 *     description: Requer a permissão `usuarios:gerenciar`. Não é paginado.
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Lista de usuários.
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
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     summary: Cria um novo usuário
 *     description: >
 *       Requer a permissão `usuarios:gerenciar`. Como efeito colateral, enfileira o envio de um
 *       e-mail de boas-vindas (`addToQueue('user_created', ...)`).
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserInput'
 *     responses:
 *       201:
 *         description: Usuário criado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Erro de validação Joi, ou e-mail já cadastrado.
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/ValidationErrorResponse'
 *                 - $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               emailDuplicado:
 *                 summary: E-mail já cadastrado
 *                 value: { message: 'Email já cadastrado' }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', authenticateToken, requirePermission('usuarios:gerenciar'), UserController.list);

/**
 * @swagger
 * /v1/users/{id}:
 *   get:
 *     summary: Busca um usuário pelo ID
 *     description: Requer a permissão `usuarios:gerenciar`.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Usuário encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   put:
 *     summary: Atualiza um usuário existente
 *     description: >
 *       Requer a permissão `usuarios:gerenciar`. Atualização parcial — apenas os campos
 *       enviados são alterados.
 *     tags: [Users]
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
 *             $ref: '#/components/schemas/UserUpdateInput'
 *     responses:
 *       200:
 *         description: Usuário atualizado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: >
 *           Erro interno inesperado. Inclui o caso de `groupId: null` no payload (ver observação
 *           em UserUpdateInput.groupId).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *   delete:
 *     summary: Remove um usuário
 *     description: >
 *       Requer a permissão `usuarios:gerenciar`. Falha com 400 se o usuário estiver vinculado a
 *       um registro de funcionário, tiver gerado relatórios (ReportEmission) ou possuir registros
 *       de alteração em Ordens de Serviço (ServiceOrderTrace).
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       204:
 *         description: Usuário removido com sucesso (sem conteúdo).
 *       400:
 *         description: >
 *           Existem registros vinculados a este usuário que impedem a exclusão (mensagem varia
 *           conforme o vínculo: funcionário, relatórios gerados ou alterações em Ordens de Serviço).
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
router.get('/:id', authenticateToken, requirePermission('usuarios:gerenciar'), UserController.get);
router.post('/', authenticateToken, requirePermission('usuarios:gerenciar'), validateBody(userSchema), UserController.create);
router.put('/:id', authenticateToken, requirePermission('usuarios:gerenciar'), validateBody(userUpdateSchema), UserController.update);
router.delete('/:id', authenticateToken, requirePermission('usuarios:gerenciar'), UserController.delete);

export default router;
