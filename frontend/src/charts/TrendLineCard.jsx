import { useId } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function TrendTooltip({ active, payload, label, metricLabel, valueFormatter }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;

  return (
    <div className="chart-tooltip min-w-[11rem]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-content-muted">
        Year {label}
      </p>
      <p className="mt-3 text-lg font-semibold text-content-primary">
        {metricLabel}: {valueFormatter(point?.value ?? 0)}
      </p>
    </div>
  );
}

function GlowDot({ cx, cy, payload, colors }) {
  if (cx == null || cy == null) {
    return null;
  }

  const isCurrent = Boolean(payload?.isCurrent);
  const radius = isCurrent ? 6 : 4;
  const glowRadius = isCurrent ? 13 : 8;

  return (
    <g>
      <circle cx={cx} cy={cy} r={glowRadius} fill={colors.glow} opacity={isCurrent ? 0.42 : 0.24} />
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={isCurrent ? colors.currentDot : colors.dot}
        stroke={colors.dotStroke}
        strokeWidth={2}
      />
      {isCurrent ? (
        <circle
          cx={cx}
          cy={cy}
          r={glowRadius - 3}
          fill="none"
          stroke={colors.ring}
          strokeWidth={1.5}
          strokeDasharray="4 4"
          opacity={0.92}
        />
      ) : null}
    </g>
  );
}

export default function TrendLineCard({
  title,
  subtitle,
  metricLabel,
  data,
  valueFormatter,
  yAxisFormatter,
  yDomain,
  loading,
  emptyLabel = 'No trend data available yet.',
  colors,
}) {
  const chartId = useId().replace(/:/g, '');
  const fillId = `${chartId}-fill`;
  const strokeId = `${chartId}-stroke`;
  const hasData = Array.isArray(data) && data.length > 0;
  const chartData = (data || []).map((item, index) => ({
    ...item,
    value: Number(item?.value ?? 0),
    isCurrent: index === (data?.length || 0) - 1,
  }));

  return (
    <section className="section card-hover chart-shell relative overflow-hidden p-5 sm:p-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background: `radial-gradient(circle at top left, ${colors.surfaceGlow}, transparent 42%), radial-gradient(circle at bottom right, ${colors.surfaceAccent}, transparent 36%)`,
        }}
      />

      <div className="relative z-[1]">
        <h3 className="section-title">{title}</h3>
        {subtitle ? <p className="section-subtitle mt-1">{subtitle}</p> : null}
      </div>

      <div className="chart-surface relative z-[1] mt-5">
        {loading ? (
          <div className="skeleton h-[250px] w-full rounded-3xl" />
        ) : !hasData ? (
          <div className="empty-state h-[250px]">{emptyLabel}</div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={chartData} margin={{ top: 14, right: 18, left: 2, bottom: 2 }}>
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.fillTop} stopOpacity={0.34} />
                  <stop offset="55%" stopColor={colors.fillMid} stopOpacity={0.14} />
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
                cursor={{ stroke: colors.cursor, strokeWidth: 1.35, strokeDasharray: '4 4' }}
                content={<TrendTooltip metricLabel={metricLabel} valueFormatter={valueFormatter} />}
              />

              <Area
                type="monotone"
                dataKey="value"
                stroke="none"
                fill={`url(#${fillId})`}
                animationDuration={1200}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={`url(#${strokeId})`}
                strokeWidth={3.25}
                dot={(props) => <GlowDot {...props} colors={colors} />}
                activeDot={(props) => <GlowDot {...props} colors={colors} />}
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
