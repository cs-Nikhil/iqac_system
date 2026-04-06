import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarRange,
  Layers3,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Users2,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { departmentsAPI, eventsAPI } from '../services/api';
import EventFormModal from '../components/events/EventFormModal';
import EventParticipantsModal from '../components/events/EventParticipantsModal';
import {
  formatEventDateRange,
  getDepartmentBadgeClass,
  getEventStatus,
  getEventStatusBadgeClass,
} from '../components/events/eventUtils';

const EVENT_TYPES = ['Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar', 'Competition', 'Hackathon', 'Conference', 'Social'];
const LEVELS = ['International', 'National', 'State', 'Regional', 'Institutional'];
const LIMIT = 12;

function MetricCard({ label, value, note, icon: Icon }) {
  return (
    <div className="card card-hover flex h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="student-stat-icon student-stat-icon--brand h-12 w-12">
          <Icon size={18} />
        </div>
        <span className="badge badge-info">{label}</span>
      </div>
      <div>
        <p className="metric-label">{label}</p>
        <p className="mt-3 text-3xl font-bold tracking-tight text-content-primary">{value}</p>
        <p className="mt-2 text-sm text-content-secondary">{note}</p>
      </div>
    </div>
  );
}

function EventCard({ event, onView }) {
  const eventStatus = getEventStatus(event.startDate, event.endDate);

  return (
    <article className="card card-hover flex h-full flex-col gap-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${getEventStatusBadgeClass(eventStatus)}`}>{eventStatus}</span>
            <span className={`badge ${getDepartmentBadgeClass(event.departmentScope)}`}>
              {event.departmentScope === 'ALL' ? 'All Departments' : (event.department?.code || event.departmentLabel)}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-content-primary">{event.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-content-secondary">
            {event.description || 'Event description will appear here once the organizing team publishes it.'}
          </p>
        </div>

        <div className="student-stat-icon student-stat-icon--info h-11 w-11 shrink-0">
          <Sparkles size={17} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="badge badge-info">{event.type}</span>
        <span className="badge badge-success">{event.level}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="section-muted p-4">
          <p className="metric-label">Date Range</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-content-primary">
            <CalendarRange size={15} className="text-brand-200" />
            {formatEventDateRange(event.startDate, event.endDate)}
          </p>
        </div>

        <div className="section-muted p-4">
          <p className="metric-label">Location</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-content-primary">
            <MapPin size={15} className="text-brand-200" />
            {event.location || 'Location pending'}
          </p>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-line/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-content-secondary">
          <p className="font-medium text-content-primary">{event.departmentLabel}</p>
          <p className="mt-1 text-xs text-content-muted">{event.organizingBody || 'IQAC Event Desk'}</p>
        </div>

        <button type="button" onClick={() => onView(event)} className="btn-primary justify-center">
          <Users2 size={15} />
          View
        </button>
      </div>
    </article>
  );
}

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: '',
    department: '',
    type: '',
    level: '',
  });
  const [flashMessage, setFlashMessage] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const allowAllDepartments = user?.role === 'iqac_admin';
  const lockedDepartment = user?.role === 'hod' && user?.department?.code ? user.department : null;

  const loadEvents = useCallback(async () => {
    setLoading(true);

    try {
      const params = { page, limit: LIMIT, ...filters };
      Object.keys(params).forEach((key) => !params[key] && delete params[key]);
      const response = await eventsAPI.getAll(params);
      setEvents(response.data.events || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Unable to load events:', error);
      setEvents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const response = await departmentsAPI.getAll();
        setDepartments(response.data.departments || []);
      } catch (error) {
        console.error('Unable to load departments:', error);
        setDepartments([]);
      }
    };

    loadDepartments();
  }, []);

  const stats = useMemo(() => {
    const ongoing = events.filter((event) => getEventStatus(event.startDate, event.endDate) === 'Ongoing').length;
    const upcoming = events.filter((event) => getEventStatus(event.startDate, event.endDate) === 'Upcoming').length;
    const openToAll = events.filter((event) => event.departmentScope === 'ALL').length;

    return [
      {
        label: 'Visible Events',
        value: loading ? '--' : total,
        note: 'Events matching your current search and filters',
        icon: Sparkles,
      },
      {
        label: 'Ongoing',
        value: loading ? '--' : ongoing,
        note: 'Live events currently accepting attention and registration',
        icon: CalendarRange,
      },
      {
        label: 'Upcoming',
        value: loading ? '--' : upcoming,
        note: 'Scheduled events coming up next in the dashboard',
        icon: Layers3,
      },
      {
        label: 'All Departments',
        value: loading ? '--' : openToAll,
        note: 'Institution-wide events visible across departments',
        icon: Building2,
      },
    ];
  }, [events, loading, total]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const handleCreateEvent = async (payload) => {
    setCreating(true);

    try {
      await eventsAPI.create(payload);
      setShowForm(false);
      setFlashMessage({
        type: 'success',
        text: 'Event created successfully.',
      });
      await loadEvents();
    } catch (error) {
      setFlashMessage({
        type: 'error',
        text: error.response?.data?.message || 'Unable to create the event.',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <Navbar title="Events & Activities" subtitle={`${total} events`} onRefresh={loadEvents} loading={loading} />

      <div className="dashboard-container flex-1">
        {flashMessage ? (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${
            flashMessage.type === 'success'
              ? 'border-success/25 bg-success/10 text-success'
              : 'border-danger/25 bg-danger/10 text-danger'
          }`}>
            {flashMessage.text}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <MetricCard key={item.label} {...item} />
          ))}
        </section>

        <section className="section space-y-5">
          <div className="toolbar">
            <div>
              <p className="eyebrow">Filters</p>
              <h2 className="mt-1 text-xl font-semibold text-content-primary">Find and manage events</h2>
              <p className="section-subtitle mt-1">Search events, narrow visibility, and open participant tracking from a single panel.</p>
            </div>

            <button type="button" onClick={() => setShowForm(true)} className="btn-primary justify-center">
              <Plus size={15} />
              Create Event
            </button>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(10rem,0.45fr))]">
            <label className="relative min-w-0">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
              <input
                className="input-field pl-9"
                placeholder="Search events by title, description, location, or organizer"
                value={filters.search}
                onChange={(event) => setFilter('search', event.target.value)}
              />
            </label>

            <select className="input-field" value={filters.department} onChange={(event) => setFilter('department', event.target.value)}>
              <option value="">All Visible Departments</option>
              {allowAllDepartments ? <option value="ALL">All Departments Events</option> : null}
              {departments.map((department) => (
                <option key={department._id} value={department._id}>
                  {department.code} · {department.name}
                </option>
              ))}
            </select>

            <select className="input-field" value={filters.type} onChange={(event) => setFilter('type', event.target.value)}>
              <option value="">All Types</option>
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <select className="input-field" value={filters.level} onChange={(event) => setFilter('level', event.target.value)}>
              <option value="">All Levels</option>
              {LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {loading ? Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="card h-[22rem] space-y-3 p-5">
              <div className="skeleton-line w-1/3" />
              <div className="skeleton-line w-3/4" />
              <div className="skeleton-line w-full" />
              <div className="skeleton-line w-5/6" />
            </div>
          )) : null}

          {!loading && events.map((event) => (
            <EventCard key={event._id} event={event} onView={setSelectedEvent} />
          ))}

          {!loading && events.length === 0 ? (
            <div className="empty-state min-h-[18rem] lg:col-span-2 2xl:col-span-3">
              No events matched the selected filters. Adjust the search criteria or publish a new event.
            </div>
          ) : null}
        </section>

        {total > LIMIT ? (
          <section className="section-muted p-4">
            <div className="toolbar">
              <p className="text-sm text-content-muted">
                Showing {(page - 1) * LIMIT + 1} to {Math.min(page * LIMIT, total)} of {total} events
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="btn-secondary h-10 px-4"
                >
                  Previous
                </button>
                <span className="rounded-xl border border-line/70 bg-panel-muted/70 px-3 py-2 text-xs font-medium text-content-secondary">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                  className="btn-secondary h-10 px-4"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {showForm ? (
        <EventFormModal
          departments={departments}
          onClose={() => !creating && setShowForm(false)}
          onSubmit={handleCreateEvent}
          submitting={creating}
          allowAllDepartments={allowAllDepartments}
          lockedDepartment={lockedDepartment}
        />
      ) : null}

      {selectedEvent ? (
        <EventParticipantsModal
          event={selectedEvent}
          departments={departments}
          onClose={() => setSelectedEvent(null)}
        />
      ) : null}
    </div>
  );
}
