import type { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isBot = message.sender === 'bot';

  return (
    <div className={`flex flex-col ${isBot ? 'items-start' : 'items-end'} gap-1`}>
      {/* Sender label */}
      <span
        className={`text-[10px] font-bold tracking-widest uppercase px-1 ${
          isBot ? 'text-blue-500' : 'text-indigo-400'
        }`}
      >
        {isBot ? 'PsicoBot' : 'Tú'}
      </span>

      {/* Bubble */}
      <div
        className={`max-w-[75%] px-5 py-3.5 rounded-2xl shadow-sm text-sm leading-relaxed ${
          isBot
            ? 'bg-white text-slate-700 rounded-tl-sm border border-slate-100'
            : 'bg-blue-500 text-white rounded-tr-sm shadow-blue-200'
        }`}
      >
        {message.content}
      </div>

      {/* Timestamp */}
      <span className="text-[10px] text-slate-400 font-medium px-1">
        {message.timestamp}
      </span>
    </div>
  );
}
