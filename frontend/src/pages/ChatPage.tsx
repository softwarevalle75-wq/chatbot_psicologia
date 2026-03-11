import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import ChatPanel from '../components/ChatPanel';
import { useAuth } from '../context/AuthContext';

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout } = useAuth();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-['Inter',sans-serif]">
      <Sidebar
        onLogout={logout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <ChatPanel onOpenSidebar={() => setSidebarOpen(true)} />
    </div>
  );
}
