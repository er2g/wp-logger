import * as dotenv from 'dotenv';
import * as http from 'http';
import expressServer from './api/server';
import websocketServer from './websocket/WebSocketServer';
import whatsappService from './services/whatsapp/WhatsAppService';
import messageHandler from './services/whatsapp/MessageHandler';
import mediaHandler from './services/whatsapp/MediaHandler';
import groupManager from './services/whatsapp/GroupManager';
import historySyncService from './services/whatsapp/HistorySyncService';
import fileStorageService from './services/storage/FileStorage';
import botRepository from './services/database/repositories/BotRepository';
import { testConnection } from './config/database';
import logger from './utils/logger';

dotenv.config();

class Application {
  private httpServer: http.Server | null = null;
  private currentQr: string | null = null;

  async initialize(): Promise<void> {
    try {
      logger.info('Starting WhatsApp Bot Application...');

      const dbConnected = await testConnection();
      if (!dbConnected) {
        throw new Error('Database connection failed');
      }

      await groupManager.initializeMonitoredGroups();

      await fileStorageService.initialize();

      const app = expressServer.getApp();
      this.httpServer = http.createServer(app);

      websocketServer.initialize(this.httpServer);

      websocketServer.onConnection((ws) => {
        if (this.currentQr) {
          ws.send(JSON.stringify({ type: 'bot:qr', data: { qr: this.currentQr } }));
        }
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
      websocketServer.broadcast('bot:qr', { qr });
    });

    whatsappService.on('ready', async () => {
      logger.info('WhatsApp is ready, syncing groups');
      this.currentQr = null;
      await botRepository.updateStatus(true);
      websocketServer.broadcast('bot:status', { isConnected: true });

      try {
        const groups = await groupManager.syncGroups();
        logger.info('Synced ' + groups.length + ' groups');
        websocketServer.broadcast('groups:synced', { groups });

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
      websocketServer.broadcast('bot:status', { isConnected: true, authenticated: true });
    });

    whatsappService.on('auth_failure', async (message) => {
      logger.error('WhatsApp auth failure:', message);
      await botRepository.updateStatus(false, message);
      websocketServer.broadcast('bot:status', { isConnected: false, error: message });
    });

    whatsappService.on('disconnected', async (reason) => {
      logger.warn('WhatsApp disconnected:', reason);
      await botRepository.updateStatus(false, reason);
      websocketServer.broadcast('bot:status', { isConnected: false, reason });
    });

    whatsappService.on('message', async (message) => {
      await this.handleIncomingMessage(message);
    });

    whatsappService.on('message_create', async (message) => {
      await this.handleIncomingMessage(message);
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
      if (!processedMessage) {
        return;
      }

      if (message.hasMedia && processedMessage.id) {
        const processedMedia = await mediaHandler.processMediaMessage(
          message,
          group.id,
          processedMessage.id
        );
        if (processedMedia) {
          websocketServer.broadcast('media:new', processedMedia, group.id);
        }
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
