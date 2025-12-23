import { Message } from 'whatsapp-web.js';
import * as mime from 'mime-types';
import * as path from 'path';
import logger from '../../utils/logger';
import fileStorageService from '../storage/FileStorage';
import mediaProcessorService from '../storage/MediaProcessor';
import whatsappService from './WhatsAppService';
import mediaRepository from '../database/repositories/MediaRepository';
import { ProcessedMedia } from '../../types/whatsapp.types';
import { MediaType } from '../../types/database.types';

export class MediaHandlerService {
  async processMediaMessage(
    message: Message,
    groupId: string,
    messageId: string
  ): Promise<ProcessedMedia | null> {
    try {
      if (!message.hasMedia) {
        return null;
      }

      const existingMedia = await mediaRepository.findByMessageId(messageId);
      if (existingMedia.length > 0) {
        return null;
      }

      const mediaBuffer = await whatsappService.downloadMedia(message);
      if (!mediaBuffer || mediaBuffer.length === 0) {
        logger.warn(`Empty media buffer for message ${message.id._serialized}`);
        return null;
      }

      const media = await message.downloadMedia();
      if (!media) {
        return null;
      }

      const mimeType = media.mimetype;
      const baseFileName = media.filename || `media_${Date.now()}`;
      const extName = path.extname(baseFileName);
      const derivedExt = mime.extension(mimeType);
      const fileName =
        extName
          ? baseFileName
          : `${baseFileName}.${derivedExt ? derivedExt : 'bin'}`;

      const mediaType = mediaProcessorService.determineMediaType(mimeType, message.type);

      if (!mediaProcessorService.isAllowedMimeType(mimeType, mediaType)) {
        logger.warn(`Disallowed mime type: ${mimeType}`);
        return null;
      }

      if (!mediaProcessorService.validateFileSize(mediaBuffer.length)) {
        logger.warn(`File too large: ${mediaBuffer.length} bytes`);
        return null;
      }

      const sanitizedFileName = mediaProcessorService.sanitizeFileName(fileName);

      const filePath = await fileStorageService.saveFile(
        mediaBuffer,
        sanitizedFileName,
        mediaType,
        groupId
      );

      let thumbnailPath: string | null = null;
      let width: number | null = null;
      let height: number | null = null;
      let duration: number | null = null;

      if (mediaType === 'image') {
        try {
          const metadata = await mediaProcessorService.processImage(mediaBuffer);
          width = metadata.width || null;
          height = metadata.height || null;

          if (metadata.thumbnailBuffer) {
            thumbnailPath = await fileStorageService.saveThumbnail(
              metadata.thumbnailBuffer,
              sanitizedFileName
            );
          }
        } catch (error) {
          logger.warn('Failed to process image metadata:', error);
        }
      } else if (mediaType === 'video') {
        try {
          const metadata = await mediaProcessorService.processVideo(mediaBuffer);
          if (metadata.thumbnailBuffer) {
            thumbnailPath = await fileStorageService.saveThumbnail(
              metadata.thumbnailBuffer,
              sanitizedFileName
            );
          }
        } catch (error) {
          logger.warn('Failed to process video metadata:', error);
        }
      }

      const savedMedia = await mediaRepository.create({
        message_id: messageId,
        group_id: groupId,
        file_name: sanitizedFileName,
        file_path: filePath,
        file_size: BigInt(mediaBuffer.length),
        mime_type: mimeType,
        media_type: mediaType,
        thumbnail_path: thumbnailPath,
        duration,
        width,
        height,
        caption: null,
        is_gif: false,
        is_animated: false,
        page_count: null,
        blur_hash: null,
      });

      const processedMedia: ProcessedMedia = {
        id: savedMedia.id,
        fileName: sanitizedFileName,
        filePath,
        fileSize: mediaBuffer.length,
        mimeType,
        mediaType,
        thumbnailPath,
        duration,
        width,
        height,
      };

      logger.info(`Media processed: ${sanitizedFileName} (${mediaType})`);
      return processedMedia;
    } catch (error) {
      logger.error('Failed to process media message:', error);
      return null;
    }
  }

  getMediaTypeFromMimeType(mimeType: string): MediaType {
    return mediaProcessorService.determineMediaType(mimeType);
  }
}

export default new MediaHandlerService();
