import { AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';

function BacklogStat({ label, value, note, icon: Icon, tone = 'brand', progress = 0 }) {
  const iconTone =
    tone === 'warning'
      ? 'student-stat-icon student-stat-icon--warning'
      : tone === 'success'
        ? 'student-stat-icon student-stat-icon--success'
        : tone === 'info'
          ? 'student-stat-icon student-stat-icon--info'
          : 'student-stat-icon student-stat-icon--brand';

  const progressTone =
    tone === 'warning'
      ? 'student-progress-fill student-progress-fill--warning'
      : tone === 'success'
        ? 'student-progress-fill student-progress-fill--success'
        : 'student-progress-fill student-progress-fill--brand';

  return (
    <div className="student-stat-card">
      <div className="student-stat-content space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className={iconTone}>
            <Icon size={18} />
          </div>
          <span className="student-glow-badge badge badge-info">{label}</span>
        </div>
        <div>
          <p className="metric-label">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-content-primary">{value}</p>
          <p className="mt-2 text-sm text-content-secondary">{note}</p>
        </div>
        <div className="student-progress-track">
          <div className={progressTone} style={{ width: `${Math.max(10, Math.min(100, Number(progress || 0)))}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function BacklogTracker({ data, loading }) {
  const summary = data?.summary || {};
  const backlogs = data?.backlogs || [];

  return (
    <section className="student-shell flex h-full flex-col gap-6 p-6 sm:p-7">
      <div className="section-header">
        <div>
          <p className="eyebrow">Backlog Tracker</p>
          <h3 className="mt-1 text-2xl font-semibold text-content-primary">Monitor failed subjects and recovery status</h3>
          <p className="section-subtitle mt-2">See active backlogs, previous clearances, and improvement eligibility.</p>
        </div>
        <div className={`badge student-glow-badge ${summary.currentBacklogs ? 'badge-warning' : 'badge-success'}`}>
          {summary.currentBacklogs || 0} active
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <BacklogStat
          label="Current Backlogs"
          value={loading ? '--' : summary.currentBacklogs || 0}
          note="Subjects awaiting clearance"
          icon={AlertCircle}
          tone="warning"
          progress={summary.currentBacklogs ? Math.min(100, summary.currentBacklogs * 18) : 8}
        />
        <BacklogStat
          label="Backlogs Cleared"
          value={loading ? '--' : summary.totalBacklogsCleared || 0}
          note="Recovered subjects on record"
          icon={CheckCircle2}
          tone="success"
          progress={summary.totalBacklogsCleared ? Math.min(100, summary.totalBacklogsCleared * 14) : 10}
        />
        <BacklogStat
          label="Backlog Rate"
          value={loading ? '--' : `${Number(summary.backlogRate || 0).toFixed(2)}%`}
          note="Current academic pressure indicator"
          icon={RotateCcw}
          tone="info"
          progress={summary.backlogRate || 10}
        />
      </div>

      <div className="student-shell-muted p-5 sm:p-6">
        <p className="metric-label">Failed Subjects</p>
        <div className="mt-5 space-y-4">
          {loading ? (
            <div className="space-y-4">
              <div className="skeleton h-28 rounded-[24px]" />
              <div className="skeleton h-28 rounded-[24px]" />
            </div>
          ) : backlogs.length === 0 ? (
            <div className="empty-state min-h-[12rem]">No active backlog subjects. You are fully clear on current records.</div>
          ) : backlogs.map((backlog) => (
            <div key={`${backlog.subject?._id || backlog.subject?.code}-${backlog.semester}`} className="student-list-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-content-primary">{backlog.subject?.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-content-muted">{backlog.subject?.code} · Semester {backlog.semester}</p>
                </div>
                <span className="badge student-glow-badge badge-warning">Attempt {backlog.attempts}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-content-secondary">
                <span>Total {backlog.total}</span>
                <span className="text-content-muted">•</span>
                <span>{backlog.academicYear}</span>
                <span className="text-content-muted">•</span>
                <span>{backlog.improvementEligible ? 'Eligible for improvement exam' : 'Review pending'}</span>
              </div>
              <div className="student-progress-track">
                <div className="student-progress-fill student-progress-fill--warning" style={{ width: `${Math.max(12, Math.min(100, (Number(backlog.attempts || 1) / 5) * 100))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
