import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarRange,
  Eye,
  Mail,
  Search,
  Users2,
  UserRound,
  X,
} from 'lucide-react';
import { eventsAPI } from '../../services/api';
import {
  formatEventDate,
  formatEventDateRange,
  getDepartmentBadgeClass,
  getEventStatus,
  getEventStatusBadgeClass,
} from './eventUtils';

const PARTICIPATION_LIMIT = 200;

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? 'btn-primary !px-4 !py-2 text-xs' : 'btn-secondary !px-4 !py-2 text-xs'}
    >
      {children}
    </button>
  );
}

export default function EventParticipantsModal({ event, departments, onClose }) {
  const [activeTab, setActiveTab] = useState('participants');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [participations, setParticipations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!event?._id) {
      return;
    }

    const loadParticipations = async () => {
      setLoading(true);

      try {
        const response = await eventsAPI.getParticipations(event._id, {
          search,
          department,
          limit: PARTICIPATION_LIMIT,
        });

        setParticipations(response.data.participations || []);
        setSummary(response.data.summary || null);
        setTotal(response.data.total || 0);
      } catch (error) {
        console.error('Error loading participations:', error);
        setParticipations([]);
        setSummary(null);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    loadParticipations();
  }, [department, event?._id, search]);

  const eventStatus = useMemo(
    () => getEventStatus(event?.startDate, event?.endDate),
    [event?.endDate, event?.startDate]
  );
  const eventDepartmentLabel = event?.departmentScope === 'ALL'
    ? 'All Departments'
    : event?.department?.name || event?.departmentLabel || 'Department Event';

  if (!event) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="section flex max-h-[92vh] w-full max-w-6xl flex-col p-0" onClick={(clickEvent) => clickEvent.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-line/80 px-6 py-5">
          <div>
            <p className="eyebrow">Event View</p>
            <h2 className="mt-1 text-2xl font-semibold text-content-primary">{event.title}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`badge ${getEventStatusBadgeClass(eventStatus)}`}>{eventStatus}</span>
              <span className={`badge ${getDepartmentBadgeClass(event.departmentScope)}`}>{eventDepartmentLabel}</span>
            </div>
          </div>

          <button type="button" onClick={onClose} className="btn-ghost h-10 w-10 p-0" aria-label="Close participants modal">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap gap-3 border-b border-line/80 px-6 py-4">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
            <Eye size={14} />
            Overview
          </TabButton>
          <TabButton active={activeTab === 'participants'} onClick={() => setActiveTab('participants')}>
            <Users2 size={14} />
            Participants
          </TabButton>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {activeTab === 'overview' ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
              <section className="section-muted p-5">
                <p className="metric-label">Event Summary</p>
                <p className="mt-3 text-sm leading-7 text-content-secondary">
                  {event.description || 'Event description is not available yet.'}
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                    <p className="metric-label">Date Range</p>
                    <p className="mt-2 flex items-center gap-2 text-sm font-medium text-content-primary">
                      <CalendarRange size={15} className="text-brand-200" />
                      {formatEventDateRange(event.startDate, event.endDate)}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                    <p className="metric-label">Participants</p>
                    <p className="mt-2 text-2xl font-semibold text-content-primary">{summary?.totalParticipants ?? total}</p>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                    <p className="metric-label">Attendance Marked</p>
                    <p className="mt-2 text-2xl font-semibold text-content-primary">{summary?.markedAttendance ?? 0}</p>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                    <p className="metric-label">Pending Attendance</p>
                    <p className="mt-2 text-2xl font-semibold text-content-primary">{summary?.pendingAttendance ?? 0}</p>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                    <p className="metric-label">Organizing Body</p>
                    <p className="mt-2 text-sm font-medium text-content-primary">
                      {event.organizingBody || 'IQAC Event Desk'}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                    <p className="metric-label">Location</p>
                    <p className="mt-2 text-sm font-medium text-content-primary">
                      {event.location || 'Location to be announced'}
                    </p>
                  </div>
                </div>
              </section>

              <section className="section-muted p-5">
                <p className="metric-label">Visibility & Scope</p>
                <div className="mt-4 space-y-4">
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold text-content-primary">Department Access</p>
                    <p className="mt-2 text-sm text-content-secondary">{eventDepartmentLabel}</p>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold text-content-primary">Event Type</p>
                    <p className="mt-2 text-sm text-content-secondary">{event.type} - {event.level}</p>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold text-content-primary">Attendance Window</p>
                    <p className="mt-2 text-sm text-content-secondary">
                      Opens {formatEventDate(summary?.event?.attendanceWindow?.opensAt || event.startDate)} and closes {formatEventDate(summary?.event?.attendanceWindow?.closesAt || event.endDate)}.
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold text-content-primary">Timeline</p>
                    <p className="mt-2 text-sm text-content-secondary">
                      Starts {formatEventDate(event.startDate)} and closes {formatEventDate(event.endDate)}.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="section-muted p-4">
                <div className="toolbar">
                  <div>
                    <p className="metric-label">Participants</p>
                    <p className="mt-2 text-sm text-content-secondary">
                      Search by student name, email, or roll number, then narrow by department when needed.
                    </p>
                  </div>

                  <div className="toolbar-group">
                    <label className="relative min-w-0 sm:min-w-[18rem]">
                      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                      <input
                        className="input-field pl-9"
                        placeholder="Search student..."
                        value={search}
                        onChange={(eventChange) => setSearch(eventChange.target.value)}
                      />
                    </label>

                    <select
                      className="input-field w-full sm:w-56"
                      value={department}
                      onChange={(eventChange) => setDepartment(eventChange.target.value)}
                    >
                      <option value="">All Departments</option>
                      {departments.map((item) => (
                        <option key={item._id} value={item._id}>
                          {item.code} - {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="badge badge-info">Total {summary?.totalParticipants ?? total}</span>
                  <span className="badge badge-success">Showing {participations.length}</span>
                  <span className="badge badge-warning">Marked {summary?.markedAttendance ?? 0}</span>
                  <span className="badge badge-info">Pending {summary?.pendingAttendance ?? 0}</span>
                </div>
              </div>

              <div className="table-shell hidden md:block">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr className="table-head">
                        <th className="table-head-cell">Student</th>
                        <th className="table-head-cell">Email</th>
                        <th className="table-head-cell">Department</th>
                        <th className="table-head-cell">Registered</th>
                        <th className="table-head-cell">Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? Array.from({ length: 5 }).map((_, index) => (
                        <tr key={index} className="table-row">
                          {Array.from({ length: 5 }).map((__, cellIndex) => (
                            <td key={cellIndex} className="table-cell">
                              <div className="skeleton h-4 w-24" />
                            </td>
                          ))}
                        </tr>
                      )) : null}

                      {!loading && participations.map((participation) => (
                        <tr key={participation._id} className="table-row">
                          <td className="table-cell">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/15 font-semibold text-brand-200 ring-1 ring-brand-400/18">
                                {participation.student?.name?.charAt(0)?.toUpperCase() || 'S'}
                              </div>
                              <div>
                                <p className="font-medium text-content-primary">{participation.student?.name}</p>
                                <p className="text-xs text-content-muted">{participation.student?.rollNumber}</p>
                              </div>
                            </div>
                          </td>
                          <td className="table-cell">{participation.student?.email || 'Email unavailable'}</td>
                          <td className="table-cell">
                            {participation.student?.department?.code || participation.student?.department?.name || 'Department pending'}
                          </td>
                          <td className="table-cell">{formatEventDate(participation.registeredAt || participation.createdAt)}</td>
                          <td className="table-cell">
                            <span className={participation.attended ? 'badge badge-success' : 'badge badge-warning'}>
                              {participation.attended ? 'Marked' : (participation.attendanceStatus || 'Pending')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {!loading ? (
                <div className="grid gap-3 md:hidden">
                  {participations.map((participation) => (
                    <article key={participation._id} className="student-list-card">
                      <div className="flex items-start gap-3">
                        <div className="student-stat-icon student-stat-icon--brand h-11 w-11">
                          <UserRound size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-content-primary">{participation.student?.name}</p>
                          <p className="mt-1 text-xs text-content-muted">{participation.student?.rollNumber}</p>
                          <div className="mt-3 space-y-1.5 text-xs text-content-secondary">
                            <p className="flex items-center gap-2">
                              <Mail size={13} className="text-brand-200" />
                              {participation.student?.email || 'Email unavailable'}
                            </p>
                            <p className="flex items-center gap-2">
                              <Building2 size={13} className="text-brand-200" />
                              {participation.student?.department?.code || participation.student?.department?.name || 'Department pending'}
                            </p>
                            <p className="flex items-center gap-2">
                              <CalendarRange size={13} className="text-brand-200" />
                              {formatEventDate(participation.registeredAt || participation.createdAt)}
                            </p>
                            <p className="flex items-center gap-2">
                              <Users2 size={13} className="text-brand-200" />
                              {participation.attended ? 'Attendance marked' : (participation.attendanceStatus || 'Attendance pending')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              {!loading && participations.length === 0 ? (
                <div className="empty-state min-h-[12rem]">
                  No participants matched the current filters for this event.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
