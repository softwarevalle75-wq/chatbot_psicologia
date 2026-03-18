import { type ReactNode, createContext, useContext, useState } from 'react';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';

interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  setIsCollapsed: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

interface DashboardLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function DashboardLayout({ title, subtitle, children }: DashboardLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      <div className="min-h-screen bg-[#eef4ff] text-slate-800 font-['Inter',sans-serif]">
        <DashboardSidebar />
        <div
          className={`min-h-screen flex flex-col transition-all duration-300 ${
            isCollapsed ? 'lg:ml-20' : 'lg:ml-72'
          }`}
        >
          <DashboardHeader title={title} subtitle={subtitle} />
          <main className="p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
