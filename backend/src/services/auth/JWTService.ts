import jwt from 'jsonwebtoken';
import { jwtConfig } from '../../config/jwt';
import { JWTPayload } from '../../types/api.types';
import logger from '../../utils/logger';

export class JWTService {
  generateAccessToken(userId: string, username: string, role: 'admin' | 'user', expiresIn?: string): string {
    const payload: JWTPayload = {
      userId,
      username,
      role,
      type: 'access',
    };

    return jwt.sign(payload, jwtConfig.secret, {
      expiresIn: (expiresIn || jwtConfig.accessExpiry) as any,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    });
  }

  generateRefreshToken(userId: string, username: string, role: 'admin' | 'user'): string {
    const payload: JWTPayload = {
      userId,
      username,
      role,
      type: 'refresh',
    };

    return jwt.sign(payload, jwtConfig.secret, {
      expiresIn: jwtConfig.refreshExpiry as any,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    });
  }

  verifyAccessToken(token: string): JWTPayload {
    try {
      const payload = jwt.verify(token, jwtConfig.secret, {
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      }) as JWTPayload;

      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      logger.debug('Access token verification failed:', error);
      throw new Error('Invalid or expired token');
    }
  }

  verifyRefreshToken(token: string): JWTPayload {
    try {
      const payload = jwt.verify(token, jwtConfig.secret, {
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      }) as JWTPayload;

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      logger.debug('Refresh token verification failed:', error);
      throw new Error('Invalid or expired refresh token');
    }
  }

  decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch (error) {
      logger.debug('Token decode failed:', error);
      return null;
    }
  }
}

export default new JWTService();
