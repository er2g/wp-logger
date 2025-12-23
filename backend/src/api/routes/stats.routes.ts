import { Router } from 'express';
import statsController from '../controllers/StatsController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// Dashboard stats
router.get('/', statsController.getStats.bind(statsController));

// Activity timeline
router.get('/timeline', statsController.getActivityTimeline.bind(statsController));

// Group-specific stats
router.get('/groups/:id', statsController.getGroupStats.bind(statsController));

export default router;
