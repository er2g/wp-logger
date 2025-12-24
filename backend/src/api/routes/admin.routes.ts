import { Router } from 'express';
import adminController from '../controllers/AdminController';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

router.use(authMiddleware);
router.use(requireRole('admin'));

router.get('/users', adminController.listUsers.bind(adminController));
router.post('/users', adminController.createUser.bind(adminController));
router.patch('/users/:id', adminController.updateUser.bind(adminController));
router.post('/users/:id/token', adminController.issueToken.bind(adminController));

export default router;
