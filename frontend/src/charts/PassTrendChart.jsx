// PassTrendChart.jsx
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip text-xs">
      <p className="mb-1 text-content-muted">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value}%
        </p>
      ))}
    </div>
  );
};

export function PassTrendChart({ data }) {
  return (
    <div className="chart-surface">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="passGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1a52ff" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#1a52ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="deptCode" />
          <YAxis domain={[0, 100]} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="passPercentage"
            name="Pass %"
            stroke="#1a52ff"
            strokeWidth={2}
            fill="url(#passGrad)"
            dot={{ r: 3, fill: '#1a52ff' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
