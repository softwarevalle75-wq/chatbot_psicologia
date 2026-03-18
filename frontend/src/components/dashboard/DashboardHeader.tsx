import { useAuth } from '../../context/AuthContext';

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
}

export default function DashboardHeader({ title, subtitle }: DashboardHeaderProps) {
  const { user } = useAuth();

  return (
    <header className="h-20 px-6 lg:px-8 bg-white/90 backdrop-blur border-b border-blue-100 flex items-center justify-between">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-blue-950">{title}</h1>
        {subtitle ? <p className="text-sm text-blue-700/70 mt-0.5">{subtitle}</p> : null}
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-blue-900">{user?.correo || user?.id}</p>
        <p className="text-xs uppercase tracking-wide text-blue-600">{user?.role}</p>
      </div>
    </header>
  );
}
