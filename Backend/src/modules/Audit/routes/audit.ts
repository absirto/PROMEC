import { Router } from 'express';
import { authenticateToken } from '../../../middleware/auth';
import prisma from '../../../core/prisma';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     AuditLog:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         entity:
 *           type: string
 *           description: Nome da entidade auditada (ex. 'Person', 'Material', 'User').
 *           example: Person
 *         entityId:
 *           type: integer
 *           example: 42
 *         action:
 *           type: string
 *           enum: [CREATE, UPDATE, DELETE]
 *           example: UPDATE
 *         userId:
 *           type: integer
 *           nullable: true
 *           description: Usuário que executou a ação, quando disponível.
 *           example: 3
 *         userEmail:
 *           type: string
 *           nullable: true
 *           example: usuario@promec.com
 *         oldData:
 *           type: object
 *           nullable: true
 *           additionalProperties: true
 *           description: Estado da entidade antes da alteração (estrutura livre, definida por quem chamou AuditService.log).
 *         newData:
 *           type: object
 *           nullable: true
 *           additionalProperties: true
 *           description: Estado da entidade depois da alteração (estrutura livre, definida por quem chamou AuditService.log).
 *         createdAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - id
 *         - entity
 *         - entityId
 *         - action
 *         - createdAt
 */

/**
 * @swagger
 * /v1/audit/{entity}/{entityId}:
 *   get:
 *     summary: Lista os logs de auditoria de uma entidade específica
 *     description: >
 *       Requer apenas autenticação (sem permissão adicional — qualquer usuário autenticado
 *       pode consultar o histórico de auditoria de qualquer entidade). Retorna as 50
 *       alterações mais recentes, ordenadas por createdAt decrescente.
 *     tags: [Audit]
 *     parameters:
 *       - in: path
 *         name: entity
 *         required: true
 *         schema:
 *           type: string
 *         description: Nome da entidade (ex. 'Person', 'Material', 'User').
 *         example: Person
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 42
 *     responses:
 *       200:
 *         description: Lista de logs de auditoria.
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
 *                     $ref: '#/components/schemas/AuditLog'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Buscar logs de auditoria de uma entidade específica
router.get('/:entity/:entityId', authenticateToken, async (req, res) => {
  const { entity, entityId } = req.params;

  const logs = await prisma.auditLog.findMany({
    where: {
      entity: String(entity),
      entityId: Number(entityId)
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  res.json(logs);
});

export default router;
