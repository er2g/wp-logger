import { pool } from '../../../config/database';
import { OCRJob, OCRDocument, OCRJobMode } from '../../../types/database.types';
import logger from '../../../utils/logger';

export interface OCRJobWithCounts extends OCRJob {
  queued_items: number;
  processing_items: number;
  skipped_items: number;
}

export interface OCRDocumentWithMedia extends OCRDocument {
  file_name: string | null;
  file_path: string | null;
  mime_type: string | null;
  media_type: string;
  group_id: string;
  is_monitored: boolean;
}

export class OcrRepository {
  async createJob(mode: OCRJobMode, requestedBy: string | null): Promise<OCRJob> {
    try {
      const result = await pool.query<OCRJob>(
        `INSERT INTO ocr_jobs (mode, requested_by)
         VALUES ($1, $2)
         RETURNING *`,
        [mode, requestedBy]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create OCR job:', error);
      throw error;
    }
  }

  async updateJobTotals(jobId: string, totalItems: number): Promise<void> {
    try {
      await pool.query(
        'UPDATE ocr_jobs SET total_items = $1 WHERE id = $2',
        [totalItems, jobId]
      );
    } catch (error) {
      logger.error('Failed to update OCR job totals:', error);
      throw error;
    }
  }

  async markJobRunning(jobId: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE ocr_jobs
         SET status = 'running', started_at = COALESCE(started_at, NOW())
         WHERE id = $1 AND status = 'queued'`,
        [jobId]
      );
    } catch (error) {
      logger.error('Failed to mark OCR job running:', error);
      throw error;
    }
  }

  async markJobStatus(jobId: string, status: OCRJob['status'], error?: string | null): Promise<void> {
    try {
      const finishedAt = status === 'completed' || status === 'failed' || status === 'cancelled';
      await pool.query(
        `UPDATE ocr_jobs
         SET status = $2,
             last_error = $3,
             finished_at = CASE WHEN $4 THEN NOW() ELSE finished_at END
         WHERE id = $1`,
        [jobId, status, error || null, finishedAt]
      );
    } catch (error) {
      logger.error('Failed to update OCR job status:', error);
      throw error;
    }
  }

  async listJobs(limit: number, offset: number): Promise<OCRJobWithCounts[]> {
    try {
      const result = await pool.query<OCRJobWithCounts>(
        `SELECT j.*,
                COALESCE(c.total, 0) as total_items,
                COALESCE(c.queued, 0) as queued_items,
                COALESCE(c.processing, 0) as processing_items,
                COALESCE(c.succeeded, 0) as succeeded_items,
                COALESCE(c.failed, 0) as failed_items,
                COALESCE(c.skipped, 0) as skipped_items
         FROM ocr_jobs j
         LEFT JOIN (
           SELECT job_id,
                  COUNT(*) as total,
                  COUNT(*) FILTER (WHERE status = 'queued') as queued,
                  COUNT(*) FILTER (WHERE status = 'processing') as processing,
                  COUNT(*) FILTER (WHERE status = 'succeeded') as succeeded,
                  COUNT(*) FILTER (WHERE status = 'failed') as failed,
                  COUNT(*) FILTER (WHERE status = 'skipped') as skipped
           FROM ocr_documents
           GROUP BY job_id
         ) c ON c.job_id = j.id
         ORDER BY j.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      return result.rows;
    } catch (error) {
      logger.error('Failed to list OCR jobs:', error);
      throw error;
    }
  }

  async countJobs(): Promise<number> {
    try {
      const result = await pool.query<{ count: string }>('SELECT COUNT(*) as count FROM ocr_jobs');
      return parseInt(result.rows[0]?.count || '0', 10);
    } catch (error) {
      logger.error('Failed to count OCR jobs:', error);
      throw error;
    }
  }

