import { Response } from 'express';
import { AuthRequest } from '../../types/api.types';
import whatsAppService from '../../services/whatsapp/WhatsAppService';
import botRepository from '../../services/database/repositories/BotRepository';
import logger from '../../utils/logger';

export class BotController {
  async getStatus(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const dbStatus = await botRepository.getStatus();
      const isServiceReady = whatsAppService.isReady();

      res.json({
        success: true,
        data: {
          is_connected: isServiceReady,
          last_connected: dbStatus?.last_connected || null,
          last_disconnected: dbStatus?.last_disconnected || null,
          error_message: dbStatus?.error_message || null,
          qr_code: dbStatus?.qr_code || null,
        },
      });
    } catch (error) {
      logger.error('Get bot status failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get bot status',
      });
    }
  }

  async restart(_req: AuthRequest, res: Response): Promise<void> {
    try {
      await whatsAppService.restart();
      res.json({
        success: true,
        message: 'Bot restart initiated',
      });
    } catch (error) {
      logger.error('Bot restart failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to restart bot',
      });
    }
  }

  async stop(_req: AuthRequest, res: Response): Promise<void> {
    try {
      await whatsAppService.destroy();
      res.json({
        success: true,
        message: 'Bot stopped successfully',
      });
    } catch (error) {
      logger.error('Bot stop failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop bot',
      });
    }
  }
}

export default new BotController();
