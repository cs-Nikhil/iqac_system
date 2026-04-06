import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CATEGORY_STYLES = [
  { key: 'excellent', label: 'Excellent', fill: '#34d399', text: 'text-emerald-300' },
  { key: 'good', label: 'Good', fill: '#60a5fa', text: 'text-blue-300' },
  { key: 'average', label: 'Average', fill: '#fbbf24', text: 'text-amber-300' },
  { key: 'atRisk', label: 'At Risk', fill: '#fb7185', text: 'text-rose-300' },
];

function DistributionTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;

  return (
    <div className="chart-tooltip min-w-[11rem]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-content-muted">
        Performance Tier
      </p>
      <p className="mt-2 text-sm font-semibold text-content-primary">{point?.label}</p>
      <p className="mt-3 text-lg font-semibold text-content-primary">
        {point?.count ?? 0} students
      </p>
      <p className="mt-1 text-sm text-content-secondary">{point?.share ?? 0}% of total cohort</p>
    </div>
  );
}

export default function PerformanceDistributionChart({ distribution = {} }) {
  const data = CATEGORY_STYLES.map((category) => ({
    ...category,
    count: Number(distribution?.[category.key] ?? 0),
  }));
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const chartData = data.map((item) => ({
    ...item,
    share: total ? Number(((item.count / total) * 100).toFixed(1)) : 0,
  }));

  if (!total) {
    return <div className="empty-state min-h-[16rem]">Performance distribution is not available yet.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {chartData.map((item) => (
          <div key={item.key} className="surface-inset p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-content-muted">{item.label}</p>
            <p className={`mt-2 text-xl font-display font-bold ${item.text}`}>{item.count}</p>
          </div>
        ))}
      </div>

      <div className="chart-surface">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(120, 140, 180, 0.18)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              tick={{ fill: 'rgb(160, 174, 198)', fontSize: 12, fontWeight: 500 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tick={{ fill: 'rgb(160, 174, 198)', fontSize: 12, fontWeight: 500 }}
            />
            <Tooltip
              cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
              content={<DistributionTooltip />}
            />
            <Bar
              dataKey="count"
              radius={[14, 14, 6, 6]}
              activeBar={{ stroke: 'rgba(255,255,255,0.24)', strokeWidth: 1.4, fillOpacity: 1 }}
              animationDuration={1100}
              animationEasing="ease-out"
            >
              {chartData.map((item) => (
                <Cell key={item.key} fill={item.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
