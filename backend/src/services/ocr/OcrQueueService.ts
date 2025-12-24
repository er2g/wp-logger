import fs from 'fs';
import sharp from 'sharp';
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

      if (document.message_id) {
        const existing = await ocrRepository.findSucceededDocumentByMessageId(document.message_id);
        if (existing && existing.id !== document.id) {
          await ocrRepository.markDocumentSkipped(document.id, 'Bundled by another OCR result');
          if (document.job_id) {
            await ocrRepository.refreshJobCounts(document.job_id);
          }
          return;
        }
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

      const bundle = await this.buildBundle(document);
      if (!bundle) {
        await this.handleFailure(document, 'File not found on disk');
        return;
      }

      if (bundle.buffer.length > this.maxFileSizeBytes) {
        await ocrRepository.markDocumentSkipped(document.id, 'File exceeds OCR size limit');
        if (document.job_id) {
          await ocrRepository.refreshJobCounts(document.job_id);
        }
        return;
      }

      const result = await ocrService.extractText({
        buffer: bundle.buffer,
        mimeType: bundle.mimeType || document.mime_type,
        fileName: bundle.fileName || document.file_name,
        language: this.language,
      });

      const bundleResult = {
        ...result.json,
        bundled_media_ids: bundle.mediaIds,
      };

      if (bundle.mediaIds.length > 1) {
        await ocrRepository.markDocumentsSucceededByMediaIds(
          bundle.mediaIds,
          document.job_id,
          result.provider,
          result.language || null,
          result.text,
          bundleResult
        );
      } else {
        await ocrRepository.markDocumentSucceeded(
          document.id,
          result.provider,
          result.language || null,
          result.text,
          bundleResult
        );
      }

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

  private async buildBundle(document: { media_id: string; message_id: string | null; media_type: string; file_path: string | null; file_name: string | null; mime_type: string | null }): Promise<{ buffer: Buffer; mimeType: string | null; fileName: string | null; mediaIds: string[] } | null> {
    const primaryPath = document.file_path;
    if (!primaryPath) {
      return null;
    }

    const primaryExists = await fileStorageService.fileExists(primaryPath);
    if (!primaryExists) {
      return null;
    }

    if (!document.message_id || (document.media_type !== 'image' && document.media_type !== 'sticker')) {
      const buffer = await fs.promises.readFile(primaryPath);
      return {
        buffer,
        mimeType: document.mime_type,
        fileName: document.file_name,
        mediaIds: [document.media_id],
      };
    }

    const bundle = await ocrRepository.getMediaBundleByMessageId(document.message_id);
    const imageBundle = bundle.filter((item) => item.media_type === 'image' || item.media_type === 'sticker');

    if (imageBundle.length <= 1) {
      const buffer = await fs.promises.readFile(primaryPath);
      return {
        buffer,
        mimeType: document.mime_type,
        fileName: document.file_name,
        mediaIds: [document.media_id],
      };
    }

    const buffers = [];
    const sizes = [];
    for (const item of imageBundle) {
      if (!item.file_path) {
        continue;
      }
      const exists = await fileStorageService.fileExists(item.file_path);
      if (!exists) {
        continue;
      }
      const fileBuffer = await fs.promises.readFile(item.file_path);
      const metadata = await sharp(fileBuffer).metadata();
      if (!metadata.width || !metadata.height) {
        continue;
      }
      buffers.push(fileBuffer);
      sizes.push({ width: metadata.width, height: metadata.height });
    }

    if (buffers.length <= 1) {
      const buffer = await fs.promises.readFile(primaryPath);
      return {
        buffer,
        mimeType: document.mime_type,
        fileName: document.file_name,
        mediaIds: [document.media_id],
      };
    }

    const maxWidth = Math.max(...sizes.map((size) => size.width));
    const resized = await Promise.all(
      buffers.map((buffer) => sharp(buffer).resize({ width: maxWidth }).png().toBuffer({ resolveWithObject: true }))
    );

    const totalHeight = resized.reduce((sum, entry) => sum + entry.info.height, 0);
    const composite = [];
    let offsetY = 0;
    for (const entry of resized) {
      composite.push({ input: entry.data, top: offsetY, left: 0 });
      offsetY += entry.info.height;
    }

    const merged = await sharp({
      create: {
        width: maxWidth,
        height: totalHeight,
        channels: 3,
        background: 'white',
      },
    })
      .composite(composite)
      .png()
      .toBuffer();

    const bundleIds = imageBundle.map((item) => item.id);

    return {
      buffer: merged,
      mimeType: 'image/png',
      fileName: `bundle-${document.message_id}.png`,
      mediaIds: bundleIds,
    };
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
