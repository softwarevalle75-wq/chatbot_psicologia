import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface SimplePieChartProps {
  data: Array<{ name: string; value: number; color: string }>;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
}

export default function SimplePieChart({
  data,
  height = 250,
  innerRadius = 45,
  outerRadius = 85,
}: SimplePieChartProps) {
  const radian = Math.PI / 180;

  const renderLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius: inner,
    outerRadius: outer,
    percent,
  }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
  }) => {
    const radius = inner + (outer - inner) * 1.25;
    const x = cx + radius * Math.cos(-midAngle * radian);
    const y = cy + radius * Math.sin(-midAngle * radian);

    if (percent < 0.05) return null;

    return (
      <text
        x={x}
        y={y}
        fill="#475569"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          dataKey="value"
          nameKey="name"
          labelLine={false}
          label={renderLabel}
          animationBegin={0}
          animationDuration={800}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} stroke="#fff" strokeWidth={2} />
          ))}
        </Pie>
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
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: '12px', color: '#334155', paddingTop: '6px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
