import { Router } from 'express';
import { PeopleController } from '../controllers/PeopleController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validateBody';
import { personCreateSchema, personUpdateSchema } from '../peopleSchema';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Person:
 *       type: object
 *       description: >
 *         Pessoa física ou jurídica (clientes, fornecedores, funcionários). O
 *         tipo determina qual relação (naturalPerson ou legalPerson) está
 *         preenchida. Endereços e contatos são sempre retornados como arrays
 *         (podendo ser vazios).
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         type:
 *           type: string
 *           enum: [F, J]
 *           description: 'F = pessoa física, J = pessoa jurídica'
 *           example: F
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         naturalPerson:
 *           nullable: true
 *           allOf:
 *             - $ref: '#/components/schemas/NaturalPerson'
 *         legalPerson:
 *           nullable: true
 *           allOf:
 *             - $ref: '#/components/schemas/LegalPerson'
 *         addresses:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Address'
 *         contacts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Contact'
 *       required:
 *         - id
 *         - type
 *         - createdAt
 *         - updatedAt
 *     NaturalPerson:
 *       type: object
 *       description: Dados de pessoa física vinculados a um Person (type=F).
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         cpf:
 *           type: string
 *           example: '12345678901'
 *         name:
 *           type: string
 *           example: Maria Silva
 *         rg:
 *           type: string
 *           nullable: true
 *         orgEmissor:
 *           type: string
 *           nullable: true
 *         ufRg:
 *           type: string
 *           nullable: true
 *           example: SP
 *         birthDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         gender:
 *           type: string
 *           nullable: true
 *           example: F
 *         cnh:
 *           type: string
 *           nullable: true
 *         cnhCategory:
 *           type: string
 *           nullable: true
 *         cnhValidity:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         ctps:
 *           type: string
 *           nullable: true
 *         ctpsSeries:
 *           type: string
 *           nullable: true
 *         pis:
 *           type: string
 *           nullable: true
 *         personId:
 *           type: integer
 *           example: 1
 *       required:
 *         - id
 *         - cpf
 *         - name
 *         - personId
 *     LegalPerson:
 *       type: object
 *       description: Dados de pessoa jurídica vinculados a um Person (type=J).
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         cnpj:
 *           type: string
 *           example: '12345678000199'
 *         corporateName:
 *           type: string
 *           example: Indústria Exemplo Ltda
 *         tradeName:
 *           type: string
 *           nullable: true
 *         stateRegistration:
 *           type: string
 *           nullable: true
 *         municipalRegistration:
 *           type: string
 *           nullable: true
 *         personId:
 *           type: integer
 *           example: 1
 *         representatives:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Representative'
 *       required:
 *         - id
 *         - cnpj
 *         - corporateName
 *         - personId
 *     Representative:
 *       type: object
 *       description: Representante legal de uma pessoa jurídica.
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: João Souza
 *         cpf:
 *           type: string
 *           example: '98765432100'
 *         function:
 *           type: string
 *           example: Sócio-administrador
 *         legalPersonId:
 *           type: integer
 *           example: 1
 *       required:
 *         - id
 *         - name
 *         - cpf
 *         - function
 *         - legalPersonId
 *     Address:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         cep:
 *           type: string
 *           example: '01310100'
 *         logradouro:
 *           type: string
 *           example: Av. Paulista
 *         numero:
 *           type: string
 *           example: '1000'
 *         complemento:
 *           type: string
 *           nullable: true
 *         bairro:
 *           type: string
 *           example: Bela Vista
 *         cidade:
 *           type: string
 *           example: São Paulo
 *         uf:
 *           type: string
 *           example: SP
 *         type:
 *           type: string
 *           enum: [RESIDENCIAL, COMERCIAL, ENTREGA, COBRANCA]
 *         personId:
 *           type: integer
 *           example: 1
 *       required:
 *         - id
 *         - cep
 *         - logradouro
 *         - numero
 *         - bairro
 *         - cidade
 *         - uf
 *         - type
 *         - personId
 *     Contact:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         type:
 *           type: string
 *           enum: [EMAIL, TELEFONE, WHATSAPP, OUTRO]
 *         value:
 *           type: string
 *           example: contato@exemplo.com
 *         description:
 *           type: string
 *           nullable: true
 *         personId:
 *           type: integer
 *           example: 1
 *       required:
 *         - id
 *         - type
 *         - value
 *         - personId
 *     NaturalPersonInput:
 *       type: object
 *       description: >
 *         Campos aceitos dentro de `naturalPerson`. Em POST /v1/people, com
 *         `type=F`, `cpf` e `name` são obrigatórios; em PUT /v1/people/{id}
 *         todos os campos são opcionais.
 *       properties:
 *         cpf:
 *           type: string
 *           minLength: 11
 *           maxLength: 11
 *           example: '12345678901'
 *         name:
 *           type: string
 *           minLength: 3
 *           example: Maria Silva
 *         rg:
 *           type: string
 *           nullable: true
 *         orgEmissor:
 *           type: string
 *           nullable: true
 *         ufRg:
 *           type: string
 *           minLength: 2
 *           maxLength: 2
 *           nullable: true
 *           example: SP
 *         birthDate:
 *           type: string
 *           format: date
 *           nullable: true
 *         gender:
 *           type: string
 *           enum: [M, F, OTHER]
 *           nullable: true
 *     LegalPersonInput:
 *       type: object
 *       description: >
 *         Campos aceitos dentro de `legalPerson`. Em POST /v1/people, com
 *         `type=J`, `cnpj` e `corporateName` são obrigatórios; em
 *         PUT /v1/people/{id} todos os campos são opcionais.
 *       properties:
 *         cnpj:
 *           type: string
 *           minLength: 14
 *           maxLength: 14
 *           example: '12345678000199'
 *         corporateName:
 *           type: string
 *           example: Indústria Exemplo Ltda
 *         tradeName:
 *           type: string
 *           nullable: true
 *         stateRegistration:
 *           type: string
 *           nullable: true
 *         municipalRegistration:
 *           type: string
 *           nullable: true
 *         representatives:
 *           type: array
 *           description: >
 *             Em POST, cada item exige `name`, `cpf` e `function`; em PUT
 *             esses campos são opcionais. Ao ser enviado, substitui
 *             integralmente os representantes existentes.
 *           items:
 *             $ref: '#/components/schemas/RepresentativeInput'
 *     RepresentativeInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: João Souza
 *         cpf:
 *           type: string
 *           minLength: 11
 *           maxLength: 11
 *         function:
 *           type: string
 *           example: Sócio-administrador
 *     AddressInput:
 *       type: object
 *       properties:
 *         cep:
 *           type: string
 *           minLength: 8
 *           maxLength: 8
 *           example: '01310100'
 *         logradouro:
 *           type: string
 *           example: Av. Paulista
 *         numero:
 *           type: string
 *           example: '1000'
 *         complemento:
 *           type: string
 *           nullable: true
 *         bairro:
 *           type: string
 *           example: Bela Vista
 *         cidade:
 *           type: string
 *           example: São Paulo
 *         uf:
 *           type: string
 *           minLength: 2
 *           maxLength: 2
 *           description: Convertido para maiúsculas pelo backend.
 *           example: SP
 *         type:
 *           type: string
 *           enum: [RESIDENCIAL, COMERCIAL, ENTREGA, COBRANCA]
 *       required:
 *         - cep
 *         - logradouro
 *         - numero
 *         - bairro
 *         - cidade
 *         - uf
 *         - type
 *     ContactInput:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           enum: [EMAIL, TELEFONE, WHATSAPP, OUTRO]
 *         value:
 *           type: string
 *           example: contato@exemplo.com
 *         description:
 *           type: string
 *           nullable: true
 *       required:
 *         - type
 *         - value
 *     PersonInput:
 *       type: object
 *       description: >
 *         `naturalPerson` é obrigatório (e `legalPerson` proibido) quando
 *         `type=F`; o inverso vale quando `type=J`. `addresses` e `contacts`
 *         são opcionais (default `[]`).
 *       properties:
 *         type:
 *           type: string
 *           enum: [F, J]
 *         naturalPerson:
 *           $ref: '#/components/schemas/NaturalPersonInput'
 *         legalPerson:
 *           $ref: '#/components/schemas/LegalPersonInput'
 *         addresses:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AddressInput'
 *           default: []
 *         contacts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ContactInput'
 *           default: []
 *       required:
 *         - type
 *     PersonUpdateInput:
 *       type: object
 *       description: >
 *         Todos os campos de nível superior são opcionais, porém ao menos um
 *         deve ser informado. Quando enviados, `naturalPerson`/`legalPerson`
 *         são mesclados (update parcial via Prisma), enquanto `addresses` e
 *         `contacts`, se enviados, substituem integralmente as listas
 *         existentes (os registros atuais são removidos e recriados a partir
 *         do payload).
 *       properties:
 *         type:
 *           type: string
 *           enum: [F, J]
 *         naturalPerson:
 *           $ref: '#/components/schemas/NaturalPersonInput'
 *         legalPerson:
 *           $ref: '#/components/schemas/LegalPersonInput'
 *         addresses:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AddressInput'
 *         contacts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ContactInput'
 */

