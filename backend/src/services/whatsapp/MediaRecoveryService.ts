import whatsappService from './WhatsAppService';
import messageRepository from '../database/repositories/MessageRepository';
import mediaRepository from '../database/repositories/MediaRepository';
import groupRepository from '../database/repositories/GroupRepository';
import mediaHandler from './MediaHandler';
import logger from '../../utils/logger';

export class MediaRecoveryService {
  private running = false;
  private historyRequests = new Map<string, number>();
  private historyChatRequests = new Map<string, number>();
  private historyRequestCooldownMs =
    Math.max(1, parseInt(process.env.MEDIA_RECOVERY_HISTORY_COOLDOWN_MINUTES || '10', 10)) * 60 * 1000;
  private historyChatCooldownMs =
    Math.max(1, parseInt(process.env.MEDIA_RECOVERY_HISTORY_CHAT_COOLDOWN_MINUTES || '10', 10)) * 60 * 1000;

  async recoverMissingMedia(): Promise<void> {
    if (this.running) {
      return;
    }

    if (process.env.MEDIA_RECOVERY_ENABLED === 'false') {
      return;
    }

    if (!whatsappService.isReady()) {
      return;
    }

    this.running = true;

    const limit = parseInt(process.env.MEDIA_RECOVERY_LIMIT || '25', 10);
    const lookbackHours = parseInt(process.env.MEDIA_RECOVERY_LOOKBACK_HOURS || '48', 10);
    const searchLimit = parseInt(process.env.MEDIA_RECOVERY_SEARCH_LIMIT || '2000', 10);
    const historyFetchLimit = Math.max(
      1,
      parseInt(process.env.MEDIA_RECOVERY_HISTORY_FETCH_LIMIT || '200', 10)
    );

    try {
      const missingMessages = await messageRepository.findMissingMediaMessages(limit, lookbackHours);
      if (missingMessages.length === 0) {
        return;
      }

      logger.info(`Media recovery: found ${missingMessages.length} message(s) missing media`);

      for (const message of missingMessages) {
        try {
          const existing = await mediaRepository.findByMessageId(message.id);
          if (existing.length > 0) {
            continue;
          }

          const group = await groupRepository.findById(message.group_id);
          if (!group) {
            continue;
          }

          let waMessage = await whatsappService.getMessageById(message.whatsapp_message_id);
          if (!waMessage && group.whatsapp_id) {
            waMessage = await whatsappService.findMessageInChat(
              group.whatsapp_id,
              message.whatsapp_message_id,
              searchLimit
            );
          }

          if (!waMessage && group.whatsapp_id) {
            waMessage = await this.findMediaByTimestamp(group.whatsapp_id, message, searchLimit);
            if (waMessage) {
              logger.info(`Media recovery: matched message by timestamp for ${message.whatsapp_message_id}`);
            }
          }

          if (!waMessage) {
            const now = Date.now();
            const lastRequested = this.historyRequests.get(message.whatsapp_message_id) || 0;
            if (now - lastRequested > this.historyRequestCooldownMs && group.whatsapp_id) {
              this.historyRequests.set(message.whatsapp_message_id, now);
              const requested = await whatsappService.requestHistorySync(
                group.whatsapp_id,
                message.whatsapp_message_id,
                message.timestamp.getTime(),
                historyFetchLimit
              );
              if (requested) {
                logger.info(`Media recovery: requested history sync for ${message.whatsapp_message_id}`);
              }
            }

            if (group.whatsapp_id) {
              const chatKey = `chat:${group.whatsapp_id}`;
              const lastChatRequested = this.historyChatRequests.get(chatKey) || 0;
              if (now - lastChatRequested > this.historyChatCooldownMs) {
                this.historyChatRequests.set(chatKey, now);
                const requestedChat = await whatsappService.requestHistorySyncFromOldest(
                  group.whatsapp_id,
                  historyFetchLimit
                );
                if (requestedChat) {
                  logger.info(`Media recovery: requested history sync from oldest for ${group.whatsapp_id}`);
                }
              }
            }

            logger.warn(`Media recovery: WA message not found for ${message.whatsapp_message_id}`);
            continue;
          }

          if (!waMessage.hasMedia) {
            logger.warn(`Media recovery: WA message has no media for ${message.whatsapp_message_id}`);
            continue;
          }

          await mediaHandler.processMediaMessage(waMessage, message.group_id, message.id);
        } catch (error) {
          logger.warn('Media recovery failed for message ' + message.id + ':', error);
        }
      }
    } catch (error) {
      logger.error('Media recovery job failed:', error);
    } finally {
      this.running = false;
    }
  }

  private async findMediaByTimestamp(
    chatId: string,
    message: { timestamp: Date; content: string | null },
    limit: number
  ) {
    const targetTimestamp = Math.floor(message.timestamp.getTime() / 1000);
    const windowSeconds = Math.max(
      5,
      parseInt(process.env.MEDIA_RECOVERY_TIMESTAMP_WINDOW_SECONDS || '120', 10)
    );
    const targetBody = (message.content || '').toLowerCase().trim();

    const candidates = await whatsappService.fetchChatMessages(chatId, limit);
    const timeMatches = candidates.filter(
      (candidate) =>
        candidate.hasMedia && Math.abs(candidate.timestamp - targetTimestamp) <= windowSeconds
    );

    if (timeMatches.length === 0) {
      return null;
    }

    if (targetBody.length > 0) {
      const bodyMatches = timeMatches.filter((candidate) => {
        const body = (candidate.body || '').toLowerCase().trim();
        return body.length > 0 && (body === targetBody || body.includes(targetBody) || targetBody.includes(body));
      });
      if (bodyMatches.length === 1) {
        return bodyMatches[0];
      }
      if (bodyMatches.length > 1) {
        return bodyMatches.sort(
          (a, b) => Math.abs(a.timestamp - targetTimestamp) - Math.abs(b.timestamp - targetTimestamp)
        )[0];
      }
    }

    if (timeMatches.length === 1) {
      return timeMatches[0];
    }

    return timeMatches.sort(
      (a, b) => Math.abs(a.timestamp - targetTimestamp) - Math.abs(b.timestamp - targetTimestamp)
    )[0];
  }
}

export default new MediaRecoveryService();
