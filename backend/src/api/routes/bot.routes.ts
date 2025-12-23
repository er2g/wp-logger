import { Router } from 'express';
import botController from '../controllers/BotController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/status', botController.getStatus);
router.post('/restart', botController.restart);
router.post('/stop', botController.stop);

export default router;
