import { TrendingDown, TrendingUp } from 'lucide-react';
import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useId } from 'react';

function formatGrowth(growth) {
  if (growth === null || Number.isNaN(growth)) {
    return 'Baseline year';
  }

  const prefix = growth > 0 ? '+' : '';
  return `${prefix}${growth.toFixed(1)}% from last year`;
}

function getGrowthTone(growth) {
  if (growth === null || Number.isNaN(growth)) {
    return 'border-line/70 bg-panel-muted/70 text-content-secondary';
  }

  if (growth >= 0) {
    return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
  }

  return 'border-rose-400/20 bg-rose-400/10 text-rose-300';
}

function GrowthBadge({ growth }) {
  const tone = getGrowthTone(growth);
  const isPositive = growth === null || Number.isNaN(growth) || growth >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
      <Icon size={14} />
      {formatGrowth(growth)}
    </span>
  );
}

function AnalyticsTooltip({ active, payload, label, metricLabel, valueFormatter }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;

  return (
    <div className="chart-tooltip min-w-[12rem]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-content-muted">Year: {label}</p>
      <p className="mt-3 text-lg font-semibold text-content-primary">
        {metricLabel}: {valueFormatter(point?.value ?? 0)}
      </p>
      <p className="mt-1 text-sm text-content-secondary">
        Growth: {point?.growthLabel || 'Baseline year'}
      </p>
    </div>
  );
}

function GlowDot({ cx, cy, payload, isCurrent, colors }) {
  if (cx == null || cy == null) {
    return null;
  }

  const radius = isCurrent ? 6 : 4;
  const ringRadius = isCurrent ? 12 : 7;

  return (
    <g>
      <circle cx={cx} cy={cy} r={ringRadius} fill={colors.glow} opacity={isCurrent ? 0.4 : 0.22} />
      <circle cx={cx} cy={cy} r={radius} fill={isCurrent ? colors.currentDot : colors.dot} stroke={colors.dotStroke} strokeWidth={2} />
      {isCurrent ? (
        <circle cx={cx} cy={cy} r={ringRadius - 3} fill="none" stroke={colors.ring} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.9} />
      ) : null}
    </g>
  );
}

export default function DepartmentAnalyticsChart({
  title,
  subtitle,
  badge,
  metricLabel,
  trendLabel,
  data,
  valueKey,
  valueFormatter,
  yAxisFormatter,
  yDomain,
  emptyLabel,
  loading,
  colors,
}) {
  const chartId = useId().replace(/:/g, '');
  const fillId = `${chartId}-fill`;
  const strokeId = `${chartId}-stroke`;
  const hasData = data.length > 0;

  const enrichedData = data.map((item, index) => {
    const previousValue = index > 0 ? Number(data[index - 1][valueKey]) : null;
    const currentValue = Number(item[valueKey]);
    const growth = previousValue && previousValue !== 0
      ? ((currentValue - previousValue) / previousValue) * 100
      : null;

    return {
      ...item,
      value: currentValue,
      growth,
      growthLabel: formatGrowth(growth),
      isCurrent: index === data.length - 1,
    };
  });

  const currentPoint = enrichedData[enrichedData.length - 1];

  return (
    <section className="section card-hover chart-shell relative overflow-hidden p-5 sm:p-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background: `radial-gradient(circle at top left, ${colors.surfaceGlow}, transparent 40%), radial-gradient(circle at bottom right, ${colors.surfaceAccent}, transparent 36%)`,
        }}
      />

      <div className="relative z-[1] section-header">
        <div>
          <p className="section-title">{title}</p>
          <p className="section-subtitle">{subtitle}</p>
        </div>
        {badge ? <span className="badge badge-info">{badge}</span> : null}
      </div>

      <div className="relative z-[1] mt-5 flex flex-wrap items-end justify-between gap-4 rounded-3xl border border-white/5 bg-white/[0.03] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-content-muted">{trendLabel}</p>
          <p className="mt-2 text-3xl font-display font-bold tracking-tight text-content-primary">
            {currentPoint ? valueFormatter(currentPoint.value) : '--'}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <GrowthBadge growth={currentPoint?.growth ?? null} />
          <p className="text-xs text-content-muted">
            {metricLabel} trend across academic years
          </p>
        </div>
      </div>

      <div className="chart-surface relative z-[1] mt-5">
        {loading ? (
          <div className="skeleton h-[260px] w-full rounded-3xl" />
        ) : !hasData ? (
          <div className="empty-state h-[260px]">{emptyLabel}</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={enrichedData} margin={{ top: 14, right: 18, left: 6, bottom: 2 }}>
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.fillTop} stopOpacity={0.42} />
                  <stop offset="55%" stopColor={colors.fillMid} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={colors.fillBottom} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id={strokeId} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={colors.strokeStart} />
                  <stop offset="100%" stopColor={colors.strokeEnd} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(120, 140, 180, 0.18)" />
              <XAxis
                dataKey="year"
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                tick={{ fill: 'rgb(160, 174, 198)', fontSize: 12, fontWeight: 500 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                domain={yDomain}
                tickFormatter={yAxisFormatter}
                tick={{ fill: 'rgb(160, 174, 198)', fontSize: 12, fontWeight: 500 }}
              />
              <Tooltip
                cursor={{ stroke: colors.cursor, strokeWidth: 1.4, strokeDasharray: '4 4' }}
                content={
                  <AnalyticsTooltip
                    metricLabel={metricLabel}
                    valueFormatter={valueFormatter}
                  />
                }
              />

              <Area
                type="monotone"
                dataKey="value"
                fill={`url(#${fillId})`}
                stroke="none"
                animationDuration={1200}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={`url(#${strokeId})`}
                strokeWidth={3.5}
                dot={(props) => (
                  <GlowDot
                    {...props}
                    isCurrent={props.payload?.isCurrent}
                    colors={colors}
                  />
                )}
                activeDot={(props) => (
                  <GlowDot
                    {...props}
                    isCurrent
                    colors={colors}
                  />
                )}
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
