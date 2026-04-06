import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
import Navbar from '../components/Navbar';
import { authService } from '../services/authService';
import { studentsAPI } from '../services/api';

const subjectBarColor = (value) => {
  if (value >= 85) return '#34d399';
  if (value >= 70) return '#60a5fa';
  if (value >= 55) return '#fbbf24';
  return '#fb7185';
};

const getStatusTone = (category = 'Average') => {
  if (category === 'Excellent') {
    return {
      badge: 'badge badge-info',
      text: 'text-sky-300',
      fill: 'from-sky-400 to-blue-600',
      glow: 'rgba(96, 165, 250, 0.2)',
    };
  }

  if (category === 'Good') {
    return {
      badge: 'badge badge-success',
      text: 'text-emerald-300',
      fill: 'from-emerald-400 to-green-600',
      glow: 'rgba(16, 185, 129, 0.18)',
    };
  }

  if (category === 'At Risk') {
    return {
      badge: 'badge badge-danger',
      text: 'text-rose-300',
      fill: 'from-rose-400 to-red-600',
      glow: 'rgba(251, 113, 133, 0.2)',
    };
  }

  return {
    badge: 'badge badge-warning',
    text: 'text-amber-300',
    fill: 'from-amber-300 to-orange-500',
    glow: 'rgba(245, 158, 11, 0.18)',
  };
};

function TrendTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip min-w-[11rem]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-content-muted">{label}</p>
      <p className="mt-3 text-lg font-semibold text-content-primary">
        {payload[0]?.value}
        {suffix}
      </p>
    </div>
  );
}

function SubjectTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;

  return (
    <div className="chart-tooltip min-w-[12rem]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-content-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-content-primary">{point?.code}</p>
      <p className="mt-3 text-lg font-semibold text-content-primary">{point?.total} Marks</p>
      <p className="mt-1 text-sm text-content-secondary">
        {point?.grade} • {point?.result}
      </p>
    </div>
  );
}

function SectionCard({ title, subtitle, children, className = '' }) {
  return (
    <section className={`section card-hover relative overflow-hidden p-5 sm:p-6 ${className}`.trim()}>
      <div className="relative z-[1]">
        <h3 className="section-title">{title}</h3>
        {subtitle ? <p className="section-subtitle mt-1">{subtitle}</p> : null}
      </div>
      <div className="relative z-[1] mt-5">{children}</div>
    </section>
  );
}

function StatTile({ label, value, tone = 'text-content-primary' }) {
  return (
    <div className="section-muted p-4">
      <p className="metric-label">{label}</p>
      <p className={`mt-3 text-2xl font-display font-bold ${tone}`}>{value}</p>
    </div>
  );
}