/**
 * @swagger
 * /v1/people:
 *   get:
 *     summary: Lista pessoas (clientes, fornecedores, funcionários)
 *     description: >
 *       Requer a permissão `pessoas:visualizar`. Por padrão retorna resultado
 *       paginado, com contagens agregadas em `meta`. Se `all=true`, ignora a
 *       paginação e retorna todos os registros que atendem ao filtro em um
 *       array simples.
 *     tags: [People]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: >
 *           Filtro (contém, case-insensitive) por nome da pessoa física, razão
 *           social/nome fantasia da pessoa jurídica, CPF ou CNPJ.
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [F, J]
 *         description: Filtra por tipo de pessoa.
 *       - in: query
 *         name: all
 *         schema:
 *           type: string
 *         example: 'true'
 *         description: Quando igual a `"true"`, retorna todos os registros sem paginação.
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
 *     responses:
 *       200:
 *         description: >
 *           Lista de pessoas. O formato varia conforme `all`: array simples
 *           (sem `meta`) quando `all=true`, ou resultado paginado (com `meta`
 *           incluindo `totalLegal`, `totalPhysical` e `totalNewThisMonth`,
 *           além dos campos padrão de paginação) caso contrário.
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: success
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Person'
 *                 - type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: success
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Person'
 *                     meta:
 *                       allOf:
 *                         - $ref: '#/components/schemas/PaginationMeta'
 *                         - type: object
 *                           properties:
 *                             totalLegal:
 *                               type: integer
 *                               example: 10
 *                             totalPhysical:
 *                               type: integer
 *                               example: 32
 *                             totalNewThisMonth:
 *                               type: integer
 *                               example: 3
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     summary: Cria uma nova pessoa (física ou jurídica)
 *     description: Requer a permissão `pessoas:gerenciar`.
 *     tags: [People]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PersonInput'
 *     responses:
 *       201:
 *         description: Pessoa criada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Person'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', authenticateToken, requirePermission('pessoas:visualizar'), PeopleController.list);

/**
 * @swagger
 * /v1/people/{id}:
 *   get:
 *     summary: Busca uma pessoa pelo ID
 *     description: Requer a permissão `pessoas:visualizar`.
 *     tags: [People]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Pessoa encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Person'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   put:
 *     summary: Atualiza uma pessoa existente
 *     description: >
 *       Requer a permissão `pessoas:gerenciar`. `addresses` e `contacts`,
 *       quando enviados, substituem integralmente as listas existentes; o
 *       mesmo vale para `representatives` dentro de `legalPerson`.
 *     tags: [People]
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
 *             $ref: '#/components/schemas/PersonUpdateInput'
 *     responses:
 *       200:
 *         description: Pessoa atualizada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Person'
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
 *     summary: Remove uma pessoa
 *     description: >
 *       Requer a permissão `pessoas:gerenciar`. Falha com 400 se a pessoa
 *       tiver Ordens de Serviço vinculadas, for um funcionário cadastrado, ou
 *       (como fornecedor) tiver entradas de estoque ou cotações de compra
 *       vinculadas.
 *     tags: [People]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       204:
 *         description: Pessoa removida com sucesso (sem conteúdo).
 *       400:
 *         description: Existem registros vinculados que impedem a exclusão.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               possuiOrdensServico:
 *                 summary: Cliente com Ordens de Serviço vinculadas
 *                 value:
 *                   status: error
 *                   message: 'Não é possível excluir: este cliente possui 2 Ordens de Serviço vinculadas.'
 *               ehFuncionario:
 *                 summary: Pessoa cadastrada como funcionário
 *                 value:
 *                   status: error
 *                   message: 'Não é possível excluir: esta pessoa está cadastrada como funcionário. Exclua o registro de funcionário primeiro.'
 *               possuiEstoque:
 *                 summary: Fornecedor com entradas de estoque vinculadas
 *                 value:
 *                   status: error
 *                   message: 'Não é possível excluir: este fornecedor possui 1 registro(s) de entrada de estoque.'
 *               possuiCotacao:
 *                 summary: Fornecedor com cotações de compra vinculadas
 *                 value:
 *                   status: error
 *                   message: 'Não é possível excluir: este fornecedor possui 1 cotação(ões) de compra vinculada(s).'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:id', authenticateToken, requirePermission('pessoas:visualizar'), PeopleController.get);
router.post('/', authenticateToken, requirePermission('pessoas:gerenciar'), validateBody(personCreateSchema), PeopleController.create);
router.put('/:id', authenticateToken, requirePermission('pessoas:gerenciar'), validateBody(personUpdateSchema), PeopleController.update);
router.delete('/:id', authenticateToken, requirePermission('pessoas:gerenciar'), PeopleController.delete);

export default router;
