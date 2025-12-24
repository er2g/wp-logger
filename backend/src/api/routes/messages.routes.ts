import { Router } from 'express';
import messagesController from '../controllers/MessagesController';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

router.use(authMiddleware);

// Main endpoints
router.get('/', messagesController.getAll.bind(messagesController));
router.get('/search', messagesController.search.bind(messagesController));
router.get('/advanced-search', messagesController.advancedSearch.bind(messagesController));
router.get('/stats', requireRole('admin'), messagesController.getStats.bind(messagesController));

// Bulk operations
router.post('/bulk', requireRole('admin'), messagesController.bulkAction.bind(messagesController));

// Single message
router.get('/:id', messagesController.getById.bind(messagesController));

export default router;
