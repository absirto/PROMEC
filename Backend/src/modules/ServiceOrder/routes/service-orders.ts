import { Router } from 'express';
import { ServiceOrderController } from '../controllers/ServiceOrderController';
import { PurchaseController } from '../controllers/PurchaseController';
import { PCPController } from '../controllers/PCPController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';

import { validateBody } from '../../../middleware/validateBody';
import { serviceOrderCreateSchema, serviceOrderUpdateSchema } from '../serviceOrderSchema';

const router = Router();
const ensureNumericId = (req: any, _res: any, next: any) => (/^\d+$/.test(String(req.params.id)) ? next() : next('route'));

/**
 * @swagger
 * components:
 *   schemas:
 *     ServiceOrder:
 *       type: object
 *       description: >
 *         Os campos `profitPercent`, `taxPercent`, `financials` e o array `transactions` são omitidos
 *         (via FinancialService.sanitizeOrder) quando o usuário autenticado não possui a permissão
 *         `financeiro:visualizar`, `financeiro:gerenciar`, `financeiro:*` nem role `admin`. Nas mesmas
 *         condições, os itens de `materials` e `services` são retornados sem `unitPrice`/`totalPrice`.
 *         Essa sanitização é aplicada em GET /v1/service-orders, GET /v1/service-orders/{id} e
 *         PATCH /v1/service-orders/{id}/plan — mas NÃO em POST /v1/service-orders nem em
 *         PUT /v1/service-orders/{id}, que sempre retornam os campos financeiros completos (ver nota em
 *         cada operação). O campo `financials` é calculado em memória (FinancialService.enrichFinancials)
 *         a partir de materials/services/transactions e não existe como coluna na tabela.
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         traceCode:
 *           type: string
 *           nullable: true
 *           description: Gerado automaticamente (OS-AAAAMMDD-XXXXXX) se não informado na criação.
 *           example: OS-20260914-A1B2C3
 *         partCode:
 *           type: string
 *           nullable: true
 *         batchCode:
 *           type: string
 *           nullable: true
 *         workCenter:
 *           type: string
 *           nullable: true
 *           example: Usinagem
 *         plannedStartDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         plannedEndDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         plannedHours:
 *           type: number
 *           nullable: true
 *         description:
 *           type: string
 *           nullable: true
 *         personId:
 *           type: integer
 *           nullable: true
 *         status:
 *           type: string
 *           example: Aberta
 *         openingDate:
 *           type: string
 *           format: date-time
 *         closingDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         problemDescription:
 *           type: string
 *         technicalDiagnosis:
 *           type: string
 *           nullable: true
 *         profitPercent:
 *           type: number
 *           nullable: true
 *           description: Omitido sem permissão financeira (ver descrição do schema).
 *         taxPercent:
 *           type: number
 *           nullable: true
 *           description: Omitido sem permissão financeira (ver descrição do schema).
 *         person:
 *           type: object
 *           nullable: true
 *           description: Relação com o módulo People, embutida inline (não é um schema deste módulo).
 *           properties:
 *             id:
 *               type: integer
 *             type:
 *               type: string
 *               example: FISICA
 *             naturalPerson:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 cpf:
 *                   type: string
 *             legalPerson:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id:
 *                   type: integer
 *                 corporateName:
 *                   type: string
 *                 tradeName:
 *                   type: string
 *                   nullable: true
 *                 cnpj:
 *                   type: string
 *         services:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ServiceOrderService'
 *         materials:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ServiceOrderMaterial'
 *         qualityControls:
 *           type: array
 *           description: Registros do módulo QualityControl, embutidos inline (apenas campos escalares).
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               serviceOrderId:
 *                 type: integer
 *                 nullable: true
 *               inspectorId:
 *                 type: integer
 *                 nullable: true
 *               inspectionDate:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *               finalVerdict:
 *                 type: string
 *                 nullable: true
 *         transactions:
 *           type: array
 *           description: Array inteiro omitido sem permissão financeira (ver descrição do schema).
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               type:
 *                 type: string
 *                 example: RECEIVABLE
 *               amount:
 *                 type: number
 *               category:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *               description:
 *                 type: string
 *                 nullable: true
 *               orderId:
 *                 type: integer
 *                 nullable: true
 *         traces:
 *           type: array
 *           description: >
 *             Histórico de alterações (ServiceOrderTrace). Em GET /v1/service-orders (listagem) traz
 *             apenas o último registro, com campos reduzidos {id, action, changedByEmail, createdAt}; em
 *             GET /v1/service-orders/{id} traz o histórico completo; em PUT /v1/service-orders/{id} traz
 *             os 20 mais recentes; em PATCH /v1/service-orders/{id}/plan traz os 10 mais recentes; e é
 *             omitido por completo em POST /v1/service-orders (create).
 *           items:
 *             $ref: '#/components/schemas/ServiceOrderTrace'
 *         financials:
 *           type: object
 *           nullable: true
 *           description: Calculado em memória; ausente sem permissão financeira (ver descrição do schema).
 *           properties:
 *             materialCost:
 *               type: number
 *             laborCost:
 *               type: number
 *             directCost:
 *               type: number
 *             profitPercent:
 *               type: number
 *             profitAmount:
 *               type: number
 *             taxPercent:
 *               type: number
 *             taxAmount:
 *               type: number
 *             totalEstimated:
 *               type: number
 *             receivables:
 *               type: number
 *             payables:
 *               type: number
 *             realizedMargin:
 *               type: number
 *       required:
 *         - id
 *         - status
 *         - openingDate
 *         - problemDescription
 *     ServiceOrderInput:
 *       type: object
 *       properties:
 *         traceCode:
 *           type: string
 *           maxLength: 50
 *           nullable: true
 *           description: Se omitido, é gerado automaticamente (OS-AAAAMMDD-XXXXXX).
 *         partCode:
 *           type: string
 *           maxLength: 100
 *           nullable: true
 *         batchCode:
 *           type: string
 *           maxLength: 100
 *           nullable: true
 *         workCenter:
 *           type: string
 *           maxLength: 100
 *           nullable: true
 *         plannedStartDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         plannedEndDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Deve ser maior ou igual a plannedStartDate.
 *         plannedHours:
 *           type: number
 *           minimum: 0
 *           nullable: true
 *         description:
 *           type: string
 *           nullable: true
 *         personId:
 *           type: integer
 *         status:
 *           type: string
 *         openingDate:
 *           type: string
 *           format: date-time
 *           description: Default é a data/hora atual se omitido.
 *         closingDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Deve ser maior ou igual a openingDate.
 *         problemDescription:
 *           type: string
 *           nullable: true
 *         technicalDiagnosis:
 *           type: string
 *           nullable: true
 *         taxPercent:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *           default: 0
 *         profitPercent:
 *           type: number
 *           minimum: 0
 *           default: 0
 *         services:
 *           type: array
 *           default: []
 *           items:
 *             $ref: '#/components/schemas/ServiceOrderServiceInput'
 *         materials:
 *           type: array
 *           default: []
 *           items:
 *             $ref: '#/components/schemas/ServiceOrderMaterialInput'
 *       required:
 *         - personId
 *         - status
 *     ServiceOrderUpdateInput:
 *       type: object
 *       description: >
 *         Todos os campos são opcionais, porém ao menos um campo deve ser informado no corpo (validação
 *         Joi `.min(1)`). Campos omitidos preservam o valor atual da OS. Se `services`/`materials` forem
 *         informados, substituem por completo os registros existentes (delete + recreate).
 *       properties:
 *         traceCode:
 *           type: string
 *           maxLength: 50
 *           nullable: true
 *         partCode:
 *           type: string
 *           maxLength: 100
 *           nullable: true
 *         batchCode:
 *           type: string
 *           maxLength: 100
 *           nullable: true
 *         workCenter:
 *           type: string
 *           maxLength: 100
 *           nullable: true
 *         plannedStartDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         plannedEndDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Deve ser maior ou igual a plannedStartDate.
 *         plannedHours:
 *           type: number
 *           minimum: 0
 *           nullable: true
 *         description:
 *           type: string
 *           nullable: true
 *         personId:
 *           type: integer
 *         status:
 *           type: string
 *         openingDate:
 *           type: string
 *           format: date-time
 *         closingDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Deve ser maior ou igual a openingDate.
 *         problemDescription:
 *           type: string
 *           nullable: true
 *         technicalDiagnosis:
 *           type: string
 *           nullable: true
 *         taxPercent:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *         profitPercent:
 *           type: number
 *           minimum: 0
 *         services:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ServiceOrderServiceInput'
 *         materials:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ServiceOrderMaterialInput'
 *     ServiceOrderPlanInput:
 *       type: object
 *       description: Todos os campos são opcionais; os omitidos preservam o valor atual da OS.
 *       properties:
 *         workCenter:
 *           type: string
 *           nullable: true
 *         plannedStartDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         plannedEndDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         plannedHours:
 *           type: number
 *           minimum: 0
 *           nullable: true
 *     ServiceOrderPlanBatchInput:
 *       type: object
 *       description: >
 *         Aplica os mesmos campos de planejamento a várias OS de uma vez. Campos de plano omitidos
 *         preservam o valor atual de cada OS; ao menos um campo de plano deve ser informado.
 *       properties:
 *         ids:
 *           type: array
 *           items:
 *             type: integer
 *           description: IDs das ordens de serviço a replanejar.
 *           example: [10, 11, 12]
 *         workCenter:
 *           type: string
 *           nullable: true
 *         plannedStartDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         plannedEndDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         plannedHours:
 *           type: number
 *           minimum: 0
 *           nullable: true
 *       required:
 *         - ids
 *     ServiceOrderService:
 *       type: object
 *       description: >
 *         Vínculo de um serviço do catálogo com a OS. `unitPrice`/`totalPrice` são omitidos sem permissão
 *         financeira (ver schema ServiceOrder).
 *       properties:
 *         id:
 *           type: integer
 *         serviceOrderId:
 *           type: integer
 *         serviceId:
 *           type: integer
 *         employeeId:
 *           type: integer
 *           nullable: true
 *         description:
 *           type: string
 *           nullable: true
 *         hoursWorked:
 *           type: number
 *         unitPrice:
 *           type: number
 *         totalPrice:
 *           type: number
 *         service:
 *           type: object
 *           description: Relação com o módulo Services, embutida inline.
 *           properties:
 *             id:
 *               type: integer
 *             name:
 *               type: string
 *             description:
 *               type: string
 *               nullable: true
 *             price:
 *               type: number
 *             active:
 *               type: boolean
 *         employee:
 *           type: object
 *           nullable: true
 *           description: Relação com o módulo Employees, embutida inline (apenas campos escalares).
 *           properties:
 *             id:
 *               type: integer
 *             personId:
 *               type: integer
 *             jobRoleId:
 *               type: integer
 *               nullable: true
 *             workAreaId:
 *               type: integer
 *               nullable: true
 *             userId:
 *               type: integer
 *               nullable: true
 *             matricula:
 *               type: string
 *               nullable: true
 *             status:
 *               type: string
 *       required:
 *         - id
 *         - serviceOrderId
 *         - serviceId
 *         - hoursWorked
 *         - unitPrice
 *         - totalPrice
 *     ServiceOrderServiceInput:
 *       type: object
 *       properties:
 *         serviceId:
 *           type: integer
 *         employeeId:
 *           type: integer
 *           nullable: true
 *         description:
 *           type: string
 *           nullable: true
 *         hoursWorked:
 *           type: number
 *           minimum: 0
 *           default: 0
 *         unitPrice:
 *           type: number
 *           minimum: 0
 *           default: 0
 *         totalPrice:
 *           type: number
 *           minimum: 0
 *           default: 0
 *       required:
 *         - serviceId
 *     ServiceOrderMaterial:
 *       type: object
 *       description: >
 *         Vínculo de um material com a OS. `unitPrice`/`totalPrice` são omitidos sem permissão financeira
 *         (ver schema ServiceOrder).
 *       properties:
 *         id:
 *           type: integer
 *         serviceOrderId:
 *           type: integer
 *         materialId:
 *           type: integer
 *         quantity:
 *           type: number
 *         unitPrice:
 *           type: number
 *         totalPrice:
 *           type: number
 *         material:
 *           type: object
 *           description: Relação com o módulo Materials, embutida inline.
 *           properties:
 *             id:
 *               type: integer
 *             name:
 *               type: string
 *             description:
 *               type: string
 *               nullable: true
 *             price:
 *               type: number
 *             unit:
 *               type: string
 *             active:
 *               type: boolean
 *       required:
 *         - id
 *         - serviceOrderId
 *         - materialId
 *         - quantity
 *         - unitPrice
 *         - totalPrice
 *     ServiceOrderMaterialInput:
 *       type: object
 *       properties:
 *         materialId:
 *           type: integer
 *         quantity:
 *           type: number
 *           minimum: 0
 *         unitPrice:
 *           type: number
 *           minimum: 0
 *           default: 0
 *         totalPrice:
 *           type: number
 *           minimum: 0
 *           default: 0
 *       required:
 *         - materialId
 *         - quantity
 *     ServiceOrderOperationLog:
 *       type: object
 *       description: Apontamento operacional (mão de obra/parada) lançado sobre uma OS.
 *       properties:
 *         id:
 *           type: integer
 *         serviceOrderId:
 *           type: integer
 *         employeeId:
 *           type: integer
 *           nullable: true
 *         operationType:
 *           type: string
 *           enum: [USINAGEM, CALDEIRARIA, MONTAGEM]
 *         shift:
 *           type: string
 *           nullable: true
 *           enum: [MORNING, AFTERNOON, NIGHT]
 *         startAt:
 *           type: string
 *           format: date-time
 *         endAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         workedHours:
 *           type: number
 *           nullable: true
 *         downtimeMinutes:
 *           type: number
 *         downtimeCategory:
 *           type: string
 *           nullable: true
 *           enum: [MACHINE, MATERIAL, SETUP, RETRABALHO, QUALIDADE, OUTROS]
 *         downtimeReason:
 *           type: string
 *           nullable: true
 *         notes:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         employee:
 *           type: object
 *           nullable: true
 *           description: >
 *             Relação com o módulo Employees, embutida inline, incluindo a pessoa vinculada (módulo
 *             People, também embutida inline).
 *           properties:
 *             id:
 *               type: integer
 *             personId:
 *               type: integer
 *             jobRoleId:
 *               type: integer
 *               nullable: true
 *             workAreaId:
 *               type: integer
 *               nullable: true
 *             userId:
 *               type: integer
 *               nullable: true
 *             matricula:
 *               type: string
 *               nullable: true
 *             status:
 *               type: string
 *             person:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 type:
 *                   type: string
 *                 naturalPerson:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     cpf:
 *                       type: string
 *                 legalPerson:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: integer
 *                     corporateName:
 *                       type: string
 *                     cnpj:
 *                       type: string
 *       required:
 *         - id
 *         - serviceOrderId
 *         - operationType
 *         - startAt
 *         - downtimeMinutes
 *         - createdAt
 *         - updatedAt
 *     ServiceOrderOperationLogInput:
 *       type: object
 *       description: >
 *         Sem validação Joi — validado manualmente em ServiceOrderService.addOperation. workedHours, se
 *         omitido, é calculado a partir de (endAt - startAt - downtimeMinutes); se endAt for omitido, fica
 *         nulo.
 *       properties:
 *         operationType:
 *           type: string
 *           enum: [USINAGEM, CALDEIRARIA, MONTAGEM]
 *         shift:
 *           type: string
 *           nullable: true
 *           enum: [MORNING, AFTERNOON, NIGHT]
 *         downtimeCategory:
 *           type: string
 *           nullable: true
 *           enum: [MACHINE, MATERIAL, SETUP, RETRABALHO, QUALIDADE, OUTROS]
 *         startAt:
 *           type: string
 *           format: date-time
 *         endAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Se informado, deve ser maior ou igual a startAt.
 *         downtimeMinutes:
 *           type: number
 *           minimum: 0
 *           default: 0
 *         employeeId:
 *           type: integer
 *           nullable: true
 *           description: Se informado, deve ser um Employee existente.
 *         workedHours:
 *           type: number
 *           minimum: 0
 *           nullable: true
 *         downtimeReason:
 *           type: string
 *           nullable: true
 *         notes:
 *           type: string
 *           nullable: true
 *       required:
 *         - operationType
 *         - startAt
 *     ServiceOrderTrace:
 *       type: object
 *       description: Registro de auditoria/histórico de uma OS (ação, autor e payload da mudança).
 *       properties:
 *         id:
 *           type: integer
 *         serviceOrderId:
 *           type: integer
 *           nullable: true
 *         serviceOrderCode:
 *           type: string
 *           nullable: true
 *         action:
 *           type: string
 *           example: CREATE
 *         changedByUserId:
 *           type: integer
 *           nullable: true
 *         changedByEmail:
 *           type: string
 *           nullable: true
 *         payload:
 *           type: object
 *           nullable: true
 *           description: JSON livre com os dados relevantes da ação (formato varia por `action`).
 *         createdAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - id
 *         - action
 *         - createdAt
 *     PurchaseRequest:
 *       type: object
 *       description: >
 *         O campo `serviceOrder` inclui `description` em GET /purchase-requests e no fulfill, mas apenas
 *         {id, traceCode} na criação (POST /purchase-requests).
 *       properties:
 *         id:
 *           type: integer
 *         code:
 *           type: string
 *           example: SC-20260914-1530-AB12
 *         serviceOrderId:
 *           type: integer
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [OPEN, PARTIAL, CLOSED]
 *         notes:
 *           type: string
 *           nullable: true
 *         requestedByEmail:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         serviceOrder:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: integer
 *             traceCode:
 *               type: string
 *               nullable: true
 *             description:
 *               type: string
 *               nullable: true
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PurchaseRequestItem'
 *       required:
 *         - id
 *         - code
 *         - status
 *         - createdAt
 *         - updatedAt
 *     PurchaseRequestItem:
 *       type: object
 *       description: >
 *         O campo `material` vem completo (todos os campos de Material) quando embutido dentro da
 *         resposta de criação de solicitação de compra (POST /purchase-requests) e dentro de
 *         PurchaseQuotation.purchaseRequest.items; nas demais respostas (listagem/fulfill de
 *         purchase-requests) vem projetado como {id, name, unit, price}.
 *       properties:
 *         id:
 *           type: integer
 *         purchaseRequestId:
 *           type: integer
 *         materialId:
 *           type: integer
 *         requestedQty:
 *           type: number
 *         stockQty:
 *           type: number
 *         shortageQty:
 *           type: number
 *         unit:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [PENDING, PARTIAL, PURCHASED]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         material:
 *           type: object
 *           description: Relação com o módulo Materials, embutida inline (projeção varia, ver acima).
 *           properties:
 *             id:
 *               type: integer
 *             name:
 *               type: string
 *             unit:
 *               type: string
 *             price:
 *               type: number
 *       required:
 *         - id
 *         - purchaseRequestId
 *         - materialId
 *         - requestedQty
 *         - stockQty
 *         - shortageQty
 *         - status
 *         - createdAt
 *         - updatedAt
 *     PurchaseRequestInput:
 *       type: object
 *       description: >
 *         Sem validação Joi (validado manualmente no controller). Itens sem materialId válido (> 0) ou com
 *         shortageQty <= 0 são descartados silenciosamente; se nenhum item restar após o filtro, a
 *         operação retorna 400.
 *       properties:
 *         serviceOrderId:
 *           type: integer
 *           nullable: true
 *           description: Se informado, a OS deve existir.
 *         notes:
 *           type: string
 *           nullable: true
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               materialId:
 *                 type: integer
 *               requestedQty:
 *                 type: number
 *                 minimum: 0
 *               stockQty:
 *                 type: number
 *                 minimum: 0
 *               shortageQty:
 *                 type: number
 *                 minimum: 0
 *                 description: Itens com shortageQty <= 0 são descartados do payload.
 *               unit:
 *                 type: string
 *                 nullable: true
 *             required:
 *               - materialId
 *               - shortageQty
 *       required:
 *         - items
 *     PurchaseRequestFulfillInput:
 *       type: object
 *       description: >
 *         Sem validação Joi (validado manualmente no controller). Para cada item, ao menos um de
 *         unitCost/totalPaid deve resultar em um custo unitário positivo, senão a operação retorna 400
 *         (ITEM_COST_REQUIRED). Itens cujo purchaseRequestItem já esteja com status PURCHASED são
 *         ignorados silenciosamente.
 *       properties:
 *         supplierPersonId:
 *           type: integer
 *         description:
 *           type: string
 *           nullable: true
 *           description: Usado como descrição do lançamento de estoque quando o item não tiver notes.
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               purchaseRequestItemId:
 *                 type: integer
 *               quantity:
 *                 type: number
 *                 minimum: 0
 *                 exclusiveMinimum: true
 *               unitCost:
 *                 type: number
 *                 nullable: true
 *               totalPaid:
 *                 type: number
 *                 nullable: true
 *               notes:
 *                 type: string
 *                 nullable: true
 *             required:
 *               - purchaseRequestItemId
 *               - quantity
 *       required:
 *         - supplierPersonId
 *         - items
 *     PurchaseQuotation:
 *       type: object
 *       description: >
 *         purchaseRequest.items[].material vem completo (todos os campos de Material) nesta resposta,
 *         diferente da projeção reduzida {id, name, unit, price} usada em PurchaseRequestItem em outras
 *         respostas (ver schema PurchaseRequestItem).
 *       properties:
 *         id:
 *           type: integer
 *         code:
 *           type: string
 *           example: COT-20260914-1530-CD34
 *         purchaseRequestId:
 *           type: integer
 *         supplierPersonId:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [OPEN, APPROVED, REJECTED]
 *         notes:
 *           type: string
 *           nullable: true
 *         validUntil:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         paymentTerms:
 *           type: string
 *           nullable: true
 *         freightMode:
 *           type: string
 *           nullable: true
 *         freightCost:
 *           type: number
 *           nullable: true
 *         deliveryLeadTimeDays:
 *           type: integer
 *           nullable: true
 *         warrantyDays:
 *           type: integer
 *           nullable: true
 *         createdByEmail:
 *           type: string
 *           nullable: true
 *         approvedByEmail:
 *           type: string
 *           nullable: true
 *         approvedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         supplierPerson:
 *           type: object
 *           description: Relação com o módulo People, embutida inline.
 *           properties:
 *             id:
 *               type: integer
 *             type:
 *               type: string
 *             naturalPerson:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 cpf:
 *                   type: string
 *             legalPerson:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id:
 *                   type: integer
 *                 corporateName:
 *                   type: string
 *                 cnpj:
 *                   type: string
 *         purchaseRequest:
 *           $ref: '#/components/schemas/PurchaseRequest'
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PurchaseQuotationItem'
 *       required:
 *         - id
 *         - code
 *         - purchaseRequestId
 *         - supplierPersonId
 *         - status
 *         - createdAt
 *         - updatedAt
 *     PurchaseQuotationItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         quotationId:
 *           type: integer
 *         purchaseRequestItemId:
 *           type: integer
 *         materialId:
 *           type: integer
 *         quantity:
 *           type: number
 *         unitCost:
 *           type: number
 *         ipiValue:
 *           type: number
 *           nullable: true
 *         icmsValue:
 *           type: number
 *           nullable: true
 *         stValue:
 *           type: number
 *           nullable: true
 *         totalPaid:
 *           type: number
 *         notes:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         material:
 *           type: object
 *           description: Relação com o módulo Materials, embutida inline (completa).
 *           properties:
 *             id:
 *               type: integer
 *             name:
 *               type: string
 *             description:
 *               type: string
 *               nullable: true
 *             price:
 *               type: number
 *             unit:
 *               type: string
 *             active:
 *               type: boolean
 *         purchaseRequestItem:
 *           $ref: '#/components/schemas/PurchaseRequestItem'
 *       required:
 *         - id
 *         - quotationId
 *         - purchaseRequestItemId
 *         - materialId
 *         - quantity
 *         - unitCost
 *         - totalPaid
 *         - createdAt
 *         - updatedAt
 *     PurchaseQuotationInput:
 *       type: object
 *       description: >
 *         Sem validação Joi — os campos abaixo refletem os campos obrigatórios (não-nulos) dos models
 *         Prisma PurchaseQuotation/PurchaseQuotationItem. A ausência de `items` causa erro 400 com uma
 *         mensagem de runtime (TypeError); a ausência de outros campos obrigatórios do Prisma (ex.:
 *         purchaseRequestId, supplierPersonId inexistentes) resulta em 400 com a mensagem de erro lançada
 *         pelo Prisma.
 *       properties:
 *         purchaseRequestId:
 *           type: integer
 *         supplierPersonId:
 *           type: integer
 *         notes:
 *           type: string
 *           nullable: true
 *         validUntil:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         paymentTerms:
 *           type: string
 *           nullable: true
 *         freightMode:
 *           type: string
 *           nullable: true
 *         freightCost:
 *           type: number
 *           nullable: true
 *         deliveryLeadTimeDays:
 *           type: integer
 *           nullable: true
 *         warrantyDays:
 *           type: integer
 *           nullable: true
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               purchaseRequestItemId:
 *                 type: integer
 *               materialId:
 *                 type: integer
 *               quantity:
 *                 type: number
 *               unitCost:
 *                 type: number
 *               ipiValue:
 *                 type: number
 *                 nullable: true
 *               icmsValue:
 *                 type: number
 *                 nullable: true
 *               stValue:
 *                 type: number
 *                 nullable: true
 *               totalPaid:
 *                 type: number
 *               notes:
 *                 type: string
 *                 nullable: true
 *             required:
 *               - purchaseRequestItemId
 *               - materialId
 *               - quantity
 *               - unitCost
 *               - totalPaid
 *       required:
 *         - purchaseRequestId
 *         - supplierPersonId
 *         - items
 */

