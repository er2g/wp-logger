import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types/api.types';
import jwtService from '../../services/auth/JWTService';
import logger from '../../utils/logger';

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    const cookieHeader = req.headers.cookie;
    let cookieToken: string | null = null;

    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
        const trimmed = part.trim();
        if (!trimmed) {
          return acc;
        }
        const index = trimmed.indexOf('=');
        if (index === -1) {
          return acc;
        }
        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1).trim();
        if (key) {
          acc[key] = decodeURIComponent(value);
        }
        return acc;
      }, {});

      if (cookies.accessToken) {
        cookieToken = cookies.accessToken;
      }
    }

    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : cookieToken;

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'No authorization token provided',
      });
      return;
    }

    const payload = jwtService.verifyAccessToken(token);

    req.user = {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
    };

    next();
  } catch (error) {
    logger.debug('Authentication failed:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
}
