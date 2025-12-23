import { Response } from 'express';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';
import { AuthRequest, TokenResponse } from '../../types/api.types';
import userRepository from '../../services/database/repositories/UserRepository';
import webauthnService from '../../services/auth/WebAuthnService';
import jwtService from '../../services/auth/JWTService';
import logger from '../../utils/logger';

export class AuthController {
  async registerStart(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { username } = req.body;

      let user = await userRepository.findByUsername(username);

      if (!user) {
        user = await userRepository.create(username);
        logger.info(`New user created: ${username}`);
      }

      const options = await webauthnService.generateRegistrationOptions(
        username,
        user.id
      );

      res.json({
        success: true,
        data: options,
      });
    } catch (error) {
      logger.error('Registration start failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start registration',
      });
    }
  }

  async registerComplete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { username, credential } = req.body;

      const user = await userRepository.findByUsername(username);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      const verification = await webauthnService.verifyRegistration(
        username,
        credential
      );

      if (!verification.verified || !verification.registrationInfo) {
        res.status(400).json({
          success: false,
          error: 'Registration verification failed',
        });
        return;
      }

      const { credentialPublicKey, credentialID, counter } =
        verification.registrationInfo;

      const credentialIdBase64 =
        webauthnService.uint8ArrayToBase64(credentialID);
      const publicKeyBase64 =
        webauthnService.uint8ArrayToBase64(credentialPublicKey);

      await userRepository.saveCredential(
        user.id,
        credentialIdBase64,
        publicKeyBase64,
        Number(counter),
        null
      );

      const accessToken = jwtService.generateAccessToken(user.id, user.username);
      const refreshToken = jwtService.generateRefreshToken(user.id, user.username);

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      const response: TokenResponse = {
        accessToken,
        expiresIn: '15m',
        user: {
          id: user.id,
          username: user.username,
        },
      };

      logger.info(`User registered successfully: ${username}`);

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      logger.error('Registration completion failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete registration',
      });
    }
  }

  async loginStart(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { username } = req.body;

      const user = await userRepository.findByUsername(username);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      const credentials = await userRepository.findCredentialsByUserId(user.id);
      if (credentials.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No credentials found for this user',
        });
        return;
      }

      const allowCredentials = credentials.map((cred) => ({
        id: cred.credential_id,
        type: 'public-key' as const,
        transports: (cred.transports || undefined) as AuthenticatorTransportFuture[] | undefined,
      }));

      const options = await webauthnService.generateAuthenticationOptions(
        username,
        allowCredentials
      );

      res.json({
        success: true,
        data: options,
      });
    } catch (error) {
      logger.error('Login start failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start login',
      });
    }
  }

  async loginComplete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { username, assertion } = req.body;

      const user = await userRepository.findByUsername(username);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      const credentialIdBase64 = assertion.id;
      const credential = await userRepository.findCredentialByCredentialId(
        credentialIdBase64
      );

      if (!credential) {
        res.status(400).json({
          success: false,
          error: 'Credential not found',
        });
        return;
      }

      const publicKey = webauthnService.base64ToUint8Array(credential.public_key);
      const counter = Number(credential.counter);

      const verification = await webauthnService.verifyAuthentication(
        username,
        assertion,
        publicKey,
        counter
      );

      if (!verification.verified) {
        res.status(401).json({
          success: false,
          error: 'Authentication verification failed',
        });
        return;
      }

      await userRepository.updateCredentialCounter(
        credentialIdBase64,
        verification.authenticationInfo.newCounter
      );

      await userRepository.updateLastLogin(user.id);

      const accessToken = jwtService.generateAccessToken(user.id, user.username);
      const refreshToken = jwtService.generateRefreshToken(user.id, user.username);

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      const response: TokenResponse = {
        accessToken,
        expiresIn: '15m',
        user: {
          id: user.id,
          username: user.username,
        },
      };

      logger.info(`User logged in successfully: ${username}`);

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      logger.error('Login completion failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete login',
      });
    }
  }

  async passwordLogin(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { password } = req.body;
      if (!password) {
        res.status(400).json({
          success: false,
          error: 'Password is required',
        });
        return;
      }

      const expectedPassword = process.env.ADMIN_PASSWORD;
      if (!expectedPassword) {
        logger.error('ADMIN_PASSWORD is not set');
        res.status(500).json({
          success: false,
          error: 'Password login is not configured',
        });
        return;
      }

      if (password !== expectedPassword) {
        res.status(401).json({
          success: false,
          error: 'Invalid password',
        });
        return;
      }

      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      let user = await userRepository.findByUsername(adminUsername);
      if (!user) {
        user = await userRepository.create(adminUsername);
      }

      await userRepository.updateLastLogin(user.id);

      const sessionExpiry = process.env.ADMIN_SESSION_EXPIRY || '30d';
      const accessToken = jwtService.generateAccessToken(
        user.id,
        user.username,
        sessionExpiry
      );

      const maxAge = 30 * 24 * 60 * 60 * 1000;
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge,
      });

      const response: TokenResponse = {
        accessToken,
        expiresIn: sessionExpiry,
        user: {
          id: user.id,
          username: user.username,
        },
      };

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      logger.error('Password login failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to login',
      });
    }
  }

  async logout(_req: AuthRequest, res: Response): Promise<void> {
    res.clearCookie('refreshToken');
    res.clearCookie('accessToken');
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }

  async me(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
        return;
      }

      const user = await userRepository.findById(req.user.userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          createdAt: user.created_at,
          lastLogin: user.last_login,
        },
      });
    } catch (error) {
      logger.error('Get user info failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user info',
      });
    }
  }
}

export default new AuthController();
