import { pool } from '../../../config/database';
import { Media } from '../../../types/database.types';
import logger from '../../../utils/logger';

export interface MediaWithOcrInfo extends Media {
  group_name: string;
  has_ocr: boolean;
  ocr_status: string | null;
}

export interface MediaFilter {
  groupId?: string;
  mediaType?: string;
  ocrEligible?: boolean;
  limit?: number;
  offset?: number;
}

export class MediaRepository {
  async findAll(): Promise<Media[]> {
    try {
      const result = await pool.query<Media>(
        `SELECT m.* FROM media m
         JOIN groups g ON m.group_id = g.id
         WHERE g.is_monitored = true`
      );
      return result.rows;
    } catch (error) {
      logger.error('Failed to find all media:', error);
      throw error;
    }
  }

  async findWithOcrInfo(filter: MediaFilter = {}): Promise<{ items: MediaWithOcrInfo[]; total: number }> {
    try {
      const conditions: string[] = ['g.is_monitored = true'];
      const params: any[] = [];
      let paramIndex = 1;

      if (filter.groupId) {
        conditions.push(`m.group_id = $${paramIndex++}`);
        params.push(filter.groupId);
      }

      if (filter.mediaType) {
        conditions.push(`m.media_type = $${paramIndex++}`);
        params.push(filter.mediaType);
      }

      if (filter.ocrEligible) {
        conditions.push(`m.media_type IN ('image', 'document', 'sticker')`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM media m
         JOIN groups g ON m.group_id = g.id
         ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0]?.count || '0', 10);

      const limit = filter.limit || 100;
      const offset = filter.offset || 0;

      const result = await pool.query<MediaWithOcrInfo>(
        `SELECT
          m.*,
          g.name as group_name,
          CASE WHEN od.id IS NOT NULL THEN true ELSE false END as has_ocr,
          od.status as ocr_status
         FROM media m
         JOIN groups g ON m.group_id = g.id
         LEFT JOIN ocr_documents od ON m.id = od.media_id
         ${whereClause}
         ORDER BY m.created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...params, limit, offset]
      );

      return { items: result.rows, total };
    } catch (error) {
      logger.error('Failed to find media with OCR info:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Media | null> {
    try {
      const result = await pool.query<Media>(
        `SELECT m.* FROM media m
         JOIN groups g ON m.group_id = g.id
         WHERE m.id = $1 AND g.is_monitored = true`,
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find media by id:', error);
      throw error;
    }
  }

  async findByMessageId(messageId: string): Promise<Media[]> {
    try {
      const result = await pool.query<Media>(
        `SELECT m.* FROM media m
         JOIN groups g ON m.group_id = g.id
         WHERE m.message_id = $1 AND g.is_monitored = true`,
        [messageId]
      );
      return result.rows;
    } catch (error) {
      logger.error('Failed to find media by message id:', error);
      throw error;
    }
  }

  async findByGroupId(groupId: string): Promise<Media[]> {
    try {
      const result = await pool.query<Media>(
        `SELECT m.* FROM media m
         JOIN groups g ON m.group_id = g.id
         WHERE m.group_id = $1 AND g.is_monitored = true`,
        [groupId]
      );
      return result.rows;
    } catch (error) {
      logger.error('Failed to find media by group id:', error);
      throw error;
    }
  }

  async create(media: Omit<Media, 'id' | 'created_at'>): Promise<Media> {
    try {
      const {
        message_id,
        group_id,
        file_name,
        file_path,
        file_size,
        mime_type,
        media_type,
        thumbnail_path,
        duration,
        width,
        height,
      } = media;

      const result = await pool.query<Media>(
        `INSERT INTO media (
          message_id, group_id, file_name, file_path, file_size,
          mime_type, media_type, thumbnail_path, duration, width, height
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          message_id,
          group_id,
          file_name,
          file_path,
          file_size,
          mime_type,
          media_type,
          thumbnail_path,
          duration,
          width,
          height,
        ]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create media:', error);
      throw error;
    }
  }

  async update(id: string, media: Partial<Omit<Media, 'id' | 'created_at'>>): Promise<Media | null> {
    try {
      const fields = Object.keys(media);
      if (fields.length === 0) return this.findById(id);

      const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
      const values = Object.values(media);

      const result = await pool.query<Media>(
        `UPDATE media SET ${setClause} WHERE id = $1 RETURNING *`,
        [id, ...values]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to update media:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await pool.query('DELETE FROM media WHERE id = $1', [id]);
    } catch (error) {
      logger.error('Failed to delete media:', error);
      throw error;
    }
  }
}

export default new MediaRepository();
