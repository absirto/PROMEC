import { Router } from 'express';
import { authenticateToken } from '../../../middleware/auth';
import prisma from '../../../core/prisma';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         title:
 *           type: string
 *           example: Nova ordem de serviço
 *         message:
 *           type: string
 *           example: A ordem de serviço #42 foi criada.
 *         type:
 *           type: string
 *           enum: [INFO, WARNING, ERROR, SUCCESS]
 *           example: INFO
 *         read:
 *           type: boolean
 *           example: false
 *         userId:
 *           type: integer
 *           nullable: true
 *           description: Se null, é uma notificação global (broadcast), visível para todos os usuários.
 *           example: 5
 *         link:
 *           type: string
 *           nullable: true
 *           description: Link opcional para navegação no frontend.
 *           example: /service-orders/42
 *         createdAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - id
 *         - title
 *         - message
 *         - type
 *         - read
 *         - createdAt
 */

/**
 * @swagger
 * /v1/notifications:
 *   get:
 *     summary: Lista as notificações do usuário autenticado
 *     description: >
 *       Requer apenas autenticação (sem permissão adicional). Retorna as notificações
 *       pessoais do usuário (userId igual ao usuário autenticado) e as notificações globais
 *       (userId nulo), ordenadas por createdAt decrescente e limitadas às 30 mais recentes.
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Lista de notificações.
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
 *                     $ref: '#/components/schemas/Notification'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Listar notificações do usuário
router.get('/', authenticateToken, async (req: any, res) => {
  const userId = req.user?.id;
  const notifications = await prisma.notification.findMany({
    where: {
      OR: [
        { userId },
        { userId: null }
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 30
  });
  res.json(notifications);
});

/**
 * @swagger
 * /v1/notifications/{id}/read:
 *   put:
 *     summary: Marca uma notificação como lida
 *     description: >
 *       Requer apenas autenticação (sem permissão adicional) — não verifica se a notificação
 *       pertence ao usuário autenticado antes de atualizar. Responde via res.sendStatus(200):
 *       o corpo é o texto simples "OK" (Content-Type text/plain), fora do envelope
 *       { status, data } padrão. Se o id não existir, a atualização falha no Prisma e a rota
 *       não trata o erro — cai no error handler genérico, retornando 500 (não 404).
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Notificação marcada como lida.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: OK
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Marcar como lida
router.put('/:id/read', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.notification.update({
      where: { id: Number(id) },
      data: { read: true }
    });
    res.sendStatus(200);
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ status: 'error', message: 'Notificação não encontrada.' });
    }
    throw error;
  }
});

/**
 * @swagger
 * /v1/notifications/read-all:
 *   put:
 *     summary: Marca todas as notificações do usuário autenticado como lidas
 *     description: >
 *       Requer apenas autenticação (sem permissão adicional). Atualiza em lote as notificações
 *       com userId igual ao usuário autenticado e read=false (não afeta notificações globais).
 *       Responde via res.sendStatus(200): o corpo é o texto simples "OK"
 *       (Content-Type text/plain), fora do envelope { status, data } padrão.
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Notificações marcadas como lidas.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: OK
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Marcar todas como lidas
router.put('/read-all', authenticateToken, async (req: any, res) => {
  const userId = req.user?.id;
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true }
  });
  res.sendStatus(200);
});

export default router;
