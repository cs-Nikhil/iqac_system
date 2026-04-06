import { Bot, Download, FileText, Maximize2, User } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const formatLabel = (value = '') =>
  String(value)
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();

const formatCellValue = (value) => {
  if (value == null || value === '') return 'N/A';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const safeParseJson = (value = '') => {
  const trimmed = String(value || '').trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return null;
  }
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isRecommendationPayload = (payload = {}) =>
  payload.intent === 'recommendation' &&
  Array.isArray(payload.insights) &&
  Array.isArray(payload.recommendations);

const isQueryRoutingPayload = (payload = {}) =>
  (payload.route === 'local' || payload.route === 'llm') &&
  typeof payload.reason === 'string' &&
  typeof payload.confidence === 'number';

const isQueryPlanPayload = (payload = {}) =>
  typeof payload.entity === 'string' &&
  typeof payload.intent === 'string' &&
  typeof payload.primary_table === 'string' &&
  Array.isArray(payload.joins) &&
  Array.isArray(payload.filters) &&
  Array.isArray(payload.fields_required);

const isReportPlanPayload = (payload = {}) =>
  (payload.type === 'report' || payload.type === 'data') &&
  (typeof payload.entity === 'string' || payload.entity === null) &&
  isPlainObject(payload.filters) &&
  (payload.sort === null || isPlainObject(payload.sort)) &&
  (typeof payload.limit === 'number' || payload.limit === null) &&
  !('intent' in payload) &&
  !('primary_table' in payload) &&
  !('report_structure' in payload);

const isQueryUnderstandingPayload = (payload = {}) =>
  (typeof payload.entity === 'string' || payload.entity === null) &&
  isPlainObject(payload.filters) &&
  (payload.sort === null || isPlainObject(payload.sort)) &&
  (typeof payload.limit === 'number' || payload.limit === null) &&
  typeof payload.hasFilters === 'boolean' &&
  !('type' in payload) &&
  !('intent' in payload) &&
  !('primary_table' in payload) &&
  !('report_structure' in payload);

const getStructuredPayload = (message = {}) => {
  if (message.type !== 'text' || message.sender === 'user') {
    return null;
  }

  const parsed = isPlainObject(message.structuredPayload)
    ? message.structuredPayload
    : safeParseJson(message.text);
  if (!isPlainObject(parsed)) {
    return null;
  }

  if (
    isRecommendationPayload(parsed) ||
    isQueryRoutingPayload(parsed) ||
    isQueryPlanPayload(parsed) ||
    isReportPlanPayload(parsed) ||
    isQueryUnderstandingPayload(parsed)
  ) {
    return parsed;
  }

  return null;
};

const KeyValueGrid = ({ data = {}, columns = 'sm:grid-cols-2 lg:grid-cols-3' }) => {
  const entries = Object.entries(data).filter(
    ([, value]) => value !== null && value !== undefined && value !== ''
  );

  if (!entries.length) {
    return null;
  }

  return (
    <div className={`grid gap-3 ${columns}`}>
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {formatLabel(key)}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {formatCellValue(value)}
          </p>
        </div>
      ))}
    </div>
  );
};

const BulletList = ({ items = [], tone = 'slate' }) => {
  if (!items.length) {
    return null;
  }

  const toneClass =
    tone === 'blue'
      ? 'border-blue-200/70 bg-blue-50/60'
      : tone === 'emerald'
        ? 'border-emerald-200/70 bg-emerald-50/60'
        : 'border-slate-200/80 bg-slate-50/70';

  return (
    <div className="grid gap-2">
      {items.map((item, index) => (
        <div
          key={`${String(item)}-${index}`}
          className={`rounded-2xl border p-3 text-sm leading-relaxed text-slate-700 ${toneClass}`}
        >
          {String(item)}
        </div>
      ))}
    </div>
  );
};

