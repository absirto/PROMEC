import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     DashboardStatsResponse:
 *       type: object
 *       description: Indicadores agregados do dashboard gerencial (financeiro, operacional e distribuição de OS).
 *       properties:
 *         stats:
 *           type: object
 *           properties:
 *             totalRevenue:
 *               type: number
 *               description: Receita total das OS concluídas no filtro (serviços + materiais + margem + impostos).
 *             totalMaterials:
 *               type: number
 *             totalServices:
 *               type: number
 *             totalTaxes:
 *               type: number
 *             totalProfit:
 *               type: number
 *             people:
 *               type: integer
 *               description: Total de pessoas cadastradas (Person.count()) — não respeita nenhum filtro de query.
 *             activeOrders:
 *               type: integer
 *               description: Total de OS no filtro, exceto as com status "Concluída" e "Cancelada".
 *             lowStock:
 *               type: integer
 *               description: >
 *                 Quantidade de materiais com estoque atual (soma de StockLog IN menos OUT)
 *                 abaixo de 10 unidades — calculado sobre todos os materiais, sem respeitar
 *                 nenhum filtro de query.
 *             totalOrders:
 *               type: integer
 *         operationsKpi:
 *           type: object
 *           properties:
 *             workedHours:
 *               type: number
 *             downtimeMinutes:
 *               type: number
 *             efficiencyPercent:
 *               type: number
 *               description: workedHours / (workedHours + downtimeMinutes / 60) * 100.
 *             logsCount:
 *               type: integer
 *         efficiencyByCenter:
 *           type: array
 *           description: Agregado de horas trabalhadas/parada por centro de trabalho (ServiceOrderOperationLog), respeitando os filtros de query.
 *           items:
 *             type: object
 *             properties:
 *               workCenter:
 *                 type: string
 *                 example: Sem centro definido
 *               workedHours:
 *                 type: number
 *               downtimeMinutes:
 *                 type: number
 *               logsCount:
 *                 type: integer
 *               efficiencyPercent:
 *                 type: number
 *         efficiencyTrendByCenter:
 *           type: array
 *           description: >
 *             Tendência diária de eficiência por centro de trabalho, nos últimos 7 dias
 *             corridos contados a partir de endDate (ou de hoje, se endDate não for
 *             informado). startDate não afeta esta janela; personId, quando informado,
 *             continua filtrando os logs considerados.
 *           items:
 *             type: object
 *             properties:
 *               workCenter:
 *                 type: string
 *               trend:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     day:
 *                       type: string
 *                       example: '05/09'
 *                     date:
 *                       type: string
 *                       example: '2026-09-05'
 *                     efficiencyPercent:
 *                       type: number
 *                     workedHours:
 *                       type: number
 *                     downtimeMinutes:
 *                       type: number
 *         downtimeByCategory:
 *           type: object
 *           description: Minutos de parada somados por categoria (downtimeCategory em maiúsculas, "OUTROS" quando ausente). Chaves dinâmicas.
 *           additionalProperties:
 *             type: number
 *           example:
 *             OUTROS: 120
 *             MANUTENCAO: 45
 *         financialPerformance:
 *           type: array
 *           description: >
 *             Receita e custo dos últimos 6 meses corridos (mês a mês, apenas OS concluídas).
 *             Não respeita startDate/endDate (a janela de 6 meses é sempre a partir do mês
 *             atual); respeita personId quando informado.
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: JAN
 *               revenue:
 *                 type: number
 *               costs:
 *                 type: number
 *         distribution:
 *           type: array
 *           description: Distribuição de OS por status, respeitando os filtros de personId/período.
 *           items:
 *             type: object
 *             properties:
 *               label:
 *                 type: string
 *                 example: Concluída
 *               value:
 *                 type: integer
 *         activities:
 *           type: array
 *           description: As 5 OS mais recentes (orderBy openingDate desc), respeitando os filtros de personId/período.
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               title:
 *                 type: string
 *                 example: 'OS #12 Concluída'
 *               description:
 *                 type: string
 *                 example: 'Cliente: João Souza'
 *               time:
 *                 type: string
 *                 format: date-time
 *                 description: Igual à openingDate da OS.
 *               type:
 *                 type: string
 *                 enum: [success, info]
 *                 description: '"success" quando o status da OS é "Concluída"; "info" nos demais casos.'
 *     DashboardAuditLogEntry:
 *       type: object
 *       description: Entrada da trilha de auditoria (AuditLog), com o usuário responsável resolvido.
 *       properties:
 *         id:
 *           type: integer
 *         entity:
 *           type: string
 *           example: Material
 *         entityId:
 *           type: integer
 *         action:
 *           type: string
 *           example: UPDATE
 *         userId:
 *           type: integer
 *           nullable: true
 *         userEmail:
 *           type: string
 *           nullable: true
 *         oldData:
 *           type: object
 *           nullable: true
 *           additionalProperties: true
 *         newData:
 *           type: object
 *           nullable: true
 *           additionalProperties: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         user:
 *           type: object
 *           nullable: true
 *           description: Usuário resolvido a partir de userId (subconjunto id/firstName/lastName/email); nulo quando userId é nulo ou o usuário não é encontrado.
 *           properties:
 *             id:
 *               type: integer
 *             firstName:
 *               type: string
 *             lastName:
 *               type: string
 *             email:
 *               type: string
 *               format: email
 */

/**
 * @swagger
 * /v1/dashboard/stats:
 *   get:
 *     summary: Indicadores agregados do dashboard
 *     description: >
 *       Requer permissão `dashboard:visualizar`. personId filtra ordens de serviço e logs de
 *       operação do cliente informado. startDate/endDate filtram openingDate das OS e startAt
 *       dos logs de operação; endDate também é usada como referência para a janela dos
 *       últimos 7 dias de efficiencyTrendByCenter. stats.people e stats.lowStock são sempre
 *       globais (não respeitam estes filtros) — ver descrição de cada campo na resposta.
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: personId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Indicadores do dashboard.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/DashboardStatsResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/stats', authenticateToken, requirePermission('dashboard:visualizar'), DashboardController.getStats);

/**
 * @swagger
 * /v1/dashboard/audit-logs:
 *   get:
 *     summary: Lista a trilha de auditoria do sistema (paginada)
 *     description: >
 *       Requer permissão `dashboard:visualizar`. entity filtra pelo nome exato da entidade
 *       auditada (AuditLog.entity). module aceita apenas o valor "Suprimentos", que filtra
 *       entity para os valores ['Material', 'StockLog', 'PurchaseRequest'] — quando informado
 *       com esse valor, sobrescreve o filtro de entity; qualquer outro valor de module é
 *       ignorado (sem efeito).
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: entity
 *         schema:
 *           type: string
 *         example: Material
 *       - in: query
 *         name: module
 *         schema:
 *           type: string
 *         example: Suprimentos
 *         description: Único valor com efeito é "Suprimentos"; sobrescreve o filtro de entity quando ambos são informados.
 *     responses:
 *       200:
 *         description: Página de logs de auditoria.
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
 *                     $ref: '#/components/schemas/DashboardAuditLogEntry'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/audit-logs', authenticateToken, requirePermission('dashboard:visualizar'), DashboardController.getAuditLogs);

export default router;
