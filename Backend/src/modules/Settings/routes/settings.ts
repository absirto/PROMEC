import { Router } from 'express';
import { SettingsController } from '../controllers/SettingsController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validateBody';
import { settingsSchema } from '../settingsSchema';

const router = Router();

// Singleton behavior: no ID needed for common operations
router.get('/', authenticateToken, requirePermission('configuracoes:gerenciar'), SettingsController.get);
router.post('/', authenticateToken, requirePermission('configuracoes:gerenciar'), validateBody(settingsSchema), SettingsController.update);
router.put('/', authenticateToken, requirePermission('configuracoes:gerenciar'), validateBody(settingsSchema), SettingsController.update);

export default router;
