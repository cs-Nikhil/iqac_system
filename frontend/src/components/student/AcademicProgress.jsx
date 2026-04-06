import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BookOpenCheck, GraduationCap, LineChart } from 'lucide-react';

const formatNumber = (value) => Number(value || 0).toFixed(2);

function ProgressTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="chart-tooltip min-w-[11rem] text-xs">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-content-muted">
        Semester {label}
      </p>
      <div className="mt-3 space-y-2">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="font-medium" style={{ color: entry.color }}>
              {entry.name}
            </span>
            <span className="font-semibold text-content-primary">{formatNumber(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AcademicProgress({ data, loading }) {
  const summary = data?.summary || {};
  const semesterPerformance = data?.semesterPerformance || [];
  const semesterResults = data?.semesterResults || [];
  const recentMarks = (data?.marks || []).slice(-6).reverse();

  return (
    <section className="card flex h-full flex-col gap-5 p-6">
      <div className="section-header">
        <div>
          <p className="eyebrow">Academic Progress</p>
          <h3 className="mt-1 text-xl font-semibold text-content-primary">Semester results and CGPA growth</h3>
          <p className="section-subtitle mt-1">Track semester performance, subject marks, and pass momentum.</p>
        </div>
        <div className="badge badge-info">{semesterPerformance.length} semesters tracked</div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Current CGPA', value: formatNumber(summary.cgpa), icon: GraduationCap },
          { label: 'Pass Percentage', value: `${formatNumber(summary.passPercentage)}%`, icon: BookOpenCheck },
          { label: 'Credits Earned', value: summary.earnedCredits || 0, icon: LineChart },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="section-muted flex items-center gap-4 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/12 text-brand-200">
              <Icon size={18} />
            </div>
            <div>
              <p className="metric-label">{label}</p>
              <p className="mt-1 text-xl font-semibold text-content-primary">{loading ? '--' : value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.9fr)]">
        <div className="surface-inset p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="metric-label">CGPA Trend</p>
              <p className="metric-note mt-1">Semester-wise SGPA and CGPA progression.</p>
            </div>
          </div>
          <div className="chart-surface chart-shell mt-4 min-h-[17rem]">
            {loading ? (
              <div className="skeleton h-full w-full rounded-2xl" />
            ) : semesterPerformance.length === 0 ? (
              <div className="empty-state h-full">No semester performance available yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={semesterPerformance} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cgpaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4d7eff" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#4d7eff" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="semester" tickFormatter={(value) => `Sem ${value}`} />
                  <YAxis domain={[0, 10]} />
                  <Tooltip content={<ProgressTooltip />} />
                  <Area type="monotone" dataKey="cgpa" stroke="#4d7eff" fill="url(#cgpaFill)" strokeWidth={3} />
                  <Area type="monotone" dataKey="sgpa" stroke="#38bdf8" fillOpacity={0} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface-inset p-4">
            <p className="metric-label">Semester Overview</p>
            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="space-y-3">
                  <div className="skeleton-line w-full" />
                  <div className="skeleton-line w-5/6" />
                  <div className="skeleton-line w-4/6" />
                </div>
              ) : semesterResults.length === 0 ? (
                <div className="empty-state min-h-[9rem]">Semester result summaries will appear after marks are published.</div>
              ) : semesterResults.slice(-4).reverse().map((semester) => (
                <div key={semester.semester} className="rounded-xl border border-line/60 bg-panel-subtle/80 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-content-primary">Semester {semester.semester}</p>
                      <p className="text-xs text-content-muted">{semester.academicYear}</p>
                    </div>
                    <span className="badge badge-success">{formatNumber(semester.passPercentage)}%</span>
                  </div>
                  <p className="mt-2 text-xs text-content-secondary">{semester.subjects.length} subjects evaluated</p>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-inset p-4">
            <p className="metric-label">Recent Subject Marks</p>
            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="space-y-3">
                  <div className="skeleton-line w-full" />
                  <div className="skeleton-line w-4/5" />
                  <div className="skeleton-line w-3/5" />
                </div>
              ) : recentMarks.length === 0 ? (
                <div className="empty-state min-h-[9rem]">No subject marks available yet.</div>
              ) : recentMarks.map((mark) => (
                <div key={mark._id} className="rounded-xl border border-line/60 bg-panel-subtle/80 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-content-primary">{mark.subject?.name}</p>
                      <p className="text-xs text-content-muted">{mark.subject?.code} · Semester {mark.semester}</p>
                    </div>
                    <span className={`badge ${mark.result === 'PASS' ? 'badge-success' : 'badge-danger'}`}>{mark.grade}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-content-secondary">
                    <span>Total {mark.total}</span>
                    <span>Internal {mark.internal} / External {mark.external}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