export default function StudentProgressDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currentUser = authService.getCurrentUser();

  const loadStudentDetail = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await studentsAPI.getById(id);
      setDetail(response.data.data || null);
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Unable to load student progress details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadStudentDetail();
  }, [loadStudentDetail]);

  const overview = detail?.overview || {};
  const statusTone = getStatusTone(overview.performanceCategory);

  const cgpaTrend = useMemo(
    () => (detail?.cgpaTrend || []).map((item) => ({ label: item.label, value: item.cgpa })),
    [detail]
  );

  const attendanceTrend = useMemo(
    () => (detail?.attendanceTrend || []).map((item) => ({ label: item.label, value: item.attendancePercentage })),
    [detail]
  );

  const subjectPerformance = useMemo(
    () => (detail?.subjectPerformance || []).map((item) => ({ ...item, label: item.subject })),
    [detail]
  );

  const comparisonData = useMemo(
    () => ([
      { label: 'Student', value: Number(detail?.comparison?.studentCgpa || 0), fill: '#60a5fa' },
      { label: 'Dept Avg', value: Number(detail?.comparison?.departmentAverageCgpa || 0), fill: '#fbbf24' },
    ]),
    [detail]
  );

  const backPath = location.state?.backTo || (currentUser?.role === 'staff' ? '/staff-dashboard/students' : '/student-progress');
  const backLabel = location.state?.backLabel || (currentUser?.role === 'staff' ? 'Back to Student Monitoring' : 'Back to Top Students');

  return (
    <div className="flex min-h-full flex-col">
      <Navbar
        title={loading ? 'Student Progress' : `${overview.name || 'Student'} Progress`}
        subtitle="Detailed academic analytics dashboard"
        onRefresh={loadStudentDetail}
        loading={loading}
      />

      <div className="dashboard-container flex-1">
        <div className="flex items-center justify-between gap-3">
          <button type="button" className="btn-secondary" onClick={() => navigate(backPath)}>
            <ArrowLeft size={15} />
            {backLabel}
          </button>
          {!loading && overview.performanceCategory ? (
            <span className={statusTone.badge}>{overview.performanceCategory}</span>
          ) : null}
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="section p-6">
              <div className="skeleton h-6 w-52" />
              <div className="skeleton mt-3 h-4 w-80" />
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="skeleton h-24 rounded-3xl" />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="section p-6">
                  <div className="skeleton h-5 w-40" />
                  <div className="skeleton mt-3 h-[260px] w-full rounded-3xl" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!loading && error ? <div className="empty-state min-h-[18rem]">{error}</div> : null}

        {!loading && !error && detail ? (
          <div className="space-y-4">
            <SectionCard
              title="Student Overview"
              subtitle="Academic identity, current standing, and performance score"
              className="overflow-hidden"
            >
              <div
                className="rounded-[1.6rem] border border-white/8 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                style={{
                  background: `radial-gradient(circle at top right, ${statusTone.glow}, transparent 36%), rgba(2, 6, 23, 0.18)`,
                }}
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="eyebrow">Student Profile</p>
                    <h2 className="mt-2 text-3xl font-semibold text-content-primary">{overview.name}</h2>
                    <p className="mt-2 text-sm text-content-secondary">
                      {overview.rollNumber} • {overview.department?.name}
                    </p>
                  </div>
                  <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/28 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="metric-label">Performance Score</p>
                        <p className={`mt-2 text-3xl font-display font-bold ${statusTone.text}`}>
                          {Number(overview.performanceScore || 0).toFixed(1)}
                        </p>
                      </div>
                      <span className={statusTone.badge}>{overview.performanceCategory}</span>
                    </div>
                    <div className="mt-4 h-3 overflow-hidden rounded-pill bg-panel-muted">
                      <div
                        className={`h-full rounded-pill bg-gradient-to-r ${statusTone.fill}`}
                        style={{ width: `${Math.max(0, Math.min(Number(overview.performanceScore || 0), 100))}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <StatTile label="Department" value={overview.department?.code || 'NA'} tone="text-sky-300" />
                  <StatTile label="Batch" value={overview.batchYear || 'NA'} />
                  <StatTile label="CGPA" value={Number(overview.cgpa || 0).toFixed(2)} tone="text-amber-300" />
                  <StatTile label="Attendance" value={`${Number(overview.attendancePercentage || 0).toFixed(1)}%`} tone="text-emerald-300" />
                  <StatTile label="Backlogs" value={overview.currentBacklogs || 0} tone="text-rose-300" />
                  <StatTile label="Current Semester" value={`Sem ${overview.currentSemester || 'NA'}`} />
                  <StatTile label="Roll Number" value={overview.rollNumber || 'NA'} />
                  <StatTile label="Status" value={overview.performanceCategory || 'Average'} tone={statusTone.text} />
                </div>
              </div>
            </SectionCard>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <SectionCard title="CGPA Trend Chart" subtitle="Semester-wise CGPA progression">
                <div className="chart-surface">
                  {cgpaTrend.length === 0 ? (
                    <div className="empty-state h-[260px]">No CGPA trend data available.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={cgpaTrend} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
                        <defs>
                          <linearGradient id="student-cgpa-line" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#7dd3fc" />
                            <stop offset="100%" stopColor="#3b82f6" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(120, 140, 180, 0.18)" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={12} />
                        <YAxis domain={[0, 10]} tickLine={false} axisLine={false} tickMargin={10} />
                        <Tooltip content={<TrendTooltip suffix="" />} />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="url(#student-cgpa-line)"
                          strokeWidth={3.2}
                          dot={{ r: 4.5, fill: '#7dd3fc', stroke: '#0f172a', strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: '#dbeafe', stroke: '#60a5fa', strokeWidth: 2 }}
                          animationDuration={1200}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Attendance Trend" subtitle="Semester-wise attendance percentage">
                <div className="chart-surface">
                  {attendanceTrend.length === 0 ? (
                    <div className="empty-state h-[260px]">No attendance trend data available.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={attendanceTrend} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
                        <defs>
                          <linearGradient id="student-attendance-line" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#86efac" />
                            <stop offset="100%" stopColor="#10b981" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(120, 140, 180, 0.18)" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={12} />
                        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tickMargin={10} />
                        <Tooltip content={<TrendTooltip suffix="%" />} />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="url(#student-attendance-line)"
                          strokeWidth={3.2}
                          dot={{ r: 4.5, fill: '#86efac', stroke: '#052e16', strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: '#dcfce7', stroke: '#10b981', strokeWidth: 2 }}
                          animationDuration={1200}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </SectionCard>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <SectionCard
                title="Subject Performance"
                subtitle={subjectPerformance[0] ? `Latest semester subject marks (${subjectPerformance[0].academicYear})` : 'Latest semester marks'}
              >
                <div className="chart-surface">
                  {subjectPerformance.length === 0 ? (
                    <div className="empty-state h-[280px]">No subject performance data available.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(280, subjectPerformance.length * 52)}>
                      <BarChart data={subjectPerformance} layout="vertical" margin={{ top: 8, right: 22, left: 20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 6" horizontal={false} stroke="rgba(120, 140, 180, 0.12)" />
                        <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} />
                        <YAxis
                          type="category"
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          width={140}
                        />
                        <Tooltip content={<SubjectTooltip />} />
                        <Bar dataKey="total" radius={[0, 12, 12, 0]} animationDuration={1100}>
                          {subjectPerformance.map((item) => (
                            <Cell key={item.code} fill={subjectBarColor(item.total)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Performance Comparison" subtitle="CGPA vs department average">
                <div className="chart-surface">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={comparisonData} margin={{ top: 16, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(120, 140, 180, 0.18)" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={12} />
                      <YAxis domain={[0, 10]} tickLine={false} axisLine={false} tickMargin={10} />
                      <Tooltip content={<TrendTooltip suffix="" />} />
                      <Bar dataKey="value" radius={[14, 14, 6, 6]} animationDuration={1100}>
                        {comparisonData.map((item) => (
                          <Cell key={item.label} fill={item.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <SectionCard title="Backlog History" subtitle="Failed subjects and their academic timeline">
                {detail.backlogHistory?.length ? (
                  <div className="space-y-3">
                    {detail.backlogHistory.map((entry, index) => (
                      <div key={`${entry.code}-${index}`} className="section-muted flex items-center justify-between gap-4 p-4">
                        <div>
                          <p className="font-semibold text-content-primary">{entry.subject}</p>
                          <p className="mt-1 text-xs text-content-muted">
                            {entry.code} • Sem {entry.semester} • {entry.academicYear}
                          </p>
                        </div>
                        <div className="text-right text-xs text-content-secondary">
                          <p>Attempts: {entry.attempts}</p>
                          <p>{entry.clearedInSemester ? `Cleared in Sem ${entry.clearedInSemester}` : 'Pending clearance'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state min-h-[14rem]">No backlog history.</div>
                )}
              </SectionCard>

              <SectionCard title="Academic Insights" subtitle="Generated takeaways from performance, attendance, and subject trends">
                <div className="space-y-3">
                  {(detail.insights || []).map((insight, index) => {
                    const toneClass =
                      insight.tone === 'positive'
                        ? 'border-emerald-400/20 bg-emerald-400/8'
                        : insight.tone === 'warning'
                          ? 'border-amber-400/20 bg-amber-400/8'
                          : 'border-info/20 bg-info/8';

                    const Icon =
                      insight.tone === 'positive'
                        ? TrendingUp
                        : insight.tone === 'warning'
                          ? AlertTriangle
                          : Sparkles;

                    return (
                      <div key={`${insight.title}-${index}`} className={`rounded-3xl border p-4 ${toneClass}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04] text-content-primary">
                            <Icon size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-content-primary">{insight.title}</p>
                            <p className="mt-1 text-sm leading-6 text-content-secondary">{insight.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
