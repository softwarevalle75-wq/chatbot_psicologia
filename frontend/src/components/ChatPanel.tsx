import { useRef, useEffect } from 'react';
import ChatHeader from './ChatHeader';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import { useChat } from '../hooks/useChat';

interface ChatPanelProps {
  onOpenSidebar: () => void;
}

export default function ChatPanel({ onOpenSidebar }: ChatPanelProps) {
  const { messages, sendMessage, status, isTyping } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const isDisconnected = status === 'disconnected' || status === 'reconnecting';

  return (
    <main className="flex flex-col flex-1 h-full overflow-hidden bg-slate-50/60">
      {/* Header */}
      <ChatHeader onOpenSidebar={onOpenSidebar} />

      {/* Connection status banner */}
      {status === 'connecting' && (
        <div className="flex-shrink-0 px-4 py-2 text-center text-xs font-medium bg-amber-50 text-amber-700 border-b border-amber-200">
          Conectando al servidor...
        </div>
      )}
      {status === 'reconnecting' && (
        <div className="flex-shrink-0 px-4 py-2 text-center text-xs font-medium bg-amber-50 text-amber-700 border-b border-amber-200">
          Reconectando...
        </div>
      )}
      {status === 'disconnected' && (
        <div className="flex-shrink-0 px-4 py-2 text-center text-xs font-medium bg-red-50 text-red-600 border-b border-red-200">
          Desconectado del servidor
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5 chat-scroll">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex flex-col items-start gap-1">
            <span className="text-[10px] font-bold tracking-widest uppercase text-blue-500 px-1">
              PsicoBot
            </span>
            <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-5 py-3.5 shadow-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" />
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={isTyping || isDisconnected} />
    </main>
  );
}
