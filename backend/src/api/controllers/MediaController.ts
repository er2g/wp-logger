import { Response } from 'express';
import { AuthRequest } from '../../types/api.types';
import mediaRepository from '../../services/database/repositories/MediaRepository';
import fileStorageService from '../../services/storage/FileStorage';
import mediaProcessorService from '../../services/storage/MediaProcessor';
import logger from '../../utils/logger';
import fs from 'fs';
import path from 'path';
import * as mime from 'mime-types';

export class MediaController {
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      // TODO: Implement proper filtering and pagination in repository
      const { groupId, messageId } = req.query as any;

      let media;
      if (groupId) {
        media = await mediaRepository.findByGroupId(groupId);
      } else if (messageId) {
        media = await mediaRepository.findByMessageId(messageId);
      } else {
        media = await mediaRepository.findAll();
      }

      res.json({
        success: true,
        data: media,
      });
    } catch (error) {
      logger.error('Get all media failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get media',
      });
    }
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const media = await mediaRepository.findById(id);

      if (!media) {
        res.status(404).json({
          success: false,
          error: 'Media not found',
        });
        return;
      }

      res.json({
        success: true,
        data: media,
      });
    } catch (error) {
      logger.error('Get media by id failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get media',
      });
    }
  }

  async download(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const media = await mediaRepository.findById(id);

      if (!media) {
        res.status(404).json({
          success: false,
          error: 'Media not found',
        });
        return;
      }

      const filePath = media.file_path;
      const exists = await fileStorageService.fileExists(filePath);
      if (!exists) {
        res.status(404).json({
          success: false,
          error: 'File not found',
        });
        return;
      }

      const fileName = media.file_name || path.basename(filePath);
      const normalizedMime = media.mime_type?.split(';')[0].trim();
      const mimeType = normalizedMime || mediaProcessorService.getMimeType(fileName);
      const extension = normalizedMime ? mime.extension(normalizedMime) : false;
      const responseFileName =
        path.extname(fileName) || !extension
          ? fileName
          : `${fileName}.${extension}`;

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${responseFileName}"`);

      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      logger.error('Download media failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to download media',
      });
    }
  }

  async stream(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const media = await mediaRepository.findById(id);

      if (!media) {
        res.status(404).json({
          success: false,
          error: 'Media not found',
        });
        return;
      }

      const filePath = media.file_path;
      const exists = await fileStorageService.fileExists(filePath);
      if (!exists) {
        res.status(404).json({
          success: false,
          error: 'File not found',
        });
        return;
      }

      const fileSize = await fileStorageService.getFileSize(filePath);
      const range = req.headers.range;
      const fileName = media.file_name || path.basename(filePath);
      const mimeType = media.mime_type || mediaProcessorService.getMimeType(fileName);

      if (!range) {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': mimeType,
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1;

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= fileSize) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
        return;
      }

      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
      });

      fs.createReadStream(filePath, { start, end }).pipe(res);
    } catch (error) {
      logger.error('Stream media failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stream media',
      });
    }
  }

  async getThumbnail(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const media = await mediaRepository.findById(id);

      if (!media) {
        res.status(404).json({
          success: false,
          error: 'Media not found',
        });
        return;
      }

      const thumbnailPath = media.thumbnail_path;
      if (thumbnailPath && (await fileStorageService.fileExists(thumbnailPath))) {
        res.setHeader('Content-Type', 'image/jpeg');
        fs.createReadStream(thumbnailPath).pipe(res);
        return;
      }

      if (media.mime_type?.startsWith('image/') || media.media_type === 'image') {
        if (await fileStorageService.fileExists(media.file_path)) {
          res.setHeader('Content-Type', media.mime_type || 'image/jpeg');
          fs.createReadStream(media.file_path).pipe(res);
          return;
        }
      }

      res.status(404).json({
        success: false,
        error: 'Thumbnail not available',
      });
    } catch (error) {
      logger.error('Get thumbnail failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get thumbnail',
      });
    }
  }
}

export default new MediaController();
