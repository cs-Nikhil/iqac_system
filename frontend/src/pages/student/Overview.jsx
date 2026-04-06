import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpenCheck,
  BookText,
  Building2,
  CalendarClock,
  FileText,
  GraduationCap,
  Mail,
  MapPinned,
  PenSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
} from 'lucide-react';
import StudentActionButton from '../../components/student/StudentActionButton';
import StudentPageIntro from '../../components/student/StudentPageIntro';
import StudentStatusBadge from '../../components/student/StudentStatusBadge';
import { studentPortalAPI } from '../../services/api';
import { useStudentWorkspace } from './StudentWorkspaceLayout';
import { STUDENT_ROUTES } from './studentRoutes';

function OverviewStat({ label, value, note, icon: Icon, tone = 'brand', progress = 0 }) {
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
        <div className="flex items-start justify-between gap-4">
          <div className={toneClass}>
            <Icon size={20} />
          </div>
          <span className="student-glow-badge badge badge-info">{label}</span>
        </div>
        <div>
          <p className="metric-label">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-content-primary sm:text-[2.1rem]">{value}</p>
          <p className="mt-2 text-sm text-content-secondary">{note}</p>
        </div>
        <div className="student-progress-track">
          <div className={progressTone} style={{ width: `${Math.max(8, Math.min(100, Number(progress || 0)))}%` }} />
        </div>
      </div>
    </div>
  );
}