  async getJobById(jobId: string): Promise<OCRJobWithCounts | null> {
    try {
      const result = await pool.query<OCRJobWithCounts>(
        `SELECT j.*,
                COALESCE(c.total, 0) as total_items,
                COALESCE(c.queued, 0) as queued_items,
                COALESCE(c.processing, 0) as processing_items,
                COALESCE(c.succeeded, 0) as succeeded_items,
                COALESCE(c.failed, 0) as failed_items,
                COALESCE(c.skipped, 0) as skipped_items
         FROM ocr_jobs j
         LEFT JOIN (
           SELECT job_id,
                  COUNT(*) as total,
                  COUNT(*) FILTER (WHERE status = 'queued') as queued,
                  COUNT(*) FILTER (WHERE status = 'processing') as processing,
                  COUNT(*) FILTER (WHERE status = 'succeeded') as succeeded,
                  COUNT(*) FILTER (WHERE status = 'failed') as failed,
                  COUNT(*) FILTER (WHERE status = 'skipped') as skipped
           FROM ocr_documents
           GROUP BY job_id
         ) c ON c.job_id = j.id
         WHERE j.id = $1`,
        [jobId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get OCR job:', error);
      throw error;
    }
  }

  async enqueueDocuments(jobId: string, mediaIds: string[], mode: OCRJobMode): Promise<number> {
    if (mediaIds.length === 0) {
      return 0;
    }

    try {
      if (mode === 'all') {
        const result = await pool.query(
          `INSERT INTO ocr_documents (job_id, media_id, status, attempts, next_attempt_at, error_message, updated_at)
           SELECT $1, m, 'queued', 0, NULL, NULL, NOW()
           FROM UNNEST($2::uuid[]) AS m
           ON CONFLICT (media_id)
           DO UPDATE SET job_id = $1,
                         status = 'queued',
                         attempts = 0,
                         next_attempt_at = NULL,
                         error_message = NULL,
                         provider = NULL,
                         language = NULL,
                         text = NULL,
                         result_json = NULL,
                         started_at = NULL,
                         finished_at = NULL,
                         updated_at = NOW()`,
          [jobId, mediaIds]
        );
        return result.rowCount || mediaIds.length;
      }

      const insertResult = await pool.query(
        `INSERT INTO ocr_documents (job_id, media_id, status)
         SELECT $1, m, 'queued'
         FROM UNNEST($2::uuid[]) AS m
         ON CONFLICT (media_id) DO NOTHING`,
        [jobId, mediaIds]
      );

      let updatedCount = 0;
      if (mode === 'failed') {
        const updateResult = await pool.query(
          `UPDATE ocr_documents
           SET job_id = $1,
               status = 'queued',
               attempts = 0,
               next_attempt_at = NULL,
               error_message = NULL,
               provider = NULL,
               language = NULL,
               text = NULL,
               result_json = NULL,
               started_at = NULL,
               finished_at = NULL,
               updated_at = NOW()
           WHERE media_id = ANY($2::uuid[])
             AND status = 'failed'`,
          [jobId, mediaIds]
        );
        updatedCount = updateResult.rowCount || 0;
      }

      return (insertResult.rowCount || 0) + updatedCount;
    } catch (error) {
      logger.error('Failed to enqueue OCR documents:', error);
      throw error;
    }
  }

  async listJobItems(jobId: string, status: string | undefined, limit: number, offset: number): Promise<{ items: OCRDocumentWithMedia[]; total: number }> {
    try {
      const params: any[] = [jobId];
      let statusFilter = '';
      if (status) {
        params.push(status);
        statusFilter = `AND d.status = $${params.length}`;
      }

      const countResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM ocr_documents d
         WHERE d.job_id = $1 ${statusFilter}`,
        params
      );

      params.push(limit, offset);
      const itemsResult = await pool.query<OCRDocumentWithMedia>(
        `SELECT d.*,
                m.file_name,
                m.file_path,
                m.mime_type,
                m.media_type,
                m.group_id,
                g.is_monitored
         FROM ocr_documents d
         JOIN media m ON m.id = d.media_id
         JOIN groups g ON g.id = m.group_id
         WHERE d.job_id = $1 ${statusFilter}
         ORDER BY d.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      return {
        items: itemsResult.rows,
        total: parseInt(countResult.rows[0]?.count || '0', 10),
      };
    } catch (error) {
      logger.error('Failed to list OCR job items:', error);
      throw error;
    }
  }

  async getDocumentByMediaId(mediaId: string): Promise<OCRDocumentWithMedia | null> {
    try {
      const result = await pool.query<OCRDocumentWithMedia>(
        `SELECT d.*,
                m.file_name,
                m.file_path,
                m.mime_type,
                m.media_type,
                m.group_id,
                g.is_monitored
         FROM ocr_documents d
         JOIN media m ON m.id = d.media_id
         JOIN groups g ON g.id = m.group_id
         WHERE d.media_id = $1
         LIMIT 1`,
        [mediaId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get OCR document by media id:', error);
      throw error;
    }
  }

  async claimNextDocuments(limit: number): Promise<OCRDocument[]> {
    try {
      const result = await pool.query<OCRDocument>(
        `WITH next_docs AS (
           SELECT d.id
           FROM ocr_documents d
           JOIN ocr_jobs j ON j.id = d.job_id
           WHERE d.status = 'queued'
             AND j.status IN ('queued', 'running')
             AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= NOW())
           ORDER BY d.created_at ASC
           FOR UPDATE SKIP LOCKED
           LIMIT $1
         )
         UPDATE ocr_documents d
         SET status = 'processing',
             started_at = NOW(),
             updated_at = NOW()
         FROM next_docs
         WHERE d.id = next_docs.id
         RETURNING d.*`,
        [limit]
      );
      return result.rows;
    } catch (error) {
      logger.error('Failed to claim OCR documents:', error);
      throw error;
    }
  }

  async getDocumentWithMedia(documentId: string): Promise<OCRDocumentWithMedia | null> {
    try {
      const result = await pool.query<OCRDocumentWithMedia>(
        `SELECT d.*,
                m.file_name,
                m.file_path,
                m.mime_type,
                m.media_type,
                m.group_id,
                g.is_monitored
         FROM ocr_documents d
         JOIN media m ON m.id = d.media_id
         JOIN groups g ON g.id = m.group_id
         WHERE d.id = $1`,
        [documentId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get OCR document with media:', error);
      throw error;
    }
  }

  async markDocumentSucceeded(documentId: string, provider: string, language: string | null, text: string, resultJson: Record<string, any>): Promise<void> {
    try {
      await pool.query(
        `UPDATE ocr_documents
         SET status = 'succeeded',
             provider = $2,
             language = $3,
             text = $4,
             result_json = $5,
             error_message = NULL,
             finished_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [documentId, provider, language, text, resultJson]
      );
    } catch (error) {
      logger.error('Failed to mark OCR document succeeded:', error);
      throw error;
    }
  }

  async markDocumentFailed(documentId: string, attempts: number, errorMessage: string, retryAt: Date | null, final: boolean): Promise<void> {
    try {
      await pool.query(
        `UPDATE ocr_documents
         SET status = $2,
             attempts = $3,
             error_message = $4,
             next_attempt_at = $5,
             finished_at = CASE WHEN $6 THEN NOW() ELSE NULL END,
             updated_at = NOW()
         WHERE id = $1`,
        [documentId, final ? 'failed' : 'queued', attempts, errorMessage, retryAt, final]
      );
    } catch (error) {
      logger.error('Failed to mark OCR document failed:', error);
      throw error;
    }
  }

  async markDocumentSkipped(documentId: string, reason: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE ocr_documents
         SET status = 'skipped',
             error_message = $2,
             finished_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [documentId, reason]
      );
    } catch (error) {
      logger.error('Failed to mark OCR document skipped:', error);
      throw error;
    }
  }

  async refreshJobCounts(jobId: string): Promise<void> {
    try {
      const counts = await pool.query<{
        total: string;
        processed: string;
        succeeded: string;
        failed: string;
        skipped: string;
        processing: string;
        queued: string;
      }>(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE status IN ('succeeded', 'failed', 'skipped')) as processed,
           COUNT(*) FILTER (WHERE status = 'succeeded') as succeeded,
           COUNT(*) FILTER (WHERE status = 'failed') as failed,
           COUNT(*) FILTER (WHERE status = 'skipped') as skipped,
           COUNT(*) FILTER (WHERE status = 'processing') as processing,
           COUNT(*) FILTER (WHERE status = 'queued') as queued
         FROM ocr_documents
         WHERE job_id = $1`,
        [jobId]
      );

      const row = counts.rows[0];
      if (!row) {
        return;
      }

      const processed = parseInt(row.processed, 10);
      const total = parseInt(row.total, 10);
      const processing = parseInt(row.processing, 10);
      const queued = parseInt(row.queued, 10);

      let status: OCRJob['status'] = 'running';
      if (total === 0) {
        status = 'completed';
      } else if (processed >= total && processing === 0 && queued === 0) {
        status = 'completed';
      }

      await pool.query(
        `UPDATE ocr_jobs
         SET processed_items = $2,
             succeeded_items = $3,
             failed_items = $4,
             total_items = $5,
             status = CASE WHEN status = 'cancelled' THEN status ELSE $6 END,
             finished_at = CASE WHEN status = 'cancelled' THEN finished_at WHEN $6 = 'completed' THEN NOW() ELSE finished_at END
         WHERE id = $1`,
        [
          jobId,
          processed,
          parseInt(row.succeeded, 10),
          parseInt(row.failed, 10),
          total,
          status,
        ]
      );
    } catch (error) {
      logger.error('Failed to refresh OCR job counts:', error);
      throw error;
    }
  }

  async cancelJob(jobId: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE ocr_jobs SET status = 'cancelled', finished_at = NOW() WHERE id = $1`,
        [jobId]
      );

      await pool.query(
        `UPDATE ocr_documents
         SET status = 'skipped',
             error_message = 'Job cancelled',
             finished_at = NOW(),
             updated_at = NOW()
         WHERE job_id = $1 AND status IN ('queued', 'processing')`,
        [jobId]
      );
    } catch (error) {
      logger.error('Failed to cancel OCR job:', error);
      throw error;
    }
  }

  async retryFailed(jobId: string): Promise<number> {
    try {
      const result = await pool.query(
        `UPDATE ocr_documents
         SET status = 'queued',
             attempts = 0,
             next_attempt_at = NULL,
             error_message = NULL,
             provider = NULL,
             language = NULL,
             text = NULL,
             result_json = NULL,
             started_at = NULL,
             finished_at = NULL,
             updated_at = NOW()
         WHERE job_id = $1 AND status = 'failed'`,
        [jobId]
      );

      await pool.query(
        `UPDATE ocr_jobs
         SET status = 'running', finished_at = NULL
         WHERE id = $1 AND status = 'completed'`,
        [jobId]
      );

      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to retry OCR documents:', error);
      throw error;
    }
  }
}

export default new OcrRepository();
