import { Response } from 'express';
import { AuthRequest } from '../../types/api.types';
import groupRepository from '../../services/database/repositories/GroupRepository';
import groupManager from '../../services/whatsapp/GroupManager';
import logger from '../../utils/logger';
import whatsappService from '../../services/whatsapp/WhatsAppService';

export class GroupsController {
  async getWhatsappGroups(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const groups = await whatsappService.getGroups();
      res.json({
        success: true,
        data: groups,
      });
    } catch (error) {
      logger.error('Get WhatsApp groups failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get WhatsApp groups',
      });
    }
  }

  async getWhatsappGroupDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const details = await groupManager.getGroupDetails(id);
      res.json({
        success: true,
        data: details,
      });
    } catch (error) {
      logger.error('Get WhatsApp group details failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get WhatsApp group details',
      });
    }
  }

  async setMonitored(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { groupIds } = req.body;
      if (!Array.isArray(groupIds)) {
        res.status(400).json({
          success: false,
          error: 'groupIds must be an array',
        });
        return;
      }
      await groupManager.setMonitoredGroups(groupIds);
      res.json({
        success: true,
        message: `Updated monitoring status for ${groupIds.length} groups`,
      });
    } catch (error) {
      logger.error('Set monitored groups failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to set monitored groups',
      });
    }
  }

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
