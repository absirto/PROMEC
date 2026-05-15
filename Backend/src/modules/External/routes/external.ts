import express from 'express';
import { ExternalController } from '../controllers/ExternalController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';

const router = express.Router();

const allowPublicExternalLookup = process.env.ALLOW_PUBLIC_EXTERNAL_LOOKUP === 'true';

if (allowPublicExternalLookup) {
	router.get('/cnpj/:cnpj', ExternalController.lookupCNPJ);
} else {
	router.get('/cnpj/:cnpj', authenticateToken, requirePermission('pessoas:visualizar'), ExternalController.lookupCNPJ);
}

export default router;
