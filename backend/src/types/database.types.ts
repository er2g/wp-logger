export interface User {
  id: string;
  username: string;
  created_at: Date;
  updated_at: Date;
  last_login: Date | null;
  is_active: boolean;
}

export interface WebAuthnCredential {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: bigint;
  transports: string[] | null;
  created_at: Date;
  last_used: Date | null;
}

export interface Group {
  id: string;
  whatsapp_id: string;
  name: string;
  description: string | null;
  chat_type: 'group' | 'dm';
  is_monitored: boolean;
  participant_count: number;
  created_at: Date;
  updated_at: Date;
  last_message_at: Date | null;
  last_synced_at: Date | null;
}

export interface Message {
  id: string;
  group_id: string;
  whatsapp_message_id: string;
  sender_name: string | null;
  sender_number: string | null;
  content: string | null;
  message_type: MessageType;
  timestamp: Date;
  is_forwarded: boolean;
  has_media: boolean;
  created_at: Date;
}

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'voice'
  | 'ptt';

export interface Media {
  id: string;
  message_id: string;
  group_id: string;
  file_name: string;
  file_path: string;
  file_size: bigint | null;
  mime_type: string | null;
  media_type: MediaType;
  thumbnail_path: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  created_at: Date;
}

export type MediaType = 'image' | 'video' | 'audio' | 'voice' | 'sticker' | 'document';

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

export interface BotStatus {
  id: number;
  is_connected: boolean;
  qr_code: string | null;
  last_connected: Date | null;
  last_disconnected: Date | null;
  error_message: string | null;
  updated_at: Date;
}

export interface DashboardStats {
  total_messages: bigint;
  total_media_files: bigint;
  total_storage_bytes: bigint;
  active_groups: number;
  messages_today: bigint;
  messages_this_week: bigint;
}

export interface GroupStats {
  id: string;
  name: string;
  whatsapp_id: string;
  is_monitored: boolean;
  participant_count: number;
  last_message_at: Date | null;
  total_messages: bigint;
  messages_with_media: bigint;
  total_media_files: bigint;
  total_storage_bytes: bigint;
}
