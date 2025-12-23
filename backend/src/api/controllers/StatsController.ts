import { Response } from 'express';
import { AuthRequest } from '../../types/api.types';
import groupRepository from '../../services/database/repositories/GroupRepository';
import messageRepository from '../../services/database/repositories/MessageRepository';
import mediaRepository from '../../services/database/repositories/MediaRepository';
import logger from '../../utils/logger';

export class StatsController {
  async getStats(_req: AuthRequest, res: Response): Promise<void> {
    try {
      // In a production environment, these should be optimized database queries (COUNT(*))
      // For now we'll fetch all and count, assuming the dataset is manageable for this MVP phase
      const [groups, messages, media] = await Promise.all([
        groupRepository.findAll(),
        messageRepository.findAll(),
        mediaRepository.findAll(),
      ]);

      const stats = {
        totalGroups: groups.length,
        monitoredGroups: groups.filter(g => g.is_monitored).length,
        totalMessages: messages.length,
        totalMedia: media.length,
        mediaByType: media.reduce((acc, curr) => {
          acc[curr.media_type] = (acc[curr.media_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Get stats failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get stats',
      });
    }
  }
}

export default new StatsController();
