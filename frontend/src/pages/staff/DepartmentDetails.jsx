import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Download,
  GraduationCap,
  Layers3,
  Loader2,
  Medal,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
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
import { downloadBlob } from './shared';

const getAcademicYearValue = (startYear) =>
  `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;

const today = new Date();
const currentAcademicStartYear =
  today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
const currentAcademicYear = getAcademicYearValue(currentAcademicStartYear);

const formatDecimal = (value) => Number(value || 0).toFixed(2);
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

function AnimatedNumber({ value, decimals = 0, suffix = '' }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const target = Number(value || 0);
    const duration = 800;
    const startTime = performance.now();
    let frameId;

    const animate = (timestamp) => {
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - ((1 - progress) ** 3);
      setDisplayValue(target * eased);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return `${displayValue.toFixed(decimals)}${suffix}`;
}

function SummaryCard({ label, value, note, icon: Icon, accent = 'blue', decimals = 0, suffix = '' }) {
  const styles = {
    blue: 'border-blue-400/18 bg-[linear-gradient(180deg,rgba(18,39,84,0.92),rgba(8,18,44,0.84))] shadow-[0_24px_70px_-52px_rgba(59,130,246,0.88)]',
    emerald: 'border-emerald-400/18 bg-[linear-gradient(180deg,rgba(8,49,50,0.92),rgba(5,21,24,0.84))] shadow-[0_24px_70px_-52px_rgba(16,185,129,0.82)]',
    violet: 'border-violet-400/18 bg-[linear-gradient(180deg,rgba(36,26,78,0.92),rgba(14,10,34,0.84))] shadow-[0_24px_70px_-52px_rgba(139,92,246,0.82)]',
    amber: 'border-amber-400/18 bg-[linear-gradient(180deg,rgba(67,39,11,0.92),rgba(25,14,5,0.84))] shadow-[0_24px_70px_-52px_rgba(245,158,11,0.84)]',
  }[accent];

  return (
    <div className={`rounded-[24px] border p-5 transition duration-300 hover:-translate-y-1 hover:scale-[1.03] ${styles}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/62">{label}</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-content-primary">
            <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
          </p>
          <p className="mt-2 text-sm text-content-secondary">{note}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/90">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function SummaryCardSkeleton() {
  return (
    <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,18,40,0.96),rgba(5,11,25,0.92))] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="skeleton-line w-24" />
          <div className="skeleton mt-4 h-10 w-28 rounded-2xl" />
          <div className="skeleton-line mt-3 w-40" />
        </div>
        <div className="skeleton h-11 w-11 rounded-2xl" />
      </div>
    </div>
  );
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const passMetric = payload.find((entry) => entry.dataKey === 'passPercentage');
  const cgpaMetric = payload.find((entry) => entry.dataKey === 'avgCgpa');

  return (
    <div className="chart-tooltip rounded-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-content-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-content-primary">Pass Rate: {formatPercent(passMetric?.value)}</p>
      <p className="mt-1 text-sm text-content-secondary">Avg CGPA: {formatDecimal(cgpaMetric?.value)}</p>
    </div>
  );
}

function ChartEmptyState() {
  return (
    <div className="relative min-h-[18rem] overflow-hidden rounded-[22px] border border-dashed border-line/70 bg-panel-subtle/50">
      <div className="absolute inset-x-6 bottom-6 flex items-end gap-4 opacity-55">
        {[28, 44, 34, 56, 42, 62].map((height, index) => (
          <div key={height} className="flex-1">
            <div className="skeleton mx-auto w-full max-w-[44px] rounded-t-[18px]" style={{ height: `${height}%` }} />
          </div>
        ))}
      </div>

      <svg className="absolute inset-x-10 top-8 h-[68%] w-[calc(100%-5rem)] opacity-35" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true">
        <path d="M 0 38 C 12 26, 24 30, 36 20 S 60 8, 72 16 S 88 26, 100 10" fill="none" stroke="rgba(52,211,153,0.55)" strokeWidth="2.5" strokeDasharray="5 6" />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/14 bg-blue-500/10 text-blue-200">
          <BarChart3 size={18} />
        </div>
        <p className="mt-4 text-base font-semibold text-content-primary">No semester data available yet</p>
        <p className="mt-2 max-w-md text-sm leading-6 text-content-secondary">Data will appear once results are added.</p>
      </div>
    </div>
  );
}

