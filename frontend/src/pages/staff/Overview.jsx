import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, GraduationCap, TrendingUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Navbar from '../../components/Navbar';
import { useTheme } from '../../context/ThemeContext';
import { staffAPI } from '../../services/api';
import { WorkspaceHeader, formatDate } from './shared';

const formatDecimal = (value) => Number(value || 0).toFixed(2);
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const toneClasses = {
  dark: {
    blue: 'border-blue-400/14 bg-blue-500/10 text-blue-100 shadow-[0_20px_40px_-28px_rgba(59,130,246,0.88)]',
    emerald: 'border-emerald-400/14 bg-emerald-500/10 text-emerald-100 shadow-[0_20px_40px_-28px_rgba(16,185,129,0.82)]',
    violet: 'border-violet-400/14 bg-violet-500/10 text-violet-100 shadow-[0_20px_40px_-28px_rgba(139,92,246,0.78)]',
    amber: 'border-amber-400/14 bg-amber-500/10 text-amber-100 shadow-[0_20px_40px_-28px_rgba(245,158,11,0.84)]',
  },
  light: {
    blue: 'border-blue-200/80 bg-blue-50 text-blue-900 shadow-[0_20px_40px_-30px_rgba(59,130,246,0.16)]',
    emerald: 'border-emerald-200/80 bg-emerald-50 text-emerald-900 shadow-[0_20px_40px_-30px_rgba(16,185,129,0.16)]',
    violet: 'border-violet-200/80 bg-violet-50 text-violet-900 shadow-[0_20px_40px_-30px_rgba(139,92,246,0.16)]',
    amber: 'border-amber-200/80 bg-amber-50 text-amber-900 shadow-[0_20px_40px_-30px_rgba(245,158,11,0.16)]',
  },
};

const performanceBadgeClass = {
  Excellent: 'badge badge-info',
  Good: 'badge badge-success',
  Average: 'badge badge-warning',
  'At Risk': 'badge badge-danger',
};

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip rounded-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-content-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-content-primary">
        Avg CGPA: {formatDecimal(payload[0].value)}
      </p>
    </div>
  );
}

