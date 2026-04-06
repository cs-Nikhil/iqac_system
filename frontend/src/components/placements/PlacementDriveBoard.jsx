import { CalendarRange, Edit3, MapPin, Users2 } from 'lucide-react';

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Date pending';

const getStatusBadgeClass = (status) => {
  if (status === 'Open') return 'badge badge-success';
  if (status === 'Closed') return 'badge badge-danger';
  return 'badge badge-warning';
};

export default function PlacementDriveBoard({ drives, loading, onEdit }) {
  return (
    <section className="section overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-line/70 px-5 py-4">
        <div>
          <p className="eyebrow">Drive Pipeline</p>
          <h3 className="mt-2 text-lg font-semibold text-content-primary">Live placement drives</h3>
          <p className="mt-2 text-sm text-content-secondary">
            Review visibility, eligibility reach, and application momentum without leaving the placements workspace.
          </p>
        </div>
        <span className="badge badge-info">{loading ? 'Loading...' : `${drives.length} drives`}</span>
      </div>

      <div className="grid gap-4 px-5 py-5">
        {loading ? (
          <>
            <div className="skeleton min-h-[12rem] rounded-[24px]" />
            <div className="skeleton min-h-[12rem] rounded-[24px]" />
          </>
        ) : drives.length ? (
          drives.map((drive) => (
            <article key={drive._id} className="card card-hover flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={getStatusBadgeClass(drive.status)}>{drive.status}</span>
                    <span className="badge badge-info">{drive.academicYear}</span>
                    <span className="badge badge-warning">{Number(drive.package || 0).toFixed(2)} LPA</span>
                  </div>
                  <h4 className="mt-3 text-lg font-semibold text-content-primary">{drive.company}</h4>
                  <p className="mt-1 text-sm text-content-secondary">{drive.role}</p>
                </div>

                <button type="button" onClick={() => onEdit(drive)} className="btn-secondary">
                  <Edit3 size={15} />
                  Edit
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="section-muted p-4">
                  <p className="metric-label">Drive Date</p>
                  <p className="mt-2 flex items-center gap-2 text-sm font-medium text-content-primary">
                    <CalendarRange size={14} className="text-brand-200" />
                    {formatDate(drive.driveDate)}
                  </p>
                </div>
                <div className="section-muted p-4">
                  <p className="metric-label">Application Deadline</p>
                  <p className="mt-2 text-sm font-medium text-content-primary">{formatDate(drive.deadline)}</p>
                </div>
                <div className="section-muted p-4">
                  <p className="metric-label">Eligibility</p>
                  <p className="mt-2 text-sm font-medium text-content-primary">
                    CGPA {Number(drive.minCgpa || 0).toFixed(1)} and up to {drive.maxBacklogs ?? 0} backlogs
                  </p>
                </div>
                <div className="section-muted p-4">
                  <p className="metric-label">Location</p>
                  <p className="mt-2 flex items-center gap-2 text-sm font-medium text-content-primary">
                    <MapPin size={14} className="text-brand-200" />
                    {drive.location || 'Location pending'}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="surface-inset p-4">
                  <p className="metric-label">Eligible Students</p>
                  <p className="mt-2 text-xl font-semibold text-content-primary">{drive.insights?.eligibleStudents || 0}</p>
                </div>
                <div className="surface-inset p-4">
                  <p className="metric-label">Applications</p>
                  <p className="mt-2 text-xl font-semibold text-content-primary">{drive.insights?.applications || 0}</p>
                </div>
                <div className="surface-inset p-4">
                  <p className="metric-label">Shortlisted</p>
                  <p className="mt-2 text-xl font-semibold text-content-primary">{drive.insights?.shortlisted || 0}</p>
                </div>
                <div className="surface-inset p-4">
                  <p className="metric-label">Selected</p>
                  <p className="mt-2 text-xl font-semibold text-content-primary">{drive.insights?.selected || 0}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-4">
                <div className="flex flex-wrap gap-2">
                  {(drive.departments || []).length ? (
                    drive.departments.map((department) => (
                      <span key={department._id || department} className="badge badge-info">
                        {department.code || department.name || department}
                      </span>
                    ))
                  ) : (
                    <span className="badge badge-success">All Departments</span>
                  )}
                </div>
                <p className="flex items-center gap-2 text-xs text-content-muted">
                  <Users2 size={13} className="text-brand-200" />
                  Notifications target eligible active students automatically.
                </p>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state min-h-[14rem]">No placement drives are available for the selected filters.</div>
        )}
      </div>
    </section>
  );
}
