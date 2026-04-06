import { ArrowRight, Building2, CalendarRange, MapPin, Sparkles } from 'lucide-react';
import StudentActionButton from './StudentActionButton';
import { formatEventDate, formatEventDateRange, getDepartmentBadgeClass, getEventStatusBadgeClass } from '../events/eventUtils';

export default function StudentEventCard({
  event,
  disabledReason,
  busyAction = '',
  onParticipate,
  onMarkAttendance,
}) {
  const isAttendanceMarked = Boolean(event.registration?.attended);
  const canMarkAttendance = Boolean(event.registration?.canMarkAttendance);
  const isRegistered = Boolean(event.isRegistered);
  const actionMode = isAttendanceMarked
    ? 'attendance_marked'
    : canMarkAttendance
      ? 'mark_attendance'
      : isRegistered
        ? 'registered'
        : 'participate';
  const tooltip =
    actionMode === 'registered'
      ? 'You are already registered for this event.'
      : actionMode === 'attendance_marked'
        ? 'Attendance has already been marked for this event.'
        : disabledReason;
  const actionDisabled =
    busyAction === 'register' ||
    busyAction === 'attendance' ||
    actionMode === 'registered' ||
    actionMode === 'attendance_marked' ||
    Boolean(disabledReason);

  const actionLabel =
    actionMode === 'attendance_marked'
      ? 'Attendance Marked'
      : actionMode === 'mark_attendance'
        ? 'Mark Attendance'
        : actionMode === 'registered'
          ? 'Registered'
          : 'Participate';

  const actionClassName =
    actionMode === 'mark_attendance'
      ? 'btn-primary min-w-[10rem] justify-center'
      : actionMode === 'participate'
        ? 'btn-primary min-w-[10rem] justify-center'
        : 'btn-secondary min-w-[10rem] justify-center';

  const handleAction = () => {
    if (actionMode === 'mark_attendance') {
      onMarkAttendance?.(event);
      return;
    }

    if (actionMode === 'participate') {
      onParticipate?.(event);
    }
  };

  return (
    <article className="student-list-card h-full">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.1),transparent_22%)]" />

      <div className="relative flex h-full flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge ${getEventStatusBadgeClass(event.status)}`}>{event.status}</span>
              <span className={`badge ${getDepartmentBadgeClass(event.departmentScope)}`}>
                {event.departmentScope === 'ALL' ? 'All Departments' : (event.department?.code || event.departmentLabel)}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-content-primary">{event.title}</h3>
              <p className="mt-2 text-sm leading-6 text-content-secondary">
                {event.description || 'Event details will be shared by the organizing team.'}
              </p>
            </div>
          </div>

          <div className="student-stat-icon student-stat-icon--brand h-12 w-12 shrink-0">
            <Sparkles size={18} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="student-shell-muted p-4">
            <p className="metric-label">Date Range</p>
            <p className="mt-2 flex items-center gap-2 text-sm font-medium text-content-primary">
              <CalendarRange size={15} className="text-brand-200" />
              {formatEventDateRange(event.startDate, event.endDate)}
            </p>
          </div>

          <div className="student-shell-muted p-4">
            <p className="metric-label">Department</p>
            <p className="mt-2 flex items-center gap-2 text-sm font-medium text-content-primary">
              <Building2 size={15} className="text-brand-200" />
              {event.departmentLabel}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="student-shell-muted p-4">
            <p className="metric-label">Location</p>
            <p className="mt-2 flex items-center gap-2 text-sm font-medium text-content-primary">
              <MapPin size={15} className="text-brand-200" />
              {event.location || 'Location to be announced'}
            </p>
          </div>

          <div className="student-shell-muted p-4">
            <p className="metric-label">Organized By</p>
            <p className="mt-2 text-sm font-medium text-content-primary">
              {event.organizingBody || 'IQAC Event Desk'}
            </p>
          </div>
        </div>

        {event.registration?.message ? (
          <div className="student-shell-muted p-4 text-sm text-content-secondary">
            <p className="metric-label">Your Message</p>
            <p className="mt-2 leading-6">{event.registration.message}</p>
          </div>
        ) : null}

        {event.registration?.attendanceStatus ? (
          <div className="student-shell-muted p-4 text-sm text-content-secondary">
            <div className="flex flex-wrap items-center gap-2">
              <p className="metric-label">Attendance</p>
              <span className={isAttendanceMarked ? 'badge badge-success' : 'badge badge-warning'}>
                {event.registration.attendanceStatus}
              </span>
            </div>
            <p className="mt-2 leading-6">
              {isAttendanceMarked
                ? `Marked on ${formatEventDate(event.registration.attendanceMarkedAt || event.registration.registeredAt)}`
                : event.attendanceSession?.canMarkNow
                  ? 'Attendance window is live for this event.'
                  : 'Attendance can be marked during the active event window.'}
            </p>
          </div>
        ) : null}

        <div className="mt-auto flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-content-muted">
            {isAttendanceMarked
              ? `Attendance captured on ${formatEventDate(event.registration?.attendanceMarkedAt)}`
              : isRegistered
                ? `Registered on ${formatEventDate(event.registration?.registeredAt)}`
                : 'Seats are coordinated by the organizing department after registration.'}
          </p>

          <StudentActionButton
            type="button"
            disabled={actionDisabled}
            tooltip={tooltip}
            onClick={handleAction}
            className={actionClassName}
          >
            {busyAction === 'attendance'
              ? 'Saving...'
              : busyAction === 'register'
                ? 'Processing...'
                : actionLabel}
            {(actionMode === 'participate' || actionMode === 'mark_attendance') && !busyAction ? <ArrowRight size={15} /> : null}
          </StudentActionButton>
        </div>
      </div>
    </article>
  );
}
