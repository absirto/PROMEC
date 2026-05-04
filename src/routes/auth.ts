import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/AuthController';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { validateBody } from '../middleware/validation/validateBody';
import { loginSchema, registerSchema } from '../middleware/validation/authSchema';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const allowPublicRegister = process.env.ALLOW_PUBLIC_REGISTER === 'true';

router.post('/login', authLimiter, validateBody(loginSchema), AuthController.login);
if (allowPublicRegister) {
  router.post('/register', authLimiter, validateBody(registerSchema), AuthController.register);
} else {
  router.post('/register', authLimiter, authenticateToken, requirePermission('usuarios:gerenciar'), validateBody(registerSchema), AuthController.register);
}
router.get('/me', authenticateToken, AuthController.me);

export default router;
