import { Response } from 'express';
import { AuthRequest } from '../../types/api.types';
import ocrRepository from '../../services/database/repositories/OcrRepository';
import ocrQueueService from '../../services/ocr/OcrQueueService';
import logger from '../../utils/logger';
import { OCRJobMode } from '../../types/database.types';

export class OcrController {
  async createJob(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { mode, groupId } = req.body as { mode?: OCRJobMode; groupId?: string };
      const jobMode: OCRJobMode = mode === 'all' || mode === 'failed' ? mode : 'missing';
      const requestedBy = req.user?.userId || null;
      const { jobId, queued } = await ocrQueueService.createJob(requestedBy, jobMode, groupId);

      res.json({
        success: true,
        data: { id: jobId, queued },
      });
    } catch (error) {
      logger.error('Create OCR job failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create OCR job',
      });
    }
  }

  async listJobs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
      const offset = (page - 1) * limit;

      const [jobs, total] = await Promise.all([
        ocrRepository.listJobs(limit, offset),
        ocrRepository.countJobs(),
      ]);
      res.json({
        success: true,
        data: jobs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      logger.error('List OCR jobs failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list OCR jobs',
      });
    }
  }

  async getJob(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const job = await ocrRepository.getJobById(id);
      if (!job) {
        res.status(404).json({
          success: false,
          error: 'OCR job not found',
        });
        return;
      }

      res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      logger.error('Get OCR job failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get OCR job',
      });
    }
  }

  async getJobItems(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
      const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) || '50', 10)));
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const offset = (page - 1) * limit;

      const result = await ocrRepository.listJobItems(id, status, limit, offset);
      res.json({
        success: true,
        data: result.items,
        pagination: {
          page,
          limit,
          total: result.total,
          pages: Math.ceil(result.total / limit),
          hasNext: page * limit < result.total,
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      logger.error('Get OCR job items failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get OCR job items',
      });
    }
  }

  async cancelJob(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await ocrQueueService.cancelJob(id);
      res.json({
        success: true,
        message: 'OCR job cancelled',
      });
    } catch (error) {
      logger.error('Cancel OCR job failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel OCR job',
      });
    }
  }

  async retryFailed(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const count = await ocrQueueService.retryFailed(id);
      res.json({
        success: true,
        data: { retried: count },
      });
    } catch (error) {
      logger.error('Retry OCR job failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retry OCR job',
      });
    }
  }

  async getResultByMedia(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { mediaId } = req.params;
      const document = await ocrRepository.getDocumentByMediaId(mediaId);
      if (!document || !document.is_monitored) {
        res.status(404).json({
          success: false,
          error: 'OCR result not found',
        });
        return;
      }

      res.json({
        success: true,
        data: document,
      });
    } catch (error) {
      logger.error('Get OCR result by media failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get OCR result',
      });
    }
  }
}

export default new OcrController();
