import whatsappService from './WhatsAppService';
import groupManager from './GroupManager';
import messageHandler from './MessageHandler';
import mediaHandler from './MediaHandler';
import messageRepository from '../database/repositories/MessageRepository';
import mediaRepository from '../database/repositories/MediaRepository';
import groupRepository from '../database/repositories/GroupRepository';
import logger from '../../utils/logger';

export class HistorySyncService {
  private syncing = false;

  async syncAllChats(): Promise<void> {
    if (this.syncing) {
      logger.warn('History sync already in progress');
      return;
    }

    this.syncing = true;

    const includeMedia = process.env.HISTORY_SYNC_INCLUDE_MEDIA !== 'false';
    const maxMessagesRaw = process.env.HISTORY_SYNC_MAX_MESSAGES;
    const maxMessages = maxMessagesRaw ? parseInt(maxMessagesRaw, 10) : undefined;

    try {
      const chats = await whatsappService.getChats();
      logger.info('Starting history sync for ' + chats.length + ' chats');

      for (const chat of chats) {
        await this.syncChat(chat.id, chat.name, includeMedia, maxMessages);
      }

      logger.info('History sync completed');
    } catch (error) {
      logger.error('History sync failed:', error);
    } finally {
      this.syncing = false;
    }
  }

  private async syncChat(
    chatId: string,
    chatName: string,
    includeMedia: boolean,
    maxMessages?: number
  ): Promise<void> {
    const group = await groupManager.ensureGroupRecord(chatId);
    if (!group) {
      logger.warn('Skipping history sync for ' + chatId + ' (missing group record)');
      return;
    }

    logger.info('Syncing history for ' + chatName + ' (' + chatId + ')');

    try {
      const messages = await whatsappService.fetchChatMessages(chatId, maxMessages);
      if (!messages.length) {
        await groupRepository.updateLastSyncedAt(group.id, new Date());
        return;
      }

      messages.sort((a, b) => a.timestamp - b.timestamp);

      let lastTimestamp: Date | null = null;

      for (const message of messages) {
        try {
          const processed = await messageHandler.processMessage(message, group.id, {
            updateGroupTimestamp: false,
            skipContactFetch: true,
          });

          const messageId = processed?.id
            || (await messageRepository.findByWhatsappMessageId(message.id._serialized))?.id
            || null;

          if (includeMedia && message.hasMedia && messageId) {
            const existingMedia = await mediaRepository.findByMessageId(messageId);
            if (existingMedia.length === 0) {
              await mediaHandler.processMediaMessage(message, group.id, messageId);
            }
          }

          lastTimestamp = new Date(message.timestamp * 1000);
        } catch (error) {
          logger.warn('History sync skipped message ' + message.id._serialized + ':', error);
        }
      }

      if (lastTimestamp) {
        await groupRepository.updateLastMessageAt(group.id, lastTimestamp);
      }

      await groupRepository.updateLastSyncedAt(group.id, new Date());
      logger.info('History sync finished for ' + chatName + ' (' + chatId + ')');
    } catch (error) {
      logger.error('History sync failed for ' + chatName + ' (' + chatId + '):', error);
    }
  }
}

export default new HistorySyncService();
