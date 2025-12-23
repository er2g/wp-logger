import { Router } from 'express';
import messagesController from '../controllers/MessagesController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// Main endpoints
router.get('/', messagesController.getAll.bind(messagesController));
router.get('/search', messagesController.search.bind(messagesController));
router.get('/advanced-search', messagesController.advancedSearch.bind(messagesController));
router.get('/stats', messagesController.getStats.bind(messagesController));

// Bulk operations
router.post('/bulk', messagesController.bulkAction.bind(messagesController));

// Single message
router.get('/:id', messagesController.getById.bind(messagesController));

export default router;
