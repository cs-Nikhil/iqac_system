import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  Briefcase,
  Building2,
  DollarSign,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import {
  Area,
  ComposedChart,
  Line,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Navbar from '../components/Navbar';
import LeaderboardCard from '../components/placements/LeaderboardCard';
import PlacementDriveBoard from '../components/placements/PlacementDriveBoard';
import PlacementDriveForm from '../components/placements/PlacementDriveForm';
import PlacementTable from '../components/placements/PlacementTable';
import { useAuth } from '../context/AuthContext';
import { departmentsAPI, placementsAPI } from '../services/api';

const YEARS = ['2020-21', '2021-22', '2022-23', '2023-24', '2024-25'];

const KPI_TONES = [
  {
    icon: 'bg-brand-500/15 text-brand-300 ring-brand-400/20',
    glow: 'rgba(59, 130, 246, 0.18)',
    accent: 'rgba(37, 99, 235, 0.28)',
  },
  {
    icon: 'bg-success/15 text-success ring-success/20',
    glow: 'rgba(16, 185, 129, 0.16)',
    accent: 'rgba(5, 150, 105, 0.24)',
  },
  {
    icon: 'bg-warning/15 text-warning ring-warning/20',
    glow: 'rgba(245, 158, 11, 0.16)',
    accent: 'rgba(217, 119, 6, 0.24)',
  },
  {
    icon: 'bg-violet-500/15 text-violet-300 ring-violet-400/20',
    glow: 'rgba(168, 85, 247, 0.18)',
    accent: 'rgba(109, 40, 217, 0.24)',
  },
];

const COMPANY_THEMES = [
  { from: '#60a5fa', to: '#2563eb', soft: 'rgba(96, 165, 250, 0.18)' },
  { from: '#34d399', to: '#059669', soft: 'rgba(52, 211, 153, 0.18)' },
  { from: '#fbbf24', to: '#d97706', soft: 'rgba(251, 191, 36, 0.18)' },
  { from: '#f472b6', to: '#db2777', soft: 'rgba(244, 114, 182, 0.18)' },
  { from: '#a78bfa', to: '#7c3aed', soft: 'rgba(167, 139, 250, 0.18)' },
  { from: '#22d3ee', to: '#0891b2', soft: 'rgba(34, 211, 238, 0.18)' },
  { from: '#fb7185', to: '#e11d48', soft: 'rgba(251, 113, 133, 0.18)' },
  { from: '#4ade80', to: '#16a34a', soft: 'rgba(74, 222, 128, 0.18)' },
];

const PACKAGE_BANDS = [
  { range: '3-5 LPA', from: '#60a5fa', to: '#2563eb' },
  { range: '5-10 LPA', from: '#34d399', to: '#059669' },
  { range: '10-20 LPA', from: '#c084fc', to: '#7c3aed' },
  { range: '20+ LPA', from: '#fbbf24', to: '#ea580c' },
];

const DEPARTMENT_THEMES = [
  { from: '#38bdf8', to: '#2563eb' },
  { from: '#34d399', to: '#0f766e' },
  { from: '#fbbf24', to: '#ea580c' },
  { from: '#f472b6', to: '#db2777' },
  { from: '#c084fc', to: '#7c3aed' },
  { from: '#22d3ee', to: '#0f766e' },
];

const chartGridStroke = 'rgba(83, 107, 156, 0.18)';

const roundTo = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));

const formatLpa = (value, digits = 2) => `${roundTo(value, digits).toFixed(digits)} LPA`;

const formatPercent = (value, digits = 1) => `${roundTo(value, digits).toFixed(digits)}%`;

const hashString = (value = '') =>
  value.split('').reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);

const getCompanyTheme = (company = '') =>
  COMPANY_THEMES[hashString(company) % COMPANY_THEMES.length];

