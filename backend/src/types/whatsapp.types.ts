import { MessageType, MediaType } from './database.types';

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: number;
  hasMedia: boolean;
  type: string;
  author?: string;
  isForwarded: boolean;
}

export interface WhatsAppGroup {
  id: string;
  name: string;
  description?: string;
  participants: number;
}

export interface WhatsAppMediaData {
  data: Buffer;
  mimetype: string;
  filename: string;
  filesize: number;
}

export interface ProcessedMessage {
  id?: string;
  groupId: string;
  whatsappMessageId: string;
  senderName: string | null;
  senderNumber: string | null;
  content: string | null;
  messageType: MessageType;
  timestamp: Date;
  isForwarded: boolean;
  hasMedia: boolean;
}

export interface ProcessedMedia {
  id?: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  mediaType: MediaType;
  thumbnailPath: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
}

export interface QRCodeData {
  qr: string;
  timestamp: Date;
}

export interface BotStatusUpdate {
  isConnected: boolean;
  timestamp: Date;
  errorMessage?: string;
}