const TokenList = ({ items = [] }) => {
  if (!items.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={String(item)}
          className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
        >
          {formatCellValue(item)}
        </span>
      ))}
    </div>
  );
};

const SectionBlock = ({ title, children }) => {
  if (!children) {
    return null;
  }

  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-white/80 p-4 shadow-sm">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">
        {title}
      </p>
      {children}
    </div>
  );
};

const RecommendationCard = ({ payload }) => (
  <div className="grid gap-4">
    <div className="rounded-[24px] border border-blue-200/60 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
      <p className="text-lg font-bold text-slate-900">Performance Recommendations</p>
      <p className="mt-1 text-sm text-slate-500">
        Actionable insights and next steps based on the detected student context.
      </p>
    </div>

    <SectionBlock title="Insights">
      <BulletList items={payload.insights} tone="blue" />
    </SectionBlock>

    <SectionBlock title="Recommendations">
      <BulletList items={payload.recommendations} tone="emerald" />
    </SectionBlock>
  </div>
);

const QueryRoutingCard = ({ payload }) => (
  <div className="grid gap-4">
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-lg font-bold text-slate-900">Query Routing</p>
      <p className="mt-1 text-sm text-slate-500">
        Recommended execution path for the query router.
      </p>
    </div>

    <SectionBlock title="Decision">
      <KeyValueGrid
        data={{
          route: payload.route,
          confidence: payload.confidence,
        }}
        columns="sm:grid-cols-2"
      />
    </SectionBlock>

    <SectionBlock title="Reason">
      <p className="text-sm leading-relaxed text-slate-700">{payload.reason}</p>
    </SectionBlock>
  </div>
);

const QueryPlanCard = ({ payload }) => (
  <div className="grid gap-4">
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-lg font-bold text-slate-900">Database Query Plan</p>
      <p className="mt-1 text-sm text-slate-500">
        Planned entity, joins, filters, and required fields.
      </p>
    </div>

    <SectionBlock title="Overview">
      <KeyValueGrid
        data={{
          intent: payload.intent,
          entity: payload.entity,
          primary_table: payload.primary_table,
        }}
      />
    </SectionBlock>

    <SectionBlock title="Joins">
      <DataTable rows={payload.joins || []} />
    </SectionBlock>

    <SectionBlock title="Filters">
      <DataTable rows={payload.filters || []} />
    </SectionBlock>

    <SectionBlock title="Fields Required">
      <TokenList items={payload.fields_required || []} />
    </SectionBlock>
  </div>
);

const ReportPlanCard = ({ payload }) => (
  <div className="grid gap-4">
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-lg font-bold text-slate-900">Report Query Plan</p>
      <p className="mt-1 text-sm text-slate-500">
        Extracted query logic with report intent attached separately.
      </p>
    </div>

    <SectionBlock title="Overview">
      <KeyValueGrid
        data={{
          type: payload.type,
          entity: payload.entity,
          limit: payload.limit === null ? 'None' : payload.limit,
        }}
      />
    </SectionBlock>

    <SectionBlock title="Filters">
      {Object.keys(payload.filters || {}).length ? (
        <KeyValueGrid data={payload.filters || {}} columns="sm:grid-cols-2" />
      ) : (
        <p className="text-sm text-slate-500">No explicit filters detected.</p>
      )}
    </SectionBlock>

    <SectionBlock title="Sorting">
      {payload.sort ? (
        <KeyValueGrid data={payload.sort} columns="sm:grid-cols-2" />
      ) : (
        <p className="text-sm text-slate-500">No explicit sorting detected.</p>
      )}
    </SectionBlock>
  </div>
);

