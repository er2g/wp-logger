import { pool } from '../../../config/database';
import { Message } from '../../../types/database.types';
import logger from '../../../utils/logger';

export class MessageRepository {
  async findAll(): Promise<Message[]> {
    try {
      const result = await pool.query<Message>('SELECT * FROM messages');
      return result.rows;
    } catch (error) {
      logger.error('Failed to find all messages:', error);
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

  async findByGroupId(groupId: string): Promise<Message[]> {
    try {
      const result = await pool.query<Message>(
        'SELECT * FROM messages WHERE group_id = $1',
        [groupId]
      );
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
          'SELECT * FROM messages' +
            ' WHERE group_id = $2' +
            ' AND (' +
              'content ILIKE $1' +
              ' OR sender_name ILIKE $1' +
              ' OR sender_number ILIKE $1' +
            ')' +
            ' ORDER BY timestamp DESC',
          [likeQuery, groupId]
        );
        return result.rows;
      }

      const result = await pool.query<Message>(
        'SELECT * FROM messages' +
          ' WHERE content ILIKE $1' +
          ' OR sender_name ILIKE $1' +
          ' OR sender_number ILIKE $1' +
          ' ORDER BY timestamp DESC',
        [likeQuery]
      );
      return result.rows;
    } catch (error) {
      logger.error('Failed to search messages:', error);
      throw error;
    }
  }

  async create(message: Omit<Message, 'id' | 'created_at'>): Promise<Message> {
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
        'INSERT INTO messages (' +
          'group_id, whatsapp_message_id, sender_name, sender_number, content,' +
          ' message_type, timestamp, is_forwarded, has_media' +
        ') VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)' +
        ' RETURNING *',
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

  async createIfNotExists(message: Omit<Message, 'id' | 'created_at'>): Promise<Message | null> {
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
        'INSERT INTO messages (' +
          'group_id, whatsapp_message_id, sender_name, sender_number, content,' +
          ' message_type, timestamp, is_forwarded, has_media' +
        ') VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)' +
        ' ON CONFLICT (whatsapp_message_id) DO NOTHING' +
        ' RETURNING *',
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

  async update(id: string, message: Partial<Omit<Message, 'id' | 'created_at'>>): Promise<Message | null> {
    try {
      const fields = Object.keys(message);
      if (fields.length === 0) return this.findById(id);

      const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
      const values = Object.values(message);

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
}

export default new MessageRepository();
