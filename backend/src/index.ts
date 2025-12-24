import * as dotenv from 'dotenv';
import * as http from 'http';
import expressServer from './api/server';
import websocketServer from './websocket/WebSocketServer';
import whatsappService from './services/whatsapp/WhatsAppService';
import messageHandler from './services/whatsapp/MessageHandler';
import mediaHandler from './services/whatsapp/MediaHandler';
import groupManager from './services/whatsapp/GroupManager';
import historySyncService from './services/whatsapp/HistorySyncService';
import mediaRecoveryService from './services/whatsapp/MediaRecoveryService';
import fileStorageService from './services/storage/FileStorage';
import ocrQueueService from './services/ocr/OcrQueueService';
import botRepository from './services/database/repositories/BotRepository';
import messageRepository from './services/database/repositories/MessageRepository';
import mediaRepository from './services/database/repositories/MediaRepository';
import { testConnection } from './config/database';
import logger from './utils/logger';

dotenv.config();

class Application {
  private httpServer: http.Server | null = null;
  private currentQr: string | null = null;
  private mediaRecoveryInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    try {
      logger.info('Starting WhatsApp Bot Application...');

      const dbConnected = await testConnection();
      if (!dbConnected) {
        throw new Error('Database connection failed');
      }

      await groupManager.initializeMonitoredGroups();

      await fileStorageService.initialize();
      ocrQueueService.start();

      const app = expressServer.getApp();
      this.httpServer = http.createServer(app);

      websocketServer.initialize(this.httpServer);

      websocketServer.onAuthenticated((ws) => {
        if (ws.role !== 'admin') {
          return;
        }

        const sendSnapshot = async () => {
          const status = await botRepository.getStatus();
          if (status) {
            ws.send(
              JSON.stringify({
                type: 'bot:status',
                data: {
                  isConnected: status.is_connected,
                  error: status.error_message || undefined,
                },
              })
            );

            if (status.qr_code) {
              ws.send(JSON.stringify({ type: 'bot:qr', data: { qr: status.qr_code } }));
              return;
            }
          }

          if (this.currentQr) {
            ws.send(JSON.stringify({ type: 'bot:qr', data: { qr: this.currentQr } }));
          }
        };

        sendSnapshot().catch((error) => {
          logger.warn('Failed to send bot snapshot to admin:', error);
        });
      });

      await whatsappService.initialize();

      this.setupWhatsAppHandlers();

      const port = parseInt(process.env.PORT || '3000');
      this.httpServer.listen(port, () => {
        logger.info('Application started successfully on port ' + port);
        logger.info('WebSocket server available at ws://localhost:' + port + '/ws');
      });

      this.setupGracefulShutdown();
    } catch (error) {
      logger.error('Failed to initialize application:', error);
      process.exit(1);
    }
  }

  private setupWhatsAppHandlers(): void {
    whatsappService.on('qr', async (qr) => {
      logger.info('QR Code received, broadcasting to clients');
      this.currentQr = qr;
      await botRepository.updateQr(qr);
      websocketServer.broadcastToRoles(['admin'], 'bot:qr', { qr });
    });

    whatsappService.on('ready', async () => {
      logger.info('WhatsApp is ready, syncing groups');
      this.currentQr = null;
      await botRepository.updateStatus(true);
      websocketServer.broadcastToRoles(['admin'], 'bot:status', { isConnected: true });

      this.scheduleMediaRecovery();

      try {
        const groups = await groupManager.syncGroups();
        logger.info('Synced ' + groups.length + ' groups');
        websocketServer.broadcastToRoles(['admin'], 'groups:synced', { groups });

        const historySyncEnabled = process.env.HISTORY_SYNC_ON_START !== 'false';
        if (historySyncEnabled) {
          historySyncService.syncAllChats().catch((error) => {
            logger.error('History sync failed:', error);
          });
        }
      } catch (error) {
        logger.error('Failed to sync groups:', error);
      }
    });

    whatsappService.on('authenticated', async () => {
      logger.info('WhatsApp authenticated');
      this.currentQr = null;
      await botRepository.updateStatus(true);
      websocketServer.broadcastToRoles(['admin'], 'bot:status', { isConnected: true, authenticated: true });
    });

    whatsappService.on('auth_failure', async (message) => {
      logger.error('WhatsApp auth failure:', message);
      await botRepository.updateStatus(false, message);
      websocketServer.broadcastToRoles(['admin'], 'bot:status', { isConnected: false, error: message });
    });

    whatsappService.on('disconnected', async (reason) => {
      logger.warn('WhatsApp disconnected:', reason);
      await botRepository.updateStatus(false, reason);
      websocketServer.broadcastToRoles(['admin'], 'bot:status', { isConnected: false, reason });
    });

    whatsappService.on('message', async (message) => {
      await this.handleIncomingMessage(message);
    });

    whatsappService.on('message_create', async (message) => {
      await this.handleIncomingMessage(message);
    });
  }

  private scheduleMediaRecovery(): void {
    if (this.mediaRecoveryInterval) {
      return;
    }

    const intervalMinutes = parseInt(process.env.MEDIA_RECOVERY_INTERVAL_MINUTES || '10', 10);
    if (intervalMinutes <= 0) {
      return;
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    this.mediaRecoveryInterval = setInterval(() => {
      mediaRecoveryService.recoverMissingMedia().catch((error) => {
        logger.warn('Media recovery interval failed:', error);
      });
    }, intervalMs);

    mediaRecoveryService.recoverMissingMedia().catch((error) => {
      logger.warn('Media recovery initial run failed:', error);
    });
  }

  private async handleIncomingMessage(message: any): Promise<void> {
    try {
      if (!messageHandler.shouldProcessMessage(message)) {
        return;
      }

      const whatsappGroupId = messageHandler.extractGroupId(message);
      if (!whatsappGroupId) {
        return;
      }

      if (!groupManager.isMonitored(whatsappGroupId)) {
        logger.debug('Skipping message from non-monitored group: ' + whatsappGroupId);
        return;
      }

      const group = await groupManager.ensureGroupRecord(whatsappGroupId);
      if (!group) {
        logger.warn('Unable to resolve group for message: ' + whatsappGroupId);
        return;
      }

      logger.info('Processing message from group: ' + group.name + ' (' + group.id + ')');

      const processedMessage = await messageHandler.processMessage(message, group.id);
      let messageId = processedMessage?.id || null;
      if (!messageId) {
        messageId =
          (await messageRepository.findByWhatsappMessageId(message.id._serialized))?.id || null;
      }

      if (message.hasMedia && messageId) {
        const processedMedia = await mediaHandler.processMediaMessage(
          message,
          group.id,
          messageId
        );
        if (processedMedia) {
          websocketServer.broadcast('media:new', processedMedia, group.id);
        } else {
          const existingMedia = await mediaRepository.findByMessageId(messageId);
          if (existingMedia.length === 0) {
            mediaRecoveryService.recoverMissingMedia().catch((error) => {
              logger.warn('Immediate media recovery failed:', error);
            });
          }
        }
      }

      if (!processedMessage) {
        return;
      }

      websocketServer.broadcast('message:new', processedMessage, group.id);
      logger.info('Broadcasted message ' + processedMessage.id + ' to group ' + group.id);
    } catch (error) {
      logger.error('Failed to handle WhatsApp message:', error);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(signal + ' received, shutting down gracefully...');

      if (this.httpServer) {
        this.httpServer.close(() => {
          logger.info('HTTP server closed');
        });
      }

      try {
        await whatsappService.destroy();
        logger.info('WhatsApp client destroyed');
      } catch (error) {
        logger.error('Error destroying WhatsApp client:', error);
      }

      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    });
  }
}

const app = new Application();
app.initialize();
