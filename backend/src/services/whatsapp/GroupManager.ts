import whatsappService from './WhatsAppService';
import groupRepository from '../database/repositories/GroupRepository';
import logger from '../../utils/logger';
import { Group } from '../../types/database.types';

export class GroupManagerService {
  private monitoredGroups: Set<string> = new Set();

  async initializeMonitoredGroups(): Promise<void> {
    try {
      const groups = await groupRepository.findAll();
      const monitoredIds = groups
        .filter(g => g.is_monitored)
        .map(g => g.whatsapp_id);

      this.monitoredGroups = new Set(monitoredIds);
      logger.info('Initialized monitoring for ' + monitoredIds.length + ' chats from database');
    } catch (error) {
      logger.error('Failed to initialize monitored groups:', error);
    }
  }

  async syncGroups(): Promise<Array<{ id: string; name: string; description: string; participants: number; chatType: 'group' | 'dm' }>> {
    try {
      const chats = await whatsappService.getChats();
      logger.info('Synced ' + chats.length + ' chats from WhatsApp');

      for (const chat of chats) {
        const existing = await groupRepository.findByWhatsappId(chat.id);
        if (existing) {
          await groupRepository.update(existing.id, {
            name: chat.name,
            participant_count: chat.participants,
            chat_type: chat.chatType,
            ...(chat.description ? { description: chat.description } : {}),
          });

          if (existing.is_monitored) {
            this.monitoredGroups.add(chat.id);
          }
        } else {
          await groupRepository.create({
            whatsapp_id: chat.id,
            name: chat.name,
            description: chat.description || null,
            chat_type: chat.chatType,
            is_monitored: true,
            participant_count: chat.participants,
            profile_picture_url: null,
            category: null,
          });
          this.monitoredGroups.add(chat.id);
        }
      }

      if (chats.length > 0) {
        logger.info('Now monitoring ' + this.monitoredGroups.size + ' chats');
      }

      return chats;
    } catch (error) {
      logger.error('Failed to sync groups:', error);
      throw error;
    }
  }

  async ensureGroupRecord(whatsappId: string): Promise<Group | null> {
    try {
      const existing = await groupRepository.findByWhatsappId(whatsappId);
      if (existing) {
        return existing;
      }

      const details = await whatsappService.getChatDetails(whatsappId);
      const created = await groupRepository.create({
        whatsapp_id: details.id,
        name: details.name,
        description: details.description || null,
        chat_type: details.chatType,
        is_monitored: true,
        participant_count: details.participants,
        profile_picture_url: null,
        category: null,
      });

      this.monitoredGroups.add(details.id);
      logger.info('Created chat record for ' + details.name + ' (' + details.id + ')');
      return created;
    } catch (error) {
      logger.error('Failed to ensure chat record for ' + whatsappId + ':', error);
      return null;
    }
  }

  async getGroupDetails(groupId: string) {
    try {
      return await whatsappService.getChatDetails(groupId);
    } catch (error) {
      logger.error('Failed to get chat details for ' + groupId + ':', error);
      throw error;
    }
  }

  async setMonitoredGroups(groupIds: string[]): Promise<void> {
    try {
      await groupRepository.updateMonitoredStatus(groupIds);
      this.monitoredGroups = new Set(groupIds);
      logger.info('Monitoring ' + groupIds.length + ' chats');
    } catch (error) {
      logger.error('Failed to set monitored groups:', error);
      throw error;
    }
  }

  isMonitored(groupId: string): boolean {
    if (this.monitoredGroups.size === 0) {
      return true;
    }
    return this.monitoredGroups.has(groupId);
  }

  addMonitoredGroup(groupId: string): void {
    this.monitoredGroups.add(groupId);
    logger.info('Added chat to monitoring: ' + groupId);
  }

  removeMonitoredGroup(groupId: string): void {
    this.monitoredGroups.delete(groupId);
    logger.info('Removed chat from monitoring: ' + groupId);
  }

  getMonitoredGroups(): string[] {
    return Array.from(this.monitoredGroups);
  }

  async clearMonitoredGroups(): Promise<void> {
    try {
      await groupRepository.updateMonitoredStatus([]);
      this.monitoredGroups.clear();
      logger.info('Cleared all monitored chats');
    } catch (error) {
      logger.error('Failed to clear monitored groups:', error);
      throw error;
    }
  }
}

export default new GroupManagerService();
