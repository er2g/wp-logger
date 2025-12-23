import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import groupsRoutes from './routes/groups.routes';
import messagesRoutes from './routes/messages.routes';
import mediaRoutes from './routes/media.routes';
import botRoutes from './routes/bot.routes';
import statsRoutes from './routes/stats.routes';
import exportRoutes from './routes/export.routes';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimit';
import logger from '../utils/logger';

dotenv.config();

export class ExpressServer {
  private app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000');
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandler();
  }

  private setupMiddleware(): void {
    this.app.set('trust proxy', 1);

    this.app.use(helmet());

    this.app.use(
      cors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'https://rammfire.com', 'http://rammfire.com'],
        credentials: true,
      })
    );

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    this.app.use(apiLimiter);

    this.app.use((req, _res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    this.app.get('/health', (_req, res) => {
      res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
      });
    });

    this.app.use('/api/v1/auth', authRoutes);
    this.app.use('/api/v1/groups', groupsRoutes);
    this.app.use('/api/v1/messages', messagesRoutes);
    this.app.use('/api/v1/media', mediaRoutes);
    this.app.use('/api/v1/bot', botRoutes);
    this.app.use('/api/v1/stats', statsRoutes);
    this.app.use('/api/v1/export', exportRoutes);

    this.app.use('*', (_req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
      });
    });
  }

  private setupErrorHandler(): void {
    this.app.use(errorHandler);
  }

  getApp(): Application {
    return this.app;
  }

  start(): void {
    this.app.listen(this.port, () => {
      logger.info(`Express server listening on port ${this.port}`);
    });
  }
}

export default new ExpressServer();
