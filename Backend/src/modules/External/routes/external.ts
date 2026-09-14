import express from 'express';
import { ExternalController } from '../controllers/ExternalController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';

const router = express.Router();

const allowPublicExternalLookup = process.env.ALLOW_PUBLIC_EXTERNAL_LOOKUP === 'true';

/**
 * @swagger
 * components:
 *   schemas:
 *     ExternalCnpjLookupResponse:
 *       type: object
 *       description: >
 *         Dados de uma empresa consultados na Receita Federal via BrasilAPI
 *         (GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}), remapeados para o formato usado
 *         pelo frontend.
 *       properties:
 *         corporateName:
 *           type: string
 *           description: Razão social (razao_social).
 *           example: PROMEC SERVICOS INDUSTRIAIS LTDA
 *         tradeName:
 *           type: string
 *           description: Nome fantasia (nome_fantasia); cai para a razão social quando a BrasilAPI não retorna nome fantasia.
 *           example: PROMEC
 *         cnpj:
 *           type: string
 *           example: "12345678000199"
 *         address:
 *           type: object
 *           properties:
 *             zipCode:
 *               type: string
 *               nullable: true
 *               example: "01310-100"
 *             street:
 *               type: string
 *               nullable: true
 *             number:
 *               type: string
 *               nullable: true
 *             complement:
 *               type: string
 *               nullable: true
 *             neighborhood:
 *               type: string
 *               nullable: true
 *             city:
 *               type: string
 *               nullable: true
 *             state:
 *               type: string
 *               nullable: true
 *               example: SP
 *         contact:
 *           type: object
 *           properties:
 *             email:
 *               type: string
 *               nullable: true
 *             phone:
 *               type: string
 *               nullable: true
 *               description: ddd_telefone_1, com fallback para ddd_telefone_2 quando o primeiro não existe.
 */

/**
 * @swagger
 * /v1/external/cnpj/{cnpj}:
 *   get:
 *     summary: Consulta dados de uma empresa pelo CNPJ na Receita Federal (BrasilAPI)
 *     description: >
 *       Requer a permissão `pessoas:visualizar` por padrão. Fica público, sem autenticação,
 *       apenas quando a variável de ambiente `ALLOW_PUBLIC_EXTERNAL_LOOKUP=true`. O CNPJ do
 *       path pode conter máscara — apenas os dígitos são considerados, e devem restar
 *       exatamente 14 após a limpeza.
 *     tags: [External]
 *     parameters:
 *       - in: path
 *         name: cnpj
 *         required: true
 *         schema:
 *           type: string
 *         description: CNPJ com ou sem máscara (apenas dígitos são considerados; deve resultar em 14 dígitos).
 *         example: "12.345.678/0001-99"
 *     responses:
 *       200:
 *         description: Empresa encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/ExternalCnpjLookupResponse'
 *       400:
 *         description: CNPJ inválido (não resulta em 14 dígitos após a limpeza).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               cnpjInvalido:
 *                 summary: CNPJ inválido
 *                 value: { error: 'CNPJ inválido' }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: CNPJ não encontrado na Receita Federal (BrasilAPI retornou 404).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             examples:
 *               cnpjNaoEncontrado:
 *                 summary: CNPJ não encontrado
 *                 value: { error: 'CNPJ não encontrado' }
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
if (allowPublicExternalLookup) {
	router.get('/cnpj/:cnpj', ExternalController.lookupCNPJ);
} else {
	router.get('/cnpj/:cnpj', authenticateToken, requirePermission('pessoas:visualizar'), ExternalController.lookupCNPJ);
}

export default router;
