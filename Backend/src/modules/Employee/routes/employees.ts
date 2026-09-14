import { Router } from 'express';
import { EmployeeController } from '../controllers/EmployeeController';
import { validateBody } from '../../../middleware/validateBody';
import { employeeCreateSchema, employeeUpdateSchema } from '../employeeSchema';
import { authenticateToken, requirePermission } from '../../../middleware/auth';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Employee:
 *       type: object
 *       description: >
 *         Funcionário. A relação `person` pertence ao módulo People (fora deste escopo) e é
 *         representada aqui de forma mínima. `user`, quando vinculado, é a linha completa do
 *         model User retornada pelo Prisma (`include: { user: true }`, sem `select`) — o campo
 *         `password` (hash bcrypt) nunca é incluído nesta documentação, ainda que outros campos
 *         não sensíveis do usuário estejam de fato presentes na resposta real.
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         personId:
 *           type: integer
 *           example: 10
 *         jobRoleId:
 *           type: integer
 *           nullable: true
 *           example: 2
 *         workAreaId:
 *           type: integer
 *           nullable: true
 *           example: 3
 *         userId:
 *           type: integer
 *           nullable: true
 *           example: 5
 *         matricula:
 *           type: string
 *           nullable: true
 *           example: MAT-0001
 *         status:
 *           type: string
 *           example: Ativo
 *         person:
 *           type: object
 *           description: Pessoa vinculada (módulo People — formato completo fora deste escopo).
 *           properties:
 *             id:
 *               type: integer
 *               example: 10
 *             naturalPerson:
 *               type: object
 *               nullable: true
 *               description: Presente quando a pessoa vinculada é física.
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 10
 *                 name:
 *                   type: string
 *                   example: João da Silva
 *                 cpf:
 *                   type: string
 *                   example: "123.456.789-00"
 *         jobRole:
 *           nullable: true
 *           allOf:
 *             - $ref: '#/components/schemas/JobRole'
 *         workArea:
 *           nullable: true
 *           allOf:
 *             - $ref: '#/components/schemas/WorkArea'
 *         user:
 *           type: object
 *           nullable: true
 *           description: >
 *             Conta de usuário vinculada (linha completa do model User, exceto o campo password,
 *             que esta documentação nunca expõe).
 *           properties:
 *             id:
 *               type: integer
 *               example: 5
 *             firstName:
 *               type: string
 *               example: Maria
 *             lastName:
 *               type: string
 *               example: Silva
 *             email:
 *               type: string
 *               format: email
 *             role:
 *               type: string
 *               example: user
 *             groupId:
 *               type: integer
 *               nullable: true
 *               example: 2
 *             createdAt:
 *               type: string
 *               format: date-time
 *             updatedAt:
 *               type: string
 *               format: date-time
 *       required:
 *         - id
 *         - personId
 *         - status
 *     EmployeeInput:
 *       type: object
 *       description: Payload de criação (POST /v1/employees).
 *       properties:
 *         personId:
 *           type: integer
 *           description: Pessoa (módulo People) a ser vinculada como funcionário.
 *           example: 10
 *         jobRoleId:
 *           type: integer
 *           example: 2
 *         workAreaId:
 *           type: integer
 *           example: 3
 *         matricula:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           example: MAT-0001
 *         status:
 *           type: string
 *           enum: [Ativo, Inativo, Afastado, Férias]
 *           default: Ativo
 *           description: >
 *             Opcional segundo a validação Joi (default "Ativo"), mas o middleware validateBody
 *             não reaplica esse default sobre o corpo da requisição — na prática, omitir este
 *             campo faz o Prisma rejeitar a criação (status é obrigatório no banco), retornando 400.
 *             Recomenda-se sempre enviar o campo explicitamente.
 *         userId:
 *           type: integer
 *           nullable: true
 *           description: Conta de usuário (módulo Users) a ser vinculada a este funcionário.
 *           example: 5
 *       required:
 *         - personId
 *         - jobRoleId
 *         - workAreaId
 *         - matricula
 *     EmployeeUpdateInput:
 *       type: object
 *       description: >
 *         Payload de atualização (PUT /v1/employees/{id}). Todos os campos são opcionais, mas ao
 *         menos um deve ser enviado. `personId` não pode ser alterado após a criação.
 *       minProperties: 1
 *       properties:
 *         jobRoleId:
 *           type: integer
 *           example: 2
 *         workAreaId:
 *           type: integer
 *           example: 3
 *         matricula:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           example: MAT-0001
 *         status:
 *           type: string
 *           enum: [Ativo, Inativo, Afastado, Férias]
 *         userId:
 *           type: integer
 *           nullable: true
 *           example: 5
 */

