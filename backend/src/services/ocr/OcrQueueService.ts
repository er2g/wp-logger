import fs from 'fs';
import ocrRepository from '../database/repositories/OcrRepository';
import mediaRepository from '../database/repositories/MediaRepository';
import groupRepository from '../database/repositories/GroupRepository';
import fileStorageService from '../storage/FileStorage';
import ocrService from './OcrService';
import logger from '../../utils/logger';
import { OCRJobMode } from '../../types/database.types';
import websocketServer from '../../websocket/WebSocketServer';

export class OcrQueueService {
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private concurrency = parseInt(process.env.OCR_CONCURRENCY || '2', 10);
  private maxAttempts = parseInt(process.env.OCR_MAX_ATTEMPTS || '3', 10);
  private pollIntervalMs = parseInt(process.env.OCR_POLL_INTERVAL_MS || '5000', 10);
  private maxFileSizeBytes = parseInt(process.env.OCR_MAX_FILE_SIZE_MB || '25', 10) * 1024 * 1024;
  private language = process.env.OCR_LANGUAGE || 'unk';

  start(): void {
    const enabled = process.env.OCR_ENABLED !== 'false';
    if (!enabled || this.pollInterval) {
      return;
    }

    this.pollInterval = setInterval(() => {
      this.tick().catch((error) => {
        logger.error('OCR queue tick failed:', error);
      });
    }, this.pollIntervalMs);

    this.tick().catch((error) => {
      logger.error('OCR queue initial tick failed:', error);
    });
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async createJob(requestedBy: string | null, mode: OCRJobMode, groupId?: string): Promise<{ jobId: string; queued: number }> {
    const job = await ocrRepository.createJob(mode, requestedBy);

    const mediaIds = await this.getMediaIdsForJob(groupId);
    const queued = await ocrRepository.enqueueDocuments(job.id, mediaIds, mode);
    await ocrRepository.updateJobTotals(job.id, queued);
    if (queued === 0) {
      await ocrRepository.markJobStatus(job.id, 'completed');
    }

    this.broadcastJobUpdate(job.id);

    return { jobId: job.id, queued };
  }

  async cancelJob(jobId: string): Promise<void> {
    await ocrRepository.cancelJob(jobId);
    this.broadcastJobUpdate(jobId);
  }

  async retryFailed(jobId: string): Promise<number> {
    const count = await ocrRepository.retryFailed(jobId);
    await ocrRepository.refreshJobCounts(jobId);
    this.broadcastJobUpdate(jobId);
    return count;
  }

  private async getMediaIdsForJob(groupId?: string): Promise<string[]> {
    const groups = await groupRepository.findAll();
    const monitoredIds = new Set(groups.filter((g) => g.is_monitored).map((g) => g.id));

    if (groupId && !monitoredIds.has(groupId)) {
      return [];
    }

    const media = await mediaRepository.findAll();
    const eligible = media.filter((item) => {
      if (groupId && item.group_id !== groupId) {
        return false;
      }
      if (!monitoredIds.has(item.group_id)) {
        return false;
      }
      return item.media_type === 'image' || item.media_type === 'document' || item.media_type === 'sticker';
    });

    return eligible.map((item) => item.id);
  }

  private async tick(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    try {
      const documents = await ocrRepository.claimNextDocuments(this.concurrency);
      if (documents.length === 0) {
        return;
      }

      await Promise.all(documents.map((doc) => this.processDocument(doc.id)));
    } finally {
      this.isRunning = false;
    }
  }

  private async processDocument(documentId: string): Promise<void> {
    try {
      const document = await ocrRepository.getDocumentWithMedia(documentId);
      if (!document) {
        return;
      }

      if (document.job_id) {
        await ocrRepository.markJobRunning(document.job_id);
      }

      if (!document.is_monitored) {
        await ocrRepository.markDocumentSkipped(document.id, 'Group no longer monitored');
        if (document.job_id) {
          await ocrRepository.refreshJobCounts(document.job_id);
        }
        return;
      }

      if (!document.file_path) {
        await this.handleFailure(document, 'Missing file path');
        return;
      }

      const exists = await fileStorageService.fileExists(document.file_path);
      if (!exists) {
        await this.handleFailure(document, 'File not found on disk');
        return;
      }

      const size = await fileStorageService.getFileSize(document.file_path);
      if (size > this.maxFileSizeBytes) {
        await ocrRepository.markDocumentSkipped(document.id, 'File exceeds OCR size limit');
        if (document.job_id) {
          await ocrRepository.refreshJobCounts(document.job_id);
        }
        return;
      }

      const buffer = await fs.promises.readFile(document.file_path);
      const result = await ocrService.extractText({
        buffer,
        mimeType: document.mime_type,
        fileName: document.file_name,
        language: this.language,
      });

      await ocrRepository.markDocumentSucceeded(
        document.id,
        result.provider,
        result.language || null,
        result.text,
        result.json
      );

      if (document.job_id) {
        await ocrRepository.refreshJobCounts(document.job_id);
        this.broadcastJobUpdate(document.job_id);
      }
    } catch (error: any) {
      const document = await ocrRepository.getDocumentWithMedia(documentId);
      if (!document) {
        return;
      }
      await this.handleFailure(document, error?.message || 'OCR failed');
    }
  }

  private async handleFailure(document: { id: string; attempts: number; job_id: string | null }, errorMessage: string): Promise<void> {
    const attempts = document.attempts + 1;
    const final = attempts >= this.maxAttempts;
    const retryAt = final ? null : new Date(Date.now() + attempts * 60 * 1000);

    await ocrRepository.markDocumentFailed(document.id, attempts, errorMessage, retryAt, final);

    if (document.job_id) {
      await ocrRepository.refreshJobCounts(document.job_id);
      this.broadcastJobUpdate(document.job_id);
    }
  }

  private async broadcastJobUpdate(jobId: string): Promise<void> {
    const job = await ocrRepository.getJobById(jobId);
    if (!job) {
      return;
    }

    websocketServer.broadcastToRoles(['admin'], 'ocr:job', {
      id: job.id,
      status: job.status,
      mode: job.mode,
      total_items: job.total_items,
      queued_items: job.queued_items,
      processing_items: job.processing_items,
      succeeded_items: job.succeeded_items,
      failed_items: job.failed_items,
      skipped_items: job.skipped_items,
      created_at: job.created_at,
      started_at: job.started_at,
      finished_at: job.finished_at,
      last_error: job.last_error,
    });
  }
}

export default new OcrQueueService();
