import { Router } from 'express';
import mediaController from '../controllers/MediaController';
import { authMiddleware } from '../middleware/auth';
import { mediaLimiter } from '../middleware/rateLimit';

const router = Router();

router.use(authMiddleware);

router.get('/', mediaController.getAll);
router.get('/:id', mediaController.getById);
router.get('/:id/download', mediaLimiter, mediaController.download);
router.get('/:id/stream', mediaLimiter, mediaController.stream);
router.get('/:id/thumbnail', mediaLimiter, mediaController.getThumbnail);

export default router;
