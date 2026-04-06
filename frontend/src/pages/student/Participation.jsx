import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck2, CalendarRange, Clock3, Sparkles } from 'lucide-react';
import StudentPageIntro from '../../components/student/StudentPageIntro';
import StudentEventCard from '../../components/student/StudentEventCard';
import EventRegistrationModal from '../../components/student/EventRegistrationModal';
import { eventsAPI, studentPortalAPI } from '../../services/api';
import { useStudentWorkspace } from './StudentWorkspaceLayout';
import { formatEventDate } from '../../components/events/eventUtils';

function SummaryCard({ label, value, note, icon: Icon, tone = 'brand', progress = 12 }) {
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
    <div className="student-stat-card page-transition">
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
          <div className={progressTone} style={{ width: `${Math.max(12, Math.min(100, Number(progress || 0)))}%` }} />
        </div>
      </div>
    </div>
  );
}

function EventSection({
  title,
  description,
  events,
  loading,
  emptyLabel,
  onParticipate,
  onMarkAttendance,
  disabledReason,
  activeAction,
}) {
  return (
    <section className="student-shell page-transition p-6 sm:p-7">
      <div className="section-header">
        <div>
          <p className="eyebrow">Student Events</p>
          <h2 className="mt-1 text-xl font-semibold text-content-primary">{title}</h2>
          <p className="section-subtitle mt-1">{description}</p>
        </div>
        <span className="badge badge-info">{events.length} events</span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {loading ? (
          Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="student-list-card h-[22rem]">
              <div className="space-y-3">
                <div className="skeleton-line w-1/3" />
                <div className="skeleton-line w-3/4" />
                <div className="skeleton-line w-full" />
                <div className="skeleton-line w-5/6" />
              </div>
            </div>
          ))
        ) : events.length === 0 ? (
          <div className="empty-state min-h-[16rem] xl:col-span-2">{emptyLabel}</div>
        ) : (
          events.map((event) => (
            <StudentEventCard
              key={event._id}
              event={event}
              disabledReason={disabledReason}
              busyAction={activeAction?.eventId === event._id ? activeAction.action : ''}
              onParticipate={onParticipate}
              onMarkAttendance={onMarkAttendance}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default function Participation() {
  const { profile, workspaceStatus, isReadOnly, readOnlyReason } = useStudentWorkspace();
  const [hub, setHub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [flashMessage, setFlashMessage] = useState(null);
  const [activeAction, setActiveAction] = useState(null);

  const loadParticipationHub = useCallback(async () => {
    setLoading(true);

    try {
      const response = await studentPortalAPI.getParticipationHub();
      setHub(response.data?.data || null);
    } catch (error) {
      console.error('Unable to load student participation hub:', error);
      setHub(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadParticipationHub();
  }, [loadParticipationHub]);

  const studentRecord = hub?.student || {
    name: profile?.name,
    email: profile?.email,
    department: profile?.department,
  };
  const summary = hub?.summary || {};
  const ongoingEvents = hub?.ongoingEvents || [];
  const upcomingEvents = hub?.upcomingEvents || [];
  const registrations = hub?.registrations || [];

  const statCards = useMemo(
    () => [
      {
        label: 'Relevant Events',
        value: loading ? '--' : summary.totalRelevantEvents || 0,
        note: 'Events visible for your department and institution-wide scope',
        icon: CalendarRange,
        tone: 'brand',
        progress: Math.min(100, Math.max(12, (summary.totalRelevantEvents || 0) * 10)),
      },
      {
        label: 'Ongoing',
        value: loading ? '--' : summary.ongoingCount || 0,
        note: 'Currently active events available for immediate registration',
        icon: Sparkles,
        tone: 'success',
        progress: summary.totalRelevantEvents ? ((summary.ongoingCount || 0) / summary.totalRelevantEvents) * 100 : 12,
      },
      {
        label: 'Upcoming',
        value: loading ? '--' : summary.upcomingCount || 0,
        note: 'Future events lined up for your semester activity calendar',
        icon: Clock3,
        tone: 'info',
        progress: summary.totalRelevantEvents ? ((summary.upcomingCount || 0) / summary.totalRelevantEvents) * 100 : 12,
      },
      {
        label: 'Registered',
        value: loading ? '--' : summary.registeredCount || 0,
        note: 'Events you have already joined through the dashboard',
        icon: CalendarCheck2,
        tone: 'warning',
        progress: summary.totalRelevantEvents ? ((summary.registeredCount || 0) / summary.totalRelevantEvents) * 100 : 12,
      },
    ],
    [loading, summary.ongoingCount, summary.registeredCount, summary.totalRelevantEvents, summary.upcomingCount]
  );

  const handleOpenRegistration = (event) => {
    setSubmissionError('');
    setSelectedEvent(event);
  };

  const handleRegister = async (payload) => {
    if (!selectedEvent?._id) {
      return;
    }

    setSubmitting(true);
    setActiveAction({ eventId: selectedEvent._id, action: 'register' });
    setSubmissionError('');

    try {
      await eventsAPI.register(selectedEvent._id, payload);
      await loadParticipationHub();
      setFlashMessage({
        type: 'success',
        text: `You are now registered for ${selectedEvent.title}.`,
      });
      setSelectedEvent(null);
    } catch (error) {
      setSubmissionError(error.response?.data?.message || 'Unable to register for this event right now.');
      setFlashMessage({
        type: 'error',
        text: error.response?.data?.message || 'Unable to register for this event right now.',
      });
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  };

  const handleMarkAttendance = async (event) => {
    if (!event?._id) {
      return;
    }

    setActiveAction({ eventId: event._id, action: 'attendance' });
    setFlashMessage(null);

    try {
      await eventsAPI.markAttendance(event._id);
      await loadParticipationHub();
      setFlashMessage({
        type: 'success',
        text: `Attendance marked successfully for ${event.title}.`,
      });
    } catch (error) {
      setFlashMessage({
        type: 'error',
        text: error.response?.data?.message || 'Unable to mark attendance right now.',
      });
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <StudentPageIntro
        eyebrow="Activities"
        title="Participation"
        description="Discover department-relevant events, register from a clean modal flow, and keep all participation records organized in one premium student workspace."
        badges={[
          {
            value: profile?.department?.code || studentRecord.department?.code || 'Department pending',
            className: 'badge-info',
          },
          {
            value: workspaceStatus.badgeLabel,
            className: workspaceStatus.badgeClassName,
          },
          {
            value: `${summary.registeredCount || 0} registered`,
            className: 'badge-success',
          },
        ]}
      />

      {flashMessage ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${
          flashMessage.type === 'success'
            ? 'border-success/25 bg-success/10 text-success'
            : 'border-danger/25 bg-danger/10 text-danger'
        }`}>
          {flashMessage.text}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </section>

      <EventSection
        title="Ongoing Events"
        description="Events currently running and open for participation from your dashboard."
        events={ongoingEvents}
        loading={loading}
        emptyLabel="No ongoing events are currently available for your department."
        onParticipate={handleOpenRegistration}
        onMarkAttendance={handleMarkAttendance}
        disabledReason={isReadOnly ? readOnlyReason : ''}
        activeAction={activeAction}
      />

      <EventSection
        title="Upcoming Events"
        description="Plan ahead for workshops, competitions, and institutional activities before they begin."
        events={upcomingEvents}
        loading={loading}
        emptyLabel="No upcoming events are available right now. Check back soon for new announcements."
        onParticipate={handleOpenRegistration}
        onMarkAttendance={handleMarkAttendance}
        disabledReason={isReadOnly ? readOnlyReason : ''}
        activeAction={activeAction}
      />

      <section className="student-shell page-transition p-6 sm:p-7">
        <div className="section-header">
          <div>
            <p className="eyebrow">Registration History</p>
            <h2 className="mt-1 text-xl font-semibold text-content-primary">Your event registrations</h2>
            <p className="section-subtitle mt-1">
              Track when you registered and keep a quick view of your participation timeline.
            </p>
          </div>
          <span className="badge badge-info">{registrations.length} records</span>
        </div>

        <div className="mt-5 space-y-4">
          {loading ? (
            <div className="space-y-3">
              <div className="skeleton-line w-full" />
              <div className="skeleton-line w-4/5" />
              <div className="skeleton-line w-3/5" />
            </div>
          ) : registrations.length === 0 ? (
            <div className="empty-state min-h-[12rem]">No registrations yet. Join an event to see it appear here.</div>
          ) : (
            registrations.map((registration) => (
              <article key={registration._id} className="student-list-card">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-content-primary">
                        {registration.event?.title || 'Event registration'}
                      </p>
                      <span className="badge badge-info">{registration.event?.status || 'Registered'}</span>
                      <span className="badge badge-success">{registration.role || 'Participant'}</span>
                      {registration.event?.registration?.attendanceStatus ? (
                        <span
                          className={
                            registration.event.registration.attendanceStatus === 'Marked'
                              ? 'badge badge-success'
                              : 'badge badge-warning'
                          }
                        >
                          {registration.event.registration.attendanceStatus}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-content-secondary">
                      {registration.message || 'Registration submitted successfully through the student dashboard.'}
                    </p>
                  </div>
                  <span className="badge badge-warning">{formatEventDate(registration.registeredAt)}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {selectedEvent ? (
        <EventRegistrationModal
          event={selectedEvent}
          student={studentRecord}
          submitting={submitting}
          error={submissionError}
          readOnly={isReadOnly}
          readOnlyReason={readOnlyReason}
          onClose={() => {
            if (!submitting) {
              setSelectedEvent(null);
              setSubmissionError('');
            }
          }}
          onSubmit={handleRegister}
        />
      ) : null}
    </div>
  );
}
