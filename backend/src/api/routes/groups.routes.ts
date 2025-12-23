import { Router } from 'express';
import groupsController from '../controllers/GroupsController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/whatsapp', groupsController.getWhatsappGroups);
router.get('/:id/whatsapp', groupsController.getWhatsappGroupDetails);
router.post('/monitored', groupsController.setMonitored);

router.get('/', groupsController.getAll);
router.get('/:id', groupsController.getById);
router.put('/:id', groupsController.update);

export default router;
