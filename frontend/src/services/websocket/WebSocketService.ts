const resolveWsUrl = () => {
  const explicitWsUrl = import.meta.env.VITE_WS_URL;
  if (explicitWsUrl) {
    return explicitWsUrl;
  }
  if (import.meta.env.DEV) {
    return 'ws://localhost:3000/ws';
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }
  return '/ws';
};

const WS_URL = resolveWsUrl();

type MessageHandler = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimeout: number = 5000;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private isAuthenticated: boolean = false;
  private accessToken: string | null = null;

  connect(accessToken: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.accessToken = accessToken;
        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;

          this.send('authenticate', { token: accessToken });

          const authTimeout = setTimeout(() => {
            if (!this.isAuthenticated) {
              reject(new Error('Authentication timeout'));
              this.disconnect();
            }
          }, 10000);

          const handleAuth = (data: any) => {
            clearTimeout(authTimeout);
            if (data.success) {
              this.isAuthenticated = true;
              resolve();
            } else {
              reject(new Error('Authentication failed'));
              this.disconnect();
            }
          };

          this.on('authenticated', handleAuth);
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.isAuthenticated = false;

          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
              this.reconnectAttempts++;
              if (this.accessToken) {
                this.connect(this.accessToken);
              }
            }, this.reconnectTimeout);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isAuthenticated = false;
      this.accessToken = null;
    }
  }

  send(type: string, data?: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    }
  }

  subscribe(groupIds: string[]): void {
    this.send('subscribe', { groupIds });
  }

  unsubscribe(groupIds: string[]): void {
    this.send('unsubscribe', { groupIds });
  }

  on(event: string, handler: MessageHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private handleMessage(message: any): void {
    const { type, data } = message;
    const handlers = this.handlers.get(type);

    if (handlers) {
      handlers.forEach((handler) => handler(data || message));
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.isAuthenticated;
  }
}

export default new WebSocketService();
