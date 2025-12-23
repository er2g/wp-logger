import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const basePath = process.env.STORAGE_BASE_PATH || path.join(process.cwd(), 'storage');

export const storageConfig = {
  basePath,
  media: {
    images: path.join(basePath, 'media', 'images'),
    videos: path.join(basePath, 'media', 'videos'),
    audio: path.join(basePath, 'media', 'audio'),
    stickers: path.join(basePath, 'media', 'stickers'),
    voice: path.join(basePath, 'media', 'voice'),
  },
  documents: path.join(basePath, 'documents'),
  thumbnails: path.join(basePath, 'thumbnails'),
  maxFileSize: 0, // 0 means unlimited
  allowedMimeTypes: undefined,
  // allowedMimeTypes: {
  //   image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  //   video: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'],
  //   audio: ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/aac'],
  //   voice: ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/aac'],
  //   document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  //              'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  //              'text/plain', 'application/zip', 'application/x-rar-compressed'],
  //   sticker: ['image/webp'],
  // },
  thumbnailOptions: {
    width: 300,
    height: 300,
    fit: 'cover' as const,
    quality: 80,
  },
};
