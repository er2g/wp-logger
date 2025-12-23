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
  chat_type: ChatType;
  is_monitored: boolean;
  participant_count: number;
  created_at: Date;
  updated_at: Date;
  last_message_at: Date | null;
  last_synced_at: Date | null;
  profile_picture_url: string | null;
  category: GroupCategory | null;
}

export type ChatType = 'group' | 'dm' | 'broadcast' | 'status' | 'channel';

export type GroupCategory =
  | 'personal'
  | 'work'
  | 'family'
  | 'friends'
  | 'business'
  | 'community'
  | 'news'
  | 'entertainment'
  | 'other';

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
  // Extended fields
  reply_to_message_id: string | null;
  is_starred: boolean;
  is_deleted: boolean;
  edited_at: Date | null;
  mentions: string[] | null;
  links: string[] | null;
  // Reaction & Poll support
  reaction_emoji: string | null;
  reaction_target_id: string | null;
  poll_name: string | null;
  poll_options: PollOption[] | null;
  poll_votes: PollVote[] | null;
  // Location data
  location_latitude: number | null;
  location_longitude: number | null;
  location_name: string | null;
  location_address: string | null;
  // Contact data
  contact_vcard: string | null;
  // Group event data
  group_event_type: GroupEventType | null;
  group_event_participants: string[] | null;
}

export interface PollOption {
  id: string;
  name: string;
}

export interface PollVote {
  option_id: string;
  voters: string[];
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
  | 'ptt'
  // Extended types
  | 'poll'
  | 'poll_update'
  | 'reaction'
  | 'revoked'
  | 'e2e_notification'
  | 'group_notification'
  | 'call_log'
  | 'ciphertext'
  | 'payment'
  | 'live_location'
  | 'product'
  | 'order'
  | 'list'
  | 'list_response'
  | 'buttons'
  | 'buttons_response'
  | 'template_button_reply'
  | 'hsm'
  | 'protocol'
  | 'unknown';

export type GroupEventType =
  | 'create'
  | 'add'
  | 'remove'
  | 'leave'
  | 'promote'
  | 'demote'
  | 'subject'
  | 'description'
  | 'picture'
  | 'restrict'
  | 'announce'
  | 'invite';

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
  // Extended fields
  caption: string | null;
  is_gif: boolean;
  is_animated: boolean;
  page_count: number | null; // For PDFs
  blur_hash: string | null; // For progressive loading
}

export type MediaType = 'image' | 'video' | 'audio' | 'voice' | 'sticker' | 'document' | 'gif';

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  details: Record<string, any> | null;
}

export interface BotStatus {
  id: number;
  is_connected: boolean;
  qr_code: string | null;
  last_connected: Date | null;
  last_disconnected: Date | null;
  error_message: string | null;
  updated_at: Date;
  phone_number: string | null;
  device_name: string | null;
  battery_level: number | null;
  is_charging: boolean | null;
}

export interface DashboardStats {
  total_messages: number;
  total_media_files: number;
  total_storage_bytes: number;
  active_groups: number;
  messages_today: number;
  messages_this_week: number;
  messages_this_month: number;
  media_by_type: Record<MediaType, number>;
  messages_by_type: Record<MessageType, number>;
  top_senders: SenderStats[];
  activity_by_hour: number[];
  activity_by_day: ActivityByDay[];
  storage_by_type: Record<MediaType, number>;
}

export interface SenderStats {
  sender_name: string;
  sender_number: string;
  message_count: number;
  media_count: number;
  last_message_at: Date;
}

export interface ActivityByDay {
  date: string;
  message_count: number;
  media_count: number;
}

export interface GroupStats {
  id: string;
  name: string;
  whatsapp_id: string;
  chat_type: ChatType;
  category: GroupCategory | null;
  is_monitored: boolean;
  participant_count: number;
  last_message_at: Date | null;
  total_messages: number;
  messages_with_media: number;
  total_media_files: number;
  total_storage_bytes: number;
  top_senders: SenderStats[];
  message_type_distribution: Record<MessageType, number>;
  activity_trend: ActivityByDay[];
}

export interface SearchResult {
  id: string;
  group_id: string;
  group_name: string;
  sender_name: string | null;
  sender_number: string | null;
  content: string | null;
  message_type: MessageType;
  timestamp: Date;
  has_media: boolean;
  highlight: string | null; // Highlighted search match
  score: number; // Search relevance score
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'html' | 'pdf';
  groupId?: string;
  startDate?: Date;
  endDate?: Date;
  includeMedia?: boolean;
  messageTypes?: MessageType[];
}

export interface SystemSettings {
  id: number;
  history_sync_enabled: boolean;
  history_sync_include_media: boolean;
  history_sync_max_messages: number | null;
  auto_download_media: boolean;
  max_media_file_size: number;
  retention_days: number | null; // null = keep forever
  timezone: string;
  language: string;
  updated_at: Date;
}

export interface Contact {
  id: string;
  whatsapp_id: string;
  name: string;
  phone_number: string;
  profile_picture_url: string | null;
  is_business: boolean;
  about: string | null;
  first_seen: Date;
  last_seen: Date;
  message_count: number;
}
