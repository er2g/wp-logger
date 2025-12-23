import { pool } from '../../../config/database';
import logger from '../../../utils/logger';

export interface BotStatus {
  is_connected: boolean;
  qr_code: string | null;
  last_connected: Date | null;
  last_disconnected: Date | null;
  error_message: string | null;
  updated_at: Date;
}

export class BotRepository {
  async getStatus(): Promise<BotStatus | null> {
    const query = 'SELECT is_connected, qr_code, last_connected, last_disconnected, error_message, updated_at FROM bot_status WHERE id = 1';
    try {
      const result = await pool.query(query);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get bot status from DB:', error);
      return null;
    }
  }

  async updateStatus(isConnected: boolean, error: string | null = null): Promise<void> {
    const now = new Date();
    let query = '';
    const params: any[] = [isConnected, now];

    if (isConnected) {
      query = 'UPDATE bot_status SET is_connected = $1, last_connected = $2, error_message = NULL, qr_code = NULL, updated_at = $2 WHERE id = 1';
    } else {
      query = 'UPDATE bot_status SET is_connected = $1, last_disconnected = $2, error_message = $3, updated_at = $2 WHERE id = 1';
      params.push(error);
    }

    try {
      await pool.query(query, params);
    } catch (error) {
      logger.error('Failed to update bot status in DB:', error);
    }
  }

  async updateQr(qr: string): Promise<void> {
    const query = 'UPDATE bot_status SET qr_code = $1, updated_at = NOW() WHERE id = 1';
    try {
      await pool.query(query, [qr]);
    } catch (error) {
      logger.error('Failed to update QR in DB:', error);
    }
  }
}

export default new BotRepository();
