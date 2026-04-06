import { useId } from 'react';
import { Activity, AlertTriangle, Trophy } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CGPA_BANDS = [
  {
    key: '0.0 - 3.9',
    shortLabel: '0-3.9',
    top: '#fb7185',
    bottom: '#dc2626',
    glow: 'rgba(244, 63, 94, 0.34)',
    text: 'text-rose-300',
    progress: 'from-rose-400 to-red-600',
    surface: 'from-rose-500/14 via-red-500/8 to-transparent',
    ring: 'ring-rose-400/20',
    dot: 'bg-rose-400',
  },
  {
    key: '4.0 - 4.9',
    shortLabel: '4-4.9',
    top: '#fb923c',
    bottom: '#ea580c',
    glow: 'rgba(249, 115, 22, 0.32)',
    text: 'text-orange-300',
    progress: 'from-orange-300 to-orange-600',
    surface: 'from-orange-500/14 via-orange-400/8 to-transparent',
    ring: 'ring-orange-400/20',
    dot: 'bg-orange-400',
  },
  {
    key: '5.0 - 5.9',
    shortLabel: '5-5.9',
    top: '#facc15',
    bottom: '#ca8a04',
    glow: 'rgba(250, 204, 21, 0.3)',
    text: 'text-yellow-300',
    progress: 'from-yellow-300 to-amber-500',
    surface: 'from-yellow-500/14 via-amber-400/8 to-transparent',
    ring: 'ring-yellow-400/20',
    dot: 'bg-yellow-400',
  },
  {
    key: '6.0 - 6.9',
    shortLabel: '6-6.9',
    top: '#60a5fa',
    bottom: '#2563eb',
    glow: 'rgba(59, 130, 246, 0.3)',
    text: 'text-blue-300',
    progress: 'from-sky-300 to-blue-600',
    surface: 'from-blue-500/14 via-sky-400/8 to-transparent',
    ring: 'ring-blue-400/20',
    dot: 'bg-blue-400',
  },
  {
    key: '7.0 - 7.9',
    shortLabel: '7-7.9',
    top: '#4ade80',
    bottom: '#16a34a',
    glow: 'rgba(34, 197, 94, 0.32)',
    text: 'text-green-300',
    progress: 'from-emerald-300 to-green-600',
    surface: 'from-green-500/14 via-emerald-400/8 to-transparent',
    ring: 'ring-green-400/20',
    dot: 'bg-green-400',
  },
  {
    key: '8.0 - 8.9',
    shortLabel: '8-8.9',
    top: '#c084fc',
    bottom: '#8b5cf6',
    glow: 'rgba(168, 85, 247, 0.3)',
    text: 'text-violet-300',
    progress: 'from-fuchsia-300 to-violet-600',
    surface: 'from-violet-500/14 via-fuchsia-400/8 to-transparent',
    ring: 'ring-violet-400/20',
    dot: 'bg-violet-400',
  },
  {
    key: '9.0 - 10.0',
    shortLabel: '9-10',
    top: '#34d399',
    bottom: '#059669',
    glow: 'rgba(16, 185, 129, 0.34)',
    text: 'text-emerald-300',
    progress: 'from-emerald-300 to-emerald-600',
    surface: 'from-emerald-500/14 via-teal-400/8 to-transparent',
    ring: 'ring-emerald-400/20',
    dot: 'bg-emerald-400',
  },
];

function roundTo(value, digits = 1) {
  return Number(Number(value || 0).toFixed(digits));
}

function getDeltaLabel(delta, suffix = 'vs previous term') {
  if (delta === null || Number.isNaN(delta)) {
    return 'Baseline';
  }

  const prefix = delta > 0 ? '+' : '';
  return `${prefix}${delta.toFixed(1)}% ${suffix}`;
}

