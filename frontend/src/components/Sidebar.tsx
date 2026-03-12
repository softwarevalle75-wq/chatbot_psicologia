import { LogOut, X } from 'lucide-react';
import logo from '../assets/loguito.png';

interface SidebarProps {
  onLogout?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ onLogout, isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile backdrop — tap outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          flex flex-col items-center h-full px-6 py-8
          bg-gradient-to-b from-blue-600 via-blue-500 to-indigo-600
          text-white select-none flex-shrink-0
          w-[80%] max-w-[320px]
          transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0 md:w-[30%] md:min-w-[260px] md:max-w-[340px]
          fixed top-0 left-0 z-40
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden self-end mb-2 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
          aria-label="Cerrar panel"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        {/* Avatar */}
        <div className="mt-2 mb-1">
          <img
            src={logo}
            alt="Logo Chatbot Psicologico"
            className="w-44 h-44 object-contain"
          />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-extrabold text-center leading-tight tracking-tight drop-shadow">
          Chatbot<br />Psicológico
        </h1>

        {/* Subtitle */}
        <p className="mt-2 text-sm font-medium tracking-widest uppercase text-white/60 text-center">
          Tu asistente virtual
        </p>

        {/* Divider */}
        <div className="mt-8 w-16 h-px bg-white/20 rounded-full" />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Logout button */}
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-rose-500 hover:bg-rose-400 active:bg-rose-600 text-white font-semibold text-sm shadow-lg shadow-rose-900/30 transition-all duration-200 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Cerrar Sesión
        </button>

        {/* Footer brand */}
        <p className="mt-5 text-xs text-white/30 font-medium tracking-wide">
          ChatBot para Psicología · v1
        </p>
      </aside>
    </>
  );
}
