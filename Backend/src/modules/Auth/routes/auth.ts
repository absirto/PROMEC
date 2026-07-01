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

router.post('/login', authLimiter, validateBody(loginSchema), AuthController.login);
if (allowPublicRegister) {
  router.post('/register', authLimiter, validateBody(registerSchema), AuthController.register);
} else {
  router.post('/register', authLimiter, authenticateToken, requirePermission('usuarios:gerenciar'), validateBody(registerSchema), AuthController.register);
}
router.get('/me', authenticateToken, AuthController.me);
router.post('/logout', AuthController.logout);

export default router;
