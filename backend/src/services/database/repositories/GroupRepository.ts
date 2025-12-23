import { pool } from '../../../config/database';
import { Group } from '../../../types/database.types';
import logger from '../../../utils/logger';

export class GroupRepository {
  async findAll(): Promise<Group[]> {
    try {
      const result = await pool.query<Group>('SELECT * FROM groups');
      return result.rows;
    } catch (error) {
      logger.error('Failed to find all groups:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Group | null> {
    try {
      const result = await pool.query<Group>(
        'SELECT * FROM groups WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find group by id:', error);
      throw error;
    }
  }

  async findByWhatsappId(whatsappId: string): Promise<Group | null> {
    try {
      const result = await pool.query<Group>(
        'SELECT * FROM groups WHERE whatsapp_id = $1',
        [whatsappId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find group by WhatsApp id:', error);
      throw error;
    }
  }

  async create(group: Omit<Group, 'id' | 'created_at' | 'updated_at' | 'last_message_at' | 'last_synced_at'>): Promise<Group> {
    try {
      const { whatsapp_id, name, description, chat_type, is_monitored, participant_count } = group;
      const result = await pool.query<Group>(
        'INSERT INTO groups (whatsapp_id, name, description, chat_type, is_monitored, participant_count)' +
          ' VALUES ($1, $2, $3, $4, $5, $6)' +
          ' RETURNING *',
        [whatsapp_id, name, description, chat_type, is_monitored, participant_count]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create group:', error);
      throw error;
    }
  }

  async update(id: string, group: Partial<Omit<Group, 'id' | 'created_at' | 'updated_at'>>): Promise<Group | null> {
    try {
      const fields = Object.keys(group);
      if (fields.length === 0) return this.findById(id);

      const setClause = fields
        .map((field, index) => field + ' = $' + (index + 2))
        .join(', ');
      const values = Object.values(group);

      const result = await pool.query<Group>(
        'UPDATE groups SET ' + setClause + ', updated_at = NOW() WHERE id = $1 RETURNING *',
        [id, ...values]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to update group:', error);
      throw error;
    }
  }

  async updateLastMessageAt(id: string, timestamp: Date): Promise<void> {
    try {
      await pool.query(
        'UPDATE groups SET last_message_at = GREATEST(COALESCE(last_message_at, $2), $2), updated_at = NOW() WHERE id = $1',
        [id, timestamp]
      );
    } catch (error) {
      logger.error('Failed to update group last_message_at:', error);
    }
  }

  async updateLastSyncedAt(id: string, timestamp: Date): Promise<void> {
    try {
      await pool.query(
        'UPDATE groups SET last_synced_at = $2, updated_at = NOW() WHERE id = $1',
        [id, timestamp]
      );
    } catch (error) {
      logger.error('Failed to update group last_synced_at:', error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await pool.query('DELETE FROM groups WHERE id = $1', [id]);
    } catch (error) {
      logger.error('Failed to delete group:', error);
      throw error;
    }
  }
}

export default new GroupRepository();
