import { Router } from 'express';
import exportController from '../controllers/ExportController';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

router.use(authMiddleware);
router.use(requireRole('admin'));

// Export all messages with filters
router.post('/', exportController.exportMessages.bind(exportController));

// Export specific group
router.get('/groups/:id', exportController.exportGroup.bind(exportController));

export default router;
