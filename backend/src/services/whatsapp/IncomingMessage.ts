import { proto } from '@whiskeysockets/baileys';

export interface IncomingMessage {
  id: { _serialized: string };
  from: string;
  to?: string;
  fromMe: boolean;
  author?: string;
  body?: string;
  timestamp: number;
  hasMedia: boolean;
  type: string;
  isForwarded: boolean;
  senderName?: string | null;
  senderNumber?: string | null;
  raw: proto.IWebMessageInfo;
}
