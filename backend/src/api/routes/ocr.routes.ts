import { Router } from 'express';
import ocrController from '../controllers/OcrController';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

router.use(authMiddleware);
router.use(requireRole('admin'));

// Settings
router.get('/settings', ocrController.getSettings.bind(ocrController));
router.patch('/settings', ocrController.updateSettings.bind(ocrController));

// Jobs
router.post('/jobs', ocrController.createJob.bind(ocrController));
router.get('/jobs', ocrController.listJobs.bind(ocrController));
router.get('/jobs/:id', ocrController.getJob.bind(ocrController));
router.get('/jobs/:id/items', ocrController.getJobItems.bind(ocrController));
router.post('/jobs/:id/cancel', ocrController.cancelJob.bind(ocrController));
router.post('/jobs/:id/retry-failed', ocrController.retryFailed.bind(ocrController));

// Media OCR
router.post('/jobs/from-media', ocrController.createJobFromMedia.bind(ocrController));
router.get('/media/:mediaId', ocrController.getResultByMedia.bind(ocrController));

export default router;
