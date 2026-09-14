import { Router } from 'express';
import { SettingsController } from '../controllers/SettingsController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validateBody';
import { settingsSchema } from '../settingsSchema';
import { logoUpload } from '../../../middleware/logoUpload';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Settings:
 *       type: object
 *       description: Registro único (singleton, id fixo 1) de configurações do sistema.
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         backgroundImageUrl:
 *           type: string
 *           nullable: true
 *         address:
 *           type: string
 *           nullable: true
 *         cnpj:
 *           type: string
 *           nullable: true
 *         companyName:
 *           type: string
 *           nullable: true
 *           example: ProMEC
 *         contactEmail:
 *           type: string
 *           format: email
 *           nullable: true
 *         logoUrl:
 *           type: string
 *           nullable: true
 *           example: /uploads/public/logo/3f1e9c2a-....png
 *         phone:
 *           type: string
 *           nullable: true
 *         systemTheme:
 *           type: string
 *           nullable: true
 *           example: dark
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - id
 *     SettingsInput:
 *       type: object
 *       description: Payload validado pelo Joi (settingsSchema) — ao menos um campo deve ser informado.
 *       minProperties: 1
 *       properties:
 *         backgroundImageUrl:
 *           type: string
 *           maxLength: 1000
 *           nullable: true
 *         address:
 *           type: string
 *           maxLength: 255
 *           nullable: true
 *         cnpj:
 *           type: string
 *           maxLength: 30
 *           nullable: true
 *         companyName:
 *           type: string
 *           maxLength: 120
 *           nullable: true
 *           example: ProMEC
 *         contactEmail:
 *           type: string
 *           format: email
 *           nullable: true
 *         logoUrl:
 *           type: string
 *           nullable: true
 *         phone:
 *           type: string
 *           maxLength: 30
 *           nullable: true
 *         systemTheme:
 *           type: string
 *           maxLength: 20
 *           nullable: true
 *           example: dark
 */

/**
 * @swagger
 * /v1/settings:
 *   get:
 *     summary: Retorna as configurações do sistema
 *     description: >
 *       Requer a permissão `configuracoes:gerenciar`. Comportamento singleton: se ainda não
 *       existir nenhum registro, cria automaticamente um com id=1 e companyName='ProMEC'
 *       antes de retornar (portanto nunca resulta em 404).
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Configurações do sistema.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Settings'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     summary: Atualiza as configurações do sistema
 *     description: >
 *       Requer a permissão `configuracoes:gerenciar`. Mesmo handler de PUT /v1/settings —
 *       faz upsert do registro singleton (id=1).
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SettingsInput'
 *     responses:
 *       200:
 *         description: Configurações atualizadas.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Settings'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   put:
 *     summary: Atualiza as configurações do sistema
 *     description: >
 *       Requer a permissão `configuracoes:gerenciar`. Mesmo handler de POST /v1/settings —
 *       faz upsert do registro singleton (id=1).
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SettingsInput'
 *     responses:
 *       200:
 *         description: Configurações atualizadas.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Settings'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Singleton behavior: no ID needed for common operations
router.get('/', authenticateToken, requirePermission('configuracoes:gerenciar'), SettingsController.get);
router.post('/', authenticateToken, requirePermission('configuracoes:gerenciar'), validateBody(settingsSchema), SettingsController.update);
router.put('/', authenticateToken, requirePermission('configuracoes:gerenciar'), validateBody(settingsSchema), SettingsController.update);

/**
 * @swagger
 * /v1/settings/logo:
 *   post:
 *     summary: Faz upload do logotipo do sistema
 *     description: >
 *       Requer a permissão `configuracoes:gerenciar`. Upload multipart via campo `logo`
 *       (multer, limite de 2MB; aceita apenas image/jpeg, image/png, image/webp, image/gif ou
 *       image/svg+xml). Apenas grava o arquivo em disco e retorna a URL pública — não
 *       atualiza o registro de Settings (logoUrl precisa ser salvo à parte via
 *       POST/PUT /v1/settings).
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               logo:
 *                 type: string
 *                 format: binary
 *             required:
 *               - logo
 *     responses:
 *       201:
 *         description: Logotipo enviado com sucesso.
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
 *                     logoUrl:
 *                       type: string
 *                       example: /uploads/public/logo/3f1e9c2a-....png
 *       400:
 *         description: Nenhum arquivo enviado no campo `logo`.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         description: >
 *           Erro interno inesperado. Também cobre rejeições do multer (arquivo acima de 2MB,
 *           ou tipo fora de image/jpeg, image/png, image/webp, image/gif, image/svg+xml): esses
 *           erros não são tratados no controller e caem no error handler genérico, retornando
 *           500 em vez de 400.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 */
router.post('/logo', authenticateToken, requirePermission('configuracoes:gerenciar'), logoUpload.single('logo'), SettingsController.uploadLogo);

export default router;