function getDeltaTone(delta, positiveIsGood = true) {
  if (delta === null || Number.isNaN(delta)) {
    return 'border-line/70 bg-panel-muted/70 text-content-secondary';
  }

  const isPositive = delta >= 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;

  return isGood
    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    : 'border-rose-400/20 bg-rose-400/10 text-rose-300';
}

function DistributionTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;

  return (
    <div className="chart-tooltip min-w-[11rem]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-content-muted">
        CGPA Band
      </p>
      <p className="mt-2 text-sm font-semibold text-content-primary">{point?.range}</p>
      <p className="mt-3 text-lg font-semibold text-content-primary">
        {point?.count ?? 0} students
      </p>
      <p className="mt-1 text-sm text-content-secondary">{point?.percentage ?? 0}% of filtered cohort</p>
    </div>
  );
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;

  return (
    <div className="chart-tooltip min-w-[11rem]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-content-muted">{label}</p>
      <p className="mt-3 text-lg font-semibold text-content-primary">{roundTo(point?.avgCGPA, 2)}</p>
      <p className="mt-1 text-sm text-content-secondary">Average CGPA in this semester</p>
    </div>
  );
}

function TrendDot({ cx, cy, payload }) {
  if (cx == null || cy == null) {
    return null;
  }

  const isCurrent = Boolean(payload?.isCurrent);
  const glowRadius = isCurrent ? 12 : 8;
  const radius = isCurrent ? 5.5 : 4;

  return (
    <g>
      <circle cx={cx} cy={cy} r={glowRadius} fill="rgba(96, 165, 250, 0.28)" opacity={isCurrent ? 0.42 : 0.22} />
      <circle cx={cx} cy={cy} r={radius} fill={isCurrent ? '#dbeafe' : '#7dd3fc'} stroke="#0f172a" strokeWidth={2} />
      {isCurrent ? (
        <circle cx={cx} cy={cy} r={glowRadius - 3} fill="none" stroke="#93c5fd" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.92} />
      ) : null}
    </g>
  );
}

