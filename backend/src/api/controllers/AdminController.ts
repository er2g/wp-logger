import { Response } from 'express';
import bcrypt from 'bcrypt';
import { AuthRequest } from '../../types/api.types';
import userRepository from '../../services/database/repositories/UserRepository';
import jwtService from '../../services/auth/JWTService';
import { usernameSchema } from '../../utils/validation';
import logger from '../../utils/logger';

export class AdminController {
  async listUsers(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const users = await userRepository.list();
      res.json({
        success: true,
        data: users.map((user) => ({
          id: user.id,
          username: user.username,
          role: user.role,
          is_active: user.is_active,
          created_at: user.created_at,
          last_login: user.last_login,
        })),
      });
    } catch (error) {
      logger.error('Failed to list users:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list users',
      });
    }
  }

  async createUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { username, password, role, issueToken } = req.body as {
        username?: string;
        password?: string;
        role?: 'admin' | 'user';
        issueToken?: boolean;
      };

      if (!username) {
        res.status(400).json({
          success: false,
          error: 'Username is required',
        });
        return;
      }

      const usernameCheck = usernameSchema.safeParse(username);
      if (!usernameCheck.success) {
        res.status(400).json({
          success: false,
          error: usernameCheck.error.errors[0]?.message || 'Invalid username',
        });
        return;
      }

      if (!password || password.length < 8) {
        res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters',
        });
        return;
      }

      const existing = await userRepository.findByUsername(username);
      if (existing) {
        res.status(409).json({
          success: false,
          error: 'Username already exists',
        });
        return;
      }

      const userRole = role === 'admin' ? 'admin' : 'user';
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await userRepository.create(username, {
        role: userRole,
        passwordHash,
      });

      const response: any = {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      };

      if (issueToken) {
        response.accessToken = jwtService.generateAccessToken(user.id, user.username, user.role);
        response.expiresIn = '15m';
      }

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      logger.error('Failed to create user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create user',
      });
    }
  }

  async issueToken(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = await userRepository.findById(id);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      const accessToken = jwtService.generateAccessToken(user.id, user.username, user.role);
      res.json({
        success: true,
        data: {
          accessToken,
          expiresIn: '15m',
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to issue token:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to issue token',
      });
    }
  }

  async updateUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { password, role, is_active } = req.body as {
        password?: string;
        role?: 'admin' | 'user';
        is_active?: boolean;
      };

      const user = await userRepository.findById(id);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      if (typeof role === 'string' && role !== user.role) {
        await userRepository.updateRole(user.id, role === 'admin' ? 'admin' : 'user');
      }

      if (typeof is_active === 'boolean') {
        await userRepository.updateStatus(user.id, is_active);
      }

      if (typeof password === 'string') {
        if (password.length < 8) {
          res.status(400).json({
            success: false,
            error: 'Password must be at least 8 characters',
          });
          return;
        }
        const passwordHash = await bcrypt.hash(password, 10);
        await userRepository.updatePassword(user.id, passwordHash);
      }

      const updated = await userRepository.findById(user.id);
      res.json({
        success: true,
        data: {
          id: updated?.id,
          username: updated?.username,
          role: updated?.role,
          is_active: updated?.is_active,
        },
      });
    } catch (error) {
      logger.error('Failed to update user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update user',
      });
    }
  }
}

export default new AdminController();
