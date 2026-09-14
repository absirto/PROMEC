
import { Router } from 'express';
import { authenticateToken, requirePermission } from '../../../middleware/auth';
import { QualityControlController } from '../controllers/QualityControlController';
import { qcPhotoUpload } from '../../../middleware/qcPhotoUpload';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     QualityControl:
 *       type: object
 *       description: >
 *         Registro de controle de qualidade na forma "crua", sem relações
 *         aninhadas — é o formato retornado pelos endpoints de criação e
 *         atualização (que não usam `include`).
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         serviceOrderId:
 *           type: integer
 *           nullable: true
 *           example: 10
 *         inspectorId:
 *           type: integer
 *           nullable: true
 *           example: 3
 *         inspectionDate:
 *           type: string
 *           format: date-time
 *           description: Definida pelo servidor no momento da criação (não é lida do payload).
 *         status:
 *           type: string
 *           description: >
 *             Texto livre — não há enum no banco de dados. Valores usados
 *             atualmente pelo frontend: "Pendente", "Aprovado", "Reprovado",
 *             "Aprovado com Restrição".
 *           example: Aprovado
 *         finalVerdict:
 *           type: string
 *           nullable: true
 *       required:
 *         - id
 *         - inspectionDate
 *         - status
 *     QualityControlInput:
 *       type: object
 *       description: >
 *         Não há schema Joi nem middleware `validateBody` nesta rota; os
 *         campos abaixo refletem exatamente o que o controller lê de
 *         `req.body`. `inspectionDate` não é aceita no payload — é sempre
 *         definida pelo servidor como o instante da requisição de criação.
 *       properties:
 *         serviceOrderId:
 *           type: integer
 *           nullable: true
 *           example: 10
 *         inspectorId:
 *           type: integer
 *           nullable: true
 *           example: 3
 *         status:
 *           type: string
 *           example: Aprovado
 *         finalVerdict:
 *           type: string
 *           nullable: true
 *     NonConformity:
 *       type: object
 *       description: >
 *         Não conformidade associada a um controle de qualidade. Somente
 *         leitura nestas rotas (retornada aninhada em GET /v1/quality-controls/{id};
 *         não há endpoint de criação/atualização/remoção para esta entidade
 *         neste módulo).
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         type:
 *           type: string
 *         problemDescription:
 *           type: string
 *         suggestedAction:
 *           type: string
 *         responsibleId:
 *           type: integer
 *         deadline:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *         qualityControlId:
 *           type: integer
 *           nullable: true
 *       required:
 *         - id
 *         - type
 *         - problemDescription
 *         - suggestedAction
 *         - responsibleId
 *         - deadline
 *         - status
 *     Measurement:
 *       type: object
 *       description: >
 *         Medição associada a um controle de qualidade. Somente leitura nestas
 *         rotas (retornada aninhada em GET /v1/quality-controls/{id}; não há
 *         endpoint de criação/atualização/remoção para esta entidade neste
 *         módulo).
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         itemMeasured:
 *           type: string
 *         expectedValue:
 *           type: number
 *           format: float
 *         toleranceMin:
 *           type: number
 *           format: float
 *           nullable: true
 *         toleranceMax:
 *           type: number
 *           format: float
 *           nullable: true
 *         measuredValue:
 *           type: number
 *           format: float
 *         unit:
 *           type: string
 *           nullable: true
 *         result:
 *           type: string
 *           nullable: true
 *         qualityControlId:
 *           type: integer
 *           nullable: true
 *       required:
 *         - id
 *         - itemMeasured
 *         - expectedValue
 *         - measuredValue
 *     QualityPhoto:
 *       type: object
 *       description: >
 *         Formato retornado pela API (projeção feita pelo controller a partir
 *         da linha da tabela, não a linha crua). `storagePath` só aparece
 *         quando o arquivo está salvo em disco; `base64` só aparece quando o
 *         conteúdo foi salvo inline em base64 e não há `storagePath`.
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         description:
 *           type: string
 *           example: Foto do defeito na peça
 *         fileName:
 *           type: string
 *           nullable: true
 *         fileType:
 *           type: string
 *           nullable: true
 *           example: image/jpeg
 *         uploadedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         downloadUrl:
 *           type: string
 *           nullable: true
 *           description: Presente apenas quando há arquivo em disco (storagePath).
 *           example: /v1/quality-controls/photos/1/file
 *         storagePath:
 *           type: string
 *           description: Incluído apenas quando o arquivo está salvo em disco.
 *         base64:
 *           type: string
 *           description: Incluído apenas quando o conteúdo foi salvo inline em base64 (sem storagePath).
 *       required:
 *         - id
 *         - description
 *         - downloadUrl
 *     QualityPhotoInput:
 *       type: object
 *       description: Enviado como multipart/form-data.
 *       properties:
 *         file:
 *           type: string
 *           format: binary
 *           description: Arquivo de imagem (campo `file`). Aceita JPEG, PNG, WEBP ou GIF, até 8MB.
 *         description:
 *           type: string
 *           maxLength: 500
 *           example: Foto do defeito na peça
 *       required:
 *         - file
 */

