import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface SimpleRadarChartProps {
  data: Array<{ name: string; value: number; max?: number }>;
  height?: number;
  color?: string;
}

export default function SimpleRadarChart({
  data,
  height = 300,
  color = '#2f6ee5',
}: SimpleRadarChartProps) {
  const maxValue = Math.max(
    ...data.map((item) => (typeof item.max === 'number' ? item.max : item.value)),
    1,
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#dbeafe" radialLines={false} />
        <PolarAngleAxis
          dataKey="name"
          tick={{ fill: '#475569', fontSize: 12 }}
          tickLine={false}
        />
        <PolarRadiusAxis
          angle={30}
          domain={[0, maxValue]}
          tick={{ fill: '#94a3b8', fontSize: 10 }}
          axisLine={false}
        />
        <Radar
          name="Perfil"
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.25}
          strokeWidth={2.5}
          dot={{ r: 3, fill: color }}
        />
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
      </RadarChart>
    </ResponsiveContainer>
  );
}
