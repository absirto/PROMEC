import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/AuthController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validateBody';
import { loginSchema, registerSchema } from '../authSchema';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Muitas tentativas de login/registro a partir deste IP. Tente novamente mais tarde.' }
});

const allowPublicRegister = process.env.ALLOW_PUBLIC_REGISTER === 'true';

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginInput:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           maxLength: 255
 *           example: usuario@promec.com
 *         password:
 *           type: string
 *           example: senha-secreta
 *       required:
 *         - email
 *         - password
 *     AuthGroup:
 *       type: object
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
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *           example: ["usuarios:gerenciar", "estoque:visualizar"]
 *     AuthUser:
 *       type: object
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
 *         role:
 *           type: string
 *           example: user
 *         email:
 *           type: string
 *           format: email
 *         group:
 *           $ref: '#/components/schemas/AuthGroup'
 *     LoginResponse:
 *       type: object
 *       description: >
 *         O JWT é entregue via cookie HttpOnly `token` (Set-Cookie), não no corpo da resposta.
 *         Esta resposta não passa pelo envelope padrão { status, data }.
 *       properties:
 *         user:
 *           $ref: '#/components/schemas/AuthUser'
 *     RegisterInput:
 *       type: object
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
 *           example: usuario@promec.com
 *         password:
 *           type: string
 *           minLength: 6
 *           maxLength: 128
 *           example: senha-secreta
 *       required:
 *         - firstName
 *         - lastName
 *         - email
 *         - password
 */

/**
 * @swagger
 * /v1/auth/login:
 *   post:
 *     summary: Autentica um usuário e inicia sessão
 *     description: >
 *       Endpoint público. Limitado a 10 tentativas a cada 15 minutos por IP (rate limit).
 *       Em caso de sucesso, define o cookie HttpOnly `token` (JWT, validade 8h).
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200:
 *         description: Login realizado com sucesso.
 *         headers:
 *           Set-Cookie:
 *             description: Cookie HttpOnly `token` contendo o JWT da sessão.
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: E-mail ou senha inválidos.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       429:
 *         description: Muitas tentativas a partir deste IP. Tente novamente mais tarde.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/login', authLimiter, validateBody(loginSchema), AuthController.login);

/**
 * @swagger
 * /v1/auth/register:
 *   post:
 *     summary: Cria um novo usuário
 *     description: >
 *       Por padrão requer autenticação e a permissão `usuarios:gerenciar` (fluxo administrativo
 *       de criação de usuários). Fica público, sem autenticação, apenas quando a variável de
 *       ambiente `ALLOW_PUBLIC_REGISTER=true` (auto-cadastro habilitado). Limitado por rate
 *       limit (10 tentativas / 15 min / IP).
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterInput'
 *     responses:
 *       201:
 *         description: Usuário criado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 10
 *                 email:
 *                   type: string
 *                   format: email
 *       400:
 *         description: Payload inválido ou e-mail já cadastrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       429:
 *         description: Muitas tentativas a partir deste IP. Tente novamente mais tarde.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
if (allowPublicRegister) {
  router.post('/register', authLimiter, validateBody(registerSchema), AuthController.register);
} else {
  router.post('/register', authLimiter, authenticateToken, requirePermission('usuarios:gerenciar'), validateBody(registerSchema), AuthController.register);
}

/**
 * @swagger
 * /v1/auth/me:
 *   get:
 *     summary: Retorna os dados do usuário autenticado
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Dados do usuário autenticado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 firstName:
 *                   type: string
 *                 role:
 *                   type: string
 *                 email:
 *                   type: string
 *                   format: email
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/me', authenticateToken, AuthController.me);

/**
 * @swagger
 * /v1/auth/logout:
 *   post:
 *     summary: Encerra a sessão do usuário
 *     description: Limpa o cookie HttpOnly `token`.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logout realizado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Logout realizado com sucesso
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/logout', authenticateToken, AuthController.logout);

export default router;