function ProfileDetail({ label, value, icon: Icon, className = '' }) {
  return (
    <div className={`student-shell-muted p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="student-stat-icon student-stat-icon--brand h-11 w-11">
          <Icon size={20} />
        </div>
        <div>
          <p className="metric-label">{label}</p>
          <p className="mt-2 break-words text-base font-semibold text-content-primary">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function Overview() {
  const { profile, loadingProfile, workspaceStatus, isReadOnly, readOnlyReason } = useStudentWorkspace();
  const [attendance, setAttendance] = useState(null);
  const [loadingAttendance, setLoadingAttendance] = useState(true);

  const loadAttendance = useCallback(async () => {
    setLoadingAttendance(true);

    try {
      const response = await studentPortalAPI.getAttendance();
      setAttendance(response.data?.data || null);
    } catch {
      setAttendance(null);
    } finally {
      setLoadingAttendance(false);
    }
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const summaryCards = useMemo(() => {
    const currentSemester = profile?.currentSemester || 1;
    const year = Math.ceil(currentSemester / 2);

    return [
      {
        label: 'CGPA',
        value: loadingProfile ? '--' : Number(profile?.cgpa || 0).toFixed(2),
        note: `Year ${year} academic standing`,
        icon: GraduationCap,
        tone: 'brand',
        progress: Number(profile?.cgpa || 0) * 10,
      },
      {
        label: 'Attendance',
        value: loadingAttendance ? '--' : `${Number(attendance?.overall?.percentage || 0).toFixed(2)}%`,
        note: `${attendance?.overall?.warningCount || 0} attendance warnings`,
        icon: BookOpenCheck,
        tone: 'info',
        progress: Number(attendance?.overall?.percentage || 0),
      },
      {
        label: 'Performance Score',
        value: loadingProfile ? '--' : Number(profile?.performanceScore || 0).toFixed(1),
        note: profile?.performanceCategory || 'Academic profile pending',
        icon: Sparkles,
        tone: 'success',
        progress: Number(profile?.performanceScore || 0),
      },
      {
        label: 'Current Semester',
        value: loadingProfile ? '--' : `Sem ${profile?.currentSemester || 1}`,
        note: `${profile?.currentBacklogs || 0} active backlogs`,
        icon: ShieldCheck,
        tone: profile?.currentBacklogs ? 'warning' : 'success',
        progress: Number(profile?.currentSemester || 1) * 12.5,
      },
    ];
  }, [attendance, loadingAttendance, loadingProfile, profile]);

  const shortcuts = useMemo(
    () => [
      {
        to: STUDENT_ROUTES.subjects,
        label: 'Subjects',
        description: 'Marks, grades, and semester GPA.',
        icon: BookText,
      },
      {
        to: STUDENT_ROUTES.attendance,
        label: 'Attendance',
        description: 'Subject-wise percentage and warnings.',
        icon: CalendarClock,
      },
      {
        to: STUDENT_ROUTES.backlogs,
        label: 'Backlogs',
        description: 'Failed subjects and recovery status.',
        icon: AlertTriangle,
      },
      {
        to: STUDENT_ROUTES.achievements,
        label: 'Achievements',
        description: 'Certificates, awards, and proof.',
        icon: Trophy,
      },
      {
        to: STUDENT_ROUTES.documents,
        label: 'Documents',
        description: 'Uploads, approvals, and file access.',
        icon: FileText,
      },
      {
        to: STUDENT_ROUTES.placements,
        label: 'Placements',
        description: 'Applications, offers, and outcomes.',
        icon: GraduationCap,
      },
    ],
    []
  );

  const renderEditAction = (className = 'min-w-[12rem]') =>
    isReadOnly ? (
      <StudentActionButton
        type="button"
        disabled
        tooltip={readOnlyReason}
        className={`btn-primary ${className}`.trim()}
      >
        <PenSquare size={16} />
        Edit profile
      </StudentActionButton>
    ) : (
      <Link to={STUDENT_ROUTES.profileEdit} className={`btn-primary ${className}`.trim()}>
        <PenSquare size={16} />
        Edit profile
      </Link>
    );

  return (
    <div className="space-y-6">
      <StudentPageIntro
        eyebrow="Dashboard"
        title="Student Overview"
        description="A focused student dashboard with your core academic indicators, read-only profile snapshot, and direct paths into each module."
        actions={renderEditAction()}
        badges={[
          {
            value: profile?.department?.code || 'Department pending',
            className: 'badge-info',
          },
          {
            value: workspaceStatus.badgeLabel,
            className: workspaceStatus.badgeClassName,
          },
          {
            value: profile?.performanceCategory || 'Profile loading',
            className: profile?.isAtRisk ? 'badge-warning' : 'badge-success',
          },
        ]}
      />

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <OverviewStat key={card.label} {...card} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(21rem,0.85fr)]">
        <div className="student-shell page-transition p-6 sm:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_24%)]" />

          <div className="relative space-y-6">
            <div className="section-header">
              <div>
                <p className="eyebrow">Profile Snapshot</p>
                <h2 className="mt-1 text-2xl font-semibold text-content-primary">
                  {loadingProfile ? 'Loading student profile...' : profile?.name || 'Student profile'}
                </h2>
                <p className="section-subtitle mt-2">
                  Your overview stays read-only here so academic data and contact details remain easy to scan.
                </p>
              </div>

              <StudentStatusBadge
                label={workspaceStatus.badgeLabel}
                className={workspaceStatus.badgeClassName}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ProfileDetail label="Roll Number" value={profile?.rollNumber || 'Not available'} icon={UserRound} />
              <ProfileDetail label="Batch Year" value={profile?.batchYear || 'Not available'} icon={GraduationCap} />
              <ProfileDetail label="Department" value={profile?.department?.name || 'Department pending'} icon={Building2} />
              <ProfileDetail label="Email" value={profile?.email || 'Email not linked'} icon={Mail} />
              <ProfileDetail label="Phone" value={profile?.phone || 'Not updated'} icon={Phone} />
              <ProfileDetail label="Gender" value={profile?.gender || 'Not specified'} icon={UserRound} />
              <ProfileDetail
                label="Address"
                value={profile?.address || 'No permanent address added yet.'}
                icon={MapPinned}
                className="md:col-span-2"
              />
            </div>

            <div className="student-shell-muted p-5">
              <div className="flex items-center gap-3">
                <AlertTriangle size={18} className="text-brand-300" />
                <div>
                  <p className="text-sm font-semibold text-content-primary">Academic risk indicators</p>
                  <p className="text-xs text-content-muted">
                    Flags appear only when intervention is recommended for your academic profile.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {profile?.riskReasons?.length ? (
                  profile.riskReasons.map((reason) => (
                    <span key={reason} className="badge badge-warning">
                      {reason}
                    </span>
                  ))
                ) : (
                  <span className="badge badge-success">Healthy standing</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <section className="student-shell page-transition p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%)]" />

            <div className="relative space-y-4">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Profile Flow</p>
                  <h2 className="mt-1 text-xl font-semibold text-content-primary">Editing stays separate</h2>
                  <p className="section-subtitle mt-1">
                    Personal details are updated on their own page so the overview remains clean and focused.
                  </p>
                </div>
              </div>

              <div className="student-shell-muted p-4 text-sm text-content-secondary">
                Fields available in the edit flow: name, phone, gender, and address.
              </div>

              {renderEditAction('w-full justify-center')}

              {isReadOnly ? (
                <p className="text-xs text-warning" title={readOnlyReason}>
                  Editing is disabled because this student record is marked as graduated.
                </p>
              ) : null}
            </div>
          </section>

          <section className="student-shell page-transition p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.14),transparent_24%)]" />

            <div className="relative space-y-4">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Current Standing</p>
                  <h2 className="mt-1 text-xl font-semibold text-content-primary">Semester and status summary</h2>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="student-shell-muted p-4">
                  <p className="metric-label">Semester</p>
                  <p className="mt-2 text-lg font-semibold text-content-primary">
                    {loadingProfile ? '--' : `Semester ${profile?.currentSemester || 1}`}
                  </p>
                </div>
                <div className="student-shell-muted p-4">
                  <p className="metric-label">Attendance warnings</p>
                  <p className="mt-2 text-lg font-semibold text-content-primary">
                    {loadingAttendance ? '--' : attendance?.overall?.warningCount || 0}
                  </p>
                </div>
                <div className="student-shell-muted p-4">
                  <p className="metric-label">Performance band</p>
                  <p className="mt-2 text-lg font-semibold text-content-primary">
                    {profile?.performanceCategory || 'Pending'}
                  </p>
                </div>
                <div className="student-shell-muted p-4">
                  <p className="metric-label">Backlogs</p>
                  <p className="mt-2 text-lg font-semibold text-content-primary">
                    {loadingProfile ? '--' : profile?.currentBacklogs || 0}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="student-shell page-transition p-6">
            <div className="section-header">
              <div>
                <p className="eyebrow">Quick Access</p>
                <h2 className="mt-1 text-xl font-semibold text-content-primary">Go straight to a module</h2>
                <p className="section-subtitle mt-1">
                  Each module loads on its own dedicated page through the student workspace.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {shortcuts.map(({ to, label, description, icon: Icon }) => (
                <Link key={to} to={to} className="group student-shortcut">
                  <div className="student-shortcut-icon">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-content-primary">{label}</p>
                    <p className="mt-1 text-xs leading-5 text-content-muted">{description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
