import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
  };
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface MessageFilterQuery extends PaginationQuery {
  groupId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface MediaFilterQuery extends PaginationQuery {
  groupId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
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
  };
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
  type: 'access' | 'refresh';
}

export interface TokenResponse {
  accessToken: string;
  expiresIn: string;
  user: {
    id: string;
    username: string;
  };
}
