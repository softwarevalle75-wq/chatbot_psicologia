import { useState, useEffect, useCallback, useRef } from 'react';
import type { Message } from '../types';
import { wsService } from '../services/websocket';
import type { BotMessage } from '../services/websocket';
import { useAuth } from '../context/AuthContext';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface UseChatReturn {
  messages: Message[];
  sendMessage: (text: string) => void;
  status: ConnectionStatus;
  isTyping: boolean;
}

let nextId = 1;

function generateTimestamp(): string {
  return new Date().toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * React hook that manages the chat WebSocket connection and message state.
 *
 * - Connects automatically when a token is available.
 * - Disconnects on logout / unmount.
 * - Shows a typing indicator between sending a user message and receiving the bot reply.
 */
export function useChat(): UseChatReturn {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isTyping, setIsTyping] = useState(false);
  const initializedSession = useRef(false);

  // Track whether we are waiting for a bot reply
  const awaitingReply = useRef(false);

  // ── Connect / disconnect based on token ────────────────
  useEffect(() => {
    if (!token) {
      wsService.disconnect();
      setStatus('disconnected');
      setMessages([]);
      setIsTyping(false);
      initializedSession.current = false;
      return;
    }

    setStatus('connecting');
    wsService.connect(token);

    const onConnected = (_data: unknown) => {
      setStatus('connected');

      if (!initializedSession.current) {
        initializedSession.current = true;

        // Al iniciar una nueva carga de página, forzamos reinicio de contexto
        // para evitar que el chat retome un estado viejo (ej. preguntas de test).
        awaitingReply.current = true;
        setIsTyping(true);
        wsService.send('__web_reset__');
      }
    };

    const onMessage = (data: unknown) => {
      const msg = data as BotMessage;

      // Bot replied, stop typing indicator
      awaitingReply.current = false;
      setIsTyping(false);

      setMessages((prev) => [
        ...prev,
        {
          id: String(nextId++),
          sender: 'bot',
          content: msg.body,
          timestamp: generateTimestamp(),
          // Attach extras for future use (buttons, media)
          ...(msg.buttons ? { buttons: msg.buttons } : {}),
          ...(msg.media ? { media: msg.media } : {}),
        } as Message,
      ]);
    };

    const onClose = () => {
      setStatus('disconnected');
      setIsTyping(false);
      awaitingReply.current = false;
    };

    const onReconnecting = () => {
      setStatus('reconnecting');
    };

    wsService.on('connected', onConnected);
    wsService.on('message', onMessage);
    wsService.on('close', onClose);
    wsService.on('reconnecting', onReconnecting);

    return () => {
      wsService.off('connected', onConnected);
      wsService.off('message', onMessage);
      wsService.off('close', onClose);
      wsService.off('reconnecting', onReconnecting);
      wsService.disconnect();
    };
  }, [token]);

  // ── Send a message ─────────────────────────────────────
  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || status !== 'connected') return;

      // Append user message to local state
      setMessages((prev) => [
        ...prev,
        {
          id: String(nextId++),
          sender: 'user',
          content: text,
          timestamp: generateTimestamp(),
        },
      ]);

      // Show typing indicator until bot replies
      awaitingReply.current = true;
      setIsTyping(true);

      // Send via WebSocket
      wsService.send(text);
    },
    [status],
  );

  return { messages, sendMessage, status, isTyping };
}
