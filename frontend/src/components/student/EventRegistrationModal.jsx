import { useEffect, useState } from 'react';
import { CalendarRange, MessageSquareText, Send, ShieldCheck, UserRound, X } from 'lucide-react';
import { formatEventDateRange } from '../events/eventUtils';

export default function EventRegistrationModal({
  event,
  student,
  submitting = false,
  error = '',
  readOnly = false,
  readOnlyReason = '',
  onClose,
  onSubmit,
}) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMessage(event?.registration?.message || '');
  }, [event]);

  if (!event || !student) {
    return null;
  }

  const departmentLabel = student.department?.name || student.department?.code || 'Department pending';

  const handleSubmit = (submitEvent) => {
    submitEvent.preventDefault();
    onSubmit({ message: message.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="student-shell w-full max-w-2xl p-6 sm:p-7" onClick={(eventClick) => eventClick.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Event Registration</p>
            <h2 className="mt-1 text-2xl font-semibold text-content-primary">{event.title}</h2>
            <p className="mt-2 text-sm text-content-secondary">
              Confirm your participation details and optionally include a short message for the organizing team.
            </p>
          </div>

          <button type="button" onClick={onClose} className="btn-ghost h-10 w-10 p-0" aria-label="Close registration modal">
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="student-shell-muted p-4">
            <p className="metric-label">Event Window</p>
            <p className="mt-2 flex items-center gap-2 text-sm font-medium text-content-primary">
              <CalendarRange size={15} className="text-brand-200" />
              {formatEventDateRange(event.startDate, event.endDate)}
            </p>
          </div>

          <div className="student-shell-muted p-4">
            <p className="metric-label">Eligibility</p>
            <p className="mt-2 flex items-center gap-2 text-sm font-medium text-content-primary">
              <ShieldCheck size={15} className="text-emerald-300" />
              {event.departmentLabel}
            </p>
          </div>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          {error ? (
            <div className="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="min-w-0">
              <span className="metric-label block">Student Name</span>
              <div className="input-field mt-2 flex items-center gap-2 text-content-secondary">
                <UserRound size={15} className="text-brand-200" />
                <span>{student.name}</span>
              </div>
            </label>

            <label className="min-w-0">
              <span className="metric-label block">Email</span>
              <input className="input-field mt-2" value={student.email} readOnly />
            </label>
          </div>

          <label className="min-w-0">
            <span className="metric-label block">Department</span>
            <input className="input-field mt-2" value={departmentLabel} readOnly />
          </label>

          <label className="min-w-0">
            <span className="metric-label block">Optional Message</span>
            <div className="relative mt-2">
              <MessageSquareText size={16} className="pointer-events-none absolute left-4 top-4 text-content-muted" />
              <textarea
                className="textarea-field min-h-[9rem] pl-11"
                placeholder="Share your interest, reason for joining, or anything the organizer should know."
                value={message}
                onChange={(eventChange) => setMessage(eventChange.target.value)}
                disabled={readOnly || submitting}
                title={readOnly ? readOnlyReason : undefined}
              />
            </div>
          </label>

          <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="btn-secondary justify-center">
              Cancel
            </button>
            <button
              type="submit"
              disabled={readOnly || submitting}
              title={readOnly ? readOnlyReason : undefined}
              className="btn-primary justify-center"
            >
              <Send size={15} />
              {submitting ? 'Submitting...' : 'Confirm Participation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
