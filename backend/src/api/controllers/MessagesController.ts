import { Response } from 'express';
import { AuthRequest, MessageFilterQuery, AdvancedSearchQuery } from '../../types/api.types';
import messageRepository from '../../services/database/repositories/MessageRepository';
import logger from '../../utils/logger';

export class MessagesController {
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const filters = req.query as unknown as MessageFilterQuery;

      // If pagination params provided, use paginated query
      if (filters.page || filters.limit) {
        const result = await messageRepository.findWithPagination(filters);

        res.json({
          success: true,
          data: result.data,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            pages: result.pages,
            hasNext: result.page < result.pages,
            hasPrev: result.page > 1,
          },
        });
        return;
      }

      // Legacy: return all (limited to 1000)
      let messages;
      if (filters.groupId) {
        messages = await messageRepository.findByGroupId(filters.groupId, 1000);
      } else {
        messages = await messageRepository.getRecentMessages(1000);
      }

      res.json({
        success: true,
        data: messages,
      });
    } catch (error) {
      logger.error('Get all messages failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get messages',
      });
    }
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const message = await messageRepository.findById(id);

      if (!message) {
        res.status(404).json({
          success: false,
          error: 'Message not found',
        });
        return;
      }

      res.json({
        success: true,
        data: message,
      });
    } catch (error) {
      logger.error('Get message by id failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get message',
      });
    }
  }

  async search(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { q, groupId } = req.query as { q?: string; groupId?: string };
      if (!q || !q.trim()) {
        res.status(400).json({
          success: false,
          error: 'Search query is required',
        });
        return;
      }

      const results = await messageRepository.search(q.trim(), groupId);
      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      logger.error('Search messages failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search messages',
      });
    }
  }

  async advancedSearch(req: AuthRequest, res: Response): Promise<void> {
    try {
      const filters = req.query as unknown as AdvancedSearchQuery;

      if (!filters.q || !filters.q.trim()) {
        res.status(400).json({
          success: false,
          error: 'Search query is required',
        });
        return;
      }

      const result = await messageRepository.advancedSearch(filters);

      res.json({
        success: true,
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          pages: result.pages,
          hasNext: result.page < result.pages,
          hasPrev: result.page > 1,
        },
      });
    } catch (error) {
      logger.error('Advanced search failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform search',
      });
    }
  }

  async getStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { groupId, startDate, endDate } = req.query as {
        groupId?: string;
        startDate?: string;
        endDate?: string;
      };

      const stats = await messageRepository.getStats(
        groupId,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Get message stats failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get stats',
      });
    }
  }

  async bulkAction(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { ids, action } = req.body as { ids: string[]; action: string };

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Message IDs are required',
        });
        return;
      }

      let processed = 0;
      let failed = 0;

      switch (action) {
        case 'delete':
          processed = await messageRepository.bulkDelete(ids);
          failed = ids.length - processed;
          break;
        case 'star':
          for (const id of ids) {
            try {
              await messageRepository.update(id, { is_starred: true } as any);
              processed++;
            } catch {
              failed++;
            }
          }
          break;
        case 'unstar':
          for (const id of ids) {
            try {
              await messageRepository.update(id, { is_starred: false } as any);
              processed++;
            } catch {
              failed++;
            }
          }
          break;
        default:
          res.status(400).json({
            success: false,
            error: 'Invalid action',
          });
          return;
      }

      res.json({
        success: true,
        data: { processed, failed },
      });
    } catch (error) {
      logger.error('Bulk action failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform bulk action',
      });
    }
  }
}

export default new MessagesController();