function SubjectsEmptyState() {
  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center rounded-[22px] border border-dashed border-emerald-400/16 bg-emerald-500/[0.04] px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/16 bg-emerald-500/10 text-emerald-200">
        <BookOpen size={18} />
      </div>
      <p className="mt-4 text-base font-semibold text-content-primary">No critical subjects detected</p>
      <p className="mt-2 max-w-md text-sm leading-6 text-content-secondary">All subjects are performing well.</p>
    </div>
  );
}

function InsightsEmptyState() {
  return (
    <div className="rounded-[22px] border border-blue-400/16 bg-blue-500/[0.05] p-5 md:col-span-3">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/16 bg-blue-500/10 text-blue-200">
          <Sparkles size={18} />
        </div>
        <div>
          <p className="text-base font-semibold text-content-primary">Insights will be generated automatically</p>
          <p className="mt-2 text-sm leading-6 text-content-secondary">Add more academic data to unlock insights for this department.</p>
        </div>
      </div>
    </div>
  );
}

function SubjectBar({ subject, maxFailCount }) {
  const width = maxFailCount ? (subject.failCount / maxFailCount) * 100 : 0;
  const toneClass =
    subject.severity === 'critical'
      ? 'from-rose-400 to-amber-400'
      : subject.severity === 'warning'
        ? 'from-amber-300 to-orange-400'
        : 'from-emerald-300 to-emerald-500';

  return (
    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4 transition duration-300 hover:scale-[1.03]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-content-primary">{subject.name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-content-muted">{subject.code}</p>
        </div>
        <span className={subject.severity === 'critical' ? 'badge badge-danger' : subject.severity === 'warning' ? 'badge badge-warning' : 'badge badge-success'}>
          {subject.failCount} backlogs
        </span>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${toneClass}`}
          style={{ width: `${Math.min(width, 100)}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-content-muted">
        <span>Pass rate {formatPercent(subject.passPercentage)}</span>
        <span>{subject.totalEntries} attempts</span>
      </div>
    </div>
  );
}

