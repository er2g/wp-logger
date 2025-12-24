import fs from 'fs/promises';
import path from 'path';
import { proto } from '@whiskeysockets/baileys';
import { storageConfig } from '../../config/storage';
import logger from '../../utils/logger';

class MessageCacheService {
  private cacheDir = path.join(storageConfig.basePath, 'wa-message-cache');
  private lastCleanup = 0;
  private cleanupIntervalMs = 6 * 60 * 60 * 1000;

  async initialize(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  async saveMessage(messageId: string, message: proto.IWebMessageInfo): Promise<void> {
    if (!messageId || messageId === 'unknown') {
      return;
    }

    try {
      await this.initialize();
      const data = proto.WebMessageInfo.encode(message).finish();
      const filePath = this.getFilePath(messageId);
      await fs.writeFile(filePath, data);
      await this.maybeCleanup();
    } catch (error) {
      logger.warn('Failed to cache WhatsApp message:', error);
    }
  }

  async loadMessage(messageId: string): Promise<proto.IWebMessageInfo | null> {
    if (!messageId || messageId === 'unknown') {
      return null;
    }

    const filePath = this.getFilePath(messageId);
    try {
      const data = await fs.readFile(filePath);
      return proto.WebMessageInfo.decode(data);
    } catch {
      return null;
    }
  }

  private getFilePath(messageId: string): string {
    const safeId = Buffer.from(messageId).toString('base64url');
    return path.join(this.cacheDir, `${safeId}.bin`);
  }

  private async maybeCleanup(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCleanup < this.cleanupIntervalMs) {
      return;
    }

    this.lastCleanup = now;
    const retentionDays = parseInt(process.env.MESSAGE_CACHE_RETENTION_DAYS || '7', 10);
    if (retentionDays <= 0) {
      return;
    }

    const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
    try {
      const entries = await fs.readdir(this.cacheDir);
      await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(this.cacheDir, entry);
          try {
            const stats = await fs.stat(fullPath);
            if (stats.mtimeMs < cutoff) {
              await fs.unlink(fullPath);
            }
          } catch {
            return;
          }
        })
      );
    } catch (error) {
      logger.warn('Failed to cleanup cached WhatsApp messages:', error);
    }
  }
}

export default new MessageCacheService();
