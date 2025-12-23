import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { whatsappConfig } from '../../config/whatsapp';
import logger from '../../utils/logger';
import { EventEmitter } from 'events';

export interface WhatsAppEvents {
  qr: (qr: string) => void;
  ready: () => void;
  authenticated: () => void;
  auth_failure: (message: string) => void;
  disconnected: (reason: string) => void;
  message: (message: Message) => void;
  message_create: (message: Message) => void;
}

export interface ChatSummary {
  id: string;
  name: string;
  description: string;
  participants: number;
  chatType: 'group' | 'dm';
}

export class WhatsAppService extends EventEmitter {
  private client: Client | null = null;
  private isInitialized: boolean = false;
  private isConnected: boolean = false;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('WhatsApp client already initialized');
      return;
    }

    try {
      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: whatsappConfig.sessionPath,
        }),
        puppeteer: whatsappConfig.puppeteerOptions,
        ...whatsappConfig.clientOptions,
      });

      this.setupEventHandlers();
      await this.client.initialize();
      this.isInitialized = true;
      logger.info('WhatsApp client initialized');
    } catch (error) {
      logger.error('Failed to initialize WhatsApp client:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('qr', (qr) => {
      logger.info('QR Code received');
      qrcode.generate(qr, { small: true });
      this.emit('qr', qr);
    });

    this.client.on('ready', () => {
      logger.info('WhatsApp client is ready');
      this.isConnected = true;
      this.emit('ready');
    });

    this.client.on('authenticated', () => {
      logger.info('WhatsApp client authenticated');
      this.emit('authenticated');
    });

    this.client.on('auth_failure', (message) => {
      logger.error('WhatsApp authentication failed:', message);
      this.isConnected = false;
      this.emit('auth_failure', message);
    });

    this.client.on('disconnected', (reason) => {
      logger.warn('WhatsApp client disconnected:', reason);
      this.isConnected = false;
      this.emit('disconnected', reason);
    });

    this.client.on('message', (message) => {
      this.emit('message', message);
    });

    this.client.on('message_create', (message) => {
      this.emit('message_create', message);
    });
  }

  async getChats(): Promise<ChatSummary[]> {
    if (!this.client || !this.isConnected) {
      throw new Error('WhatsApp client not connected');
    }

    try {
      const chats = await this.client.getChats();

      return chats.map((chat: any) => {
        const name = chat.name || chat.formattedTitle || 'Unknown';
        const isGroup = Boolean(chat.isGroup);
        const participants = isGroup && Array.isArray(chat.participants)
          ? chat.participants.length
          : 0;
        const description = isGroup
          ? (chat.description || chat.groupMetadata?.desc || '')
          : '';

        return {
          id: chat.id._serialized,
          name,
          description,
          participants,
          chatType: isGroup ? 'group' : 'dm',
        } as ChatSummary;
      });
    } catch (error) {
      logger.error('Failed to get chats:', error);
      throw error;
    }
  }

  async getGroups() {
    const chats = await this.getChats();
    return chats
      .filter((chat) => chat.chatType === 'group')
      .map((chat) => ({
        id: chat.id,
        name: chat.name,
        description: chat.description,
        participants: chat.participants,
      }));
  }

  async getChatDetails(chatId: string): Promise<ChatSummary> {
    if (!this.client || !this.isConnected) {
      throw new Error('WhatsApp client not connected');
    }

    try {
      const chat: any = await this.client.getChatById(chatId);
      const isGroup = Boolean(chat.isGroup);
      const participants = isGroup && Array.isArray(chat.participants)
        ? chat.participants.length
        : 0;

      return {
        id: chat.id._serialized,
        name: chat.name || chat.formattedTitle || 'Unknown',
        description: isGroup ? (chat.description || chat.groupMetadata?.desc || '') : '',
        participants,
        chatType: isGroup ? 'group' : 'dm',
      };
    } catch (error) {
      logger.error('Failed to get chat details for ' + chatId + ':', error);
      throw error;
    }
  }

  async getGroupDetails(groupId: string) {
    const details = await this.getChatDetails(groupId);
    if (details.chatType !== 'group') {
      throw new Error('Chat is not a group');
    }

    return {
      id: details.id,
      name: details.name,
      description: details.description,
      participants: details.participants,
    };
  }

  async fetchChatMessages(chatId: string, limit?: number): Promise<Message[]> {
    if (!this.client || !this.isConnected) {
      throw new Error('WhatsApp client not connected');
    }

    try {
      const chat: any = await this.client.getChatById(chatId);
      const maxLimit = typeof limit === 'number' ? limit : Infinity;
      return await chat.fetchMessages({ limit: maxLimit });
    } catch (error) {
      logger.error('Failed to fetch chat messages for ' + chatId + ':', error);
      throw error;
    }
  }

  async downloadMedia(message: Message): Promise<Buffer> {
    if (!this.client || !this.isConnected) {
      throw new Error('WhatsApp client not connected');
    }

    try {
      if (!message.hasMedia) {
        throw new Error('Message does not have media');
      }

      const media = await message.downloadMedia();
      if (!media) {
        throw new Error('Failed to download media');
      }

      return Buffer.from(media.data, 'base64');
    } catch (error) {
      logger.error('Failed to download media:', error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.isConnected;
  }

  async destroy(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
      this.isInitialized = false;
      this.isConnected = false;
      logger.info('WhatsApp client destroyed');
    }
  }

  async restart(): Promise<void> {
    logger.info('Restarting WhatsApp client...');
    await this.destroy();
    await this.initialize();
  }
}

export default new WhatsAppService();
