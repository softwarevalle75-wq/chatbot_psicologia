import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface SimpleLineChartProps {
  data: Array<{ name: string; value: number }>;
  height?: number;
  color?: string;
}

export default function SimpleLineChart({
  data,
  height = 250,
  color = '#2f6ee5',
}: SimpleLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="lineGradientPrimary" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity={0.9} />
            <stop offset="100%" stopColor="#4a8af4" stopOpacity={1} />
          </linearGradient>
          <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#2f6ee5" floodOpacity="0.28" />
          </filter>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="#dbeafe" vertical={false} />
        <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#475569', fontSize: 12 }} tickLine={false} />
        <YAxis stroke="#94a3b8" tick={{ fill: '#475569', fontSize: 12 }} tickLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e3a8a',
            borderRadius: '10px',
            boxShadow: '0 10px 30px rgba(15,23,42,0.35)',
          }}
          labelStyle={{ color: '#bfdbfe', fontWeight: 600 }}
          itemStyle={{ color: '#e2e8f0' }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="url(#lineGradientPrimary)"
          strokeWidth={3}
          dot={{ fill: '#ffffff', stroke: color, strokeWidth: 2, r: 3.5 }}
          activeDot={{ r: 6, fill: color, stroke: '#fff', strokeWidth: 2 }}
          style={{ filter: 'url(#lineGlow)' }}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