const getCompanyInitials = (company = '') => {
  const parts = company
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(' ')
    .filter(Boolean);

  if (!parts.length) return 'CO';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

const truncate = (value = '', length = 16) =>
  value.length > length ? `${value.slice(0, length - 1)}...` : value;

const parseAcademicYearStart = (academicYear = '') => {
  const [startYear] = academicYear.split('-');
  return Number(startYear) || academicYear;
};

const formatChange = (value, digits = 1) => {
  if (!Number.isFinite(value)) return '0.0%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${roundTo(value, digits).toFixed(digits)}%`;
};

function ChartCard({ title, subtitle, badge, tone, className = '', children }) {
  const background = tone
    ? `radial-gradient(circle at top left, ${tone.glow}, transparent 42%), radial-gradient(circle at bottom right, ${tone.accent}, transparent 34%)`
    : 'none';

  return (
    <section className={`section card-hover chart-shell relative overflow-hidden p-5 sm:p-6 ${className}`.trim()}>
      <div className="pointer-events-none absolute inset-0 opacity-90" style={{ background }} />
      <div className="relative z-[1] flex items-start justify-between gap-3">
        <div>
          <h3 className="section-title">{title}</h3>
          {subtitle ? <p className="section-subtitle mt-1">{subtitle}</p> : null}
        </div>
        {badge ? <span className="badge badge-info">{badge}</span> : null}
      </div>
      <div className="relative z-[1] mt-5">{children}</div>
    </section>
  );
}

function MetricCard({ label, value, note, icon: Icon, tone }) {
  return (
    <div className="section card-hover relative overflow-hidden p-5">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background: `radial-gradient(circle at top left, ${tone.glow}, transparent 42%), radial-gradient(circle at bottom right, ${tone.accent}, transparent 34%)`,
        }}
      />
      <div className="relative z-[1] flex items-start justify-between gap-4">
        <div>
          <p className="metric-label">{label}</p>
          <p className="mt-3 text-2xl font-display font-bold text-content-primary">{value}</p>
          <p className="metric-note mt-2">{note}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${tone.icon}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function CompanyAxisTick({ x, y, payload }) {
  const label = payload?.value || '';
  const theme = getCompanyTheme(label);
  const badgeX = x - 122;
  const textX = x - 102;

  return (
    <g>
      <circle cx={badgeX} cy={y} r={11} fill={theme.soft} stroke={theme.from} strokeWidth={1.4} />
      <text x={badgeX} y={y + 3.5} textAnchor="middle" fontSize="8" fontWeight="700" fill={theme.from}>
        {getCompanyInitials(label)}
      </text>
      <text x={textX} y={y + 4} textAnchor="start" fontSize="11" fill="rgb(var(--color-content-secondary))">
        {truncate(label, 16)}
      </text>
    </g>
  );
}

function CompanyTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  const theme = getCompanyTheme(point?._id);

  return (
    <div className="chart-tooltip min-w-[14rem]">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl border text-xs font-semibold"
          style={{ borderColor: theme.from, color: theme.from, backgroundColor: theme.soft }}
        >
          {getCompanyInitials(point?._id)}
        </div>
        <div>
          <p className="text-sm font-semibold text-content-primary">{point?._id}</p>
          <p className="text-xs text-content-muted">Recruiting company</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/5 bg-white/5 px-3 py-2">
          <p className="metric-label">Students Hired</p>
          <p className="mt-2 text-lg font-semibold text-content-primary">{point?.count || 0}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/5 px-3 py-2">
          <p className="metric-label">Avg Package</p>
          <p className="mt-2 text-lg font-semibold text-content-primary">{formatLpa(point?.avgPackage || 0)}</p>
        </div>
      </div>
    </div>
  );
}

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;

  return (
    <div className="chart-tooltip min-w-[14rem]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-content-muted">
        {point?.academicYear || point?.label}
      </p>
      <p className="mt-3 text-lg font-semibold text-content-primary">{point?.count || 0} placements</p>
      <p className="mt-2 text-sm text-content-secondary">Average package {formatLpa(point?.avgPackage || 0)}</p>
    </div>
  );
}

function DistributionTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;

  return (
    <div className="chart-tooltip min-w-[12rem]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-content-muted">{point?.range}</p>
      <p className="mt-3 text-lg font-semibold text-content-primary">{point?.count || 0} students</p>
      <p className="mt-2 text-sm text-content-secondary">{formatPercent(point?.share || 0)} of placed cohort</p>
    </div>
  );
}

function DepartmentTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;

  return (
    <div className="chart-tooltip min-w-[14rem]">
      <p className="text-sm font-semibold text-content-primary">{point?.deptName}</p>
      <p className="mt-3 text-lg font-semibold text-content-primary">{formatPercent(point?.placementPercentage || 0, 0)}</p>
      <p className="mt-2 text-sm text-content-secondary">
        {point?.placedCount || 0} placed out of {point?.totalStudents || 0} students
      </p>
      <p className="mt-1 text-sm text-content-secondary">Avg package {formatLpa(point?.avgPackage || 0)}</p>
    </div>
  );
}

export default function Placements() {
  const { user } = useAuth();
  const [placements, setPlacements] = useState([]);
  const [stats, setStats] = useState(null);
  const [drives, setDrives] = useState([]);
  const [driveSummary, setDriveSummary] = useState({});
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingDrive, setSubmittingDrive] = useState(false);
  const [filters, setFilters] = useState({ academicYear: '', company: '' });
  const [localFilter, setLocalFilter] = useState({ type: '', range: '', department: '' });
  const [editingDrive, setEditingDrive] = useState(null);
  const [driveResetToken, setDriveResetToken] = useState(0);
  const [driveMessage, setDriveMessage] = useState(null);

  const lockedDepartment = user?.role === 'hod' ? user.department : null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters, limit: 1000 };
      Object.keys(params).forEach((key) => !params[key] && delete params[key]);

      const [placementsResponse, statsResponse, drivesResponse, departmentsResponse] = await Promise.all([
        placementsAPI.getAll(params),
        placementsAPI.stats(params),
        placementsAPI.getDrives(params),
        departmentsAPI.getAll(),
      ]);

      setPlacements(placementsResponse.data.placements || []);
      setStats(statsResponse.data || null);
      setDrives(drivesResponse.data.drives || []);
      setDriveSummary(drivesResponse.data.summary || {});
      setDepartments(departmentsResponse.data.departments || []);
    } catch (error) {
      console.error(error);
      setDrives([]);
      setDriveSummary({});
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  const resetDriveEditor = () => {
    setEditingDrive(null);
    setDriveResetToken((current) => current + 1);
  };

  const handleDriveSubmit = async (payload) => {
    setSubmittingDrive(true);
    setDriveMessage(null);

    try {
      if (editingDrive?._id) {
        await placementsAPI.updateDrive(editingDrive._id, payload);
      } else {
        await placementsAPI.createDrive(payload);
      }

      setDriveMessage({
        type: 'success',
        text: editingDrive
          ? 'Placement drive updated successfully.'
          : 'Placement drive published and student notifications queued.',
      });
      resetDriveEditor();
      await load();
    } catch (error) {
      setDriveMessage({
        type: 'error',
        text: error.response?.data?.message || 'Unable to save the placement drive right now.',
      });
    } finally {
      setSubmittingDrive(false);
    }
  };

  const filteredPlacements = useMemo(() => {
    let result = [...placements];
    if (localFilter.type) {
      result = result.filter(p => p.placementType === localFilter.type);
    }
    if (localFilter.department) {
      result = result.filter(p => p.student?.department?.code === localFilter.department);
    }
    if (localFilter.range) {
      if (localFilter.range === '<10') result = result.filter(p => (p.package || 0) < 10);
      else if (localFilter.range === '10-20') result = result.filter(p => (p.package || 0) >= 10 && (p.package || 0) <= 20);
      else if (localFilter.range === '>20') result = result.filter(p => (p.package || 0) > 20);
    }
    return result;
  }, [placements, localFilter]);

  const uniqueDepartments = useMemo(() => {
    const depts = new Set(placements.map(p => p.student?.department?.code).filter(Boolean));
    return Array.from(depts).sort();
  }, [placements]);

  const topCompanies = stats?.topCompanies || [];
  const departmentRates = stats?.departmentRates || [];
  const topPackages = stats?.topPackages || [];

  const trendData = useMemo(
    () =>
      (stats?.trendByYear || [])
        .map((entry) => ({
          ...entry,
          label: String(parseAcademicYearStart(entry._id)),
          academicYear: entry._id,
        }))
        .sort((left, right) => parseAcademicYearStart(left.academicYear) - parseAcademicYearStart(right.academicYear)),
    [stats]
  );

  const packageDistribution = useMemo(() => {
    const totalPlaced = stats?.stats?.totalPlaced || 0;
    const countMap = new Map((stats?.packageDistribution || []).map((entry) => [entry.range, entry.count]));

    return PACKAGE_BANDS.map((band) => {
      const count = countMap.get(band.range) || 0;
      return {
        ...band,
        count,
        share: totalPlaced > 0 ? (count / totalPlaced) * 100 : 0,
      };
    });
  }, [stats]);

  const insights = useMemo(() => {
    const currentTrend = trendData[trendData.length - 1];
    const previousTrend = trendData[trendData.length - 2];
    const placementGrowth = previousTrend?.count
      ? (((currentTrend?.count || 0) - previousTrend.count) / previousTrend.count) * 100
      : 0;
    const packageGrowth = previousTrend?.avgPackage
      ? (((currentTrend?.avgPackage || 0) - previousTrend.avgPackage) / previousTrend.avgPackage) * 100
      : 0;
    const highestRate = departmentRates[0];
    const highestOffer = topPackages[0];

    return [
      {
        title: 'Year-on-Year Growth',
        value: formatChange(placementGrowth),
        description: currentTrend && previousTrend
          ? `Placements moved from ${previousTrend.count} in ${previousTrend.academicYear} to ${currentTrend.count} in ${currentTrend.academicYear}.`
          : 'Growth will appear once at least two academic years are available.',
      },
      {
        title: 'Average Package Shift',
        value: formatChange(packageGrowth),
        description: currentTrend
          ? `Current average package is ${formatLpa(currentTrend.avgPackage || 0)} across the latest visible year.`
          : 'Average package insights will appear when placement records are available.',
      },
      {
        title: 'Highest Placement Rate',
        value: highestRate ? formatPercent(highestRate.placementPercentage || 0, 0) : '0%',
        description: highestRate
          ? `${highestRate.deptCode} is leading with ${highestRate.placedCount} placed students.`
          : 'Department comparison becomes available after placement data is recorded.',
      },
      {
        title: 'Top Salary Offer',
        value: highestOffer ? formatLpa(highestOffer.package || 0) : '0.00 LPA',
        description: highestOffer
          ? `${highestOffer.company} offered the current highest package in the visible dataset.`
          : 'Top salary insights will appear when high-value offers are recorded.',
      },
    ];
  }, [departmentRates, topPackages, trendData]);

  const kpiCards = [
    {
      label: 'Total Placed',
      value: loading ? '-' : stats?.stats?.totalPlaced ?? 0,
      note: 'Successful placement outcomes in scope',
      icon: Award,
    },
    {
      label: 'Average Package',
      value: loading ? '-' : formatLpa(stats?.stats?.avgPackage || 0),
      note: 'Average offer size across all placements',
      icon: DollarSign,
    },
    {
      label: 'Highest Package',
      value: loading ? '-' : formatLpa(stats?.stats?.maxPackage || 0),
      note: 'Best recorded offer in the current view',
      icon: TrendingUp,
    },
    {
      label: 'Total Companies',
      value: loading ? '-' : stats?.stats?.totalCompanies ?? 0,
      note: 'Distinct recruiters engaged in this scope',
      icon: Building2,
    },
  ];

  const driveKpis = [
    {
      label: 'Open Drives',
      value: loading ? '-' : driveSummary.open ?? 0,
      note: 'Opportunities currently live for student applications',
      icon: Briefcase,
    },
    {
      label: 'Upcoming Drives',
      value: loading ? '-' : driveSummary.upcoming ?? 0,
      note: 'Scheduled drives that are visible ahead of launch',
      icon: Sparkles,
    },
    {
      label: 'Drive Applications',
      value: loading ? '-' : driveSummary.applications ?? 0,
      note: 'Applications recorded across the visible drive pipeline',
      icon: Award,
    },
    {
      label: 'Eligible Students',
      value: loading ? '-' : driveSummary.eligibleStudents ?? 0,
      note: 'Students matching the current drive eligibility rules',
      icon: Building2,
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <Navbar title="Placements" subtitle="Placement analytics, salary trends, and hiring intelligence" onRefresh={load} loading={loading} />

      <div className="dashboard-container flex-1">
        {driveMessage ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              driveMessage.type === 'success'
                ? 'border-success/25 bg-success/10 text-success'
                : 'border-danger/25 bg-danger/10 text-danger'
            }`}
          >
            {driveMessage.text}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((card, index) => (
            <MetricCard
              key={card.label}
              label={card.label}
              value={card.value}
              note={card.note}
              icon={card.icon}
              tone={KPI_TONES[index % KPI_TONES.length]}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {driveKpis.map((card, index) => (
            <MetricCard
              key={card.label}
              label={card.label}
              value={card.value}
              note={card.note}
              icon={card.icon}
              tone={KPI_TONES[(index + 1) % KPI_TONES.length]}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <PlacementDriveForm
            departments={departments}
            editingDrive={editingDrive}
            lockedDepartment={lockedDepartment}
            onCancel={resetDriveEditor}
            onSubmit={handleDriveSubmit}
            resetToken={driveResetToken}
            submitting={submittingDrive}
          />
          <PlacementDriveBoard drives={drives} loading={loading} onEdit={setEditingDrive} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <ChartCard
            title="Top Recruiting Companies"
            subtitle="Hiring leaders ranked by total offers and package quality"
            badge={`${topCompanies.length || 0} visible`}
            tone={{ glow: 'rgba(59, 130, 246, 0.12)', accent: 'rgba(139, 92, 246, 0.14)' }}
            className="xl:col-span-2"
          >
            {loading ? (
              <div className="skeleton h-[18rem]" />
            ) : topCompanies.length ? (
              <div className="min-w-0">
                <div className="chart-surface">
                  <ResponsiveContainer width="100%" height={304}>
                    <BarChart data={topCompanies} layout="vertical" margin={{ top: 10, right: 18, left: 28, bottom: 0 }}>
                      <defs>
                        {topCompanies.map((company, index) => {
                          const theme = getCompanyTheme(company._id);
                          return (
                            <linearGradient key={company._id} id={`placement-company-${index}`} x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor={theme.from} />
                              <stop offset="100%" stopColor={theme.to} />
                            </linearGradient>
                          );
                        })}
                      </defs>
                      <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <YAxis dataKey="_id" type="category" tickLine={false} axisLine={false} tick={<CompanyAxisTick />} width={140} />
                      <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }} content={<CompanyTooltip />} />
                      <Bar dataKey="count" radius={[0, 10, 10, 0]} barSize={18} minPointSize={6} animationDuration={1200}>
                        {topCompanies.map((company, index) => (
                          <Cell
                            key={company._id}
                            fill={`url(#placement-company-${index})`}
                            stroke={getCompanyTheme(company._id).soft}
                            strokeWidth={1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="empty-state min-h-[18rem]">Top recruiting companies are not available for the current filter.</div>
            )}
          </ChartCard>

          <ChartCard
            title="Placement Trend"
            subtitle="Year-wise hiring momentum with average package context"
            badge={trendData[trendData.length - 1]?.academicYear || 'Trend'}
            tone={{ glow: 'rgba(14, 165, 233, 0.16)', accent: 'rgba(37, 99, 235, 0.16)' }}
          >
            {loading ? (
              <div className="skeleton h-[19rem]" />
            ) : trendData.length ? (
              <div className="min-w-0">
                <div className="chart-surface">
                  <ResponsiveContainer width="100%" height={304}>
                    <ComposedChart data={trendData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="placement-trend-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="placement-trend-stroke" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#22d3ee" />
                          <stop offset="100%" stopColor="#4f46e5" />
                        </linearGradient>
                        <filter id="glow-line-placement" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="4" result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                      </defs>
                      <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<TrendTooltip />} />
                      <Area
                        type="natural"
                        dataKey="count"
                        stroke="none"
                        fill="url(#placement-trend-fill)"
                        animationDuration={1200}
                      />
                      <Line
                        type="natural"
                        dataKey="count"
                        stroke="url(#placement-trend-stroke)"
                        strokeWidth={3}
                        filter="url(#glow-line-placement)"
                        animationDuration={1200}
                        activeDot={{ r: 6, stroke: '#93c5fd', strokeWidth: 2, fill: '#0f172a' }}
                        dot={({ cx, cy, index }) => {
                          const isLatest = index === trendData.length - 1;
                          return (
                            <g key={`${cx}-${cy}-${index}`}>
                              {isLatest ? <circle cx={cx} cy={cy} r={12} fill="rgba(96, 165, 250, 0.12)" /> : null}
                              <circle
                                cx={cx}
                                cy={cy}
                                r={isLatest ? 5.2 : 3.4}
                                fill={isLatest ? '#a78bfa' : '#7dd3fc'}
                                stroke="#0f172a"
                                strokeWidth={2}
                              />
                              {isLatest ? (
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={9}
                                  fill="none"
                                  stroke="#a78bfa"
                                  strokeWidth={1.5}
                                  strokeDasharray="3 3"
                                  opacity={0.8}
                                  className="animate-spin-slow"
                                  style={{ transformOrigin: `${cx}px ${cy}px` }}
                                />
                              ) : null}
                            </g>
                          );
                        }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="empty-state min-h-[19rem]">Placement trend is not available for the current filter.</div>
            )}
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <ChartCard
            title="Package Distribution"
            subtitle="Salary spread across offer bands"
            badge="Histogram"
            tone={{ glow: 'rgba(34, 211, 238, 0.12)', accent: 'rgba(59, 130, 246, 0.12)' }}
          >
            {loading ? (
              <div className="skeleton h-[16rem]" />
            ) : (
              <div className="min-w-0">
                <div className="chart-surface">
                  <ResponsiveContainer width="100%" height={256}>
                    <BarChart data={packageDistribution} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
                      <defs>
                        {packageDistribution.map((band, index) => (
                          <linearGradient key={band.range} id={`package-band-${index}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={band.from} />
                            <stop offset="100%" stopColor={band.to} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="range" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<DistributionTooltip />} />
                      <Bar dataKey="count" radius={[10, 10, 2, 2]} minPointSize={6} animationDuration={1100}>
                        {packageDistribution.map((band, index) => (
                          <Cell key={band.range} fill={`url(#package-band-${index})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </ChartCard>

          <ChartCard
            title="Department Placement Rate"
            subtitle="Placement percentage across the visible department scope"
            badge={departmentRates.length === 1 ? departmentRates[0]?.deptCode : `${departmentRates.length || 0} depts`}
            tone={{ glow: 'rgba(251, 191, 36, 0.12)', accent: 'rgba(34, 197, 94, 0.12)' }}
          >
            {loading ? (
              <div className="skeleton h-[16rem]" />
            ) : departmentRates.length ? (
              <div className="min-w-0">
                <div className="chart-surface">
                  <ResponsiveContainer width="100%" height={256}>
                    <BarChart data={departmentRates.slice(0, 6)} layout="vertical" margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
                      <defs>
                        {departmentRates.slice(0, 6).map((department, index) => {
                          const theme = DEPARTMENT_THEMES[index % DEPARTMENT_THEMES.length];
                          return (
                            <linearGradient key={department._id} id={`dept-rate-${index}`} x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor={theme.from} />
                              <stop offset="100%" stopColor={theme.to} />
                            </linearGradient>
                          );
                        })}
                      </defs>
                      <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                      <YAxis dataKey="deptCode" type="category" tickLine={false} axisLine={false} width={56} />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<DepartmentTooltip />} />
                      <Bar dataKey="placementPercentage" radius={[0, 10, 10, 0]} barSize={18} minPointSize={8} animationDuration={1200}>
                        {departmentRates.slice(0, 6).map((department, index) => (
                          <Cell key={department._id} fill={`url(#dept-rate-${index})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="empty-state min-h-[16rem]">Department comparison is not available for the current filter.</div>
            )}
          </ChartCard>

          <section className="section card-hover relative overflow-hidden p-5 sm:p-6">
            <div
              className="pointer-events-none absolute inset-0 opacity-90"
              style={{
                background:
                  'radial-gradient(circle at top left, rgba(168, 85, 247, 0.12), transparent 42%), radial-gradient(circle at bottom right, rgba(16, 185, 129, 0.10), transparent 34%)',
              }}
            />
            <div className="relative z-[1] flex items-start justify-between gap-3">
              <div>
                <h3 className="section-title">Placement Insights</h3>
                <p className="section-subtitle mt-1">Auto-generated signals from hiring, packages, and department performance</p>
              </div>
              <span className="badge badge-info">
                <Sparkles size={12} />
                Live
              </span>
            </div>
            <div className="relative z-[1] mt-5 space-y-3">
              {insights.map((insight) => (
                <div key={insight.title} className="surface-inset p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-brand-200">
                        <Target size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-content-primary">{insight.title}</p>
                        <p className="mt-1 text-xs text-content-muted">{insight.description}</p>
                      </div>
                    </div>
                    <span className="badge badge-success">{insight.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 mb-8 mt-2">
            <div className="xl:col-span-4 h-[580px] flex flex-col">
              <LeaderboardCard placements={filteredPlacements} />
            </div>
            <div className="xl:col-span-8 h-[580px] flex flex-col">
              <PlacementTable 
                placements={filteredPlacements} 
                loading={loading} 
                filters={filters} 
                setFilter={setFilter} 
                YEARS={YEARS} 
                localFilter={localFilter}
                setLocalFilter={setLocalFilter}
                uniqueDepartments={uniqueDepartments}
              />
            </div>
          </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          <div className="surface-inset flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300">
              <Briefcase size={18} />
            </div>
            <div>
              <p className="metric-label">Hiring Coverage</p>
              <p className="mt-1 text-sm text-content-primary">
                {stats?.stats?.totalPlaced || 0} placements tracked across {stats?.stats?.totalCompanies || 0} recruiters.
              </p>
            </div>
          </div>
          <div className="surface-inset flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-success/15 text-success">
              <Trophy size={18} />
            </div>
            <div>
              <p className="metric-label">Best Department</p>
              <p className="mt-1 text-sm text-content-primary">
                {departmentRates[0] ? `${departmentRates[0].deptName} at ${formatPercent(departmentRates[0].placementPercentage || 0, 0)}` : 'Awaiting placement data'}
              </p>
            </div>
          </div>
          <div className="surface-inset flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-warning/15 text-warning">
              <DollarSign size={18} />
            </div>
            <div>
              <p className="metric-label">Average Offer</p>
              <p className="mt-1 text-sm text-content-primary">
                {formatLpa(stats?.stats?.avgPackage || 0)} with a floor of {formatLpa(stats?.stats?.minPackage || 0)}.
              </p>
            </div>
          </div>
          <div className="surface-inset flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="metric-label">Top Recruiter</p>
              <p className="mt-1 text-sm text-content-primary">
                {topCompanies[0] ? `${topCompanies[0]._id} hired ${topCompanies[0].count} students` : 'No recruiter insights yet'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