/**
 * @swagger
 * /v1/employees:
 *   get:
 *     summary: Lista funcionários (paginado)
 *     description: Requer a permissão `funcionarios:visualizar`.
 *     tags: [Employees]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Máximo de 100 itens por página.
 *         example: 20
 *     responses:
 *       200:
 *         description: Lista paginada de funcionários, ordenada pelo nome da pessoa física vinculada.
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
 *                     $ref: '#/components/schemas/Employee'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     summary: Cria um novo funcionário
 *     description: Requer a permissão `funcionarios:gerenciar`.
 *     tags: [Employees]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmployeeInput'
 *     responses:
 *       201:
 *         description: Funcionário criado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Employee'
 *       400:
 *         description: >
 *           Erro de validação Joi, ou falha ao criar (ex.: personId/jobRoleId/workAreaId/userId
 *           inexistente, personId já vinculado a outro funcionário, userId já vinculado a outro
 *           funcionário, ou status omitido — ver observação em EmployeeInput.status).
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/ValidationErrorResponse'
 *                 - $ref: '#/components/schemas/ErrorMessage'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', authenticateToken, requirePermission('funcionarios:visualizar'), EmployeeController.list);

/**
 * @swagger
 * /v1/employees/{id}:
 *   get:
 *     summary: Busca um funcionário pelo ID
 *     description: Requer a permissão `funcionarios:visualizar`.
 *     tags: [Employees]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Funcionário encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Employee'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   put:
 *     summary: Atualiza um funcionário existente
 *     description: >
 *       Requer a permissão `funcionarios:gerenciar`. Atualização parcial — todos os campos do
 *       payload são opcionais, mas ao menos um deve ser enviado.
 *     tags: [Employees]
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
 *             $ref: '#/components/schemas/EmployeeUpdateInput'
 *     responses:
 *       200:
 *         description: Funcionário atualizado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Employee'
 *       400:
 *         description: >
 *           Erro de validação Joi, ou falha ao atualizar (ex.: jobRoleId/workAreaId/userId
 *           inexistente, ou userId já vinculado a outro funcionário).
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/ValidationErrorResponse'
 *                 - $ref: '#/components/schemas/ErrorMessage'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   delete:
 *     summary: Remove um funcionário
 *     description: >
 *       Requer a permissão `funcionarios:gerenciar`. Falha com 400 se o funcionário estiver
 *       vinculado a inspeções de qualidade, apontamentos de operação (ServiceOrderOperationLog)
 *       ou serviços prestados em Ordens de Serviço (ServiceOrderService).
 *     tags: [Employees]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       204:
 *         description: Funcionário removido com sucesso (sem conteúdo).
 *       400:
 *         description: >
 *           Existem registros vinculados a este funcionário que impedem a exclusão (mensagem
 *           varia conforme o vínculo: inspeções de qualidade, apontamentos de operação ou
 *           serviços em Ordens de Serviço).
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
router.get('/:id', authenticateToken, requirePermission('funcionarios:visualizar'), EmployeeController.get);
router.post('/', authenticateToken, requirePermission('funcionarios:gerenciar'), validateBody(employeeCreateSchema), EmployeeController.create);
router.put('/:id', authenticateToken, requirePermission('funcionarios:gerenciar'), validateBody(employeeUpdateSchema), EmployeeController.update);
router.delete('/:id', authenticateToken, requirePermission('funcionarios:gerenciar'), EmployeeController.delete);

export default router;
