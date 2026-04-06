import { useMemo, useState } from 'react';
import { Briefcase, FileBadge2, MapPinned, Sparkles, TrendingUp } from 'lucide-react';
import StudentActionButton from './StudentActionButton';

const formatCurrency = (value) => `${Number(value || 0).toFixed(1)} LPA`;

function PlacementMetric({ label, value, note, icon: Icon, tone = 'brand', progress = 0 }) {
  const toneClass =
    tone === 'success'
      ? 'student-stat-icon student-stat-icon--success'
      : tone === 'warning'
        ? 'student-stat-icon student-stat-icon--warning'
        : tone === 'info'
          ? 'student-stat-icon student-stat-icon--info'
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
          <div className={progressTone} style={{ width: `${Math.max(10, Math.min(100, Number(progress || 0)))}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function PlacementPortal({
  data,
  loading,
  submitting,
  onApply,
  readOnly = false,
  readOnlyReason = '',
}) {
  const [selectedDrive, setSelectedDrive] = useState('');
  const [resume, setResume] = useState(null);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const drives = data?.drives || [];
  const applications = data?.applications || [];
  const stats = data?.stats || {};
  const placementHistory = data?.placementHistory || [];

  const activeDrive = useMemo(
    () => drives.find((drive) => drive._id === selectedDrive) || null,
    [drives, selectedDrive]
  );

  const metricCards = useMemo(
    () => [
      {
        label: 'Eligible Drives',
        value: loading ? '--' : stats.totalOpportunities || 0,
        note: 'Live opportunities aligned to your profile',
        icon: Briefcase,
        tone: 'brand',
        progress: Math.min(100, Math.max(12, Number(stats.totalOpportunities || 0) * 16)),
      },
      {
        label: 'Applications',
        value: loading ? '--' : stats.applications || 0,
        note: 'Submitted placement applications',
        icon: FileBadge2,
        tone: 'info',
        progress: Math.min(100, Math.max(12, Number(stats.applications || 0) * 18)),
      },
      {
        label: 'Department Placements',
        value: loading ? '--' : stats.departmentPlacements || 0,
        note: 'Confirmed placements in your department',
        icon: TrendingUp,
        tone: 'success',
        progress: Math.min(100, Math.max(12, Number(stats.departmentPlacements || 0) * 8)),
      },
      {
        label: 'Avg Package',
        value: loading ? '--' : formatCurrency(stats.averagePackage),
        note: 'Average reported compensation package',
        icon: MapPinned,
        tone: 'warning',
        progress: Math.min(100, Math.max(16, Number(stats.averagePackage || 0) * 10)),
      },
    ],
    [loading, stats]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedDrive) {
      return;
    }

    const payload = new FormData();
    payload.append('driveId', selectedDrive);
    payload.append('notes', notes);
    if (resume) {
      payload.append('resume', resume);
    }

    const result = await onApply(payload);
    if (result?.success === false) {
      setMessage(result.message || 'Unable to submit the placement application.');
      return;
    }

    setMessage('Placement application submitted successfully.');
    setSelectedDrive('');
    setResume(null);
    setNotes('');
  };

  return (
    <section className="student-shell flex h-full flex-col gap-6 p-6 sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.14),transparent_20%)]" />

      <div className="relative flex flex-col gap-6">
        <div className="section-header">
          <div>
            <p className="eyebrow">Placement Portal</p>
            <h3 className="mt-1 text-2xl font-semibold text-content-primary">Explore opportunities and track your placement pipeline</h3>
            <p className="section-subtitle mt-2 max-w-2xl">
              Review eligible drives, submit resumes, and monitor applications and final outcomes from one premium workflow.
            </p>
          </div>
          <div className={`badge student-glow-badge ${readOnly ? 'badge-warning' : 'badge-info'}`}>
            {readOnly ? 'View-only access' : `${drives.length} open drives`}
          </div>
        </div>

        {message ? (
          <div className={`rounded-[24px] border px-4 py-3 text-sm shadow-[0_18px_48px_-32px_rgba(15,23,42,0.95)] backdrop-blur-md ${
            message.includes('successfully')
              ? 'border-success/25 bg-success/10 text-success'
              : 'border-danger/25 bg-danger/10 text-danger'
          }`}>
            {message}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((card) => (
            <PlacementMetric key={card.label} {...card} />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
          <div className="space-y-6">
            <section className="student-shell-muted p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="metric-label">Eligible Placement Drives</p>
                  <p className="mt-2 text-sm text-content-secondary">
                    Review role fit, package, and deadlines before choosing the drive you want to apply for.
                  </p>
                </div>
                <div className="student-stat-icon student-stat-icon--brand h-10 w-10">
                  <Sparkles size={16} />
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {loading ? (
                  <>
                    <div className="skeleton h-40 w-full rounded-[24px]" />
                    <div className="skeleton h-40 w-full rounded-[24px]" />
                  </>
                ) : drives.length === 0 ? (
                  <div className="empty-state min-h-[13rem] md:col-span-2">
                    No open placement drives match your current eligibility yet.
                  </div>
                ) : (
                  drives.map((drive) => {
                    const isActive = selectedDrive === drive._id;

                    return (
                      <button
                        key={drive._id}
                        type="button"
                        onClick={() => {
                          setMessage('');
                          setSelectedDrive(drive._id);
                        }}
                        className={`student-list-card text-left ${
                          isActive
                            ? 'border-brand-300/30 bg-white/[0.08] shadow-[0_24px_60px_-36px_rgba(59,130,246,0.5)]'
                            : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-content-primary">{drive.company}</p>
                            <p className="mt-1 text-sm text-content-secondary">{drive.role}</p>
                          </div>
                          <span className="badge student-glow-badge badge-success">{formatCurrency(drive.package)}</span>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="student-shell-muted p-3">
                            <p className="metric-label">Deadline</p>
                            <p className="mt-2 text-sm font-semibold text-content-primary">
                              {new Date(drive.deadline).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                            </p>
                          </div>
                          <div className="student-shell-muted p-3">
                            <p className="metric-label">Min CGPA</p>
                            <p className="mt-2 text-sm font-semibold text-content-primary">
                              {Number(drive.minCgpa || 0).toFixed(2)}
                            </p>
                          </div>
                          <div className="student-shell-muted p-3">
                            <p className="metric-label">Max Backlogs</p>
                            <p className="mt-2 text-sm font-semibold text-content-primary">{drive.maxBacklogs ?? 0}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section className="student-shell-muted p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="metric-label">Application History</p>
                  <p className="mt-2 text-sm text-content-secondary">
                    Track what you applied for and see where each application stands today.
                  </p>
                </div>
                <div className="student-stat-icon student-stat-icon--info h-10 w-10">
                  <FileBadge2 size={16} />
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {loading ? (
                  <div className="space-y-4">
                    <div className="skeleton h-28 rounded-[24px]" />
                    <div className="skeleton h-28 rounded-[24px]" />
                  </div>
                ) : applications.length === 0 ? (
                  <div className="empty-state min-h-[12rem]">No applications submitted yet.</div>
                ) : (
                  applications.map((application) => (
                    <article key={application._id} className="student-list-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-content-primary">{application.drive?.company}</p>
                          <p className="mt-1 text-sm text-content-secondary">{application.drive?.role}</p>
                        </div>
                        <span className={`badge student-glow-badge ${
                          application.applicationStatus === 'Selected'
                            ? 'badge-success'
                            : application.applicationStatus === 'Rejected'
                              ? 'badge-danger'
                              : 'badge-info'
                        }`}
                        >
                          {application.applicationStatus}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-content-muted">
                        <span>
                          Applied {new Date(application.appliedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                        </span>
                        {application.resume?.path ? <span className="badge badge-info">Resume uploaded</span> : null}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <form className="student-shell-muted space-y-4 p-5 sm:p-6" onSubmit={handleSubmit}>
              <div>
                <p className="metric-label">Apply to Drive</p>
                <h4 className="mt-2 text-xl font-semibold text-content-primary">Submit a polished application</h4>
                <p className="mt-2 text-sm text-content-secondary">
                  Choose the drive, upload your resume, and add optional notes before you apply.
                </p>
              </div>

              {readOnly ? (
                <div className="rounded-[24px] border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
                  Placement applications are disabled for graduated students. You can still review drive eligibility and application history.
                </div>
              ) : null}

              <select
                className="input-field"
                value={selectedDrive}
                onChange={(event) => {
                  setMessage('');
                  setSelectedDrive(event.target.value);
                }}
                disabled={readOnly || submitting}
                title={readOnly ? readOnlyReason : undefined}
                required
              >
                <option value="">Select placement drive</option>
                {drives.map((drive) => (
                  <option key={drive._id} value={drive._id}>
                    {`${drive.company} / ${drive.role}`}
                  </option>
                ))}
              </select>

              {activeDrive ? (
                <div className="student-list-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-content-primary">{activeDrive.company}</p>
                      <p className="mt-1 text-sm text-content-secondary">{`${activeDrive.role} / ${formatCurrency(activeDrive.package)}`}</p>
                    </div>
                    <span className="badge student-glow-badge badge-info">Selected</span>
                  </div>
                  <p className="mt-4 text-xs text-content-muted">
                    Deadline {new Date(activeDrive.deadline).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </p>
                </div>
              ) : null}

              <input
                className="file-field"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(event) => setResume(event.target.files?.[0] || null)}
                disabled={readOnly || submitting}
                title={readOnly ? readOnlyReason : undefined}
                required
              />
              <textarea
                className="textarea-field min-h-[7rem]"
                placeholder="Optional notes for your application"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={readOnly || submitting}
                title={readOnly ? readOnlyReason : undefined}
              />
              <StudentActionButton
                type="submit"
                disabled={readOnly || submitting || !selectedDrive}
                tooltip={readOnly ? readOnlyReason : undefined}
                className="btn-primary w-full justify-center"
              >
                {submitting ? 'Submitting...' : 'Apply now'}
              </StudentActionButton>
            </form>

            <section className="student-shell-muted p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="metric-label">Placement Outcomes</p>
                  <p className="mt-2 text-sm text-content-secondary">
                    Final placement records stay visible here even when the profile is view-only.
                  </p>
                </div>
                <div className="student-stat-icon student-stat-icon--success h-10 w-10">
                  <TrendingUp size={16} />
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {loading ? (
                  <div className="space-y-4">
                    <div className="skeleton h-24 rounded-[24px]" />
                    <div className="skeleton h-24 rounded-[24px]" />
                  </div>
                ) : placementHistory.length === 0 ? (
                  <div className="empty-state min-h-[10rem]">No final placement outcomes recorded on your profile yet.</div>
                ) : (
                  placementHistory.map((placement) => (
                    <div key={placement._id} className="student-list-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-content-primary">{placement.company}</p>
                          <p className="mt-1 text-sm text-content-secondary">{placement.role}</p>
                        </div>
                        <span className="badge student-glow-badge badge-success">{formatCurrency(placement.package)}</span>
                      </div>
                      <p className="mt-4 text-xs text-content-muted">
                        Placed on {new Date(placement.placementDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
