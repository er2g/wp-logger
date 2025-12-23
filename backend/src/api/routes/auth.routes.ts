import { Router } from 'express';
import authController from '../controllers/AuthController';
import { authMiddleware } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/register/start', authLimiter, authController.registerStart.bind(authController));
router.post('/register/complete', authLimiter, authController.registerComplete.bind(authController));
router.post('/login/start', authLimiter, authController.loginStart.bind(authController));
router.post('/login/complete', authLimiter, authController.loginComplete.bind(authController));
router.post('/login/password', authLimiter, authController.passwordLogin.bind(authController));
router.post('/logout', authMiddleware, authController.logout.bind(authController));
router.get('/me', authMiddleware, authController.me.bind(authController));

export default router;
