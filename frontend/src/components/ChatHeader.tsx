import { Menu } from 'lucide-react';

interface ChatHeaderProps {
  onOpenSidebar: () => void;
}

export default function ChatHeader({ onOpenSidebar }: ChatHeaderProps) {
  return (
    <header className="flex items-center gap-3 px-4 py-4 bg-white border-b border-slate-100 shadow-sm flex-shrink-0">
      {/* Hamburger — visible only on mobile */}
      <button
        onClick={onOpenSidebar}
        className="md:hidden p-2 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer"
        aria-label="Abrir panel lateral"
      >
        <Menu className="w-5 h-5 text-slate-600" />
      </button>

      {/* Status indicator */}
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
      </span>
      <span className="text-sm font-semibold text-slate-700 tracking-wide">Activo</span>

      {/* Right side info */}
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden sm:inline-block text-xs text-slate-400 font-medium">
          Asistente de Bienestar
        </span>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
          <span className="text-white text-xs font-bold">CP</span>
        </div>
      </div>
    </header>
  );
}
