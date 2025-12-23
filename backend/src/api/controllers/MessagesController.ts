import { Response } from 'express';
import { AuthRequest, MessageFilterQuery } from '../../types/api.types';
import messageRepository from '../../services/database/repositories/MessageRepository';
import logger from '../../utils/logger';

export class MessagesController {
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      // TODO: Implement proper filtering and pagination in repository
      // For now we just return all or filter by group if provided
      const { groupId } = req.query as unknown as MessageFilterQuery;

      let messages;
      if (groupId) {
        messages = await messageRepository.findByGroupId(groupId);
      } else {
        messages = await messageRepository.findAll();
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
}

export default new MessagesController();
