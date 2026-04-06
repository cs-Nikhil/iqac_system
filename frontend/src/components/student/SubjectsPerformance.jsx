import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpenText,
  CheckCircle2,
  GraduationCap,
  TrendingUp,
} from 'lucide-react';
import { studentPortalAPI } from '../../services/api';

const SEMESTERS = Array.from({ length: 8 }, (_, index) => index + 1);

const clampSemester = (value, fallback = 1) => {
  const normalized = Number(value);

  if (!Number.isFinite(normalized)) {
    return fallback;
  }

  return Math.min(8, Math.max(1, Math.trunc(normalized)));
};

const formatDecimal = (value, digits = 2) => Number(value || 0).toFixed(digits);
const formatWholeNumber = (value) => Number(value || 0).toFixed(0);

function SummaryMetric({ label, value, note, icon: Icon, tone, progress = 0 }) {
  const toneClass =
    tone === 'success'
      ? 'student-stat-icon student-stat-icon--success'
      : tone === 'warning'
        ? 'student-stat-icon student-stat-icon--warning'
        : 'student-stat-icon student-stat-icon--brand';

  const progressTone =
    tone === 'success'
      ? 'student-progress-fill student-progress-fill--success'
      : tone === 'warning'
        ? 'student-progress-fill student-progress-fill--warning'
        : 'student-progress-fill student-progress-fill--brand';

  return (
    <div className="student-stat-card">
      <div className="student-stat-content space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className={toneClass}>
            <Icon size={19} />
          </div>
          <span className="badge student-glow-badge badge-info">{label}</span>
        </div>

        <div>
          <p className="metric-label">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-content-primary">{value}</p>
          <p className="mt-2 text-sm text-content-secondary">{note}</p>
        </div>

        <div className="student-progress-track">
          <div className={progressTone} style={{ width: `${Math.max(12, Math.min(100, progress))}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function SubjectsPerformance({ currentSemester, loading: dashboardLoading }) {
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [semesterCache, setSemesterCache] = useState({});
  const [loadingSemester, setLoadingSemester] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentSemester) {
      return;
    }

    setSelectedSemester((activeSemester) => activeSemester ?? clampSemester(currentSemester));
  }, [currentSemester]);

  useEffect(() => {
    if (!selectedSemester || dashboardLoading) {
      return;
    }

    if (semesterCache[selectedSemester]) {
      return;
    }

    const semesterToLoad = selectedSemester;
    let cancelled = false;

    setLoadingSemester(semesterToLoad);
    setError('');

    studentPortalAPI
      .getSubjectsPerformance(semesterToLoad)
      .then((response) => {
        if (cancelled) {
          return;
        }

        setSemesterCache((currentCache) => ({
          ...currentCache,
          [semesterToLoad]: response.data?.data ?? null,
        }));
      })
      .catch((requestError) => {
        if (cancelled) {
          return;
        }

        setError(requestError.response?.data?.message || 'Unable to load semester subjects right now.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSemester((activeSemester) =>
            activeSemester === semesterToLoad ? null : activeSemester
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dashboardLoading, selectedSemester, semesterCache]);

  const semesterPayload = selectedSemester ? semesterCache[selectedSemester] : null;
  const semesterData = semesterPayload?.semester || null;
  const summary = semesterData?.summary || {};
  const subjects = semesterData?.subjects || [];
  const availableSemesters = semesterPayload?.availableSemesters || SEMESTERS;
  const isLoading = dashboardLoading || (!semesterPayload && loadingSemester === selectedSemester);
  const performanceLevel = Math.min(100, Math.max(0, Number(summary.performanceLevel || 0)));
  const hasFailures = Number(summary.failedSubjects || 0) > 0;

  const retryCurrentSemester = () => {
    if (!selectedSemester) {
      return;
    }

    setError('');
    setSemesterCache((currentCache) => {
      const nextCache = { ...currentCache };
      delete nextCache[selectedSemester];
      return nextCache;
    });
  };

  return (
    <section className="student-shell relative flex h-full flex-col gap-6 overflow-hidden p-6 sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_24%)]" />

      <div className="relative flex flex-col gap-6">
        <div className="section-header">
          <div>
            <p className="eyebrow">Academic Records</p>
            <h3 className="mt-1 text-xl font-semibold text-content-primary">Subjects &amp; Performance</h3>
            <p className="section-subtitle mt-1">View your semester-wise academic records</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-info">
              {semesterData?.academicYear || 'Academic year pending'}
            </span>
            <span className={`badge ${hasFailures ? 'badge-warning' : 'badge-success'}`}>
              {hasFailures ? `${summary.failedSubjects} backlog ${Number(summary.failedSubjects) === 1 ? 'subject' : 'subjects'}` : 'All subjects clear'}
            </span>
          </div>
        </div>

        <div className="student-shell-muted p-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {availableSemesters.map((semester) => {
              const isActive = selectedSemester === semester;
              const isPending = loadingSemester === semester && !semesterCache[semester];

              return (
                <button
                  key={semester}
                  type="button"
                  onClick={() => {
                    setError('');
                    setSelectedSemester(semester);
                  }}
                  className={`inline-flex min-w-[5.2rem] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition duration-200 ${
                    isActive
                      ? 'border-brand-300/40 bg-brand-500/15 text-content-primary shadow-[0_14px_38px_-20px_rgba(59,130,246,0.85)]'
                      : 'border-white/10 bg-white/[0.03] text-content-secondary hover:border-white/15 hover:bg-white/[0.05] hover:text-content-primary'
                  }`}
                >
                  <span>{`Sem ${semester}`}</span>
                  {isPending ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-200" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        {error && !semesterPayload ? (
          <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-4 text-sm text-danger">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <span>{error}</span>
              <button type="button" className="btn-secondary" onClick={retryCurrentSemester}>
                Retry semester
              </button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {SEMESTERS.slice(0, 4).map((semester) => (
                <div key={semester} className="skeleton h-28 rounded-2xl" />
              ))}
            </div>
            <div className="skeleton h-16 rounded-2xl" />
            <div className="skeleton h-[22rem] rounded-[1.5rem]" />
          </div>
        ) : semesterData ? (
          <>
            <div className="student-shell-muted p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="metric-label">Semester Summary</p>
                  <h4 className="mt-2 text-2xl font-semibold tracking-tight text-content-primary">
                    {`Semester ${semesterData.sem} performance snapshot`}
                  </h4>
                  <p className="mt-2 max-w-2xl text-sm text-content-secondary">
                    Review published subjects, latest marks, grades, and pass status for the selected semester.
                  </p>
                </div>
                <div className="student-shell-muted px-4 py-3 text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-content-muted">Average marks</p>
                  <p className="mt-2 text-2xl font-semibold text-content-primary">
                    {formatDecimal(summary.averageMarks)}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SummaryMetric
                  label="SGPA"
                  value={formatDecimal(semesterData.sgpa)}
                  note={`Semester ${semesterData.sem} GPA summary`}
                  icon={GraduationCap}
                  tone="brand"
                  progress={Number(semesterData.sgpa || 0) * 10}
                />
                <SummaryMetric
                  label="Total Subjects"
                  value={formatWholeNumber(summary.totalSubjects)}
                  note={`${formatWholeNumber(summary.totalCredits)} credits registered`}
                  icon={BookOpenText}
                  tone="brand"
                  progress={Math.min(100, Math.max(12, Number(summary.totalSubjects || 0) * 12))}
                />
                <SummaryMetric
                  label="Passed Subjects"
                  value={formatWholeNumber(summary.passedSubjects)}
                  note={`${formatDecimal(summary.passPercentage)}% pass ratio`}
                  icon={CheckCircle2}
                  tone="success"
                  progress={Number(summary.passPercentage || 0)}
                />
                <SummaryMetric
                  label="Failed Subjects"
                  value={formatWholeNumber(summary.failedSubjects)}
                  note="Failed subjects automatically flow to Backlogs"
                  icon={AlertTriangle}
                  tone="warning"
                  progress={Math.min(100, Math.max(12, Number(summary.failedSubjects || 0) * 20))}
                />
              </div>

              <div className="mt-5 student-shell-muted p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-400/15 bg-brand-500/10 text-brand-200">
                      <TrendingUp size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-content-primary">Performance level</p>
                      <p className="text-xs text-content-muted">Calculated from semester SGPA and latest subject attempts</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-content-primary">{`${formatWholeNumber(performanceLevel)}%`}</p>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      hasFailures
                        ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400'
                        : 'bg-gradient-to-r from-emerald-400 via-cyan-400 to-brand-400'
                    }`}
                    style={{ width: `${performanceLevel}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/15 shadow-[0_22px_60px_-46px_rgba(15,23,42,0.95)] backdrop-blur-md">
              <div className="flex flex-col gap-3 border-b border-white/10 bg-white/[0.04] px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-content-primary">{`Semester ${semesterData.sem} subjects`}</p>
                  <p className="mt-1 text-xs text-content-muted">
                    Total marks are auto-calculated from internal and external scores.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-content-muted">
                  <span className="rounded-full border border-white/10 px-3 py-1">Passing total: 40</span>
                  <span className="rounded-full border border-white/10 px-3 py-1">Passing external: 24</span>
                </div>
              </div>

              {subjects.length === 0 ? (
                <div className="empty-state m-5">{`No published subjects for Semester ${selectedSemester} yet.`}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-white/10">
                      <tr>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted">Subject Code</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted">Subject Name</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted">Internal Marks</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted">External Marks</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted">Total Marks</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted">Grade</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map((subject) => {
                        const totalMarks = Number(subject.total ?? (subject.internal + subject.external) ?? 0);

                        return (
                          <tr
                            key={subject._id || `${subject.code}-${subject.name}`}
                            className="border-b border-white/10 transition duration-200 hover:bg-white/[0.04]"
                          >
                            <td className="px-5 py-4 align-middle text-content-secondary">{subject.code}</td>
                            <td className="px-5 py-4 align-middle">
                              <div>
                                <p className="font-semibold text-content-primary">{subject.name}</p>
                                <p className="mt-1 text-xs text-content-muted">{subject.type}</p>
                              </div>
                            </td>
                            <td className="px-5 py-4 align-middle text-content-secondary">{formatWholeNumber(subject.internal)}</td>
                            <td className="px-5 py-4 align-middle text-content-secondary">{formatWholeNumber(subject.external)}</td>
                            <td className="px-5 py-4 align-middle text-content-primary">{formatWholeNumber(totalMarks)}</td>
                            <td className="px-5 py-4 align-middle">
                              <span className="inline-flex min-w-[3.25rem] items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-content-primary">
                                {subject.grade}
                              </span>
                            </td>
                            <td className="px-5 py-4 align-middle">
                              <span
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                                  subject.status === 'Pass'
                                    ? 'border-emerald-400/20 bg-emerald-500/12 text-emerald-300'
                                    : 'border-rose-400/20 bg-rose-500/12 text-rose-300'
                                }`}
                              >
                                {subject.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p className="text-xs text-content-muted">
              Failed subjects are automatically treated as backlogs and stay available in the Backlogs module.
            </p>
          </>
        ) : (
          <div className="empty-state">Select a semester to review your academic subjects and performance.</div>
        )}
      </div>
    </section>
  );
}
