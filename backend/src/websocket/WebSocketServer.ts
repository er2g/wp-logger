import { Server as HTTPServer } from 'http';
import { WebSocketServer as WSServer, WebSocket } from 'ws';
import jwtService from '../services/auth/JWTService';
import logger from '../utils/logger';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  username?: string;
  subscribedGroups?: Set<string>;
}

export class WebSocketServer {
  private wss: WSServer | null = null;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private connectionCallbacks: ((ws: WebSocket) => void)[] = [];

  initialize(server: HTTPServer): void {
    this.wss = new WSServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: AuthenticatedWebSocket, _req) => {
      logger.info('New WebSocket connection');

      this.connectionCallbacks.forEach(cb => cb(ws));

      ws.subscribedGroups = new Set();

      const timeout = setTimeout(() => {
        if (!ws.userId) {
          logger.warn('WebSocket authentication timeout');
          ws.close(1008, 'Authentication timeout');
        }
      }, 10000);

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(ws, data, timeout);
        } catch (error) {
          logger.error('Invalid WebSocket message:', error);
          ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        if (ws.userId) {
          this.clients.delete(ws.userId);
          logger.info(`WebSocket client disconnected: ${ws.username}`);
        }
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });
    });

    logger.info('WebSocket server initialized');
  }

  onConnection(callback: (ws: WebSocket) => void): void {
    this.connectionCallbacks.push(callback);
  }

  private handleMessage(ws: AuthenticatedWebSocket, data: any, timeout: NodeJS.Timeout): void {
    switch (data.type) {
      case 'authenticate':
        this.handleAuthentication(ws, data.token, timeout);
        break;

      case 'subscribe':
        this.handleSubscribe(ws, data.groupIds);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(ws, data.groupIds);
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      default:
        ws.send(JSON.stringify({ type: 'error', error: 'Unknown message type' }));
    }
  }

  private handleAuthentication(ws: AuthenticatedWebSocket, token: string, timeout: NodeJS.Timeout): void {
    try {
      const payload = jwtService.verifyAccessToken(token);

      ws.userId = payload.userId;
      ws.username = payload.username;

      this.clients.set(payload.userId, ws);

      clearTimeout(timeout);

      ws.send(JSON.stringify({ type: 'authenticated', success: true }));

      logger.info(`WebSocket client authenticated: ${payload.username}`);
    } catch (error) {
      logger.error('WebSocket authentication failed:', error);
      ws.send(JSON.stringify({ type: 'authenticated', success: false, error: 'Invalid token' }));
      ws.close(1008, 'Authentication failed');
    }
  }

  private handleSubscribe(ws: AuthenticatedWebSocket, groupIds: string[]): void {
    if (!ws.userId) {
      ws.send(JSON.stringify({ type: 'error', error: 'Not authenticated' }));
      return;
    }

    groupIds.forEach((groupId) => {
      ws.subscribedGroups?.add(groupId);
    });

    logger.debug(`Client ${ws.username} subscribed to groups:`, groupIds);

    ws.send(JSON.stringify({ type: 'subscribed', groupIds }));
  }

  private handleUnsubscribe(ws: AuthenticatedWebSocket, groupIds: string[]): void {
    if (!ws.userId) {
      ws.send(JSON.stringify({ type: 'error', error: 'Not authenticated' }));
      return;
    }

    groupIds.forEach((groupId) => {
      ws.subscribedGroups?.delete(groupId);
    });

    logger.debug(`Client ${ws.username} unsubscribed from groups:`, groupIds);

    ws.send(JSON.stringify({ type: 'unsubscribed', groupIds }));
  }

  broadcast(type: string, data: any, groupId?: string): void {
    const message = JSON.stringify({ type, data });

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        if (!groupId || client.subscribedGroups?.has(groupId)) {
          client.send(message);
        }
      }
    });
  }

  sendToUser(userId: string, type: string, data: any): void {
    const client = this.clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type, data }));
    }
  }

  getConnectedClients(): number {
    return this.clients.size;
  }
}

export default new WebSocketServer();
