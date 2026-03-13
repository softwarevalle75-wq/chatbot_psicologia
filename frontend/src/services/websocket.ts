/**
 * WebSocket service for communicating with the BuilderBot backend.
 *
 * - Connects to /ws?token=JWT on the backend (proxied by Vite in dev).
 * - Automatically reconnects with exponential back-off on unexpected close.
 * - Emits typed events via a simple listener pattern.
 */

export type WsEventType = 'connected' | 'message' | 'close' | 'error' | 'reconnecting';

export interface BotMessage {
  type: 'message';
  from: 'bot';
  body: string;
  timestamp: string;
  media?: string;
  buttons?: Array<{ body: string }>;
}

export interface ConnectedEvent {
  type: 'connected';
  phone: string;
  name: string;
}

export type WsIncoming = BotMessage | ConnectedEvent;

type WsListener = (data: unknown) => void;

const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 1_000;

const rawWsBase = import.meta.env.VITE_WS_BASE_URL?.trim();

function buildWebSocketBaseUrl(): string {
  if (!rawWsBase) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws`;
  }

  let base = rawWsBase.replace(/\/+$/, '');
  if (base.startsWith('https://')) base = `wss://${base.slice('https://'.length)}`;
  if (base.startsWith('http://')) base = `ws://${base.slice('http://'.length)}`;
  if (!/^wss?:\/\//.test(base)) {
    throw new Error('VITE_WS_BASE_URL debe iniciar con ws://, wss://, http:// o https://');
  }

  if (!base.endsWith('/ws')) {
    base = `${base}/ws`;
  }

  return base;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private listeners = new Map<WsEventType, Set<WsListener>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = INITIAL_RECONNECT_DELAY;
  private intentionalClose = false;

  /**
   * Connect to the backend WebSocket.
   * @param token JWT token for authentication
   */
  connect(token: string): void {
    // If already connected with the same token, skip
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.token === token) {
      return;
    }

    this.token = token;
    this.intentionalClose = false;
    this.clearReconnectTimer();
    this.closeExisting();

    const wsBase = buildWebSocketBaseUrl();
    const tokenSeparator = wsBase.includes('?') ? '&' : '?';
    const url = `${wsBase}${tokenSeparator}token=${encodeURIComponent(token)}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectDelay = INITIAL_RECONNECT_DELAY;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsIncoming;

        if (data.type === 'connected') {
          this.emit('connected', data);
        } else if (data.type === 'message') {
          this.emit('message', data);
        }
      } catch {
        console.warn('WS: Could not parse incoming message', event.data);
      }
    };

    this.ws.onclose = (event) => {
      this.emit('close', { code: event.code, reason: event.reason });

      if (!this.intentionalClose && this.token) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.emit('error', { message: 'WebSocket error' });
    };
  }

  /**
   * Send a text message to the bot.
   */
  send(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WS: Cannot send, socket not open');
      return;
    }
    this.ws.send(JSON.stringify({ text }));
  }

  /**
   * Gracefully disconnect. Will NOT attempt to reconnect.
   */
  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.closeExisting();
    this.token = null;
  }

  /**
   * Check if the WebSocket is currently open.
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ── Event system ──────────────────────────────────────────

  on(event: WsEventType, listener: WsListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: WsEventType, listener: WsListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit(event: WsEventType, data: unknown): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const fn of set) {
        try { fn(data); } catch (e) { console.error('WS listener error:', e); }
      }
    }
  }

  // ── Internal helpers ──────────────────────────────────────

  private closeExisting(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;

      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();

    this.emit('reconnecting', { delay: this.reconnectDelay });

    this.reconnectTimer = setTimeout(() => {
      if (this.token) {
        this.connect(this.token);
      }
    }, this.reconnectDelay);

    // Exponential back-off capped at MAX_RECONNECT_DELAY
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

/** Singleton instance */
export const wsService = new WebSocketService();