const QueryUnderstandingCard = ({ payload }) => {
  const filterRows = Object.entries(payload.filters || {}).map(([field, value]) => ({
    field,
    ...(isPlainObject(value) ? value : { value }),
  }));

  return (
    <div className="grid gap-4">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-lg font-bold text-slate-900">Query Understanding</p>
        <p className="mt-1 text-sm text-slate-500">
          Extracted entity, filters, sorting, and limit from the query.
        </p>
      </div>

      <SectionBlock title="Overview">
        <KeyValueGrid
          data={{
            entity: payload.entity,
            limit: payload.limit === null ? 'None' : payload.limit,
            has_filters: payload.hasFilters,
          }}
        />
      </SectionBlock>

      <SectionBlock title="Filters">
        {filterRows.length ? (
          <DataTable rows={filterRows} />
        ) : (
          <p className="text-sm text-slate-500">No explicit filters detected.</p>
        )}
      </SectionBlock>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionBlock title="Sorting">
          {payload.sort ? (
            <KeyValueGrid data={payload.sort} columns="sm:grid-cols-2" />
          ) : (
            <p className="text-sm text-slate-500">No explicit sorting detected.</p>
          )}
        </SectionBlock>
      </div>
    </div>
  );
};

const StructuredPayloadCard = ({ payload }) => {
  if (isRecommendationPayload(payload)) {
    return <RecommendationCard payload={payload} />;
  }

  if (isQueryRoutingPayload(payload)) {
    return <QueryRoutingCard payload={payload} />;
  }

  if (isQueryPlanPayload(payload)) {
    return <QueryPlanCard payload={payload} />;
  }

  if (isReportPlanPayload(payload)) {
    return <ReportPlanCard payload={payload} />;
  }

  if (isQueryUnderstandingPayload(payload)) {
    return <QueryUnderstandingCard payload={payload} />;
  }

  return null;
};

const getRowEntries = (row = {}) =>
  Object.entries(row).filter(([key]) => key !== '_id' && key !== '__v');

