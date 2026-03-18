import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface SimpleBarChartProps {
  data: Array<{ name: string; value: number; color?: string }>;
  height?: number;
  color?: string;
  layout?: 'horizontal' | 'vertical';
  variant?: 'modern' | 'classic';
}

export default function SimpleBarChart({
  data,
  height = 250,
  color = '#4a8af4',
  layout = 'horizontal',
  variant = 'modern',
}: SimpleBarChartProps) {
  const hasCustomColors = data.some((item) => item.color);
  const isClassic = variant === 'classic';

  if (layout === 'vertical') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 60, bottom: 5 }}
        >
          {!isClassic && (
            <defs>
              <linearGradient id="barVerticalGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={color} stopOpacity={0.82} />
                <stop offset="100%" stopColor="#2f6ee5" stopOpacity={1} />
              </linearGradient>
            </defs>
          )}
          <CartesianGrid strokeDasharray={isClassic ? '3 3' : '4 4'} stroke="#dbeafe" vertical={false} />
          <XAxis type="number" stroke="#94a3b8" tick={{ fill: '#475569', fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#94a3b8"
            tick={{ fill: '#475569', fontSize: 11 }}
            width={55}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isClassic ? '#fff' : '#0f172a',
              border: isClassic ? '1px solid #dbeafe' : '1px solid #1e3a8a',
              borderRadius: isClassic ? '8px' : '10px',
              boxShadow: isClassic ? '0 2px 8px rgba(0,0,0,0.08)' : '0 10px 30px rgba(15,23,42,0.35)',
            }}
            labelStyle={{ color: isClassic ? '#172554' : '#bfdbfe', fontWeight: 600 }}
            itemStyle={{ color: isClassic ? '#334155' : '#e2e8f0' }}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]}>
            {hasCustomColors
              ? data.map((entry, index) => <Cell key={index} fill={entry.color || color} />)
              : data.map((_, index) => <Cell key={index} fill={isClassic ? color : 'url(#barVerticalGradient)'} />)}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        {!isClassic && (
          <defs>
            <linearGradient id="barHorizontalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4a8af4" stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={0.8} />
            </linearGradient>
          </defs>
        )}
        <CartesianGrid strokeDasharray={isClassic ? '3 3' : '4 4'} stroke="#dbeafe" vertical={false} />
        <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#475569', fontSize: 12 }} />
        <YAxis stroke="#94a3b8" tick={{ fill: '#475569', fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: isClassic ? '#fff' : '#0f172a',
            border: isClassic ? '1px solid #dbeafe' : '1px solid #1e3a8a',
            borderRadius: isClassic ? '8px' : '10px',
            boxShadow: isClassic ? '0 2px 8px rgba(0,0,0,0.08)' : '0 10px 30px rgba(15,23,42,0.35)',
          }}
          labelStyle={{ color: isClassic ? '#172554' : '#bfdbfe', fontWeight: 600 }}
          itemStyle={{ color: isClassic ? '#334155' : '#e2e8f0' }}
        />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {hasCustomColors
            ? data.map((entry, index) => <Cell key={index} fill={entry.color || color} />)
            : data.map((_, index) => <Cell key={index} fill={isClassic ? color : 'url(#barHorizontalGradient)'} />)}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
