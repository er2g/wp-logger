import { Router } from 'express';
import messagesController from '../controllers/MessagesController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', messagesController.getAll);
router.get('/search', messagesController.search);
router.get('/:id', messagesController.getById);

export default router;