/**
 * @swagger
 * /v1/service-orders:
 *   get:
 *     summary: Lista ordens de serviço
 *     description: >
 *       Requer permissão `os:visualizar`. Suporta paginação, busca textual e filtros de status/período.
 *       Se `all=true`, ignora a paginação e retorna todos os registros que atendem aos filtros em `data`
 *       (sem `meta`, sem `qualityControls`/`transactions` sanitizados de forma diferente — mesma
 *       sanitização se aplica). A resposta é sanitizada por FinancialService.sanitizeOrder (ver schema
 *       ServiceOrder); cada item traz apenas o último registro de `traces`, com campos reduzidos
 *       {id, action, changedByEmail, createdAt}.
 *     tags: [ServiceOrders]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Ignorado quando all=true.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Ignorado quando all=true.
 *       - in: query
 *         name: all
 *         schema:
 *           type: boolean
 *         description: Se true, retorna todos os registros (sem paginação) como array simples em data.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca por traceCode, partCode, description ou nome/razão social do cliente.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filtro exato de status. Tem prioridade sobre excludeCancelled.
 *       - in: query
 *         name: excludeCancelled
 *         schema:
 *           type: boolean
 *         description: Se true (e status não informado), exclui OS com status "Cancelada".
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filtra openingDate >= startDate.
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filtra openingDate <= endDate (fim do dia, 23:59:59.999).
 *     responses:
 *       200:
 *         description: Lista de ordens de serviço.
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
 *                     $ref: '#/components/schemas/ServiceOrder'
 *                 meta:
 *                   allOf:
 *                     - $ref: '#/components/schemas/PaginationMeta'
 *                   description: Ausente quando all=true.
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         description: Erro ao listar ordens de serviço.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *   post:
 *     summary: Cria uma nova ordem de serviço
 *     description: >
 *       Requer permissão `os:gerenciar`. Diferente de GET, esta resposta NÃO passa por
 *       FinancialService.sanitizeOrder — os campos financeiros (profitPercent, taxPercent, financials) e
 *       os preços de materials/services são sempre incluídos, independente da permissão financeira do
 *       usuário. A resposta inclui apenas person, services e materials (sem qualityControls, transactions
 *       ou traces). Dispara uma notificação assíncrona de "Nova OS Aberta".
 *     tags: [ServiceOrders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceOrderInput'
 *     responses:
 *       201:
 *         description: Ordem de serviço criada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/ServiceOrder'
 *       400:
 *         description: Erro de validação Joi ou erro ao criar (ex. personId inexistente).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.list);

// PCP Endpoints
/**
 * @swagger
 * /v1/service-orders/materials/check:
 *   post:
 *     summary: Verifica a cobertura de estoque para uma lista de materiais
 *     description: >
 *       Requer permissão `os:visualizar`. Calcula, para cada material informado, o saldo atual em estoque
 *       (soma de StockLog IN menos OUT) e a ruptura (shortage) em relação à quantidade solicitada. Itens
 *       com materialId inválido ou quantity <= 0 são ignorados silenciosamente; se nenhum item restar,
 *       retorna items vazio com totais zerados (coveragePercent 100).
 *     tags: [ServiceOrders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               materials:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     materialId:
 *                       type: integer
 *                     quantity:
 *                       type: number
 *                       minimum: 0
 *     responses:
 *       200:
 *         description: Cobertura de estoque calculada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           materialId:
 *                             type: integer
 *                           materialName:
 *                             type: string
 *                           unit:
 *                             type: string
 *                           requestedQty:
 *                             type: number
 *                           stockQty:
 *                             type: number
 *                           shortageQty:
 *                             type: number
 *                           coveragePercent:
 *                             type: number
 *                           status:
 *                             type: string
 *                             enum: [SHORTAGE, OK]
 *                     totals:
 *                       type: object
 *                       properties:
 *                         requestedQty:
 *                           type: number
 *                         stockQty:
 *                           type: number
 *                         shortageQty:
 *                           type: number
 *                         coveragePercent:
 *                           type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/materials/check', authenticateToken, requirePermission('os:visualizar'), PCPController.checkMaterialsCoverage);

/**
 * @swagger
 * /v1/service-orders/pcp/overview:
 *   get:
 *     summary: Visão consolidada de carga de trabalho por centro de trabalho (PCP)
 *     description: >
 *       Requer permissão `os:visualizar`. Considera apenas OS com status diferente de "Concluída"/
 *       "Cancelada" cuja janela planejada (plannedStartDate/plannedEndDate) sobrepõe o período informado.
 *     tags: [ServiceOrders]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Default é a data/hora atual.
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Default é startDate + 6 dias.
 *       - in: query
 *         name: dailyCapacityHours
 *         schema:
 *           type: number
 *           default: 8
 *     responses:
 *       200:
 *         description: Visão PCP calculada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     periodStart:
 *                       type: string
 *                       format: date-time
 *                     periodEnd:
 *                       type: string
 *                       format: date-time
 *                     dailyCapacityHours:
 *                       type: number
 *                     days:
 *                       type: integer
 *                     centers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           workCenter:
 *                             type: string
 *                           ordersCount:
 *                             type: integer
 *                           plannedHours:
 *                             type: number
 *                           capacityHours:
 *                             type: number
 *                           loadPercent:
 *                             type: number
 *                           orders:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                 traceCode:
 *                                   type: string
 *                                   nullable: true
 *                                 description:
 *                                   type: string
 *                                   nullable: true
 *                                 status:
 *                                   type: string
 *                                 workCenter:
 *                                   type: string
 *                                   nullable: true
 *                                 plannedStartDate:
 *                                   type: string
 *                                   format: date-time
 *                                   nullable: true
 *                                 plannedEndDate:
 *                                   type: string
 *                                   format: date-time
 *                                   nullable: true
 *                                 plannedHours:
 *                                   type: number
 *                                   nullable: true
 *       400:
 *         description: Período inválido (datas não parseáveis).
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
router.get('/pcp/overview', authenticateToken, requirePermission('os:visualizar'), PCPController.pcpOverview);

/**
 * @swagger
 * /v1/service-orders/pcp/calendar:
 *   get:
 *     summary: Calendário diário/por turno de carga de trabalho por centro de trabalho (PCP)
 *     description: >
 *       Requer permissão `os:visualizar`. Distribui as horas planejadas de cada OS proporcionalmente pelos
 *       dias do período (spanDays) e pelos turnos configurados. Considera apenas OS com status diferente
 *       de "Concluída"/"Cancelada" e com plannedStartDate/plannedEndDate definidos.
 *     tags: [ServiceOrders]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Default é a data atual (início do dia).
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Default é startDate + 6 dias.
 *       - in: query
 *         name: morningHours
 *         schema:
 *           type: number
 *           default: 4
 *       - in: query
 *         name: afternoonHours
 *         schema:
 *           type: number
 *           default: 4
 *       - in: query
 *         name: nightHours
 *         schema:
 *           type: number
 *           default: 0
 *     responses:
 *       200:
 *         description: Calendário PCP calculado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     periodStart:
 *                       type: string
 *                       format: date-time
 *                     periodEnd:
 *                       type: string
 *                       format: date-time
 *                     days:
 *                       type: array
 *                       items:
 *                         type: string
 *                         example: "2026-09-14"
 *                     shiftConfig:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           key:
 *                             type: string
 *                             enum: [morning, afternoon, night]
 *                           label:
 *                             type: string
 *                             enum: [Manha, Tarde, Noite]
 *                           hours:
 *                             type: number
 *                     centers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           workCenter:
 *                             type: string
 *                           days:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 date:
 *                                   type: string
 *                                   example: "2026-09-14"
 *                                 plannedHours:
 *                                   type: number
 *                                 capacityHours:
 *                                   type: number
 *                                 loadPercent:
 *                                   type: number
 *                                 shifts:
 *                                   type: array
 *                                   items:
 *                                     type: object
 *                                     properties:
 *                                       key:
 *                                         type: string
 *                                       label:
 *                                         type: string
 *                                       capacityHours:
 *                                         type: number
 *                                       plannedHours:
 *                                         type: number
 *                                       loadPercent:
 *                                         type: number
 *                                 orderIds:
 *                                   type: array
 *                                   items:
 *                                     type: integer
 *       400:
 *         description: Período inválido (datas não parseáveis ou início maior que fim).
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
router.get('/pcp/calendar', authenticateToken, requirePermission('os:visualizar'), PCPController.pcpCalendar);

/**
 * @swagger
 * /v1/service-orders/operations/efficiency:
 *   get:
 *     summary: Eficiência operacional agregada por centro de trabalho e tipo de operação
 *     description: >
 *       Requer permissão `os:visualizar`. Agrega os apontamentos (ServiceOrderOperationLog) cujo startAt
 *       está no período informado. efficiencyPercent = workedHours / (workedHours + downtimeMinutes/60).
 *     tags: [ServiceOrders]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Default é 30 dias atrás.
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Default é a data/hora atual.
 *     responses:
 *       200:
 *         description: Eficiência operacional calculada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     periodStart:
 *                       type: string
 *                       format: date-time
 *                     periodEnd:
 *                       type: string
 *                       format: date-time
 *                     totals:
 *                       type: object
 *                       properties:
 *                         workedHours:
 *                           type: number
 *                         downtimeMinutes:
 *                           type: number
 *                         efficiencyPercent:
 *                           type: number
 *                     downtimeByCategory:
 *                       type: object
 *                       description: Mapa dinâmico categoria de parada -> minutos totais.
 *                       additionalProperties:
 *                         type: number
 *                     byCenterAndOperation:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           workCenter:
 *                             type: string
 *                           operationType:
 *                             type: string
 *                           logsCount:
 *                             type: integer
 *                           ordersCount:
 *                             type: integer
 *                           workedHours:
 *                             type: number
 *                           downtimeMinutes:
 *                             type: number
 *                           efficiencyPercent:
 *                             type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/operations/efficiency', authenticateToken, requirePermission('os:visualizar'), PCPController.operationsEfficiency);

// Purchase Endpoints
/**
 * @swagger
 * /v1/service-orders/purchase-requests:
 *   post:
 *     summary: Cria uma solicitação de compra (PurchaseRequest) a partir de itens em ruptura
 *     description: >
 *       Requer permissão `os:gerenciar`. Gera um código sequencial (SC-AAAAMMDD-HHmm-XXXX). Se
 *       serviceOrderId for informado, registra um ServiceOrderTrace (action PURCHASE_REQUEST_CREATE) na
 *       OS vinculada.
 *     tags: [ServiceOrders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PurchaseRequestInput'
 *     responses:
 *       201:
 *         description: Solicitação de compra criada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/PurchaseRequest'
 *       400:
 *         description: Nenhum item em ruptura informado, ou erro ao gerar a solicitação.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               semItens:
 *                 summary: Nenhum item em ruptura
 *                 value: { status: error, message: "Não há itens em ruptura para gerar solicitação de compra." }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: OS informada não encontrada, ou um ou mais materiais não encontrados.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               osNaoEncontrada:
 *                 summary: OS não encontrada
 *                 value: { status: error, message: "OS não encontrada para vincular solicitação de compra." }
 *               materialNaoEncontrado:
 *                 summary: Material não encontrado
 *                 value: { status: error, message: "Um ou mais materiais não foram encontrados." }
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   get:
 *     summary: Lista solicitações de compra
 *     description: >
 *       Requer permissão `os:visualizar`. Em caso de erro interno, retorna 200 com lista vazia em `data`
 *       (sem `meta`) em vez de um erro — comportamento atual do controller (catch retorna res.json([])).
 *     tags: [ServiceOrders]
 *     parameters:
 *       - in: query
 *         name: serviceOrderId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, PARTIAL, CLOSED]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filtra createdAt >= startDate.
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filtra createdAt <= endDate (fim do dia, 23:59:59.999).
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
 *         description: Lista de solicitações de compra (ou array vazio em caso de erro interno, ver acima).
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
 *                     $ref: '#/components/schemas/PurchaseRequest'
 *                 meta:
 *                   allOf:
 *                     - $ref: '#/components/schemas/PaginationMeta'
 *                   description: Ausente na resposta de fallback de erro (data vazio).
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post('/purchase-requests', authenticateToken, requirePermission('os:gerenciar'), PurchaseController.createPurchaseRequest);
router.get('/purchase-requests', authenticateToken, requirePermission('os:visualizar'), PurchaseController.listPurchaseRequests);

/**
 * @swagger
 * /v1/service-orders/purchase-requests/{id}/fulfill:
 *   post:
 *     summary: Registra a compra (entrada de estoque) de itens de uma solicitação de compra
 *     description: >
 *       Requer permissão `os:gerenciar`. Para cada item processado, adquire um lock pessimista no
 *       material, calcula a quantidade efetivamente comprada (limitada ao shortageQty restante), cria um
 *       StockLog de entrada (IN), atualiza o preço do material e recalcula o status do
 *       PurchaseRequestItem (PARTIAL/PURCHASED) e da PurchaseRequest (OPEN/PARTIAL/CLOSED). Registra um
 *       ServiceOrderTrace (action PURCHASE_REQUEST_FULFILL) se a solicitação estiver vinculada a uma OS.
 *     tags: [ServiceOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da solicitação de compra (PurchaseRequest).
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PurchaseRequestFulfillInput'
 *     responses:
 *       200:
 *         description: Solicitação de compra atualizada após o registro da compra.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/PurchaseRequest'
 *       400:
 *         description: Payload inválido ou custo do item não informado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               idInvalido:
 *                 summary: ID de solicitação inválido
 *                 value: { status: error, message: "Solicitação de compra inválida." }
 *               fornecedorObrigatorio:
 *                 summary: Fornecedor não informado
 *                 value: { status: error, message: "Fornecedor é obrigatório para registrar a compra." }
 *               semItens:
 *                 summary: Nenhum item informado
 *                 value: { status: error, message: "Informe ao menos um item para registrar compra." }
 *               itensInvalidos:
 *                 summary: Itens malformados (após filtro)
 *                 value: { status: error, message: "Itens de compra inválidos." }
 *               custoObrigatorio:
 *                 summary: Sem unitCost nem totalPaid válido
 *                 value: { status: error, message: "Informe custo unitário ou total pago para os itens da compra." }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Solicitação, item da solicitação ou fornecedor não encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               solicitacaoNaoEncontrada:
 *                 summary: Solicitação não encontrada
 *                 value: { status: error, message: "Solicitação de compra não encontrada." }
 *               itemNaoEncontrado:
 *                 summary: Item da solicitação não encontrado
 *                 value: { status: error, message: "Item da solicitação não encontrado." }
 *               fornecedorNaoEncontrado:
 *                 summary: Fornecedor não encontrado
 *                 value: { status: error, message: "Fornecedor não encontrado." }
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/purchase-requests/:id/fulfill', authenticateToken, requirePermission('os:gerenciar'), PurchaseController.fulfillPurchaseRequest);

/**
 * @swagger
 * /v1/service-orders/purchase-quotations:
 *   post:
 *     summary: Cria uma cotação de compra (PurchaseQuotation) vinculada a uma solicitação de compra
 *     description: >
 *       Requer permissão `os:gerenciar`. Gera um código sequencial (COT-AAAAMMDD-HHmm-XXXX). Sem
 *       validação Joi (ver PurchaseQuotationInput) — erros de payload malformado ou FK inválida (ex.:
 *       purchaseRequestId/supplierPersonId/materialId/purchaseRequestItemId inexistentes) retornam 400
 *       com a mensagem de erro lançada pelo Prisma ou pelo runtime.
 *     tags: [ServiceOrders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PurchaseQuotationInput'
 *     responses:
 *       201:
 *         description: Cotação de compra criada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/PurchaseQuotation'
 *       400:
 *         description: Payload inválido ou erro ao criar a cotação (mensagem varia conforme a causa).
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
 *   get:
 *     summary: Lista cotações de compra
 *     description: >
 *       Requer permissão `os:visualizar`. Em caso de erro interno, retorna 200 com lista vazia em `data`
 *       (sem `meta`) em vez de um erro — comportamento atual do controller (catch retorna res.json([])).
 *     tags: [ServiceOrders]
 *     parameters:
 *       - in: query
 *         name: purchaseRequestId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, APPROVED, REJECTED]
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
 *         description: Lista de cotações de compra (ou array vazio em caso de erro interno, ver acima).
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
 *                     $ref: '#/components/schemas/PurchaseQuotation'
 *                 meta:
 *                   allOf:
 *                     - $ref: '#/components/schemas/PaginationMeta'
 *                   description: Ausente na resposta de fallback de erro (data vazio).
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post('/purchase-quotations', authenticateToken, requirePermission('os:gerenciar'), PurchaseController.createPurchaseQuotation);
router.get('/purchase-quotations', authenticateToken, requirePermission('os:visualizar'), PurchaseController.listPurchaseQuotations);

/**
 * @swagger
 * /v1/service-orders/purchase-quotations/{id}/approve:
 *   post:
 *     summary: Aprova uma cotação de compra
 *     description: >
 *       Requer permissão `os:gerenciar`. Para cada item da cotação, adquire lock pessimista no material,
 *       calcula a quantidade a comprar (limitada ao shortageQty restante do PurchaseRequestItem) e cria um
 *       StockLog de entrada (IN). Recalcula o status da PurchaseRequest e rejeita (status REJECTED) as
 *       demais cotações OPEN da mesma solicitação. Dispara uma notificação assíncrona de "Cotação
 *       Aprovada". Não há tratamento especial de erros — qualquer falha (inclusive cotação inexistente ou
 *       já processada) retorna 400 com error.message bruto.
 *     tags: [ServiceOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da cotação (PurchaseQuotation).
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Cotação aprovada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/PurchaseQuotation'
 *       400:
 *         description: Cotação inexistente, cotação não está mais OPEN, ou outro erro (ex. Prisma).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               naoEncontrada:
 *                 summary: Cotação inexistente
 *                 value: { status: error, message: "QUOTATION_NOT_FOUND" }
 *               naoAberta:
 *                 summary: Cotação já aprovada/rejeitada
 *                 value: { status: error, message: "QUOTATION_NOT_OPEN" }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/purchase-quotations/:id/approve', authenticateToken, requirePermission('os:gerenciar'), PurchaseController.approvePurchaseQuotation);

/**
 * @swagger
 * /v1/service-orders/purchase-quotations/{id}/pdf:
 *   get:
 *     summary: Gera o PDF de uma cotação de compra
 *     description: Requer permissão `os:visualizar`. Retorna o binário do PDF (não passa pelo envelope JSON padrão).
 *     tags: [ServiceOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da cotação (PurchaseQuotation).
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: PDF da cotação gerado com sucesso.
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: ID de cotação inválido.
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
router.get('/purchase-quotations/:id/pdf', authenticateToken, requirePermission('os:visualizar'), PurchaseController.getPurchaseQuotationPDF);

// Service Order Endpoints
/**
 * @swagger
 * /v1/service-orders/{id}/operations:
 *   get:
 *     summary: Lista os apontamentos operacionais (ServiceOrderOperationLog) de uma OS
 *     description: Requer permissão `os:visualizar`.
 *     tags: [ServiceOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da ordem de serviço.
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Lista de apontamentos operacionais, mais recentes primeiro.
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
 *                     $ref: '#/components/schemas/ServiceOrderOperationLog'
 *       400:
 *         description: ID de OS inválido.
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
 *   post:
 *     summary: Registra um apontamento operacional (mão de obra/parada) para uma OS
 *     description: >
 *       Requer permissão `os:gerenciar`. Sem validação Joi (ver ServiceOrderOperationLogInput). Registra
 *       um ServiceOrderTrace (action OP_LOG_CREATE).
 *     tags: [ServiceOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da ordem de serviço.
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceOrderOperationLogInput'
 *     responses:
 *       201:
 *         description: Apontamento operacional criado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/ServiceOrderOperationLog'
 *       400:
 *         description: ID de OS inválido, campo obrigatório inválido/ausente, ou erro genérico.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               idOsInvalido:
 *                 summary: ID de OS inválido
 *                 value: { status: error, message: "ID de OS inválido." }
 *               tipoInvalido:
 *                 summary: operationType fora do enum
 *                 value: { status: error, message: "Tipo de operação inválido." }
 *               turnoInvalido:
 *                 summary: shift fora do enum
 *                 value: { status: error, message: "Turno inválido." }
 *               categoriaInvalida:
 *                 summary: downtimeCategory fora do enum
 *                 value: { status: error, message: "Categoria de parada inválida." }
 *               inicioInvalido:
 *                 summary: startAt ausente/inválido
 *                 value: { status: error, message: "Data/hora de início inválida." }
 *               fimInvalido:
 *                 summary: endAt inválido
 *                 value: { status: error, message: "Data/hora de fim inválida." }
 *               fimAntesInicio:
 *                 summary: endAt anterior a startAt
 *                 value: { status: error, message: "Fim não pode ser menor que início." }
 *               funcionarioInvalido:
 *                 summary: employeeId malformado
 *                 value: { status: error, message: "Funcionário inválido." }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: OS ou funcionário não encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               osNaoEncontrada:
 *                 summary: OS não encontrada
 *                 value: { status: error, message: "Ordem de serviço não encontrada" }
 *               funcionarioNaoEncontrado:
 *                 summary: Funcionário não encontrado
 *                 value: { status: error, message: "Funcionário não encontrado." }
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:id/operations', ensureNumericId, authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.listOperations);

/**
 * @swagger
 * /v1/service-orders/{id}/pdf:
 *   get:
 *     summary: Gera o PDF de uma ordem de serviço
 *     description: Requer permissão `os:visualizar`. Retorna o binário do PDF (não passa pelo envelope JSON padrão).
 *     tags: [ServiceOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da ordem de serviço.
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: PDF da OS gerado com sucesso.
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: ID de OS inválido.
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
router.get('/:id/pdf', ensureNumericId, authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.getServiceOrderPDF);

/**
 * @swagger
 * /v1/service-orders/{id}:
 *   get:
 *     summary: Busca uma ordem de serviço pelo ID
 *     description: >
 *       Requer permissão `os:visualizar`. Resposta sanitizada por FinancialService.sanitizeOrder (ver
 *       schema ServiceOrder) e com o histórico completo de `traces`.
 *     tags: [ServiceOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da ordem de serviço.
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Ordem de serviço encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/ServiceOrder'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Ordem de serviço não encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   put:
 *     summary: Atualiza uma ordem de serviço existente
 *     description: >
 *       Requer permissão `os:gerenciar`. Diferente de GET, esta resposta NÃO passa por
 *       FinancialService.sanitizeOrder — os campos financeiros e os preços de materials/services são
 *       sempre incluídos, independente da permissão financeira do usuário. Inclui qualityControls,
 *       transactions e os 20 traces mais recentes. Se services/materials forem informados no corpo,
 *       substituem por completo os registros existentes.
 *     tags: [ServiceOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da ordem de serviço.
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceOrderUpdateInput'
 *     responses:
 *       200:
 *         description: Ordem de serviço atualizada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/ServiceOrder'
 *       400:
 *         description: Erro de validação Joi, ou erro ao atualizar.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Ordem de serviço não encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   delete:
 *     summary: Remove uma ordem de serviço
 *     description: Requer permissão `os:gerenciar`. Também registra um ServiceOrderTrace (action DELETE) antes da exclusão.
 *     tags: [ServiceOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da ordem de serviço.
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       204:
 *         description: Ordem de serviço removida com sucesso (sem conteúdo).
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Ordem de serviço não encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:id', ensureNumericId, authenticateToken, requirePermission('os:visualizar'), ServiceOrderController.get);
router.post('/', authenticateToken, requirePermission('os:gerenciar'), validateBody(serviceOrderCreateSchema), ServiceOrderController.create);
router.post('/:id/operations', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.addOperation);

/**
 * @swagger
 * /v1/service-orders/plan/batch:
 *   patch:
 *     summary: Replaneja em lote (workCenter/janela/horas) várias ordens de serviço
 *     description: >
 *       Requer permissão `os:gerenciar`. Valida a janela de cada OS individualmente e verifica conflitos
 *       de agenda tanto contra OS não incluídas no lote (externalConflicts) quanto entre as próprias OS do
 *       lote (internalConflicts) no mesmo workCenter. Se não houver conflitos, aplica a atualização em
 *       massa e registra um ServiceOrderTrace (action PLAN_BATCH_UPDATE) por OS.
 *     tags: [ServiceOrders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceOrderPlanBatchInput'
 *     responses:
 *       200:
 *         description: Replanejamento em lote aplicado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     updatedCount:
 *                       type: integer
 *                       description: Quantidade de OS efetivamente atualizadas.
 *                     notFoundIds:
 *                       type: array
 *                       items:
 *                         type: integer
 *                       description: IDs informados que não correspondem a nenhuma OS existente.
 *       400:
 *         description: Nenhum ID válido informado, nenhum campo de plano informado, ou janela inválida.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               semIds:
 *                 summary: Nenhuma OS informada
 *                 value: { status: error, message: "Informe ao menos uma OS para replanejamento em lote." }
 *               semDados:
 *                 summary: Nenhum campo de plano informado
 *                 value: { status: error, message: "Nenhum campo de planejamento foi informado para atualização." }
 *               janelaInvalida:
 *                 summary: plannedStartDate maior que plannedEndDate em alguma OS
 *                 value: { status: error, message: "Janela de planejamento inválida: início maior que fim." }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Nenhuma das OS informadas foi encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       409:
 *         description: Conflito de agenda (externo a outras OS, ou interno entre OS do próprio lote).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Conflito de agenda detectado para o replanejamento em lote.
 *                 externalConflicts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       conflicts:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             traceCode:
 *                               type: string
 *                               nullable: true
 *                             description:
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
 *                             workCenter:
 *                               type: string
 *                               nullable: true
 *                             status:
 *                               type: string
 *                 internalConflicts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       leftId:
 *                         type: integer
 *                       rightId:
 *                         type: integer
 *                       workCenter:
 *                         type: string
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch('/plan/batch', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.updatePlanBatch);

/**
 * @swagger
 * /v1/service-orders/{id}/plan:
 *   patch:
 *     summary: Replaneja (workCenter/janela/horas) uma ordem de serviço
 *     description: >
 *       Requer permissão `os:gerenciar`. Verifica conflito de agenda no mesmo workCenter contra outras OS
 *       não concluídas/canceladas. Resposta sanitizada por FinancialService.sanitizeOrder (ver schema
 *       ServiceOrder), com os 10 traces mais recentes. Registra um ServiceOrderTrace (action PLAN_UPDATE).
 *     tags: [ServiceOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da ordem de serviço.
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceOrderPlanInput'
 *     responses:
 *       200:
 *         description: Ordem de serviço replanejada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/ServiceOrder'
 *       400:
 *         description: ID inválido, janela de planejamento inválida, ou outro erro.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               idInvalido:
 *                 summary: ID de OS inválido
 *                 value: { status: error, message: "ID de OS inválido." }
 *               janelaInvalida:
 *                 summary: plannedStartDate maior que plannedEndDate
 *                 value: { status: error, message: "Janela de planejamento inválida: início maior que fim." }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Ordem de serviço não encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       409:
 *         description: Conflito de agenda no centro de trabalho para o período informado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Conflito de agenda no centro de trabalho para o período informado.
 *                 conflicts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       traceCode:
 *                         type: string
 *                         nullable: true
 *                       description:
 *                         type: string
 *                         nullable: true
 *                       plannedStartDate:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       plannedEndDate:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       workCenter:
 *                         type: string
 *                         nullable: true
 *                       status:
 *                         type: string
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch('/:id/plan', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.updatePlan);
router.put('/:id', authenticateToken, requirePermission('os:gerenciar'), validateBody(serviceOrderUpdateSchema), ServiceOrderController.update);
router.delete('/:id', authenticateToken, requirePermission('os:gerenciar'), ServiceOrderController.delete);

export default router;
