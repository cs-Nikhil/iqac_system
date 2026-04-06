import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';

const data = [
  { year: 2020, CSE: 65, ECE: 60, MECH: 58, CIVIL: 55, IT: 59 },
  { year: 2021, CSE: 68, ECE: 62, MECH: 59, CIVIL: 56, IT: 60 },
  { year: 2022, CSE: 70, ECE: 64, MECH: 60, CIVIL: 57, IT: 61 },
  { year: 2023, CSE: 72, ECE: 66, MECH: 61, CIVIL: 58, IT: 62 },
  { year: 2024, CSE: 74, ECE: 68, MECH: 63, CIVIL: 60, IT: 64 },
];

const COLORS = {
  CSE: '#3b82f6',
  ECE: '#10b981',
  MECH: '#f59e0b',
  CIVIL: '#ef4444',
  IT: '#8b5cf6',
};

function CustomTooltip({ active, payload, label }) {
  const { isLightTheme } = useTheme();

  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="chart-tooltip min-w-[11rem]">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-content-muted">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full shadow-sm"
                style={{
                  backgroundColor: entry.color,
                  boxShadow: `0 0 8px ${entry.color}`,
                  outline: isLightTheme ? '1px solid rgba(255,255,255,0.9)' : '1px solid rgba(15,23,42,0.8)',
                }}
              />
              <span className="whitespace-nowrap text-sm font-semibold text-content-primary">
                {entry.name}
              </span>
            </div>
            <span className="text-sm font-bold" style={{ color: entry.color }}>
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomLegend({ payload }) {
  return (
    <ul className="flex flex-wrap justify-center gap-4 pt-4">
      {payload.map((entry, index) => (
        <li key={`item-${index}`} className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color, boxShadow: `0 0 6px ${entry.color}80` }}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-content-secondary">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function DepartmentPerformanceTrendChart() {
  const { isLightTheme } = useTheme();

  return (
    <div className="chart-surface">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <filter id="glow-line" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <CartesianGrid
            strokeDasharray="3 6"
            vertical={false}
            stroke={isLightTheme ? 'rgba(148,163,184,0.22)' : 'rgba(120,140,180,0.18)'}
          />
          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={false}
            tick={{ fill: isLightTheme ? '#64748b' : 'rgb(160, 174, 198)', fontSize: 12, fontWeight: 500 }}
            dy={10}
          />
          <YAxis
            domain={[50, 80]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: isLightTheme ? '#64748b' : 'rgb(160, 174, 198)', fontSize: 12, fontWeight: 500 }}
            dx={-10}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: '#3b82f6', strokeWidth: 1.35, strokeDasharray: '4 4' }}
          />
          <Legend content={<CustomLegend />} />

          {Object.entries(COLORS).map(([department, color]) => (
            <Line
              key={department}
              type="monotone"
              dataKey={department}
              stroke={color}
              strokeWidth={2.5}
              filter="url(#glow-line)"
              dot={{ r: 3.5, strokeWidth: 2, fill: isLightTheme ? '#ffffff' : '#0a0f1c' }}
              activeDot={{ r: 5, strokeWidth: 2, fill: color, stroke: '#ffffff' }}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
