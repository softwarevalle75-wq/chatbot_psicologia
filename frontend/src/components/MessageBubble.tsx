import type { Message } from '../types';
import type { ReactNode } from 'react';

interface MessageBubbleProps {
  message: Message;
}

const formatLine = (line: string) => line.replace(/\s+$/g, '');

const isSeparator = (line: string) => {
  const cleaned = line.replace(/\s+/g, '');
  return cleaned.length >= 8 && /^[=\-_.•🧠👉⭐✨🔹]+$/.test(cleaned);
};

const extractNumberFromEmoji = (token: string) => {
  const emojiMap: Record<string, string> = {
    '0️⃣': '0',
    '1️⃣': '1',
    '2️⃣': '2',
    '3️⃣': '3',
    '4️⃣': '4',
    '5️⃣': '5',
    '6️⃣': '6',
    '7️⃣': '7',
    '8️⃣': '8',
    '9️⃣': '9',
  };
  return emojiMap[token] || token;
};

const matchOptionLine = (line: string) => {
  const trimmed = line.trim();
  const emojiMatch = trimmed.match(/^([0-9]️⃣)\s*(.+)$/);
  if (emojiMatch) {
    return { token: emojiMatch[1], text: emojiMatch[2] };
  }

  const numericMatch = trimmed.match(/^([0-9])\s*[).:\-]\s*(.+)$/);
  if (numericMatch) {
    return { token: numericMatch[1], text: numericMatch[2] };
  }

  return null;
};

const matchNumberedLine = (line: string) => {
  const trimmed = line.trim();
  const match = trimmed.match(/^([0-9]{1,2})\s*[).\-]\s*(.+)$/);
  if (!match) return null;
  return { index: match[1], text: match[2] };
};

const matchQuestionLine = (line: string) => {
  const trimmed = line.trim();
  const match = trimmed.match(/^([0-9]{1,2})\s*[).\-]\s*(.+\?)$/);
  if (!match) return null;
  return { index: match[1], text: match[2] };
};

const hasFollowingOptionLine = (lines: string[], fromIndex: number) => {
  const maxLookAhead = Math.min(fromIndex + 5, lines.length - 1);

  for (let idx = fromIndex + 1; idx <= maxLookAhead; idx += 1) {
    const line = lines[idx];
    const trimmed = line.trim();

    if (!trimmed) continue;
    if (isSeparator(line)) return false;

    return Boolean(matchOptionLine(line));
  }

  return false;
};

const parseInlineFormatting = (text: string) => {
  const tokenRegex = /(\*[^*\n]+\*|_[^_\n]+_)/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let index = 0;

  for (const match of text.matchAll(tokenRegex)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    const token = match[0];
    if (token.startsWith('*')) {
      nodes.push(<strong key={`b-${index++}`}>{token.slice(1, -1)}</strong>);
    } else {
      nodes.push(<em key={`i-${index++}`}>{token.slice(1, -1)}</em>);
    }

    lastIndex = start + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
};

const renderBotMessage = (content: string) => {
  const lines = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(formatLine);

  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        if (!line.trim()) {
          return <div key={`sp-${idx}`} className="h-1" />;
        }

        if (isSeparator(line)) {
          return <div key={`sep-${idx}`} className="my-1 border-t border-slate-300/70" />;
        }

        const questionLine = matchQuestionLine(line);
        const numberedLine = matchNumberedLine(line);
        const shouldRenderAsQuestionCard =
          Boolean(questionLine) ||
          (Boolean(numberedLine) && hasFollowingOptionLine(lines, idx));

        if (shouldRenderAsQuestionCard) {
          const questionData = questionLine || numberedLine;

          if (!questionData) return null;

          return (
            <div key={`q-${idx}`} className="flex items-start gap-2 rounded-lg bg-blue-50/80 px-2.5 py-2 border border-blue-200/80">
              <span className="shrink-0 inline-flex min-w-6 h-6 items-center justify-center rounded-md bg-blue-600 text-white text-[11px] font-semibold">
                ❓
              </span>
              <p className="whitespace-pre-wrap break-words text-slate-800 font-medium">
                <span className="text-blue-700 font-semibold mr-1">{questionData.index}.</span>
                {parseInlineFormatting(questionData.text)}
              </p>
            </div>
          );
        }

        const optionLine = matchOptionLine(line);
        if (optionLine) {
          const numericToken = extractNumberFromEmoji(optionLine.token);
          return (
            <div key={`opt-${idx}`} className="flex items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 border border-slate-200/80">
              <span className="shrink-0 inline-flex min-w-6 h-6 items-center justify-center rounded-md bg-slate-200 text-slate-700 text-[11px] font-semibold">
                {numericToken}
              </span>
              <p className="whitespace-pre-wrap break-words text-slate-800">
                {parseInlineFormatting(optionLine.text)}
              </p>
            </div>
          );
        }

        if (numberedLine) {
          return (
            <div key={`num-${idx}`} className="flex items-start gap-2">
              <span className="mt-0.5 text-[11px] font-bold text-blue-600">{numberedLine.index}.</span>
              <p className="whitespace-pre-wrap break-words flex-1">
                {parseInlineFormatting(numberedLine.text)}
              </p>
            </div>
          );
        }

        return (
          <p key={`ln-${idx}`} className="whitespace-pre-wrap break-words">
            {parseInlineFormatting(line)}
          </p>
        );
      })}
    </div>
  );
};

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
        {isBot ? renderBotMessage(message.content) : <span className="whitespace-pre-wrap break-words">{message.content}</span>}
      </div>

      {/* Timestamp */}
      <span className="text-[10px] text-slate-400 font-medium px-1">
        {message.timestamp}
      </span>
    </div>
  );
}
