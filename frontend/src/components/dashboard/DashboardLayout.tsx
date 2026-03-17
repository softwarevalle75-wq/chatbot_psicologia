import type { ReactNode } from 'react';
import DashboardSidebar from './DashboardSidebar';
import DashboardHeader from './DashboardHeader';

interface DashboardLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function DashboardLayout({ title, subtitle, children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-[#eef4ff] text-slate-800 font-['Inter',sans-serif]">
      <DashboardSidebar />
      <div className="lg:ml-72 min-h-screen flex flex-col">
        <DashboardHeader title={title} subtitle={subtitle} />
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
