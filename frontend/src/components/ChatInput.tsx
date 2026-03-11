import { useState } from 'react';
import { ArrowRight } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex-shrink-0 px-4 pt-3 pb-3 bg-white border-t border-slate-100">
      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all duration-200">
        {/* Textarea */}
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Escribe tu mensaje aquí..."
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-sm text-slate-700 placeholder-slate-400 leading-relaxed max-h-32 overflow-y-auto font-['Inter',sans-serif]"
          style={{ minHeight: '24px' }}
        />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          aria-label="Enviar mensaje"
          className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:bg-slate-200 disabled:cursor-not-allowed flex items-center justify-center shadow-md shadow-blue-200 transition-all duration-200 cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 text-white" strokeWidth={2.5} />
        </button>
      </div>

      {/* Footer hint */}
      <p className="text-center text-[10px] text-slate-400 mt-2 font-medium tracking-wide">
        ChatBot para Psicología · v1
      </p>
    </div>
  );
}