function SummaryCard({ label, value, note, icon: Icon, tone }) {
  const { isLightTheme } = useTheme();
  const palette = isLightTheme ? toneClasses.light : toneClasses.dark;

  return (
    <div className={`rounded-[24px] border p-5 ${palette[tone] || palette.blue}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isLightTheme ? 'text-content-muted' : 'text-white/65'}`}>{label}</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-content-primary">{value}</p>
          <p className={`mt-2 text-sm ${isLightTheme ? 'text-content-secondary' : 'text-white/70'}`}>{note}</p>
        </div>
        <div
          className={[
            'flex h-11 w-11 items-center justify-center rounded-2xl border',
            isLightTheme
              ? 'border-white/80 bg-white/80 text-content-primary shadow-[0_14px_30px_-24px_rgba(15,23,42,0.14)]'
              : 'border-white/10 bg-white/10 text-white/90',
          ].join(' ')}
        >
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

export default function Overview() {
  const { isLightTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await staffAPI.getAnalytics();
      setAnalytics(response.data.data || null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summaryCards = useMemo(() => {
    const studentStats = analytics?.studentStats || {};
    const overview = analytics?.overview || {};

    return [
      {
        label: 'Total Students',
        value: overview.totalStudents ?? 0,
        note: 'Institution-wide active learner count',
        icon: GraduationCap,
        tone: 'blue',
      },
      {
        label: 'Average CGPA',
        value: formatDecimal(studentStats.avgCgpa),
        note: 'Current academic average across students',
        icon: TrendingUp,
        tone: 'emerald',
      },
      {
        label: 'Pass Percentage',
        value: formatPercent(studentStats.passPercentage),
        note: 'Computed from the live performance dataset',
        icon: BarChart3,
        tone: 'violet',
      },
      {
        label: 'At-Risk Students',
        value: studentStats.atRiskStudents ?? 0,
        note: 'Students needing follow-up support',
        icon: AlertTriangle,
        tone: 'amber',
      },
    ];
  }, [analytics]);

  const trendData = analytics?.studentStats?.cgpaTrend || [];
  const recentStudentPerformance = analytics?.recentStudentPerformance || [];

  return (
    <div className="flex min-h-full flex-col">
      <Navbar
        title="Staff Dashboard"
        subtitle="A focused IQAC staff view for monitoring student outcomes, department health, reports, and documents."
        onRefresh={loadData}
        loading={loading}
        compact
      />

      <div className="dashboard-container flex-1 py-6">
        <section
          className={[
            'relative overflow-hidden rounded-[28px] p-6 sm:p-7',
            isLightTheme
              ? 'border border-line/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.94))] shadow-[0_26px_90px_-56px_rgba(15,23,42,0.14)]'
              : 'border border-white/10 bg-[linear-gradient(135deg,rgba(8,15,36,0.96),rgba(4,10,24,0.92))] shadow-[0_26px_90px_-56px_rgba(15,23,42,0.98)]',
          ].join(' ')}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_82%_14%,rgba(16,185,129,0.14),transparent_24%)]" />
          <div className="relative">
            <span className="badge badge-info">STAFF</span>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-content-primary sm:text-[2.25rem]">
              Minimal monitoring for student performance and reporting.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-content-secondary">
              Keep the staff module clean and secondary: just the essential outcome cards, a CGPA trend view, and the latest student performance records.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </section>

        <section className="section overflow-hidden">
          <WorkspaceHeader
            title="CGPA Trend"
            subtitle="A semester-wise line view of overall academic movement."
            badge={trendData.length ? `${trendData.length} points` : 'No data'}
          />
          <div className="px-5 py-5">
            <div
              className={[
                'overflow-hidden rounded-[24px] p-4 sm:p-5',
                isLightTheme
                  ? 'border border-line/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.94))] shadow-[0_24px_64px_-46px_rgba(15,23,42,0.14)]'
                  : 'border border-white/10 bg-[linear-gradient(180deg,rgba(6,12,28,0.94),rgba(4,8,20,0.92))]',
              ].join(' ')}
            >
              {trendData.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trendData} margin={{ top: 14, right: 14, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="staff-cgpa-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.32} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(125,145,185,0.14)" strokeDasharray="4 7" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
                    <YAxis domain={[0, 10]} tickLine={false} axisLine={false} tickMargin={10} />
                    <Tooltip content={<TrendTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="avgCGPA"
                      stroke="#60a5fa"
                      strokeWidth={3}
                      fill="url(#staff-cgpa-fill)"
                      dot={{ r: 4, fill: '#dbeafe', stroke: '#3b82f6', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#ffffff', stroke: '#60a5fa', strokeWidth: 2 }}
                      animationDuration={900}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state min-h-[18rem]">No CGPA trend data is available yet for the staff module.</div>
              )}
            </div>
          </div>
        </section>

        <section className="section overflow-hidden">
          <WorkspaceHeader
            title="Recent Student Performance"
            subtitle="The latest academic records surfaced for quick review."
            badge={`${recentStudentPerformance.length} rows`}
          />
          <div className="overflow-x-auto">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr className="table-head">
                  <th className="table-head-cell">Name</th>
                  <th className="table-head-cell">Department</th>
                  <th className="table-head-cell">CGPA</th>
                  <th className="table-head-cell">Attendance</th>
                  <th className="table-head-cell">Backlogs</th>
                  <th className="table-head-cell">Updated</th>
                </tr>
              </thead>
              <tbody>
                {recentStudentPerformance.length ? recentStudentPerformance.map((student) => (
                  <tr key={student.id} className="table-row">
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-content-primary">{student.name}</p>
                        <p className="mt-1 text-xs text-content-muted">
                          {student.rollNumber} · Semester {student.currentSemester || 'NA'}
                        </p>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="text-content-primary">{student.department?.code || student.department?.name || 'NA'}</span>
                    </td>
                    <td className="table-cell font-medium text-content-primary">{formatDecimal(student.cgpa)}</td>
                    <td className="table-cell">{formatPercent(student.avgAttendance)}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-content-primary">{student.currentBacklogs ?? 0}</span>
                        <span className={performanceBadgeClass[student.performanceCategory] || 'badge badge-warning'}>
                          {student.performanceCategory || 'Average'}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell text-xs text-content-muted">{formatDate(student.updatedAt)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="table-cell" colSpan={6}>
                      <div className="empty-state min-h-[12rem]">Recent performance rows will appear here once student data is available.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
