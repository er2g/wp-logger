import { pool } from '../../../config/database';
import { Message, MessageType, SearchResult } from '../../../types/database.types';
import { MessageFilterQuery, AdvancedSearchQuery } from '../../../types/api.types';
import logger from '../../../utils/logger';

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export class MessageRepository {
  async findAll(): Promise<Message[]> {
    try {
      const result = await pool.query<Message>(
        'SELECT * FROM messages ORDER BY timestamp DESC'
      );
      return result.rows;
    } catch (error) {
      logger.error('Failed to find all messages:', error);
      throw error;
    }
  }

  async findWithPagination(filters: MessageFilterQuery): Promise<PaginatedResult<Message>> {
    try {
      const page = Math.max(1, parseInt(filters.page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(filters.limit || '50', 10)));
      const offset = (page - 1) * limit;
      const sortBy = filters.sortBy || 'timestamp';
      const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.groupId) {
        conditions.push(`m.group_id = $${paramIndex++}`);
        params.push(filters.groupId);
      }

      if (filters.type) {
        const types = Array.isArray(filters.type) ? filters.type : [filters.type];
        conditions.push(`m.message_type = ANY($${paramIndex++})`);
        params.push(types);
      }

      if (filters.senderNumber) {
        conditions.push(`m.sender_number ILIKE $${paramIndex++}`);
        params.push(`%${filters.senderNumber}%`);
      }

      if (filters.senderName) {
        conditions.push(`m.sender_name ILIKE $${paramIndex++}`);
        params.push(`%${filters.senderName}%`);
      }

      if (filters.startDate) {
        conditions.push(`m.timestamp >= $${paramIndex++}`);
        params.push(new Date(filters.startDate));
      }

      if (filters.endDate) {
        conditions.push(`m.timestamp <= $${paramIndex++}`);
        params.push(new Date(filters.endDate));
      }

      if (filters.hasMedia === 'true') {
        conditions.push('m.has_media = true');
      } else if (filters.hasMedia === 'false') {
        conditions.push('m.has_media = false');
      }

      if (filters.isForwarded === 'true') {
        conditions.push('m.is_forwarded = true');
      }

      if (filters.search) {
        conditions.push(`(
          m.content ILIKE $${paramIndex} OR
          m.sender_name ILIKE $${paramIndex} OR
          m.sender_number ILIKE $${paramIndex}
        )`);
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM messages m ${whereClause}`;
      const countResult = await pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count, 10);

      // Get paginated data
      const dataQuery = `
        SELECT m.* FROM messages m
        ${whereClause}
        ORDER BY m.${sortBy} ${sortOrder}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      params.push(limit, offset);

      const dataResult = await pool.query<Message>(dataQuery, params);

      return {
        data: dataResult.rows,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Failed to find messages with pagination:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Message | null> {
    try {
      const result = await pool.query<Message>(
        'SELECT * FROM messages WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find message by id:', error);
      throw error;
    }
  }

  async findByWhatsappMessageId(whatsappMessageId: string): Promise<Message | null> {
    try {
      const result = await pool.query<Message>(
        'SELECT * FROM messages WHERE whatsapp_message_id = $1',
        [whatsappMessageId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find message by WhatsApp id:', error);
      throw error;
    }
  }

  async findByGroupId(groupId: string, limit?: number): Promise<Message[]> {
    try {
      let query = 'SELECT * FROM messages WHERE group_id = $1 ORDER BY timestamp DESC';
      const params: any[] = [groupId];

      if (limit) {
        query += ' LIMIT $2';
        params.push(limit);
      }

      const result = await pool.query<Message>(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Failed to find messages by group id:', error);
      throw error;
    }
  }

  async search(query: string, groupId?: string): Promise<Message[]> {
    try {
      const likeQuery = `%${query}%`;
      if (groupId) {
        const result = await pool.query<Message>(
          `SELECT * FROM messages
           WHERE group_id = $2
           AND (
             content ILIKE $1
             OR sender_name ILIKE $1
             OR sender_number ILIKE $1
           )
           ORDER BY timestamp DESC
           LIMIT 100`,
          [likeQuery, groupId]
        );
        return result.rows;
      }

      const result = await pool.query<Message>(
        `SELECT * FROM messages
         WHERE content ILIKE $1
         OR sender_name ILIKE $1
         OR sender_number ILIKE $1
         ORDER BY timestamp DESC
         LIMIT 100`,
        [likeQuery]
      );
      return result.rows;
    } catch (error) {
      logger.error('Failed to search messages:', error);
      throw error;
    }
  }

  async advancedSearch(filters: AdvancedSearchQuery): Promise<PaginatedResult<SearchResult>> {
    try {
      const page = Math.max(1, parseInt(filters.page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(filters.limit || '50', 10)));
      const offset = (page - 1) * limit;

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Full-text search
      if (filters.q) {
        if (filters.exact === 'true') {
          conditions.push(`m.content ILIKE $${paramIndex++}`);
          params.push(`%${filters.q}%`);
        } else {
          conditions.push(`(
            m.content ILIKE $${paramIndex} OR
            m.sender_name ILIKE $${paramIndex} OR
            m.sender_number ILIKE $${paramIndex}
          )`);
          params.push(`%${filters.q}%`);
          paramIndex++;
        }
      }

      if (filters.groupId) {
        conditions.push(`m.group_id = $${paramIndex++}`);
        params.push(filters.groupId);
      }

      if (filters.type) {
        const types = Array.isArray(filters.type) ? filters.type : [filters.type];
        conditions.push(`m.message_type = ANY($${paramIndex++})`);
        params.push(types);
      }

      if (filters.startDate) {
        conditions.push(`m.timestamp >= $${paramIndex++}`);
        params.push(new Date(filters.startDate));
      }

      if (filters.endDate) {
        conditions.push(`m.timestamp <= $${paramIndex++}`);
        params.push(new Date(filters.endDate));
      }

      if (filters.senderNumber) {
        conditions.push(`m.sender_number ILIKE $${paramIndex++}`);
        params.push(`%${filters.senderNumber}%`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM messages m ${whereClause}`;
      const countResult = await pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count, 10);

      // Determine sort order
      let orderBy = 'm.timestamp DESC';
      if (filters.sortBy === 'sender') {
        orderBy = 'm.sender_name ASC NULLS LAST, m.timestamp DESC';
      }

      // Get paginated data with group name
      const dataQuery = `
        SELECT
          m.id,
          m.group_id,
          g.name as group_name,
          m.sender_name,
          m.sender_number,
          m.content,
          m.message_type,
          m.timestamp,
          m.has_media,
          CASE
            WHEN m.content ILIKE $${paramIndex}
            THEN regexp_replace(m.content, '(${filters.q || ''})', E'<mark>\\1</mark>', 'gi')
            ELSE m.content
          END as highlight,
          1 as score
        FROM messages m
        LEFT JOIN groups g ON m.group_id = g.id
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
      `;
      params.push(`%${filters.q || ''}%`, limit, offset);

      const dataResult = await pool.query<SearchResult>(dataQuery, params);

      return {
        data: dataResult.rows,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Failed to perform advanced search:', error);
      throw error;
    }
  }

  async getStats(groupId?: string, startDate?: Date, endDate?: Date): Promise<{
    total: number;
    byType: Record<string, number>;
    byDay: Array<{ date: string; count: number }>;
    byHour: number[];
    topSenders: Array<{ sender_name: string; sender_number: string; count: number }>;
  }> {
    try {
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (groupId) {
        conditions.push(`group_id = $${paramIndex++}`);
        params.push(groupId);
      }

      if (startDate) {
        conditions.push(`timestamp >= $${paramIndex++}`);
        params.push(startDate);
      }

      if (endDate) {
        conditions.push(`timestamp <= $${paramIndex++}`);
        params.push(endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Total count
      const totalResult = await pool.query(
        `SELECT COUNT(*) FROM messages ${whereClause}`,
        params
      );
      const total = parseInt(totalResult.rows[0].count, 10);

      // By type
      const byTypeResult = await pool.query(
        `SELECT message_type, COUNT(*) as count FROM messages ${whereClause} GROUP BY message_type`,
        params
      );
      const byType: Record<string, number> = {};
      byTypeResult.rows.forEach((row: any) => {
        byType[row.message_type] = parseInt(row.count, 10);
      });

      // By day (last 30 days)
      const byDayResult = await pool.query(
        `SELECT DATE(timestamp) as date, COUNT(*) as count
         FROM messages ${whereClause}
         GROUP BY DATE(timestamp)
         ORDER BY date DESC
         LIMIT 30`,
        params
      );
      const byDay = byDayResult.rows.map((row: any) => ({
        date: row.date.toISOString().split('T')[0],
        count: parseInt(row.count, 10),
      }));

      // By hour
      const byHourResult = await pool.query(
        `SELECT EXTRACT(HOUR FROM timestamp) as hour, COUNT(*) as count
         FROM messages ${whereClause}
         GROUP BY hour
         ORDER BY hour`,
        params
      );
      const byHour = new Array(24).fill(0);
      byHourResult.rows.forEach((row: any) => {
        byHour[parseInt(row.hour, 10)] = parseInt(row.count, 10);
      });

      // Top senders
      const topSendersResult = await pool.query(
        `SELECT sender_name, sender_number, COUNT(*) as count
         FROM messages ${whereClause}
         GROUP BY sender_name, sender_number
         ORDER BY count DESC
         LIMIT 10`,
        params
      );
      const topSenders = topSendersResult.rows.map((row: any) => ({
        sender_name: row.sender_name,
        sender_number: row.sender_number,
        count: parseInt(row.count, 10),
      }));

      return { total, byType, byDay, byHour, topSenders };
    } catch (error) {
      logger.error('Failed to get message stats:', error);
      throw error;
    }
  }

  async create(message: Omit<Message, 'id' | 'created_at' | 'is_starred' | 'is_deleted' | 'edited_at' | 'mentions' | 'links' | 'reaction_emoji' | 'reaction_target_id' | 'poll_name' | 'poll_options' | 'poll_votes' | 'location_latitude' | 'location_longitude' | 'location_name' | 'location_address' | 'contact_vcard' | 'group_event_type' | 'group_event_participants' | 'reply_to_message_id'>): Promise<Message> {
    try {
      const {
        group_id,
        whatsapp_message_id,
        sender_name,
        sender_number,
        content,
        message_type,
        timestamp,
        is_forwarded,
        has_media,
      } = message;

      const result = await pool.query<Message>(
        `INSERT INTO messages (
          group_id, whatsapp_message_id, sender_name, sender_number, content,
          message_type, timestamp, is_forwarded, has_media
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          group_id,
          whatsapp_message_id,
          sender_name,
          sender_number,
          content,
          message_type,
          timestamp,
          is_forwarded,
          has_media,
        ]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create message:', error);
      throw error;
    }
  }

  async createIfNotExists(message: Omit<Message, 'id' | 'created_at' | 'is_starred' | 'is_deleted' | 'edited_at' | 'mentions' | 'links' | 'reaction_emoji' | 'reaction_target_id' | 'poll_name' | 'poll_options' | 'poll_votes' | 'location_latitude' | 'location_longitude' | 'location_name' | 'location_address' | 'contact_vcard' | 'group_event_type' | 'group_event_participants' | 'reply_to_message_id'>): Promise<Message | null> {
    try {
      const {
        group_id,
        whatsapp_message_id,
        sender_name,
        sender_number,
        content,
        message_type,
        timestamp,
        is_forwarded,
        has_media,
      } = message;

      const result = await pool.query<Message>(
        `INSERT INTO messages (
          group_id, whatsapp_message_id, sender_name, sender_number, content,
          message_type, timestamp, is_forwarded, has_media
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (whatsapp_message_id) DO NOTHING
        RETURNING *`,
        [
          group_id,
          whatsapp_message_id,
          sender_name,
          sender_number,
          content,
          message_type,
          timestamp,
          is_forwarded,
          has_media,
        ]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to create message:', error);
      throw error;
    }
  }

  async update(id: string, message: Partial<Message>): Promise<Message | null> {
    try {
      const allowedFields = ['content', 'is_starred', 'is_deleted', 'edited_at'];
      const fields = Object.keys(message).filter(key => allowedFields.includes(key));
      if (fields.length === 0) return this.findById(id);

      const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
      const values = fields.map(field => (message as any)[field]);

      const result = await pool.query<Message>(
        `UPDATE messages SET ${setClause} WHERE id = $1 RETURNING *`,
        [id, ...values]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to update message:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await pool.query('DELETE FROM messages WHERE id = $1', [id]);
    } catch (error) {
      logger.error('Failed to delete message:', error);
      throw error;
    }
  }

  async bulkDelete(ids: string[]): Promise<number> {
    try {
      const result = await pool.query(
        'DELETE FROM messages WHERE id = ANY($1)',
        [ids]
      );
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to bulk delete messages:', error);
      throw error;
    }
  }

  async countByGroupId(groupId: string): Promise<number> {
    try {
      const result = await pool.query(
        'SELECT COUNT(*) FROM messages WHERE group_id = $1',
        [groupId]
      );
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Failed to count messages by group id:', error);
      throw error;
    }
  }

  async getRecentMessages(limit: number = 50): Promise<Message[]> {
    try {
      const result = await pool.query<Message>(
        'SELECT * FROM messages ORDER BY timestamp DESC LIMIT $1',
        [limit]
      );
      return result.rows;
    } catch (error) {
      logger.error('Failed to get recent messages:', error);
      throw error;
    }
  }
}

export default new MessageRepository();
