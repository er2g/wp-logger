import { Response } from 'express';
import { AuthRequest } from '../../types/api.types';
import groupRepository from '../../services/database/repositories/GroupRepository';
import groupManager from '../../services/whatsapp/GroupManager';
import logger from '../../utils/logger';

export class GroupsController {
  async getAll(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const groups = await groupRepository.findAll();
      res.json({
        success: true,
        data: groups,
      });
    } catch (error) {
      logger.error('Get all groups failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get groups',
      });
    }
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const group = await groupRepository.findById(id);

      if (!group) {
        res.status(404).json({
          success: false,
          error: 'Group not found',
        });
        return;
      }

      res.json({
        success: true,
        data: group,
      });
    } catch (error) {
      logger.error('Get group by id failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get group',
      });
    }
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      delete updates.id;
      delete updates.created_at;
      delete updates.updated_at;

      const group = await groupRepository.update(id, updates);

      if (!group) {
        res.status(404).json({
          success: false,
          error: 'Group not found',
        });
        return;
      }

      if (typeof updates.is_monitored === 'boolean') {
        if (updates.is_monitored) {
          groupManager.addMonitoredGroup(group.whatsapp_id);
        } else {
          groupManager.removeMonitoredGroup(group.whatsapp_id);
        }
      }

      res.json({
        success: true,
        data: group,
      });
    } catch (error) {
      logger.error('Update group failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update group',
      });
    }
  }
}

export default new GroupsController();
