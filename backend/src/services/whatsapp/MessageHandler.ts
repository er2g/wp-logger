import { Message } from 'whatsapp-web.js';
import logger from '../../utils/logger';
import messageRepository from '../database/repositories/MessageRepository';
import groupRepository from '../database/repositories/GroupRepository';
import { ProcessedMessage } from '../../types/whatsapp.types';
import { MessageType } from '../../types/database.types';

export class MessageHandlerService {
  async processMessage(
    message: Message,
    groupId: string,
    options?: { updateGroupTimestamp?: boolean; skipContactFetch?: boolean }
  ): Promise<ProcessedMessage | null> {
    try {
      let senderNumber: string | null = null;
      let senderName: string | null = null;

      if (!options?.skipContactFetch) {
        try {
          const contact = await message.getContact();
          senderNumber = contact.id.user || contact.id._serialized;
          senderName = contact.name || contact.pushname || 'Unknown';
        } catch (error) {
          logger.warn('Failed to fetch contact for message, using metadata fallback', error);
        }
      }

      if (!senderNumber || !senderName) {
        const rawMessage = message as any;
        senderNumber = senderNumber || rawMessage?.author || rawMessage?.from || rawMessage?.to || null;
        senderName = senderName || rawMessage?._data?.notifyName || rawMessage?._data?.sender?.pushname || 'Unknown';
      }

      const messageType = this.determineMessageType(message);
      const timestamp = new Date(message.timestamp * 1000);

      const savedMessage = await messageRepository.createIfNotExists({
        group_id: groupId,
        whatsapp_message_id: message.id._serialized,
        sender_name: senderName,
        sender_number: senderNumber,
        content: message.body || null,
        message_type: messageType,
        timestamp: timestamp,
        is_forwarded: message.isForwarded || false,
        has_media: message.hasMedia,
      });

      if (!savedMessage) {
        return null;
      }

      if (options?.updateGroupTimestamp !== false) {
        await groupRepository.updateLastMessageAt(groupId, timestamp);
      }

      const processedMessage: ProcessedMessage = {
        id: savedMessage.id,
        groupId,
        whatsappMessageId: message.id._serialized,
        senderName,
        senderNumber,
        content: message.body || null,
        messageType,
        timestamp: timestamp,
        isForwarded: message.isForwarded || false,
        hasMedia: message.hasMedia,
      };

      logger.debug(`Processed message from ${senderName} in group ${groupId}`);
      return processedMessage;
    } catch (error) {
      logger.error('Failed to process message:', error);
      throw error;
    }
  }

  private determineMessageType(message: Message): MessageType {
    if (message.type === 'chat') {
      return 'text';
    } else if (message.type === 'image') {
      return 'image';
    } else if (message.type === 'video') {
      return 'video';
    } else if (message.type === 'audio' || message.type === 'ptt') {
      return message.type === 'ptt' ? 'ptt' : 'audio';
    } else if (message.type === 'document') {
      return 'document';
    } else if (message.type === 'sticker') {
      return 'sticker';
    } else if (message.type === 'location') {
      return 'location';
    } else if (message.type === 'vcard') {
      return 'contact';
    }

    return 'text';
  }

  isGroupMessage(message: Message): boolean {
    const from = message.from || '';
    const to = (message as any).to || '';
    return from.includes('@g.us') || to.includes('@g.us');
  }

  extractGroupId(message: Message): string | null {
    const rawMessage = message as any;
    const chatId = message.fromMe ? rawMessage?.to : message.from;
    if (!chatId || chatId === 'status@broadcast') {
      return null;
    }
    return chatId;
  }

  shouldProcessMessage(message: Message): boolean {
    return Boolean(this.extractGroupId(message));
  }
}

export default new MessageHandlerService();