export default function DepartmentDetails() {
  const { departmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [detail, setDetail] = useState(null);

  const academicYear = location.state?.academicYear || currentAcademicYear;

  const loadData = useCallback(async () => {
    if (!departmentId) return;

    setLoading(true);
    try {
      const response = await staffAPI.getDepartmentDetails(departmentId, { academicYear });
      setDetail(response.data.data || null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [academicYear, departmentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = detail?.summary || {};
  const performanceTrend = detail?.performanceTrend || [];
  const topSubjects = detail?.backlogAnalysis?.topSubjects || [];
  const insights = detail?.insights || [];
  const maxFailCount = Math.max(...topSubjects.map((subject) => subject.failCount || 0), 1);
  const backlogStudents = detail?.backlogAnalysis?.totalBacklogStudents || 0;
  const backlogSeverity = summary.totalStudents
    ? Math.round((backlogStudents / summary.totalStudents) * 100)
    : 0;

  const trendHeadline = useMemo(() => {
    if (performanceTrend.length < 2) {
      return 'Performance trend is building as more semester records are captured.';
    }

    const firstPoint = performanceTrend[0];
    const latestPoint = performanceTrend[performanceTrend.length - 1];
    const cgpaDelta = latestPoint.avgCgpa - firstPoint.avgCgpa;

    if (Math.abs(cgpaDelta) <= 0.12) {
      return 'CGPA trend is stable across the observed semesters.';
    }

    return `CGPA has ${cgpaDelta > 0 ? 'improved' : 'softened'} by ${Math.abs(cgpaDelta).toFixed(2)} points from ${firstPoint.label} to ${latestPoint.label}.`;
  }, [performanceTrend]);

  const handleDownload = async () => {
    if (!departmentId) return;

    setBusyAction('download');
    try {
      const response = await staffAPI.exportDepartmentReport({
        format: 'pdf',
        department: departmentId,
        academicYear,
      });
      downloadBlob(response.data, `${summary.code || 'department'}-department-report.pdf`);
    } catch (error) {
      console.error(error);
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <Navbar
        title="Department Details"
        subtitle="A focused staff snapshot of department performance, backlog pressure, and report readiness."
        onRefresh={loadData}
        loading={loading}
        compact
      />

      <div className="dashboard-container flex-1 py-6">
        <section className={`relative overflow-hidden rounded-[28px] border p-6 shadow-[0_26px_90px_-56px_rgba(15,23,42,0.98)] sm:p-7 ${summary.isTopDepartment ? 'border-blue-400/18 bg-[linear-gradient(135deg,rgba(12,33,88,0.96),rgba(4,10,24,0.92))]' : 'border-white/10 bg-[linear-gradient(135deg,rgba(8,15,36,0.96),rgba(4,10,24,0.92))]'}`}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_82%_14%,rgba(16,185,129,0.14),transparent_24%)]" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <button type="button" className="btn-ghost px-0 text-content-muted hover:bg-transparent" onClick={() => navigate('/staff-dashboard/departments')}>
                <ArrowLeft size={16} />
                Back to Departments
              </button>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="badge badge-info">{academicYear}</span>
                {summary.rank ? (
                  <span className={summary.isTopDepartment ? 'badge badge-info' : 'badge badge-warning'}>
                    Rank {summary.rank}
                  </span>
                ) : null}
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-content-primary sm:text-[2.2rem]">
                {summary.name ? `${summary.name} (${summary.code})` : 'Department'}
              </h2>
              <p className="mt-3 text-sm leading-7 text-content-secondary">
                {summary.isTopDepartment
                  ? `${summary.code || 'This department'} is currently the top performing department in the selected academic year.`
                  : `${summary.code || 'This department'} performance snapshot for academic review and reporting.`}
              </p>
            </div>

            <button type="button" className="btn-primary" onClick={handleDownload} disabled={busyAction === 'download'}>
              {busyAction === 'download' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {busyAction === 'download' ? 'Preparing Report...' : 'Download Department Report'}
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            <>
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
            </>
          ) : (
            <>
              <SummaryCard
                label="Total Students"
                value={summary.totalStudents || 0}
                note="Active students currently mapped to this department."
                icon={GraduationCap}
                accent={summary.isTopDepartment ? 'blue' : 'emerald'}
              />
              <SummaryCard
                label="Average CGPA"
                value={summary.avgCgpa || 0}
                decimals={2}
                note="Average academic performance across the department."
                icon={TrendingUp}
                accent="violet"
              />
              <SummaryCard
                label="Pass Percentage"
                value={summary.passPercentage || 0}
                decimals={1}
                suffix="%"
                note="Pass performance for the selected academic cycle."
                icon={BarChart3}
                accent="emerald"
              />
              <SummaryCard
                label="Total Backlogs"
                value={summary.totalBacklogs || 0}
                note={`${summary.backlogStudents || 0} students currently carry backlogs.`}
                icon={Layers3}
                accent="amber"
              />
            </>
          )}
        </section>

        <section className="section overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line/70 px-5 py-4">
            <div>
              <p className="eyebrow">Performance Trend</p>
              <h3 className="mt-2 text-lg font-semibold text-content-primary">Semester-wise Pass % and CGPA</h3>
              <p className="mt-2 text-sm text-content-muted">{trendHeadline}</p>
            </div>
            <span className="badge badge-info">{performanceTrend.length} semesters</span>
          </div>

          <div className="px-5 py-5">
            <div className="chart-surface">
              {loading ? (
                <div className="skeleton min-h-[18rem] rounded-[22px]" />
              ) : performanceTrend.length ? (
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={performanceTrend} margin={{ top: 18, right: 24, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="rgba(125,145,185,0.14)" strokeDasharray="4 7" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
                    <YAxis
                      yAxisId="pass"
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      label={{ value: 'Pass %', angle: -90, position: 'insideLeft', fill: 'rgba(148,163,184,0.85)', fontSize: 12 }}
                    />
                    <YAxis
                      yAxisId="cgpa"
                      orientation="right"
                      domain={[0, 10]}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      label={{ value: 'CGPA', angle: 90, position: 'insideRight', fill: 'rgba(148,163,184,0.85)', fontSize: 12 }}
                    />
                    <Tooltip content={<TrendTooltip />} />
                    <Legend verticalAlign="top" height={30} wrapperStyle={{ color: 'rgba(226,232,240,0.9)', fontSize: 12 }} />
                    <Bar
                      yAxisId="pass"
                      dataKey="passPercentage"
                      name="Pass %"
                      fill="rgba(96,165,250,0.8)"
                      radius={[14, 14, 5, 5]}
                      barSize={26}
                      animationDuration={950}
                    />
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
                <ChartEmptyState />
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="section overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line/70 px-5 py-4">
              <div>
                <p className="eyebrow">Backlog Analysis</p>
                <h3 className="mt-2 text-lg font-semibold text-content-primary">Current backlog pressure</h3>
              </div>
              <span className="badge badge-warning">{summary.backlogStudents || 0} students</span>
            </div>

            <div className="px-5 py-5">
              {loading ? (
                <div className="skeleton min-h-[11rem] rounded-[22px]" />
              ) : backlogStudents === 0 ? (
                <div className="rounded-[22px] border border-emerald-400/18 bg-[linear-gradient(180deg,rgba(8,49,50,0.92),rgba(5,21,24,0.84))] p-5 shadow-[0_24px_70px_-52px_rgba(16,185,129,0.82)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="metric-label">Total Backlog Students</p>
                      <p className="mt-4 text-3xl font-semibold tracking-tight text-content-primary">0</p>
                      <p className="mt-2 text-sm text-content-secondary">No backlog students. The department is currently clear of backlog pressure.</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-emerald-200">
                      <CheckCircle2 size={18} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[22px] border border-amber-400/16 bg-[linear-gradient(180deg,rgba(67,39,11,0.92),rgba(25,14,5,0.84))] p-5 shadow-[0_24px_70px_-52px_rgba(245,158,11,0.84)] transition duration-300 hover:scale-[1.03]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="metric-label">Total Backlog Students</p>
                      <p className="mt-4 text-3xl font-semibold tracking-tight text-content-primary">
                        <AnimatedNumber value={backlogStudents} />
                      </p>
                      <p className="mt-2 text-sm text-content-secondary">Students currently needing backlog recovery support.</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/90">
                      <AlertTriangle size={18} />
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-xs text-content-muted">
                      <span>Backlog severity</span>
                      <span>{formatPercent(backlogSeverity)}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${backlogSeverity >= 35 ? 'from-rose-400 to-amber-400' : backlogSeverity >= 20 ? 'from-amber-300 to-orange-400' : 'from-emerald-300 to-emerald-500'}`}
                        style={{ width: `${Math.min(backlogSeverity, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="section overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line/70 px-5 py-4">
              <div>
                <p className="eyebrow">Critical Subjects</p>
                <h3 className="mt-2 text-lg font-semibold text-content-primary">Top 3 subjects with highest backlogs</h3>
              </div>
              <span className="badge badge-info">{topSubjects.length} subjects</span>
            </div>

            <div className="grid gap-4 px-5 py-5">
              {loading ? (
                <>
                  <div className="skeleton min-h-[6.5rem] rounded-[20px]" />
                  <div className="skeleton min-h-[6.5rem] rounded-[20px]" />
                  <div className="skeleton min-h-[6.5rem] rounded-[20px]" />
                </>
              ) : topSubjects.length ? topSubjects.map((subject) => (
                <SubjectBar key={subject.id || subject.code} subject={subject} maxFailCount={maxFailCount} />
              )) : (
                <SubjectsEmptyState />
              )}
            </div>
          </div>
        </section>

        <section className="section overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line/70 px-5 py-4">
            <div>
              <p className="eyebrow">Insights</p>
              <h3 className="mt-2 text-lg font-semibold text-content-primary">Smart highlights</h3>
            </div>
            <span className="badge badge-info">{insights.length} insights</span>
          </div>

          <div className="grid gap-4 px-5 py-5 md:grid-cols-3">
            {loading ? (
              <>
                <div className="skeleton min-h-[10rem] rounded-[22px]" />
                <div className="skeleton min-h-[10rem] rounded-[22px]" />
                <div className="skeleton min-h-[10rem] rounded-[22px]" />
              </>
            ) : insights.length ? insights.map((insight) => (
              <div
                key={insight.title}
                className={`rounded-[22px] border p-5 transition duration-300 hover:scale-[1.03] ${insight.tone === 'warning' ? 'border-amber-400/18 bg-amber-500/8' : insight.tone === 'success' ? 'border-emerald-400/18 bg-emerald-500/8' : 'border-blue-400/18 bg-blue-500/8'}`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-brand-200">
                  <Sparkles size={17} />
                </div>
                <p className="mt-4 text-sm font-semibold text-content-primary">{insight.title}</p>
                <p className="mt-2 text-sm leading-6 text-content-secondary">{insight.text}</p>
              </div>
            )) : (
              <InsightsEmptyState />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