/**
 * @swagger
 * /v1/quality-controls/photos/{photoId}/file:
 *   get:
 *     summary: Faz o download do arquivo binário de uma foto de controle de qualidade
 *     description: >
 *       Requer a permissão `qualidade:visualizar`. Retorna o arquivo bruto
 *       salvo em disco, com `Content-Type` dinâmico conforme o tipo
 *       armazenado; esta resposta não passa pelo envelope padrão
 *       `{ status, data }`.
 *     tags: [QualityControl]
 *     parameters:
 *       - in: path
 *         name: photoId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Conteúdo binário do arquivo da foto.
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Foto sem arquivo associado, ou arquivo ausente em disco.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               semArquivo:
 *                 summary: Foto sem storagePath cadastrado
 *                 value:
 *                   status: error
 *                   message: 'Ficheiro não encontrado.'
 *               arquivoAusente:
 *                 summary: storagePath aponta para um arquivo inexistente em disco
 *                 value:
 *                   status: error
 *                   message: 'Ficheiro em falta no disco.'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/photos/:photoId/file', authenticateToken, requirePermission('qualidade:visualizar'), QualityControlController.downloadPhoto);

/**
 * @swagger
 * /v1/quality-controls/photos/{photoId}:
 *   delete:
 *     summary: Remove uma foto de um controle de qualidade
 *     description: >
 *       Requer a permissão `qualidade:gerenciar`. Remove o registro no banco
 *       e, se existir, o arquivo correspondente em disco.
 *     tags: [QualityControl]
 *     parameters:
 *       - in: path
 *         name: photoId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       204:
 *         description: Foto removida com sucesso (sem conteúdo).
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/photos/:photoId', authenticateToken, requirePermission('qualidade:gerenciar'), QualityControlController.deletePhoto);

/**
 * @swagger
 * /v1/quality-controls:
 *   get:
 *     summary: Lista todos os controles de qualidade
 *     description: >
 *       Requer a permissão `qualidade:visualizar`. Sem paginação e sem
 *       filtros de busca — retorna todos os registros, cada um com a Ordem de
 *       Serviço, o inspetor (com a pessoa/nome aninhados) e as fotos
 *       associadas.
 *     tags: [QualityControl]
 *     responses:
 *       200:
 *         description: Lista de controles de qualidade.
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
 *                       - $ref: '#/components/schemas/QualityControl'
 *                       - type: object
 *                         properties:
 *                           serviceOrder:
 *                             type: object
 *                             nullable: true
 *                             description: >
 *                               Ordem de serviço vinculada — todos os campos
 *                               escalares do modelo ServiceOrder, sem relações
 *                               aninhadas (ver módulo ServiceOrders para o
 *                               schema completo).
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               traceCode:
 *                                 type: string
 *                                 nullable: true
 *                               partCode:
 *                                 type: string
 *                                 nullable: true
 *                               batchCode:
 *                                 type: string
 *                                 nullable: true
 *                               workCenter:
 *                                 type: string
 *                                 nullable: true
 *                               plannedStartDate:
 *                                 type: string
 *                                 format: date-time
 *                                 nullable: true
 *                               plannedEndDate:
 *                                 type: string
 *                                 format: date-time
 *                                 nullable: true
 *                               plannedHours:
 *                                 type: number
 *                                 format: float
 *                                 nullable: true
 *                               description:
 *                                 type: string
 *                                 nullable: true
 *                               personId:
 *                                 type: integer
 *                                 nullable: true
 *                               status:
 *                                 type: string
 *                               openingDate:
 *                                 type: string
 *                                 format: date-time
 *                               closingDate:
 *                                 type: string
 *                                 format: date-time
 *                                 nullable: true
 *                               problemDescription:
 *                                 type: string
 *                               technicalDiagnosis:
 *                                 type: string
 *                                 nullable: true
 *                               profitPercent:
 *                                 type: number
 *                                 format: float
 *                                 nullable: true
 *                               taxPercent:
 *                                 type: number
 *                                 format: float
 *                                 nullable: true
 *                           inspector:
 *                             type: object
 *                             nullable: true
 *                             description: >
 *                               Funcionário inspetor, com a pessoa e o nome
 *                               (naturalPerson) aninhados. Formato diferente
 *                               do usado em GET /v1/quality-controls/{id}, que
 *                               não aninha a pessoa.
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               personId:
 *                                 type: integer
 *                               jobRoleId:
 *                                 type: integer
 *                                 nullable: true
 *                               workAreaId:
 *                                 type: integer
 *                                 nullable: true
 *                               userId:
 *                                 type: integer
 *                                 nullable: true
 *                               matricula:
 *                                 type: string
 *                                 nullable: true
 *                               status:
 *                                 type: string
 *                               person:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: integer
 *                                   type:
 *                                     type: string
 *                                     enum: [F, J]
 *                                   createdAt:
 *                                     type: string
 *                                     format: date-time
 *                                   updatedAt:
 *                                     type: string
 *                                     format: date-time
 *                                   naturalPerson:
 *                                     nullable: true
 *                                     allOf:
 *                                       - $ref: '#/components/schemas/NaturalPerson'
 *                           photos:
 *                             type: array
 *                             items:
 *                               $ref: '#/components/schemas/QualityPhoto'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     summary: Registra um novo controle de qualidade
 *     description: >
 *       Requer a permissão `qualidade:gerenciar`. Sem validação de payload
 *       (não há middleware `validateBody` nesta rota).
 *     tags: [QualityControl]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QualityControlInput'
 *     responses:
 *       201:
 *         description: Controle de qualidade criado (sem relações aninhadas).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/QualityControl'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', authenticateToken, requirePermission('qualidade:visualizar'), QualityControlController.list);

/**
 * @swagger
 * /v1/quality-controls/{id}:
 *   get:
 *     summary: Busca um controle de qualidade pelo ID
 *     description: >
 *       Requer a permissão `qualidade:visualizar`. Inclui a Ordem de Serviço,
 *       o inspetor (dados do funcionário, sem a pessoa aninhada), não
 *       conformidades, medições e fotos.
 *     tags: [QualityControl]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Controle de qualidade encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/QualityControl'
 *                     - type: object
 *                       properties:
 *                         serviceOrder:
 *                           type: object
 *                           nullable: true
 *                           description: >
 *                             Ordem de serviço vinculada — todos os campos
 *                             escalares do modelo ServiceOrder, sem relações
 *                             aninhadas (ver módulo ServiceOrders para o
 *                             schema completo).
 *                           properties:
 *                             id:
 *                               type: integer
 *                             traceCode:
 *                               type: string
 *                               nullable: true
 *                             partCode:
 *                               type: string
 *                               nullable: true
 *                             batchCode:
 *                               type: string
 *                               nullable: true
 *                             workCenter:
 *                               type: string
 *                               nullable: true
 *                             plannedStartDate:
 *                               type: string
 *                               format: date-time
 *                               nullable: true
 *                             plannedEndDate:
 *                               type: string
 *                               format: date-time
 *                               nullable: true
 *                             plannedHours:
 *                               type: number
 *                               format: float
 *                               nullable: true
 *                             description:
 *                               type: string
 *                               nullable: true
 *                             personId:
 *                               type: integer
 *                               nullable: true
 *                             status:
 *                               type: string
 *                             openingDate:
 *                               type: string
 *                               format: date-time
 *                             closingDate:
 *                               type: string
 *                               format: date-time
 *                               nullable: true
 *                             problemDescription:
 *                               type: string
 *                             technicalDiagnosis:
 *                               type: string
 *                               nullable: true
 *                             profitPercent:
 *                               type: number
 *                               format: float
 *                               nullable: true
 *                             taxPercent:
 *                               type: number
 *                               format: float
 *                               nullable: true
 *                         inspector:
 *                           type: object
 *                           nullable: true
 *                           description: >
 *                             Funcionário inspetor — campos escalares do
 *                             modelo Employee, sem a pessoa aninhada (formato
 *                             diferente do usado em GET /v1/quality-controls).
 *                           properties:
 *                             id:
 *                               type: integer
 *                             personId:
 *                               type: integer
 *                             jobRoleId:
 *                               type: integer
 *                               nullable: true
 *                             workAreaId:
 *                               type: integer
 *                               nullable: true
 *                             userId:
 *                               type: integer
 *                               nullable: true
 *                             matricula:
 *                               type: string
 *                               nullable: true
 *                             status:
 *                               type: string
 *                         nonConformities:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/NonConformity'
 *                         measurements:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Measurement'
 *                         photos:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/QualityPhoto'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   put:
 *     summary: Atualiza um controle de qualidade existente
 *     description: >
 *       Requer a permissão `qualidade:gerenciar`. Sem validação de payload
 *       (não há middleware `validateBody` nesta rota).
 *     tags: [QualityControl]
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
 *             $ref: '#/components/schemas/QualityControlInput'
 *     responses:
 *       200:
 *         description: Controle de qualidade atualizado (sem relações aninhadas).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/QualityControl'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   delete:
 *     summary: Remove um controle de qualidade
 *     description: >
 *       Requer a permissão `qualidade:gerenciar`. Também remove do disco os
 *       arquivos das fotos associadas antes de excluir o registro.
 *     tags: [QualityControl]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       204:
 *         description: Controle de qualidade removido com sucesso (sem conteúdo).
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:id', authenticateToken, requirePermission('qualidade:visualizar'), QualityControlController.get);
router.post('/', authenticateToken, requirePermission('qualidade:gerenciar'), QualityControlController.create);

/**
 * @swagger
 * /v1/quality-controls/{qualityControlId}/photos:
 *   post:
 *     summary: Anexa uma foto a um controle de qualidade
 *     description: >
 *       Requer a permissão `qualidade:gerenciar`. Upload multipart (campo
 *       `file`); aceita apenas JPEG, PNG, WEBP ou GIF, até 8MB — arquivos fora
 *       desses limites são rejeitados pelo middleware de upload antes de
 *       chegar ao controller.
 *     tags: [QualityControl]
 *     parameters:
 *       - in: path
 *         name: qualityControlId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/QualityPhotoInput'
 *     responses:
 *       201:
 *         description: Foto anexada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/QualityPhoto'
 *       400:
 *         description: Arquivo não enviado (campo `file` ausente).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               status: error
 *               message: 'Ficheiro de imagem obrigatório (campo file).'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/:qualityControlId/photos',
  authenticateToken,
  requirePermission('qualidade:gerenciar'),
  qcPhotoUpload.single('file'),
  QualityControlController.uploadPhoto,
);
router.put('/:id', authenticateToken, requirePermission('qualidade:gerenciar'), QualityControlController.update);
router.delete('/:id', authenticateToken, requirePermission('qualidade:gerenciar'), QualityControlController.delete);

export default router;