function KpiCard({ label, value, meta, icon: Icon, tone, indicator }) {
  return (
    <div className="section card-hover relative overflow-hidden p-5">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone.surface} opacity-90`} />
      <div className="relative z-[1] flex items-start justify-between gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${tone.ring} bg-white/[0.04] ${tone.text}`}>
          <Icon size={18} />
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${tone.badge}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${indicator}`} />
          {meta}
        </span>
      </div>
      <div className="relative z-[1] mt-5">
        <p className="metric-label">{label}</p>
        <p className={`mt-2 font-display text-3xl font-bold ${tone.text}`}>{value}</p>
      </div>
    </div>
  );
}

function DistributionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="section p-5">
            <div className="skeleton h-5 w-1/3" />
            <div className="skeleton mt-4 h-8 w-1/2" />
            <div className="skeleton mt-3 h-5 w-2/3" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="section p-5">
          <div className="skeleton h-5 w-1/3" />
          <div className="skeleton mt-2 h-4 w-1/2" />
          <div className="skeleton mt-4 h-[250px] w-full rounded-3xl" />
          <div className="mt-4 border-t border-line/70 pt-4">
            <div className="skeleton h-4 w-1/4" />
            <div className="skeleton mt-2 h-3 w-1/3" />
            <div className="skeleton mt-4 h-[150px] w-full rounded-3xl" />
          </div>
        </div>
        <div className="section p-5">
          <div className="skeleton h-5 w-1/3" />
          <div className="skeleton mt-2 h-4 w-2/3" />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skeleton h-24 rounded-3xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentProgressAnalytics({
  students,
  cgpaTrend,
  loading,
}) {
  const chartId = useId().replace(/:/g, '');
  const totalStudents = students.length;
  const averageCgpa = totalStudents
    ? students.reduce((sum, student) => sum + Number(student.cgpa || 0), 0) / totalStudents
    : 0;
  const topPerformers = students.filter((student) => Number(student.cgpa || 0) > 9).length;
  const atRiskStudents = students.filter((student) => (student.performanceCategory || (student.isAtRisk ? 'At Risk' : 'Good')) === 'At Risk').length;

  const normalizedDistribution = CGPA_BANDS.map((band) => {
    const count = students.filter((student) => {
      const cgpa = Number(student.cgpa || 0);

      if (band.key === '0.0 - 3.9') return cgpa >= 0 && cgpa < 4;
      if (band.key === '4.0 - 4.9') return cgpa >= 4 && cgpa < 5;
      if (band.key === '5.0 - 5.9') return cgpa >= 5 && cgpa < 6;
      if (band.key === '6.0 - 6.9') return cgpa >= 6 && cgpa < 7;
      if (band.key === '7.0 - 7.9') return cgpa >= 7 && cgpa < 8;
      if (band.key === '8.0 - 8.9') return cgpa >= 8 && cgpa < 9;
      return cgpa >= 9 && cgpa <= 10;
    }).length;

    return {
      ...band,
      count,
      percentage: totalStudents ? roundTo((count / totalStudents) * 100) : 0,
      gradientId: `${chartId}-${band.shortLabel.replace(/[^a-z0-9]/gi, '').toLowerCase()}`,
    };
  });

  const trendSeries = (cgpaTrend || []).map((item, index) => ({
    semester: `Sem ${item.semester}`,
    avgCGPA: roundTo(item.avgCGPA, 2),
    isCurrent: index === (cgpaTrend?.length || 0) - 1,
  }));
  const latestTrendPoint = trendSeries[trendSeries.length - 1];
  const previousTrendPoint = trendSeries.length > 1 ? trendSeries[trendSeries.length - 2] : null;
  const avgCgpaDelta =
    previousTrendPoint && previousTrendPoint.avgCGPA > 0
      ? ((latestTrendPoint.avgCGPA - previousTrendPoint.avgCGPA) / previousTrendPoint.avgCGPA) * 100
      : null;

  const kpis = [
    {
      label: 'Average CGPA',
      value: roundTo(averageCgpa, 2).toFixed(2),
      meta: getDeltaLabel(avgCgpaDelta),
      icon: Activity,
      tone: {
        text: 'text-blue-300',
        surface: 'from-sky-500/16 via-blue-500/8 to-transparent',
        ring: 'ring-blue-400/20',
        badge: getDeltaTone(avgCgpaDelta, true),
      },
      indicator: 'bg-blue-400',
    },
    {
      label: 'Top Performers',
      value: topPerformers.toLocaleString('en-IN'),
      meta: `${roundTo(totalStudents ? (topPerformers / totalStudents) * 100 : 0)}% of cohort`,
      icon: Trophy,
      tone: {
        text: 'text-emerald-300',
        surface: 'from-emerald-500/16 via-green-500/8 to-transparent',
        ring: 'ring-emerald-400/20',
        badge: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
      },
      indicator: 'bg-emerald-400',
    },
    {
      label: 'At Risk Students',
      value: atRiskStudents.toLocaleString('en-IN'),
      meta: `${roundTo(totalStudents ? (atRiskStudents / totalStudents) * 100 : 0)}% need support`,
      icon: AlertTriangle,
      tone: {
        text: 'text-rose-300',
        surface: 'from-rose-500/16 via-red-500/8 to-transparent',
        ring: 'ring-rose-400/20',
        badge: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
      },
      indicator: 'bg-rose-400',
    },
  ];

  if (loading) {
    return <DistributionSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <section className="section card-hover chart-shell relative h-full overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.14),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.1),transparent_34%)]" />
          <div className="relative z-[1]">
            <h3 className="section-title">CGPA Distribution</h3>
            <p className="section-subtitle mt-1">Color-coded student spread across academic performance bands</p>
          </div>

          <div className="relative z-[1] mt-4 flex flex-1 flex-col gap-4">
            <div className="chart-surface">
              {totalStudents === 0 ? (
                <div className="empty-state h-[250px]">No CGPA data is available for the selected filters.</div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={normalizedDistribution} barGap={10} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
                    <defs>
                    {normalizedDistribution.map((band) => (
                      <linearGradient key={band.gradientId} id={band.gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={band.top} stopOpacity={0.98} />
                        <stop offset="100%" stopColor={band.bottom} stopOpacity={0.9} />
                      </linearGradient>
                    ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(120, 140, 180, 0.18)" />
                    <XAxis
                      dataKey="shortLabel"
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
                      activeBar={{ stroke: 'rgba(255,255,255,0.26)', strokeWidth: 1.4, fillOpacity: 1 }}
                      animationDuration={1100}
                      animationEasing="ease-out"
                    >
                      {normalizedDistribution.map((band) => (
                        <Cell key={band.gradientId} fill={`url(#${band.gradientId})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="flex flex-1 flex-col border-t border-line/70 pt-4">
              <div className="px-1">
                <h4 className="text-sm font-semibold text-content-primary">Average CGPA Trend</h4>
                <p className="section-subtitle mt-1">Semester-wise academic progression</p>
              </div>

              <div className="chart-surface mt-4 flex min-h-[240px] flex-1">
                {trendSeries.length === 0 ? (
                  <div className="empty-state h-full w-full">Semester CGPA trend is not available for the selected filters.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendSeries} margin={{ top: 12, right: 8, left: -6, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`${chartId}-line`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#7dd3fc" />
                          <stop offset="100%" stopColor="#3b82f6" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(120, 140, 180, 0.18)" />
                      <XAxis
                        dataKey="semester"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={12}
                        tick={{ fill: 'rgb(160, 174, 198)', fontSize: 12, fontWeight: 500 }}
                      />
                      <YAxis
                        domain={[0, 10]}
                        tickCount={4}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        tick={{ fill: 'rgb(160, 174, 198)', fontSize: 12, fontWeight: 500 }}
                      />
                      <Tooltip
                        cursor={{ stroke: '#60a5fa', strokeWidth: 1.35, strokeDasharray: '4 4' }}
                        content={<TrendTooltip />}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgCGPA"
                        stroke={`url(#${chartId}-line)`}
                        strokeWidth={3}
                        dot={(props) => <TrendDot {...props} />}
                        activeDot={(props) => <TrendDot {...props} />}
                        animationDuration={1200}
                        animationEasing="ease-out"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="section card-hover chart-shell relative h-full overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(250,204,21,0.08),transparent_32%)]" />
          <div className="relative z-[1]">
            <h3 className="section-title">Performance Summary</h3>
            <p className="section-subtitle mt-1">Visual breakdown of student distribution across every CGPA range</p>
          </div>

          <div className="relative z-[1] mt-4 grid auto-rows-fr gap-3 md:grid-cols-2">
            {normalizedDistribution.map((band) => (
              <div
                key={band.key}
                className={`rounded-3xl border border-white/6 bg-gradient-to-br ${band.surface} p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-content-muted">CGPA Range</p>
                    <p className={`mt-2 text-base font-semibold ${band.text}`}>{band.key}</p>
                  </div>
                  <span className={`h-2.5 w-2.5 rounded-full ${band.dot}`} />
                </div>

                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-2xl font-display font-bold text-content-primary">{band.count}</p>
                    <p className="mt-1 text-xs text-content-muted">students</p>
                  </div>
                  <p className="text-sm font-semibold text-content-secondary">{band.percentage}%</p>
                </div>

                <div className="mt-4 h-2.5 overflow-hidden rounded-pill bg-panel-muted">
                  <div
                    className={`h-full rounded-pill bg-gradient-to-r ${band.progress}`}
                    style={{ width: `${Math.max(0, Math.min(band.percentage, 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

    </div>
  );
}
