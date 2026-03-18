import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconBgColor?: string;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  iconBgColor = 'bg-blue-600',
  subtitle,
  trend,
}: StatCardProps) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-white via-white to-blue-50/70 border border-blue-100/90 rounded-2xl p-5 shadow-[0_12px_30px_-20px_rgba(37,89,190,0.45)] hover:shadow-[0_18px_35px_-20px_rgba(37,89,190,0.6)] transition-all duration-300">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#2f6ee5] via-[#4a8af4] to-[#2559be]" />
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-blue-200/20 blur-2xl" />
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 truncate">{title}</p>
          <p className="text-3xl font-bold text-blue-950 mt-1 tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          {trend && (
            <div className="flex items-center mt-2">
              <span className={`text-sm font-semibold ${trend.isPositive ? 'text-green-600' : 'text-red-500'}`}>
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-slate-400 ml-1.5">vs periodo anterior</span>
            </div>
          )}
        </div>
        <div className={`${iconBgColor} p-3 rounded-xl shadow-[0_10px_20px_-10px_rgba(30,64,175,0.85)] flex-shrink-0 ml-3`}>
          <Icon className="w-7 h-7 text-white" />
        </div>
      </div>
    </div>
  );
}
