import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';

const getGradientColors = (code) => {
  switch (code) {
    case 'CSE':
      return { start: '#60a5fa', end: '#2563eb' };
    case 'ECE':
      return { start: '#818cf8', end: '#4f46e5' };
    case 'MECH':
      return { start: '#c084fc', end: '#9333ea' };
    case 'CIVIL':
      return { start: '#38bdf8', end: '#0284c7' };
    case 'IT':
      return { start: '#a78bfa', end: '#7c3aed' };
    default:
      return { start: '#9ca3af', end: '#4b5563' };
  }
};

function DeptTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  const data = payload[0]?.payload;

  return (
    <div className="chart-tooltip rounded-xl transition-all duration-200">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-sm font-semibold text-content-primary">{data.department || label}</p>
        {data.isTop ? (
          <span className="rounded border border-amber-500/30 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-500">
            Top
          </span>
        ) : null}
      </div>

      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-2 text-sm font-medium text-content-secondary">
          <span
            className="h-2.5 w-2.5 rounded-full shadow-sm"
            style={{
              background: `linear-gradient(to bottom, ${getGradientColors(data.code).start}, ${getGradientColors(data.code).end})`,
            }}
          />
          Score: <span className="font-bold text-content-primary">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

function CustomLabel({ x, y, width, value, index, data, isLightTheme }) {
  const isTop = data[index]?.isTop;

  return (
    <g>
      <text
        x={x + width / 2}
        y={y - 8}
        fill={isTop ? '#f59e0b' : isLightTheme ? '#334155' : '#e2e8f0'}
        textAnchor="middle"
        fontSize={12}
        fontWeight="bold"
        className="drop-shadow-sm"
      >
        {value}
      </text>
      {isTop ? (
        <text
          x={x + width / 2}
          y={y - 24}
          fill="#f59e0b"
          textAnchor="middle"
          fontSize={10}
          fontWeight="bold"
          className="drop-shadow-md"
        >
          Top Performer
        </text>
      ) : null}
    </g>
  );
}

export function DepartmentRankingChart({ data }) {
  const { isLightTheme } = useTheme();

  if (!data?.length) {
    return <div className="flex h-52 items-center justify-center text-sm text-slate-500">No data</div>;
  }

  if (data.length === 1) {
    const department = data[0];
    const metrics = [
      { label: 'Pass Percentage', value: department.passPercentage, bar: 'from-brand-400 to-brand-600' },
      { label: 'Attendance', value: department.avgAttendance, bar: 'from-emerald-400 to-emerald-600' },
      { label: 'Placement', value: department.placementPercentage, bar: 'from-amber-300 to-orange-500' },
    ];

    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <div className="surface-inset flex min-h-[220px] flex-col justify-between p-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-content-muted">Department Score</p>
            <p className="mt-3 text-5xl font-display font-bold text-brand-300">{department.score}</p>
            <p className="mt-2 text-sm text-content-secondary">
              Composite score for {department.department}
            </p>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-brand-400/20 bg-brand-500/10 px-4 py-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-content-muted">Department</p>
              <p className="mt-1 text-sm font-semibold text-content-primary">{department.code}</p>
            </div>
            <span className="badge badge-info">Rank #{department.rank}</span>
          </div>
        </div>

        <div className="surface-inset min-h-[220px] p-5">
          <div className="grid gap-4">
            {metrics.map((metric) => (
              <div key={metric.label}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-[0.18em] text-content-muted">{metric.label}</span>
                  <span className="text-sm font-semibold text-content-primary">{metric.value}%</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-pill bg-panel-muted">
                  <div
                    className={`h-full rounded-pill bg-gradient-to-r ${metric.bar}`}
                    style={{ width: `${Math.max(0, Math.min(metric.value, 100))}%` }}
                  />
                </div>
              </div>
            ))}

            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="surface-inset rounded-2xl p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-content-muted">Research Papers</p>
                <p className="mt-2 text-2xl font-display font-bold text-content-primary">{department.researchPapers}</p>
              </div>
              <div className="surface-inset rounded-2xl p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-content-muted">Score Basis</p>
                <p className="mt-2 text-sm leading-6 text-content-secondary">
                  Built from pass percentage, attendance, placement outcomes, and research activity.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const maxScore = Math.max(...data.map((item) => Number(item.score) || 0));
  const chartData = data.map((item) => ({
    ...item,
    isTop: Number(item.score) === maxScore,
  }));

  return (
    <div className="chart-surface w-full">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 35, right: 10, left: -20, bottom: 5 }}>
          <defs>
            {chartData.map((entry) => {
              const colors = getGradientColors(entry.code);

              return (
                <linearGradient key={`grad-${entry.code}`} id={`grad-${entry.code}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.start} stopOpacity={1} />
                  <stop offset="100%" stopColor={colors.end} stopOpacity={0.82} />
                </linearGradient>
              );
            })}
          </defs>

          <CartesianGrid
            strokeDasharray="4 4"
            vertical={false}
            stroke={isLightTheme ? 'rgba(148,163,184,0.22)' : 'rgba(255,255,255,0.06)'}
          />
          <XAxis
            dataKey="code"
            stroke={isLightTheme ? '#94a3b8' : '#64748b'}
            tick={{ fill: isLightTheme ? '#64748b' : '#94a3b8', fontSize: 13, fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis
            domain={[0, 100]}
            stroke={isLightTheme ? '#94a3b8' : '#64748b'}
            tick={{ fill: isLightTheme ? '#64748b' : '#94a3b8', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            dx={-10}
          />
          <Tooltip
            content={<DeptTooltip />}
            cursor={{ fill: isLightTheme ? 'rgba(148,163,184,0.12)' : 'rgba(255,255,255,0.04)', radius: [6, 6, 0, 0] }}
          />
          <Bar
            dataKey="score"
            radius={[6, 6, 0, 0]}
            animationDuration={1500}
            animationEasing="ease-out"
            maxBarSize={80}
          >
            <LabelList
              dataKey="score"
              content={(props) => <CustomLabel {...props} data={chartData} isLightTheme={isLightTheme} />}
            />
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={`url(#grad-${entry.code})`}
                style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                className="hover:brightness-125 hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]"
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
