import { Request } from 'express';
import { MessageType, MediaType, GroupCategory, ChatType, ExportOptions } from './database.types';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
    role: 'admin' | 'user';
  };
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface MessageFilterQuery extends PaginationQuery {
  groupId?: string;
  type?: MessageType | MessageType[];
  senderNumber?: string;
  senderName?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  hasMedia?: string;
  isForwarded?: string;
  isStarred?: string;
  chatType?: ChatType;
}

export interface MediaFilterQuery extends PaginationQuery {
  groupId?: string;
  messageId?: string;
  type?: MediaType | MediaType[];
  startDate?: string;
  endDate?: string;
  minSize?: string;
  maxSize?: string;
}

export interface GroupFilterQuery extends PaginationQuery {
  chatType?: ChatType;
  category?: GroupCategory;
  isMonitored?: string;
  search?: string;
}

export interface SearchQuery extends PaginationQuery {
  q: string;
  groupId?: string;
  type?: MessageType | MessageType[];
  startDate?: string;
  endDate?: string;
  senderNumber?: string;
  exact?: string; // exact match vs fuzzy
}

export interface AdvancedSearchQuery extends SearchQuery {
  includeMedia?: string;
  sortBy?: 'relevance' | 'date' | 'sender';
  highlight?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ExportRequest {
  options: ExportOptions;
}

export interface ExportResponse {
  success: boolean;
  downloadUrl?: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
}

export interface StatsQuery {
  groupId?: string;
  startDate?: string;
  endDate?: string;
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

export interface ContactQuery extends PaginationQuery {
  search?: string;
  isBusiness?: string;
}

export interface WebAuthnRegistrationStart {
  username: string;
}

export interface WebAuthnRegistrationComplete {
  username: string;
  credential: any; // RegistrationResponseJSON from @simplewebauthn/types
}

export interface WebAuthnLoginStart {
  username: string;
}

export interface WebAuthnLoginComplete {
  username: string;
  assertion: any; // AuthenticationResponseJSON from @simplewebauthn/types
}

export interface JWTPayload {
  userId: string;
  username: string;
  role: 'admin' | 'user';
  type: 'access' | 'refresh';
}

export interface TokenResponse {
  accessToken: string;
  expiresIn: string;
  user: {
    id: string;
    username: string;
    role: 'admin' | 'user';
  };
}

export interface BulkActionRequest {
  ids: string[];
  action: 'delete' | 'star' | 'unstar' | 'export';
}

export interface BulkActionResponse {
  success: boolean;
  processed: number;
  failed: number;
  errors?: string[];
}

export interface GroupUpdateRequest {
  name?: string;
  description?: string;
  category?: GroupCategory;
  is_monitored?: boolean;
}

export interface SystemSettingsUpdateRequest {
  history_sync_enabled?: boolean;
  history_sync_include_media?: boolean;
  history_sync_max_messages?: number | null;
  auto_download_media?: boolean;
  max_media_file_size?: number;
  retention_days?: number | null;
  timezone?: string;
  language?: string;
}

// WebSocket event types
export interface WSMessage {
  type: string;
  payload: any;
}

export interface WSNewMessageEvent {
  id: string;
  groupId: string;
  senderName: string | null;
  senderNumber: string | null;
  content: string | null;
  messageType: MessageType;
  timestamp: string;
  hasMedia: boolean;
  isForwarded: boolean;
}

export interface WSNewMediaEvent {
  id: string;
  messageId: string;
  groupId: string;
  fileName: string;
  mediaType: MediaType;
  fileSize: number;
  thumbnailPath: string | null;
}

export interface WSBotStatusEvent {
  isConnected: boolean;
  qrCode: string | null;
  errorMessage: string | null;
  phoneNumber: string | null;
}

export interface WSGroupSyncEvent {
  groupId: string;
  messageCount: number;
  status: 'started' | 'progress' | 'completed' | 'failed';
  progress?: number;
}