const DataTable = ({ rows = [] }) => {
  if (!rows.length) return null;

  const columns = Array.from(
    rows.reduce((set, row) => {
      getRowEntries(row).forEach(([key]) => set.add(key));
      return set;
    }, new Set())
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white/50 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-xs text-slate-700">
          <thead className="bg-slate-100/80 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column} className="whitespace-nowrap px-4 py-2.5 font-bold">
                  {formatLabel(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, rowIndex) => (
              <tr
                key={row.id || row._id || rowIndex}
                className="transition-colors hover:bg-slate-50/50"
              >
                {columns.map((column) => (
                  <td key={column} className="px-4 py-2 align-top leading-relaxed">
                    {formatCellValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SummaryGrid = ({ summary = {}, compact = false }) => {
  const entries = Object.entries(summary).filter(
    ([, value]) => value !== null && value !== undefined && value !== ''
  );
  if (!entries.length) return null;

  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'}`}>
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="rounded-2xl border border-blue-100/50 bg-blue-50/40 p-4 backdrop-blur-sm"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/80">
            {formatLabel(key)}
          </p>
          <p className="mt-1 text-lg font-bold text-slate-900">
            {formatCellValue(value)}
          </p>
        </div>
      ))}
    </div>
  );
};

const REPORT_CHART_COLORS = [
  '#2563eb',
  '#0f766e',
  '#f59e0b',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#16a34a',
  '#ea580c',
];

const getReportChartColor = (index = 0) =>
  REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length];

const formatMetricValue = (value, format = 'number') => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return formatCellValue(value);
  }

  if (format === 'integer') {
    return String(Math.round(numericValue));
  }

  if (format === 'percentage') {
    return `${numericValue.toFixed(2).replace(/\.00$/, '')}%`;
  }

  return numericValue.toFixed(2).replace(/\.00$/, '');
};

const normalizeReportChartData = (chart = {}) =>
  Array.isArray(chart.data)
    ? chart.data.filter((row) => row && typeof row === 'object')
    : [];

const ReportChartCard = ({ chart = {}, compact = false }) => {
  const data = normalizeReportChartData(chart);
  if (!data.length) {
    return null;
  }

  const type = chart.type || 'bar';
  const xKey = chart.xKey || chart.nameKey || 'label';
  const yKey = chart.yKey || chart.valueKey || 'value';
  const nameKey = chart.nameKey || xKey;
  const valueKey = chart.valueKey || yKey;

  return (
    <div className="rounded-[22px] border border-slate-200/70 bg-white/80 p-4 shadow-sm">
      <div className="mb-3">
        <p className="text-sm font-semibold text-slate-900">
          {chart.title || 'Chart'}
        </p>
        <p className="text-[11px] uppercase tracking-widest text-slate-500">
          {chart.subtitle || formatLabel(type)}
        </p>
      </div>

      <div className={compact ? 'h-64' : 'h-72'}>
        <ResponsiveContainer width="100%" height="100%">
          {type === 'pie' ? (
            <PieChart>
              <Pie
                data={data.map((row, index) => ({
                  ...row,
                  fill: getReportChartColor(index),
                }))}
                dataKey={valueKey}
                nameKey={nameKey}
                innerRadius={55}
                outerRadius={92}
                paddingAngle={3}
              >
                {data.map((row, index) => (
                  <Cell
                    key={`${chart.id || chart.title || 'pie'}-${String(row[nameKey])}-${index}`}
                    fill={getReportChartColor(index)}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatMetricValue(value, chart.format)} />
              <Legend />
            </PieChart>
          ) : type === 'horizontalBar' ? (
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 10, right: 16, left: 24, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey={xKey}
                tick={{ fontSize: 11 }}
                width={120}
              />
              <Tooltip formatter={(value) => formatMetricValue(value, chart.format)} />
              <Bar dataKey={yKey} fill="#2563eb" radius={[0, 8, 8, 0]} />
            </BarChart>
          ) : type === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatMetricValue(value, chart.format)} />
              <Line
                type="monotone"
                dataKey={yKey}
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatMetricValue(value, chart.format)} />
              <Bar dataKey={yKey} fill="#2563eb" radius={[8, 8, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const HighlightGrid = ({ items = [], compact = false }) => {
  if (!items.length) {
    return null;
  }

  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'}`}>
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {item.label}
          </p>
          <p className="mt-2 text-base font-semibold text-slate-900">
            {formatCellValue(item.value)}
          </p>
        </div>
      ))}
    </div>
  );
};

const deriveFallbackAnswerCard = (message = {}) => {
  if (message.answerCard && typeof message.answerCard === 'object') {
    return message.answerCard;
  }

  if (message.type === 'count') {
    return {
      headline: message.title || 'Count',
      summary: message.text || '',
      highlights: [
        {
          label: 'Count',
          value:
            message.meta?.count ??
            message.meta?.totalRecords ??
            message.value ??
            message.total ??
            '0',
        },
      ],
      table: [],
      chart: null,
      tableTitle: message.title || 'Count',
    };
  }

  if (['data', 'table', 'top_performers'].includes(message.type) && (message.rows?.length || message.summaryText)) {
    return {
      headline: message.title || 'Structured Answer',
      summary: message.summaryText || message.text || '',
      highlights: [],
      table: message.rows || [],
      chart: null,
      tableTitle: message.title || 'Supporting Data',
    };
  }

  return null;
};

const AnswerCard = ({
  message,
  compact = false,
  onFocusMessage = null,
  onAnswerAction = null,
}) => {
  const card = deriveFallbackAnswerCard(message);
  if (!card) {
    return null;
  }

  const highlights = Array.isArray(card.highlights) ? card.highlights.filter(Boolean) : [];
  const supportingRows = Array.isArray(card.table) ? card.table : [];
  const actions = Array.isArray(card.actions) ? card.actions.filter(Boolean) : [];
  const supportingChart =
    card.chart && Array.isArray(card.chart.data) && card.chart.data.length
      ? card.chart
      : null;

  return (
    <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
      <div className="border-b border-slate-200 bg-gradient-to-r from-white via-slate-50 to-blue-50/70 px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            {message.title ? (
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600/75">
                {message.title}
              </p>
            ) : null}
            <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
              {card.headline || message.title || 'Structured Answer'}
            </h3>
            {card.summary ? (
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                {card.summary}
              </p>
            ) : null}
          </div>

          {typeof onFocusMessage === 'function' ? (
            <button
              type="button"
              onClick={onFocusMessage}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Maximize2 size={14} className="text-blue-500" />
              Expand
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 px-5 py-5 sm:px-6 sm:py-6">
        <HighlightGrid items={highlights} compact={compact} />

        {actions.length ? (
          <div className="flex flex-wrap gap-3">
            {actions.map((action, index) => (
              <button
                key={`${action.label || 'action'}-${index}`}
                type="button"
                onClick={() => onAnswerAction?.(action)}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={typeof onAnswerAction !== 'function'}
              >
                {action.label || 'Open'}
              </button>
            ))}
          </div>
        ) : null}

        {supportingChart ? (
          <div className="rounded-[24px] border border-slate-200 bg-white/80 p-5 shadow-sm">
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">
              Visual Summary
            </p>
            <ReportChartCard chart={supportingChart} compact={compact} />
          </div>
        ) : null}

        {supportingRows.length ? (
          <div className="rounded-[24px] border border-slate-200 bg-white/80 p-5 shadow-sm">
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">
              {card.tableTitle || 'Supporting Data'}
            </p>
            <DataTable rows={supportingRows} />
          </div>
        ) : null}
      </div>
    </div>
  );
};

const normalizeInsightPoints = (insights = {}) => {
  if (Array.isArray(insights.points) && insights.points.length) {
    return insights.points;
  }

  return [
    ...(Array.isArray(insights.problem) ? insights.problem : []),
    ...(Array.isArray(insights.suggestions) ? insights.suggestions : []),
  ].filter(Boolean);
};

function DynamicChart({ chart, compact = false }) {
  if (!chart || !Array.isArray(chart.data) || !chart.data.length) {
    return null;
  }

  const { type, data, xKey = 'label', yKey = 'value', title, metric } = chart;
  const normalizedType = type === 'line' ? 'line' : 'bar';

  return (
    <div className="rounded-[22px] border border-slate-200/70 bg-white/80 p-4 shadow-sm">
      {(title || metric) && (
        <div className="mb-3">
          {title ? <p className="text-sm font-semibold text-slate-900">{title}</p> : null}
          {metric ? (
            <p className="text-[11px] uppercase tracking-widest text-slate-500">{metric}</p>
          ) : null}
        </div>
      )}

      <div className={compact ? 'mt-2 h-56' : 'mt-2 h-64'}>
        <ResponsiveContainer width="100%" height="100%">
          {normalizedType === 'line' ? (
            <LineChart data={data}>
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey={yKey}
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          ) : (
            <BarChart data={data}>
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey={yKey} fill="#2563eb" radius={[8, 8, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const InsightCard = ({
  insights = {},
  text = '',
  summaryText = '',
  chart = null,
  onExport,
  onFocusMessage,
  compact = false,
}) => {
  if (!insights || typeof insights !== 'object') {
    return null;
  }

  const points = normalizeInsightPoints(insights);
  const description = insights.description || summaryText || insights.impact || text;

  return (
    <div className="grid gap-4">
      <div className="rounded-[22px] border border-blue-200/60 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-blue-700">
              {insights.title || 'AI Insight'}
            </h3>
            {description ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{description}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {typeof onFocusMessage === 'function' ? (
              <button
                type="button"
                onClick={onFocusMessage}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Maximize2 size={14} className="text-blue-500" />
                Expand
              </button>
            ) : null}

            {typeof onExport === 'function' ? (
              <button
                type="button"
                onClick={onExport}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Download size={14} className="text-blue-500" />
                PDF
              </button>
            ) : null}
          </div>
        </div>

        {points.length ? (
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
            {points.map((point, index) => (
              <li key={`${point}-${index}`}>{point}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <DynamicChart chart={chart} compact={compact} />
    </div>
  );
};

const ReportCard = ({ message, onExport, compact = false, onFocusMessage = null }) => {
  const reportCharts = Array.isArray(message.reportCharts) ? message.reportCharts : [];
  const tables = message.tables?.length
    ? message.tables
    : message.tableRows?.length
      ? [{ title: 'Report Table', rows: message.tableRows }]
      : [];
  const reportMeta = message.meta && typeof message.meta === 'object' ? message.meta : null;
  const description =
    message.text && message.text !== message.title ? message.text : '';
  const previewNotice =
    message.summaryText ||
    (reportMeta?.scope === 'full_preview' && reportMeta.exportRows > reportMeta.displayRows
      ? `Chat preview shows ${reportMeta.displayRows} rows. Export includes all ${reportMeta.exportRows} filtered rows.`
      : reportMeta?.scope === 'ranked_subset' && reportMeta.displayRows
        ? `This report is scoped to ${reportMeta.displayRows} ranked rows${reportMeta.sort?.field ? ` by ${formatLabel(reportMeta.sort.field)}` : ''}.`
        : '');

  return (
    <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
      <div className="border-b border-slate-200 bg-gradient-to-r from-white via-slate-50 to-blue-50/80 px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <div className="mt-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100/70 text-blue-600">
              <FileText size={26} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-blue-600/70">
                Report Canvas
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                {message.title || 'Report Generated'}
              </p>
              {description ? (
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {typeof onFocusMessage === 'function' ? (
              <button
                onClick={onFocusMessage}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
              >
                <Maximize2 size={16} className="text-blue-500" /> Expand
              </button>
            ) : null}
            <button
              onClick={() => onExport?.('pdf')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
            >
              <Download size={16} className="text-blue-500" /> PDF
            </button>
            <button
              onClick={() => onExport?.('docx')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
            >
              <Download size={16} className="text-blue-500" /> DOCX
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 px-5 py-5 sm:px-6 sm:py-6">
        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">
            Key Metrics
          </p>
          <SummaryGrid summary={message.summary} compact={compact} />
        </div>

        {previewNotice ? (
          <div className="rounded-[20px] border border-blue-200/70 bg-blue-50/70 px-4 py-3 text-sm font-medium text-blue-900">
            {previewNotice}
          </div>
        ) : null}

        {reportCharts.length ? (
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">
              Visual Breakdown
            </p>
            <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2'}`}>
              {reportCharts.map((chart) => (
                <ReportChartCard
                  key={chart.id || `${chart.type || 'chart'}-${chart.title || 'untitled'}`}
                  chart={chart}
                  compact={compact}
                />
              ))}
            </div>
          </div>
        ) : null}

        {tables.map((table) => (
          <div
            key={table.title}
            className="rounded-[24px] border border-slate-200 bg-white/80 p-5 shadow-sm"
          >
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">
              {table.title}
            </p>
            <DataTable rows={table.rows || []} />
          </div>
        ))}
      </div>
    </div>
  );
};

const getBotLayoutVariant = (message = {}) => {
  if (message.type === 'report') {
    return 'report_canvas';
  }

  if (
    message.presentation?.variant === 'answer_card' ||
    message.answerCard ||
    message.type === 'count'
  ) {
    return 'answer_card';
  }

  return 'bubble';
};

const BotContent = ({
  message,
  onExport,
  onInsightExport,
  compact = false,
  onFocusMessage = null,
  onAnswerAction = null,
}) => {
  const structuredPayload = getStructuredPayload(message);

  if (structuredPayload) {
    return <StructuredPayloadCard payload={structuredPayload} />;
  }

  if (
    message.presentation?.variant === 'answer_card' ||
    message.answerCard ||
    message.type === 'count'
  ) {
    return (
      <AnswerCard
        message={message}
        compact={compact}
        onFocusMessage={onFocusMessage}
        onAnswerAction={onAnswerAction}
      />
    );
  }

  switch (message.type) {
    case 'report':
      return (
        <ReportCard
          message={message}
          onExport={onExport}
          compact={compact}
          onFocusMessage={onFocusMessage}
        />
      );
    case 'insight':
      return (
        <InsightCard
          insights={message.insights}
          text={message.text}
          summaryText={message.summaryText}
          chart={message.chart}
          onExport={onInsightExport}
          compact={compact}
          onFocusMessage={onFocusMessage}
        />
      );
    case 'data':
    case 'top_performers':
    case 'table':
      return (
        <div className="grid gap-4">
          {message.title ? (
            <p className="text-base font-bold text-slate-900">{message.title}</p>
          ) : null}
          {message.summaryText ? (
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {message.summaryText}
            </p>
          ) : null}
          {!message.summaryText || message.summaryText !== message.text ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {message.text}
            </p>
          ) : null}
          <DataTable rows={message.rows} />
        </div>
      );
    default:
      return (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
          {message.text}
        </p>
      );
  }
};

export default function ChatMessage({
  message,
  onExport,
  onInsightExport,
  compact = false,
  onFocusMessage = null,
  onAnswerAction = null,
}) {
  const isUser = message.sender === 'user';
  const botLayoutVariant = isUser ? 'bubble' : getBotLayoutVariant(message);
  const isCanvasLayout =
    !isUser && (botLayoutVariant === 'report_canvas' || botLayoutVariant === 'answer_card');
  const isErrorMessage = !isUser && message.status === 'error';

  return (
    <div
      className={`flex w-full items-start gap-4 py-4 ${
        isUser
          ? 'justify-end'
          : 'animate-in fade-in slide-in-from-bottom-4 justify-start duration-500'
      }`}
    >
      {!isUser ? (
        <div className="jorvis-avatar-shell mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
          <Bot size={20} strokeWidth={2.5} />
        </div>
      ) : null}

      <div
        className={[
          'transition-all duration-300',
          isCanvasLayout
            ? 'w-full min-w-0 flex-1 px-0 py-0'
            : compact
              ? 'max-w-[88%] rounded-[26px] px-5 py-4 shadow-sm sm:max-w-[82%]'
              : 'max-w-[90%] rounded-[28px] px-6 py-4 shadow-sm sm:max-w-[80%] lg:max-w-[70%]',
          isUser
            ? 'jorvis-message-user rounded-br-[8px] text-white'
            : isCanvasLayout
              ? 'bg-transparent text-slate-700 shadow-none'
              : isErrorMessage
                ? 'jorvis-message-error rounded-bl-[8px] text-slate-700'
                : 'jorvis-message-bot rounded-bl-[8px] text-slate-700',
        ].join(' ')}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words text-[15px] font-medium leading-relaxed">
            {message.text}
          </p>
        ) : (
          <BotContent
            message={message}
            onExport={onExport}
            onInsightExport={onInsightExport}
            compact={compact}
            onFocusMessage={onFocusMessage}
            onAnswerAction={onAnswerAction}
          />
        )}

        <div
          className={`mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${
            isUser ? 'text-white/75' : 'text-slate-400'
          }`}
        >
          {isUser ? 'YOU' : <span className="text-blue-600">JORVIS AI</span>}
          <span className="opacity-40">- {message.timestamp}</span>
        </div>
      </div>

      {isUser ? (
        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
          <User size={20} strokeWidth={2.5} />
        </div>
      ) : null}
    </div>
  );
}

export function FullscreenChatLayout({ children }) {
  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50 font-sans">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Bot size={18} />
          </div>
          <span className="font-bold tracking-tight text-slate-900">
            JORVIS <span className="text-blue-600">INSIGHTS</span>
          </span>
        </div>
        <div className="flex items-center gap-4 text-slate-500">
          <button className="hover:text-blue-600">
            <Maximize2 size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
