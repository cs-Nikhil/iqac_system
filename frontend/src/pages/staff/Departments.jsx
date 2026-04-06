import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Layers3,
  Medal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Navbar from '../../components/Navbar';
import { staffAPI } from '../../services/api';

const formatDecimal = (value) => Number(value || 0).toFixed(2);
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const getAcademicYearValue = (startYear) =>
  `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;

const today = new Date();
const currentAcademicStartYear =
  today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
const currentAcademicYear = getAcademicYearValue(currentAcademicStartYear);

const ACADEMIC_YEAR_OPTIONS = Array.from({ length: 4 }, (_, index) => {
  const startYear = currentAcademicStartYear - index;
  const academicYear = getAcademicYearValue(startYear);
  return { value: academicYear, label: academicYear };
});

const SEMESTER_OPTIONS = [
  { value: '', label: 'All Semesters' },
  ...Array.from({ length: 8 }, (_, index) => ({
    value: String(index + 1),
    label: `Semester ${index + 1}`,
  })),
];

const TOP_BAR_COLORS = ['#60a5fa', '#8b5cf6'];

function AnimatedNumber({ value, decimals = 0, suffix = '' }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const target = Number(value || 0);
    const duration = 850;
    const startTime = performance.now();
    let frameId;

    const animate = (timestamp) => {
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easedProgress = 1 - ((1 - progress) ** 3);
      setDisplayValue(target * easedProgress);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return `${displayValue.toFixed(decimals)}${suffix}`;
}

function StatCard({ label, value, note, trend, icon: Icon, accent = 'blue', decimals = 0, suffix = '' }) {
  const accentStyles = {
    blue: {
      shell: 'border-blue-400/18 bg-[linear-gradient(180deg,rgba(18,39,84,0.92),rgba(8,18,44,0.84))]',
      icon: 'bg-blue-500/14 text-blue-200',
      glow: 'shadow-[0_28px_75px_-52px_rgba(59,130,246,0.92)]',
    },
    emerald: {
      shell: 'border-emerald-400/18 bg-[linear-gradient(180deg,rgba(8,49,50,0.92),rgba(5,21,24,0.84))]',
      icon: 'bg-emerald-500/14 text-emerald-200',
      glow: 'shadow-[0_28px_75px_-52px_rgba(16,185,129,0.9)]',
    },
    violet: {
      shell: 'border-violet-400/18 bg-[linear-gradient(180deg,rgba(36,26,78,0.92),rgba(14,10,34,0.84))]',
      icon: 'bg-violet-500/14 text-violet-200',
      glow: 'shadow-[0_28px_75px_-52px_rgba(139,92,246,0.92)]',
    },
    amber: {
      shell: 'border-amber-400/18 bg-[linear-gradient(180deg,rgba(67,39,11,0.92),rgba(25,14,5,0.84))]',
      icon: 'bg-amber-500/14 text-amber-200',
      glow: 'shadow-[0_28px_75px_-52px_rgba(245,158,11,0.9)]',
    },
  }[accent];

  return (
    <div className={`rounded-[24px] border p-5 transition duration-300 hover:-translate-y-1 hover:scale-[1.03] ${accentStyles.shell} ${accentStyles.glow}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/62">{label}</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-content-primary">
            <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
          </p>
          <p className="mt-2 text-sm text-content-secondary">{note}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 ${accentStyles.icon}`}>
          <Icon size={18} />
        </div>
      </div>

      <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-medium text-white/82">
        {trend.direction === 'up' ? <TrendingUp size={14} className="text-emerald-300" /> : <TrendingDown size={14} className="text-rose-300" />}
        <span>{trend.label}</span>
      </div>
    </div>
  );
}

function TopDepartmentCard({ department, delta }) {
  return (
    <div className="rounded-[26px] border border-blue-400/22 bg-[linear-gradient(135deg,rgba(13,34,88,0.94),rgba(8,18,44,0.88))] p-6 shadow-[0_32px_90px_-54px_rgba(59,130,246,0.98)] transition duration-300 hover:-translate-y-1 hover:scale-[1.03]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100/70">Top Performing Department</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-content-primary">{department?.code || 'NA'}</p>
          <p className="mt-1 text-sm text-content-secondary">{department?.name || 'No department data available'}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/16 bg-blue-500/14 text-blue-100">
          <Medal size={19} />
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
          <p className="metric-label">Pass %</p>
          <p className="mt-2 text-2xl font-semibold text-content-primary">
            <AnimatedNumber value={department?.passPercentage || 0} decimals={1} suffix="%" />
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
          <p className="metric-label">Avg CGPA</p>
          <p className="mt-2 text-2xl font-semibold text-content-primary">
            <AnimatedNumber value={department?.avgCgpa || 0} decimals={2} />
          </p>
        </div>
      </div>

      <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/16 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-100">
        <TrendingUp size={14} />
        {delta > 0 ? `+${delta.toFixed(1)} pts vs next best department` : 'Leading the current review cycle'}
      </div>
    </div>
  );
}

function DepartmentTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const passMetric = payload.find((entry) => entry.dataKey === 'passPercentage');
  const cgpaMetric = payload.find((entry) => entry.dataKey === 'avgCgpa');
  const backlogMetric = payload[0]?.payload?.backlogPercentage;

  return (
    <div className="chart-tooltip rounded-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-content-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-content-primary">Pass Rate: {formatPercent(passMetric?.value)}</p>
      <p className="mt-1 text-sm text-content-secondary">Avg CGPA: {formatDecimal(cgpaMetric?.value)}</p>
      <p className="mt-1 text-sm text-content-secondary">Backlog Rate: {formatPercent(backlogMetric)}</p>
    </div>
  );
}

function DepartmentCard({ department, isTopDepartment, isFeatured, isActive, onSelect }) {
  return (
    <div
      className={[
        'rounded-[24px] border p-5 transition duration-300 hover:-translate-y-1 hover:scale-[1.03]',
        isTopDepartment
          ? 'border-blue-400/22 bg-[linear-gradient(180deg,rgba(17,39,89,0.94),rgba(7,18,43,0.88))] shadow-[0_28px_80px_-48px_rgba(59,130,246,0.95)]'
          : isFeatured
            ? 'border-violet-400/18 bg-[linear-gradient(180deg,rgba(31,22,66,0.94),rgba(11,8,28,0.88))] shadow-[0_28px_80px_-52px_rgba(139,92,246,0.82)]'
            : 'border-white/8 bg-[linear-gradient(180deg,rgba(10,18,40,0.96),rgba(5,11,25,0.92))] shadow-[0_24px_70px_-46px_rgba(15,23,42,0.98)]',
        isActive ? 'ring-1 ring-brand-300/40' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-content-primary">{department.name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-content-muted">{department.code}</p>
        </div>
        <span className={`badge ${isTopDepartment ? 'badge-info' : 'badge-warning'}`}>
          Rank {department.rank || 'NA'}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
          <p className="metric-label">Pass %</p>
          <p className="mt-2 text-2xl font-semibold text-content-primary">{formatPercent(department.passPercentage)}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
          <p className="metric-label">Avg CGPA</p>
          <p className="mt-2 text-2xl font-semibold text-content-primary">{formatDecimal(department.avgCgpa)}</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-content-muted">
            <span>Pass performance</span>
            <span>{formatPercent(department.passPercentage)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
            <div
              className={`h-full rounded-full ${isTopDepartment ? 'bg-gradient-to-r from-sky-300 to-blue-500' : 'bg-gradient-to-r from-blue-300 to-blue-500'}`}
              style={{ width: `${Math.min(Number(department.passPercentage || 0), 100)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-content-muted">
            <span>CGPA strength</span>
            <span>{formatDecimal(department.avgCgpa)}/10</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
            <div
              className={`h-full rounded-full ${isFeatured ? 'bg-gradient-to-r from-violet-300 to-fuchsia-500' : 'bg-gradient-to-r from-emerald-300 to-emerald-500'}`}
              style={{ width: `${Math.min(Number(department.avgCgpa || 0) * 10, 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between text-sm text-content-secondary">
        <span>{department.studentCount || 0} students</span>
        <span>{department.totalBacklogs || department.studentsWithBacklogs || 0} backlogs</span>
      </div>

      <button
        type="button"
        className="btn-secondary mt-5 w-full justify-between"
        onClick={() => onSelect(department.id)}
      >
        View Details
        <ArrowUpRight size={16} />
      </button>
    </div>
  );
}

export default function Departments() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [activeDepartmentId, setActiveDepartmentId] = useState('');
  const [filters, setFilters] = useState({
    academicYear: currentAcademicYear,
    semester: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await staffAPI.getAnalytics({
        academicYear: filters.academicYear,
        semester: filters.semester || undefined,
      });
      setDepartments(response.data.data?.departmentMetrics?.summaries || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [filters.academicYear, filters.semester]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (departments.length && !departments.some((department) => department.id === activeDepartmentId)) {
      setActiveDepartmentId(departments[0].id);
    }
  }, [activeDepartmentId, departments]);

  const topDepartment = departments[0] || null;
  const secondDepartment = departments[1] || null;
  const activeDepartment = departments.find((department) => department.id === activeDepartmentId) || topDepartment;

  const chartData = useMemo(
    () => departments.map((department) => ({
      id: department.id,
      label: department.code,
      passPercentage: Number(department.passPercentage || 0),
      avgCgpa: Number(department.avgCgpa || 0),
      backlogPercentage: Number(department.backlogPercentage || 0),
      isTopDepartment: department.id === topDepartment?.id,
    })),
    [departments, topDepartment]
  );

  const highlights = useMemo(() => {
    if (!departments.length) {
      return {
        averagePass: 0,
        averageCgpa: 0,
        totalDepartments: 0,
        highPerformerRatio: 0,
      };
    }

    const averagePass =
      departments.reduce((sum, department) => sum + Number(department.passPercentage || 0), 0) / departments.length;
    const averageCgpa =
      departments.reduce((sum, department) => sum + Number(department.avgCgpa || 0), 0) / departments.length;
    const highPerformerRatio =
      (departments.filter((department) => Number(department.passPercentage || 0) >= 80).length / departments.length) * 100;

    return {
      averagePass,
      averageCgpa,
      totalDepartments: departments.length,
      highPerformerRatio,
    };
  }, [departments]);

  const headlineInsight = useMemo(() => {
    if (!topDepartment) {
      return 'No department performance insight is available right now.';
    }

    const scopeLabel = filters.semester
      ? `Semester ${filters.semester}`
      : filters.academicYear;

    return `${topDepartment.code} leads in performance for ${scopeLabel}.`;
  }, [filters.academicYear, filters.semester, topDepartment]);

  const chartInsight = useMemo(() => {
    if (!activeDepartment) {
      return 'Use the cards below to focus on a department and compare pass rate against CGPA.';
    }

    return `${activeDepartment.code} is currently showing ${formatPercent(activeDepartment.passPercentage)} pass performance with an average CGPA of ${formatDecimal(activeDepartment.avgCgpa)}.`;
  }, [activeDepartment]);

  const insights = useMemo(() => {
    if (!departments.length) {
      return [];
    }

    const lowestCgpaDepartment = [...departments].sort((left, right) => left.avgCgpa - right.avgCgpa)[0];
    const highestBacklogDepartment = [...departments].sort((left, right) => right.backlogPercentage - left.backlogPercentage)[0];

    return [
      {
        title: 'Highest Pass Rate',
        text: `${topDepartment.code} has the strongest pass rate at ${formatPercent(topDepartment.passPercentage)}.`,
      },
      {
        title: 'Lowest CGPA',
        text: `${lowestCgpaDepartment.code} currently has the lowest CGPA at ${formatDecimal(lowestCgpaDepartment.avgCgpa)}.`,
      },
      {
        title: 'Backlog Pressure',
        text: `${highestBacklogDepartment.code} carries the highest backlog rate at ${formatPercent(highestBacklogDepartment.backlogPercentage)}.`,
      },
    ];
  }, [departments, topDepartment]);

  const todayLabel = new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' });
  const topGap = topDepartment && secondDepartment
    ? Number(topDepartment.passPercentage || 0) - Number(secondDepartment.passPercentage || 0)
    : 0;

  const openDepartmentDetails = (departmentId) => {
    if (!departmentId) return;

    navigate(`/staff-dashboard/departments/${departmentId}`, {
      state: {
        academicYear: filters.academicYear,
      },
    });
  };

  return (
    <div className="flex min-h-full flex-col">
      <Navbar
        title="Departments"
        subtitle="A smarter performance dashboard for department comparison, trends, and quick insights."
        onRefresh={loadData}
        loading={loading}
        compact
      />

      <div className="dashboard-container flex-1 py-6">
        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,15,36,0.96),rgba(4,10,24,0.92))] p-6 shadow-[0_26px_90px_-56px_rgba(15,23,42,0.98)] sm:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_82%_14%,rgba(16,185,129,0.14),transparent_24%),radial-gradient(circle_at_88%_84%,rgba(139,92,246,0.14),transparent_26%)]" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <span className="badge badge-info">Departments Overview</span>
              <p className="mt-5 text-2xl font-semibold tracking-tight text-content-primary sm:text-[2rem]">
                {headlineInsight}
              </p>
              <p className="mt-3 text-sm leading-7 text-content-secondary">
                Compare pass performance, CGPA quality, and backlog pressure across departments with a cleaner, more intelligent visual snapshot.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block min-w-[11rem]">
                <span className="metric-label block">Academic Year</span>
                <select
                  className="input-field mt-2"
                  value={filters.academicYear}
                  onChange={(event) => setFilters((current) => ({ ...current, academicYear: event.target.value }))}
                >
                  {ACADEMIC_YEAR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block min-w-[11rem]">
                <span className="metric-label block">Semester</span>
                <select
                  className="input-field mt-2"
                  value={filters.semester}
                  onChange={(event) => setFilters((current) => ({ ...current, semester: event.target.value }))}
                >
                  {SEMESTER_OPTIONS.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="min-w-[11rem] rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="metric-label">Today</p>
                <div className="mt-2 flex items-center gap-2 text-sm font-medium text-content-primary">
                  <CalendarDays size={16} className="text-brand-200" />
                  <span>{todayLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
          <TopDepartmentCard department={topDepartment} delta={topGap} />
          <StatCard
            label="Average Pass Percentage"
            value={highlights.averagePass}
            decimals={1}
            suffix="%"
            note="Average department pass performance in the current scope."
            trend={{
              direction: highlights.averagePass >= 75 ? 'up' : 'down',
              label: `${Math.abs(highlights.averagePass - 75).toFixed(1)} pts vs 75% benchmark`,
            }}
            icon={BarChart3}
            accent="emerald"
          />
          <StatCard
            label="Average CGPA"
            value={highlights.averageCgpa}
            decimals={2}
            note="Average academic quality across all departments."
            trend={{
              direction: highlights.averageCgpa >= 6.5 ? 'up' : 'down',
              label: `${Math.abs(highlights.averageCgpa - 6.5).toFixed(2)} vs 6.5 target`,
            }}
            icon={TrendingUp}
            accent="violet"
          />
          <StatCard
            label="Total Departments"
            value={highlights.totalDepartments}
            note="Academic units included in this snapshot."
            trend={{
              direction: highlights.highPerformerRatio >= 50 ? 'up' : 'down',
              label: `${Math.round(highlights.highPerformerRatio)}% above 80% pass`,
            }}
            icon={Users}
            accent="amber"
          />
        </section>

        <section className="section overflow-hidden">
          <div className="border-b border-line/70 px-5 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="eyebrow">Combined Performance View</p>
                <h3 className="mt-2 text-lg font-semibold text-content-primary">Pass % vs CGPA</h3>
                <p className="mt-2 text-sm text-content-muted">Bars show pass performance, while the line tracks CGPA movement across departments.</p>
              </div>
              <span className="badge badge-info">{departments.length} departments</span>
            </div>
          </div>

          <div className="px-5 py-5">
            <div className="surface-inset mb-5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-brand-200">
                  <Sparkles size={17} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-content-primary">Insight</p>
                  <p className="mt-1 text-sm leading-6 text-content-secondary">{chartInsight}</p>
                </div>
              </div>
            </div>

            <div className="chart-surface">
              {chartData.length ? (
                <ResponsiveContainer width="100%" height={360}>
                  <ComposedChart data={chartData} margin={{ top: 18, right: 18, left: -10, bottom: 6 }}>
                    <CartesianGrid stroke="rgba(125,145,185,0.14)" strokeDasharray="4 7" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
                    <YAxis yAxisId="pass" domain={[0, 100]} tickLine={false} axisLine={false} tickMargin={10} />
                    <YAxis yAxisId="cgpa" orientation="right" domain={[0, 10]} tickLine={false} axisLine={false} tickMargin={10} />
                    <Tooltip content={<DepartmentTooltip />} />
                    <Legend verticalAlign="top" height={30} wrapperStyle={{ color: 'rgba(226,232,240,0.9)', fontSize: 12 }} />
                    <Bar
                      yAxisId="pass"
                      dataKey="passPercentage"
                      name="Pass %"
                      radius={[14, 14, 5, 5]}
                      barSize={30}
                      animationDuration={1000}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={entry.id}
                          fill={
                            entry.isTopDepartment
                              ? TOP_BAR_COLORS[0]
                              : index === 1
                                ? TOP_BAR_COLORS[1]
                                : 'rgba(148,163,184,0.6)'
                          }
                        />
                      ))}
                    </Bar>
                    <Line
                      yAxisId="cgpa"
                      type="monotone"
                      dataKey="avgCgpa"
                      name="CGPA"
                      stroke="#34d399"
                      strokeWidth={3}
                      dot={{ r: 4.5, fill: '#d1fae5', stroke: '#10b981', strokeWidth: 2 }}
                      activeDot={{ r: 6.5, fill: '#ffffff', stroke: '#34d399', strokeWidth: 2 }}
                      animationDuration={1100}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state min-h-[20rem]">Department comparisons will appear here once filtered data is available.</div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {departments.length ? departments.map((department, index) => (
            <DepartmentCard
              key={department.id || department.code}
              department={department}
              isTopDepartment={index === 0}
              isFeatured={index === 1}
              isActive={department.id === activeDepartment?.id}
              onSelect={openDepartmentDetails}
            />
          )) : (
            <div className="empty-state min-h-[15rem] md:col-span-2 xl:col-span-4">
              No department summary data is available yet.
            </div>
          )}
        </section>

        <section className="section overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line/70 px-5 py-4">
            <div>
              <p className="eyebrow">Insights</p>
              <h3 className="mt-2 text-lg font-semibold text-content-primary">Smart performance takeaways</h3>
            </div>
            <span className="badge badge-info">{insights.length} insights</span>
          </div>

          <div className="grid gap-4 px-5 py-5 md:grid-cols-3">
            {insights.length ? insights.map((insight) => (
              <div key={insight.title} className="rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,18,40,0.96),rgba(5,11,25,0.92))] p-5 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.98)] transition duration-300 hover:scale-[1.03]">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-brand-200">
                  <Layers3 size={17} />
                </div>
                <p className="mt-4 text-sm font-semibold text-content-primary">{insight.title}</p>
                <p className="mt-2 text-sm leading-6 text-content-secondary">{insight.text}</p>
              </div>
            )) : (
              <div className="empty-state min-h-[12rem] md:col-span-3">
                Insights will appear here once department analytics are available.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
