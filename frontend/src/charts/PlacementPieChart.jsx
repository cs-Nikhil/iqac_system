import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#1a52ff', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="chart-tooltip text-xs">
      <p className="font-medium text-content-primary">{d.name}</p>
      <p className="text-content-muted">{d.value} students placed</p>
      <p style={{ color: d.payload.fill }}>{d.payload.placementPercentage}% of dept</p>
    </div>
  );
};

export function PlacementPieChart({ data }) {
  if (!data?.length) return <div className="h-52 flex items-center justify-center text-slate-500 text-sm">No data</div>;

  const chartData = data.map(d => ({
    name: d.deptCode || d.deptName?.split(' ')[0],
    value: d.placedCount,
    placementPercentage: d.placementPercentage,
  }));

  return (
    <div className="chart-surface">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span className="text-xs text-content-muted">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
