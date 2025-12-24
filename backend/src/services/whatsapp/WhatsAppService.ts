import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  proto,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import * as fs from 'fs';
import { whatsappConfig } from '../../config/whatsapp';
import logger from '../../utils/logger';
import { EventEmitter } from 'events';
import { IncomingMessage } from './IncomingMessage';
import messageCacheService from './MessageCacheService';

export interface WhatsAppEvents {
  qr: (qr: string) => void;
  ready: () => void;
  authenticated: () => void;
  auth_failure: (message: string) => void;
  disconnected: (reason: string) => void;
  message: (message: IncomingMessage) => void;
  message_create: (message: IncomingMessage) => void;
}

export interface ChatSummary {
  id: string;
  name: string;
  description: string;
  participants: number;
  chatType: 'group' | 'dm';
}

interface DownloadedMedia {
  buffer: Buffer;
  mimetype?: string;
  filename?: string;
  filesize?: number;
}

export class WhatsAppService extends EventEmitter {
  private socket: ReturnType<typeof makeWASocket> | null = null;
  private chats = new Map<string, Record<string, unknown>>();
  private contacts = new Map<string, { name?: string; notify?: string }>();
  private messagesByChat = new Map<string, proto.IWebMessageInfo[]>();
  private maxMessagesPerChat = Math.max(2000, parseInt(process.env.WA_MESSAGE_CACHE_LIMIT || '2000', 10));
  private isInitialized = false;
  private isConnected = false;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('WhatsApp client already initialized');
      return;
    }

    try {
      await fs.promises.mkdir(whatsappConfig.sessionPath, { recursive: true });
      await messageCacheService.initialize();

      const { state, saveCreds } = await useMultiFileAuthState(whatsappConfig.sessionPath);
      const { version } = await fetchLatestBaileysVersion();

      this.socket = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: false,
        syncFullHistory: whatsappConfig.syncFullHistory,
        markOnlineOnConnect: whatsappConfig.markOnlineOnConnect,
        logger: pino({ level: 'silent' }),
      });

      this.socket.ev.on('creds.update', saveCreds);
      this.setupEventHandlers();

      this.isInitialized = true;
      logger.info('WhatsApp client initialized');
    } catch (error) {
      logger.error('Failed to initialize WhatsApp client:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.socket) {
      return;
    }

    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        logger.info('QR Code received');
        qrcode.generate(qr, { small: true });
        this.emit('qr', qr);
      }

      if (connection === 'open') {
        logger.info('WhatsApp client is ready');
        this.isConnected = true;
        this.emit('authenticated');
        this.emit('ready');
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        const reason = shouldReconnect ? 'connection_closed' : 'logged_out';

        logger.warn('WhatsApp client disconnected:', reason);
        this.isConnected = false;
        if (!shouldReconnect) {
          this.emit('auth_failure', 'logged_out');
        }
        this.emit('disconnected', reason);

        if (shouldReconnect) {
          setTimeout(() => {
            this.restart().catch((error) => logger.error('Failed to restart WhatsApp client:', error));
          }, 5000);
        }
      }
    });

    this.socket.ev.on('chats.upsert', (chats) => {
      for (const chat of chats) {
        const chatId = this.resolveChatId(chat as unknown as Record<string, unknown>);
        if (chatId) {
          this.chats.set(chatId, chat as unknown as Record<string, unknown>);
        }
      }
    });

    this.socket.ev.on('chats.update', (chats) => {
      for (const chat of chats) {
        const chatId = this.resolveChatId(chat as unknown as Record<string, unknown>);
        if (!chatId) {
          continue;
        }
        const existing = this.chats.get(chatId) || {};
        this.chats.set(chatId, { ...existing, ...chat });
      }
    });

    this.socket.ev.on('contacts.upsert', (contacts) => {
      for (const contact of contacts) {
        if (contact.id) {
          this.contacts.set(contact.id, { name: contact.name, notify: contact.notify });
        }
      }
    });

    this.socket.ev.on('messaging-history.set', ({ chats, contacts, messages }) => {
      if (Array.isArray(chats)) {
        for (const chat of chats) {
          const chatId = this.resolveChatId(chat as unknown as Record<string, unknown>);
          if (chatId) {
            this.chats.set(chatId, chat as unknown as Record<string, unknown>);
          }
        }
      }

      if (Array.isArray(contacts)) {
        for (const contact of contacts) {
          if (contact.id) {
            this.contacts.set(contact.id, { name: contact.name, notify: contact.notify });
          }
        }
      }

      if (Array.isArray(messages)) {
        for (const rawMessage of messages) {
          this.ingestMessage(rawMessage, false);
        }
      }
    });

    this.socket.ev.on('messages.upsert', ({ messages, type }) => {
      for (const rawMessage of messages) {
        const shouldEmit = type === 'notify';
        this.ingestMessage(rawMessage, shouldEmit);
      }
    });
  }

  async getChats(): Promise<ChatSummary[]> {
    if (!this.socket || !this.isConnected) {
      throw new Error('WhatsApp client not connected');
    }

    try {
      const summaries: ChatSummary[] = [];
      const knownIds = new Set<string>();
      const chatList = Array.from(this.chats.values());

      for (const chat of chatList) {
        const chatId = this.resolveChatId(chat);
        if (!chatId || chatId === 'status@broadcast' || knownIds.has(chatId)) {
          continue;
        }

        knownIds.add(chatId);
        summaries.push(this.toChatSummary(chatId, chat));
      }

      const groupMap = await this.socket.groupFetchAllParticipating();
      for (const group of Object.values(groupMap)) {
        if (knownIds.has(group.id)) {
          continue;
        }
        summaries.push({
          id: group.id,
          name: group.subject || 'Unknown',
          description: group.desc || '',
          participants: group.participants?.length || 0,
          chatType: 'group',
        });
      }

      return summaries;
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
    if (!this.socket || !this.isConnected) {
      throw new Error('WhatsApp client not connected');
    }

    try {
      if (chatId.endsWith('@g.us')) {
        const metadata = await this.socket.groupMetadata(chatId);
        return {
          id: metadata.id,
          name: metadata.subject || 'Unknown',
          description: metadata.desc || '',
          participants: metadata.participants?.length || 0,
          chatType: 'group',
        };
      }

      const contact = this.resolveContact(chatId);
      return {
        id: chatId,
        name: contact?.name || contact?.notify || chatId,
        description: '',
        participants: 0,
        chatType: 'dm',
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

  async fetchChatMessages(chatId: string, limit?: number): Promise<IncomingMessage[]> {
    if (!this.socket || !this.isConnected) {
      throw new Error('WhatsApp client not connected');
    }

    try {
      const maxLimit = typeof limit === 'number' ? limit : 50;
      const messages = this.messagesByChat.get(chatId) || [];
      const sliced = messages.slice(-maxLimit);

      return sliced
        .map((message) => this.toIncomingMessage(message))
        .filter((message): message is IncomingMessage => Boolean(message));
    } catch (error) {
      logger.error('Failed to fetch chat messages for ' + chatId + ':', error);
      throw error;
    }
  }

  async getMessageById(messageId: string): Promise<IncomingMessage | null> {
    if (!this.socket || !this.isConnected) {
      throw new Error('WhatsApp client not connected');
    }

    const parsed = this.parseMessageId(messageId);
    if (!parsed) {
      return null;
    }

    try {
      const messages = this.messagesByChat.get(parsed.remoteJid) || [];
      const found = messages.find((msg) => msg.key?.id === parsed.id);
      if (found) {
        return this.toIncomingMessage(found);
      }

      const normalizedId = this.normalizeMessageId(messageId);
      let cached = await messageCacheService.loadMessage(normalizedId);
      if (!cached && normalizedId !== messageId) {
        cached = await messageCacheService.loadMessage(messageId);
      }
      return cached ? this.toIncomingMessage(cached) : null;
    } catch (error) {
      logger.warn('Failed to get message by id ' + messageId + ':', error);
      return null;
    }
  }

  async findMessageInChat(chatId: string, messageId: string, limit = 200): Promise<IncomingMessage | null> {
    try {
      const messages = await this.fetchChatMessages(chatId, limit);
      const normalizedId = this.normalizeMessageId(messageId);
      return messages.find((msg) => this.normalizeMessageId(msg.id._serialized) === normalizedId) || null;
    } catch (error) {
      logger.warn('Failed to find message in chat ' + chatId + ':', error);
      return null;
    }
  }

  async requestHistorySync(
    chatId: string,
    messageId: string,
    timestampMs: number,
    count = 200
  ): Promise<boolean> {
    if (!this.socket || !this.isConnected) {
      return false;
    }

    const parsed = this.parseMessageId(messageId);
    if (!parsed) {
      return false;
    }

    const socket = this.socket as unknown as {
      fetchMessageHistory?: (count: number, key: { remoteJid: string; fromMe: boolean; id: string }, timestampMs: number) => Promise<void>;
    };

    if (typeof socket.fetchMessageHistory !== 'function') {
      logger.warn('History sync request not supported by socket');
      return false;
    }

    const oldestKey = {
      remoteJid: chatId || parsed.remoteJid,
      fromMe: false,
      id: parsed.id,
    };

    try {
      await socket.fetchMessageHistory(count, oldestKey, Math.max(0, Math.floor(timestampMs)));
      return true;
    } catch (error) {
      logger.warn('Failed to request history sync:', error);
      return false;
    }
  }

  async requestHistorySyncFromOldest(chatId: string, count = 200): Promise<boolean> {
    if (!this.socket || !this.isConnected) {
      return false;
    }

    const messages = this.messagesByChat.get(chatId) || [];
    if (messages.length === 0) {
      return false;
    }

    let oldest = messages[0];
    let oldestTimestamp = this.extractTimestamp(oldest);
    for (let i = 1; i < messages.length; i++) {
      const candidate = messages[i];
      const candidateTimestamp = this.extractTimestamp(candidate);
      if (candidateTimestamp < oldestTimestamp) {
        oldest = candidate;
        oldestTimestamp = candidateTimestamp;
      }
    }

    if (!oldest?.key?.id || !oldest.key.remoteJid) {
      return false;
    }

    const socket = this.socket as unknown as {
      fetchMessageHistory?: (count: number, key: { remoteJid: string; fromMe: boolean; id: string }, timestampMs: number) => Promise<void>;
    };

    if (typeof socket.fetchMessageHistory !== 'function') {
      logger.warn('History sync request not supported by socket');
      return false;
    }

    try {
      await socket.fetchMessageHistory(
        count,
        {
          remoteJid: oldest.key.remoteJid,
          fromMe: Boolean(oldest.key.fromMe),
          id: oldest.key.id,
        },
        oldestTimestamp * 1000
      );
      return true;
    } catch (error) {
      logger.warn('Failed to request history sync from oldest:', error);
      return false;
    }
  }

  async downloadMedia(message: IncomingMessage): Promise<DownloadedMedia | null> {
    if (!this.socket || !this.isConnected) {
      throw new Error('WhatsApp client not connected');
    }

    if (!message.hasMedia) {
      throw new Error('Message does not have media');
    }

    const mediaInfo = this.extractMediaInfo(message.raw);
    if (!mediaInfo) {
      return null;
    }

    try {
      const data = await downloadMediaMessage(
        message.raw,
        'buffer',
        {},
        { logger: pino({ level: 'silent' }), reuploadRequest: this.socket.updateMediaMessage }
      );

      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as Uint8Array);
      return {
        buffer,
        mimetype: mediaInfo.mimetype,
        filename: mediaInfo.filename,
        filesize: mediaInfo.filesize,
      };
    } catch (error) {
      logger.error('Failed to download media:', error);
      return null;
    }
  }

  isReady(): boolean {
    return this.isConnected;
  }

  async destroy(): Promise<void> {
    if (this.socket) {
      this.socket.end(new Error('Client destroyed'));
      this.socket = null;
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

  private toIncomingMessage(message: proto.IWebMessageInfo): IncomingMessage | null {
    const chatId = message.key?.remoteJid;
    if (!chatId || chatId === 'status@broadcast') {
      return null;
    }

    const senderJid = message.key?.participant || message.participant || chatId;
    const normalizedSender = this.normalizeJid(senderJid);
    const senderNumber = this.extractUserNumber(normalizedSender);
    const senderName =
      message.pushName
      || this.resolveContact(normalizedSender)?.name
      || this.resolveContact(normalizedSender)?.notify
      || null;

    const { type, hasMedia, isForwarded } = this.extractMessageType(message);
    const body = this.extractBody(message) || '';
    const timestamp = this.extractTimestamp(message);
    const serializedId = this.serializeMessageId(message.key);

    return {
      id: { _serialized: serializedId },
      from: chatId,
      to: chatId,
      fromMe: Boolean(message.key?.fromMe),
      author: normalizedSender,
      body,
      timestamp,
      hasMedia,
      type,
      isForwarded,
      senderName,
      senderNumber,
      raw: message,
    };
  }

  private extractBody(message: proto.IWebMessageInfo): string | null {
    const content = this.unwrapMessage(message.message);
    if (!content) {
      return null;
    }

    if (content.conversation) {
      return content.conversation;
    }
    if (content.extendedTextMessage?.text) {
      return content.extendedTextMessage.text;
    }
    if (content.imageMessage?.caption) {
      return content.imageMessage.caption;
    }
    if (content.videoMessage?.caption) {
      return content.videoMessage.caption;
    }
    if (content.documentMessage?.caption) {
      return content.documentMessage.caption;
    }
    if (content.documentMessage?.fileName) {
      return content.documentMessage.fileName;
    }

    return null;
  }

  private extractMessageType(message: proto.IWebMessageInfo): { type: string; hasMedia: boolean; isForwarded: boolean } {
    const content = this.unwrapMessage(message.message);
    if (!content) {
      return { type: 'chat', hasMedia: false, isForwarded: false };
    }

    const isForwarded = this.extractForwardedFlag(content);
    if (content.imageMessage) {
      return { type: 'image', hasMedia: true, isForwarded };
    }
    if (content.videoMessage) {
      return { type: 'video', hasMedia: true, isForwarded };
    }
    if (content.audioMessage) {
      const type = content.audioMessage.ptt ? 'ptt' : 'audio';
      return { type, hasMedia: true, isForwarded };
    }
    if (content.documentMessage) {
      return { type: 'document', hasMedia: true, isForwarded };
    }
    if (content.stickerMessage) {
      return { type: 'sticker', hasMedia: true, isForwarded };
    }
    if (content.locationMessage) {
      return { type: 'location', hasMedia: false, isForwarded };
    }
    if (content.contactMessage || content.contactsArrayMessage) {
      return { type: 'vcard', hasMedia: false, isForwarded };
    }

    return { type: 'chat', hasMedia: false, isForwarded };
  }

  private extractForwardedFlag(content: proto.IMessage): boolean {
    const contextInfo =
      content.extendedTextMessage?.contextInfo
      || content.imageMessage?.contextInfo
      || content.videoMessage?.contextInfo
      || content.documentMessage?.contextInfo
      || content.audioMessage?.contextInfo
      || content.stickerMessage?.contextInfo;

    return Boolean(contextInfo?.isForwarded || (contextInfo?.forwardingScore && contextInfo.forwardingScore > 0));
  }

  private extractMediaInfo(message: proto.IWebMessageInfo): { mimetype?: string; filename?: string; filesize?: number } | null {
    const content = this.unwrapMessage(message.message);
    if (!content) {
      return null;
    }

    if (content.documentMessage) {
      return {
        mimetype: content.documentMessage.mimetype || undefined,
        filename: content.documentMessage.fileName || undefined,
        filesize: content.documentMessage.fileLength ? Number(content.documentMessage.fileLength) : undefined,
      };
    }

    if (content.imageMessage) {
      return {
        mimetype: content.imageMessage.mimetype || undefined,
        filename: undefined,
        filesize: content.imageMessage.fileLength ? Number(content.imageMessage.fileLength) : undefined,
      };
    }

    if (content.videoMessage) {
      return {
        mimetype: content.videoMessage.mimetype || undefined,
        filename: undefined,
        filesize: content.videoMessage.fileLength ? Number(content.videoMessage.fileLength) : undefined,
      };
    }

    if (content.audioMessage) {
      return {
        mimetype: content.audioMessage.mimetype || undefined,
        filename: undefined,
        filesize: content.audioMessage.fileLength ? Number(content.audioMessage.fileLength) : undefined,
      };
    }

    if (content.stickerMessage) {
      return {
        mimetype: content.stickerMessage.mimetype || 'image/webp',
        filename: undefined,
        filesize: content.stickerMessage.fileLength ? Number(content.stickerMessage.fileLength) : undefined,
      };
    }

    return null;
  }

  private extractTimestamp(message: proto.IWebMessageInfo): number {
    const timestamp = message.messageTimestamp;
    if (typeof timestamp === 'number') {
      return timestamp;
    }
    if (typeof timestamp === 'string') {
      return parseInt(timestamp, 10);
    }
    if (timestamp && typeof timestamp === 'object' && 'toNumber' in timestamp) {
      return (timestamp as { toNumber: () => number }).toNumber();
    }
    return Math.floor(Date.now() / 1000);
  }

  private unwrapMessage(message: proto.IMessage | null | undefined): proto.IMessage | null {
    if (!message) {
      return null;
    }

    const wrapped = message as proto.IMessage & {
      ephemeralMessage?: { message?: proto.IMessage };
      viewOnceMessage?: { message?: proto.IMessage };
      viewOnceMessageV2?: { message?: proto.IMessage };
      viewOnceMessageV2Extension?: { message?: proto.IMessage };
      documentWithCaptionMessage?: { message?: proto.IMessage };
    };

    if (wrapped.ephemeralMessage?.message) {
      return wrapped.ephemeralMessage.message;
    }

    if (wrapped.viewOnceMessage?.message) {
      return wrapped.viewOnceMessage.message;
    }

    if (wrapped.viewOnceMessageV2?.message) {
      return wrapped.viewOnceMessageV2.message;
    }

    if (wrapped.viewOnceMessageV2Extension?.message) {
      return wrapped.viewOnceMessageV2Extension.message;
    }

    if (wrapped.documentWithCaptionMessage?.message) {
      return wrapped.documentWithCaptionMessage.message;
    }

    return message;
  }

  private serializeMessageId(key: proto.IMessageKey | null | undefined): string {
    if (!key?.remoteJid || !key.id) {
      return 'unknown';
    }
    return `${key.remoteJid}:${key.id}`;
  }

  private normalizeMessageId(messageId: string): string {
    const parsed = this.parseMessageId(messageId);
    if (!parsed) {
      return messageId;
    }
    return `${parsed.remoteJid}:${parsed.id}`;
  }

  private parseMessageId(messageId: string): { remoteJid: string; id: string } | null {
    const separator = messageId.indexOf(':');
    if (separator <= 0) {
      const legacyParts = messageId.split('_');
      if (legacyParts.length >= 3 && (legacyParts[0] === 'true' || legacyParts[0] === 'false')) {
        return {
          remoteJid: legacyParts[1],
          id: legacyParts[2],
        };
      }
      return null;
    }
    return {
      remoteJid: messageId.slice(0, separator),
      id: messageId.slice(separator + 1),
    };
  }

  private normalizeJid(jid: string): string {
    return jid.split(':')[0];
  }

  private extractUserNumber(jid: string): string | null {
    const normalized = this.normalizeJid(jid);
    const index = normalized.indexOf('@');
    if (index === -1) {
      return normalized;
    }
    return normalized.slice(0, index);
  }

  private resolveContact(jid: string): { name?: string; notify?: string } | null {
    return this.contacts.get(jid) || null;
  }

  private resolveChatId(chat: Record<string, unknown>): string | null {
    const idValue = chat.id as { id?: string; remoteJid?: string } | string | undefined;
    if (typeof idValue === 'string') {
      return idValue;
    }
    if (idValue?.remoteJid) {
      return idValue.remoteJid;
    }
    if (typeof idValue?.id === 'string') {
      return idValue.id;
    }
    if (typeof (chat as { jid?: string }).jid === 'string') {
      return (chat as { jid: string }).jid;
    }
    return null;
  }

  private toChatSummary(chatId: string, chat: Record<string, unknown>): ChatSummary {
    const isGroup = chatId.endsWith('@g.us');
    const name =
      (chat as { name?: string }).name
      || (chat as { subject?: string }).subject
      || chatId;

    const description =
      (chat as { description?: string }).description
      || (chat as { desc?: string }).desc
      || '';

    const participants = (chat as { participants?: Array<unknown> }).participants?.length || 0;

    return {
      id: chatId,
      name,
      description,
      participants,
      chatType: isGroup ? 'group' : 'dm',
    };
  }

  private ingestMessage(rawMessage: proto.IWebMessageInfo, emit: boolean): void {
    const chatId = rawMessage.key?.remoteJid;
    if (chatId) {
      const existing = this.messagesByChat.get(chatId) || [];
      existing.push(rawMessage);
      if (existing.length > this.maxMessagesPerChat) {
        existing.splice(0, existing.length - this.maxMessagesPerChat);
      }
      this.messagesByChat.set(chatId, existing);
    }

    const message = this.toIncomingMessage(rawMessage);
    if (!message) {
      return;
    }

    if (message.hasMedia) {
      const cacheId = this.normalizeMessageId(message.id._serialized);
      messageCacheService.saveMessage(cacheId, rawMessage).catch((error) => {
        logger.warn('Failed to cache incoming message:', error);
      });
    }

    if (!emit) {
      return;
    }

    if (message.fromMe) {
      this.emit('message_create', message);
    } else {
      this.emit('message', message);
    }
  }
}

export default new WhatsAppService();
