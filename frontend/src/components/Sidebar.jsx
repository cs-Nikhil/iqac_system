import { Link, useLocation } from 'react-router-dom';
import {
  X,
  LayoutDashboard,
  Users,
  GraduationCap,
  Building2,
  FolderOpen,
  BookOpen,
  Briefcase,
  FileText,
  LogOut,
  Cpu,
  ChevronRight,
  TrendingUp,
  Trophy,
  Calendar,
  AlertTriangle,
  MessageSquareText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import { FACULTY_WORKSPACE_ROUTES } from '../pages/faculty/facultyRoutes';
import { STUDENT_ROUTES } from '../pages/student/studentRoutes';

const ROLE_MENUS = {
  iqac_admin: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/departments', icon: Building2, label: 'Departments' },
    { to: '/students', icon: GraduationCap, label: 'Students' },
    { to: '/student-progress', icon: TrendingUp, label: 'Progress' },
    { to: '/faculty', icon: Users, label: 'Faculty' },
    { to: '/research', icon: BookOpen, label: 'Research' },
    { to: '/placements', icon: Briefcase, label: 'Placements' },
    { to: '/achievements', icon: Trophy, label: 'Achievements' },
    { to: '/events', icon: Calendar, label: 'Events' },
    { to: '/naac', icon: FileText, label: 'NAAC' },
    { to: '/nba', icon: FileText, label: 'NBA' },
    { to: '/reports', icon: FileText, label: 'Reports' },
    { to: '/documents', icon: FolderOpen, label: 'Documents' },
  ],
  hod: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/departments', icon: Building2, label: 'Departments' },
    { to: '/faculty', icon: Users, label: 'Faculty' },
    { to: '/research', icon: BookOpen, label: 'Research' },
    { to: '/students', icon: GraduationCap, label: 'Students' },
    { to: '/student-progress', icon: TrendingUp, label: 'Progress' },
    { to: '/placements', icon: Briefcase, label: 'Placements' },
    { to: '/achievements', icon: Trophy, label: 'Achievements' },
    { to: '/events', icon: Calendar, label: 'Events' },
    { to: '/naac', icon: FileText, label: 'NAAC' },
    { to: '/nba', icon: FileText, label: 'NBA' },
    { to: '/reports', icon: FileText, label: 'Reports' },
  ],
  faculty: [
    { to: FACULTY_WORKSPACE_ROUTES.overview, icon: LayoutDashboard, label: 'Dashboard' },
    { to: FACULTY_WORKSPACE_ROUTES.subjects, icon: BookOpen, label: 'My Subjects' },
    { to: FACULTY_WORKSPACE_ROUTES.students, icon: GraduationCap, label: 'My Students' },
    { to: FACULTY_WORKSPACE_ROUTES.contributions, icon: Trophy, label: 'Achievements & Research' },
    { to: FACULTY_WORKSPACE_ROUTES.documents, icon: FolderOpen, label: 'Documents' },
  ],
  staff: [
    { to: '/staff-dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/staff-dashboard/students', icon: GraduationCap, label: 'Students' },
    { to: '/staff-dashboard/departments', icon: Building2, label: 'Departments' },
    { to: '/staff-dashboard/reports', icon: FileText, label: 'Reports' },
    { to: '/staff-dashboard/documents', icon: FolderOpen, label: 'Documents' },
  ],
  student: [
    {
      heading: 'Dashboard',
      items: [{
        to: STUDENT_ROUTES.overview,
        icon: LayoutDashboard,
        label: 'Overview',
        matchPrefixes: [STUDENT_ROUTES.overview, `${STUDENT_ROUTES.root}/profile`],
      }],
    },
    {
      heading: 'Academics',
      items: [{ to: STUDENT_ROUTES.subjects, icon: BookOpen, label: 'Subjects' }],
    },
    {
      heading: 'Attendance',
      items: [{ to: STUDENT_ROUTES.attendance, icon: Calendar, label: 'Attendance' }],
    },
    {
      heading: 'Performance',
      items: [{ to: STUDENT_ROUTES.backlogs, icon: AlertTriangle, label: 'Backlogs' }],
    },
    {
      heading: 'Activities',
      items: [
        { to: STUDENT_ROUTES.participation, icon: Calendar, label: 'Participation' },
        { to: STUDENT_ROUTES.achievements, icon: Trophy, label: 'Achievements' },
      ],
    },
    {
      heading: 'Feedback',
      items: [{ to: STUDENT_ROUTES.feedback, icon: MessageSquareText, label: 'Feedback' }],
    },
    {
      heading: 'Documents',
      items: [{ to: STUDENT_ROUTES.documents, icon: FileText, label: 'Documents' }],
    },
    {
      heading: 'Placements',
      items: [{ to: STUDENT_ROUTES.placements, icon: Briefcase, label: 'Placements' }],
    },
  ],
};

const ROLE_COLORS = {
  iqac_admin: 'badge-info',
  hod: 'badge-success',
  faculty: 'badge-warning',
  staff: 'badge-info',
  student: 'badge-success',
};

const ROLE_COPY = {
  iqac_admin: {
    title: 'Quality command center',
    description: 'Analytics, reporting, and institutional health in one dashboard.',
  },
  hod: {
    title: 'Department command center',
    description: 'Track department outcomes, faculty, and accreditation readiness.',
  },
  faculty: {
    title: 'Faculty IQAC workspace',
    description: 'Track subject outcomes, my students, structured contributions, and tagged academic documents.',
  },
  staff: {
    title: 'Staff monitoring',
    description: 'A lightweight space for student outcomes, reports, and shared documents.',
  },
  student: {
    title: 'Student success workspace',
    description: 'Navigate dedicated pages for academics, attendance, activities, documents, and placements.',
  },
};

const getDestinationParts = (to) => {
  const [pathname, hashFragment] = to.split('#');
  return {
    pathname,
    hash: hashFragment ? `#${hashFragment}` : '',
  };
};

const normalizeNavSections = (items = []) =>
  items.length && Array.isArray(items[0]?.items) ? items : [{ heading: '', items }];

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = ROLE_MENUS[user?.role] || [];
  const navSections = normalizeNavSections(navItems);
  const workspaceCopy = ROLE_COPY[user?.role] || ROLE_COPY.student;
  const isStaffWorkspace = user?.role === 'staff';

  const shellClass = isOpen ? 'translate-x-0' : '-translate-x-full';

  const isItemActive = ({ to, matchPaths = [], matchPrefixes = [] }) => {
    const { pathname, hash } = getDestinationParts(to);

    if (matchPaths.some((candidate) => location.pathname === candidate)) {
      return true;
    }

    if (matchPrefixes.some((prefix) => location.pathname.startsWith(prefix))) {
      return true;
    }

    if (hash) {
      return location.pathname === pathname && location.hash === hash;
    }

    return location.pathname === pathname;
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-canvas/72 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`sidebar-shell fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-line/70 shadow-elevated backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${isStaffWorkspace ? 'sidebar-shell--staff' : ''} ${shellClass}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line/70 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/20">
              <Cpu size={18} />
            </div>
            <div>
              <p className="text-base font-semibold tracking-tight text-content-primary">IQAC</p>
              <p className="text-[11px] uppercase tracking-[0.22em] text-content-muted">Monitoring System</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost h-9 w-9 p-0 lg:hidden"
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 pt-5">
          <div className="sidebar-theme-panel">
            <div>
              <p className="eyebrow">Appearance</p>
              <p className="mt-1 text-sm text-content-muted">Switch between light and dark workspace modes.</p>
            </div>
            <ThemeToggle />
          </div>

          {isStaffWorkspace ? (
            <div className="sidebar-workspace-card--staff rounded-[24px] border border-brand-400/18 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="badge badge-info">STAFF</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-content-muted">Panel</span>
              </div>
              <p className="mt-4 text-lg font-semibold tracking-tight text-content-primary">Monitoring System</p>
              <p className="mt-2 text-sm leading-6 text-content-muted">{workspaceCopy.description}</p>
            </div>
          ) : (
            <div className="section-muted space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Workspace</p>
                <span className={`badge ${ROLE_COLORS[user?.role] || 'badge-info'}`}>{user?.role || 'loading'}</span>
              </div>
              <div>
                <p className="text-base font-semibold text-content-primary">{workspaceCopy.title}</p>
                <p className="mt-1 text-sm text-content-muted">{workspaceCopy.description}</p>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
          {navItems.length > 0 ? navSections.map(({ heading, items }) => (
            <div key={heading || items.map(({ to }) => to).join('|')} className="space-y-1">
              {heading ? (
                <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-content-muted">
                  {heading}
                </p>
              ) : null}

              {items.map(({ to, icon: Icon, label, matchPaths, matchPrefixes }) => {
                const active = isItemActive({ to, matchPaths, matchPrefixes });

                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => onClose()}
                    className={[
                      'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition duration-200',
                      active
                        ? isStaffWorkspace
                          ? 'border border-brand-400/28 bg-[linear-gradient(135deg,rgba(59,130,246,0.16),rgba(59,130,246,0.06))] text-content-primary shadow-[0_18px_36px_-28px_rgba(59,130,246,0.95),inset_0_1px_0_rgba(255,255,255,0.05)]'
                          : 'border border-brand-400/20 bg-brand-500/12 text-content-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                        : 'text-content-secondary hover:bg-panel-muted hover:text-content-primary',
                    ].join(' ')}
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${active ? 'bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/18' : 'bg-panel-muted/80 text-content-muted group-hover:text-content-secondary'}`}>
                      <Icon size={17} />
                    </div>
                    <span className="flex-1">{label}</span>
                    <ChevronRight size={15} className={`transition ${active ? 'text-brand-300 opacity-100' : 'opacity-0 group-hover:opacity-60'}`} />
                  </Link>
                );
              })}
            </div>
          )) : (
            <div className="empty-state min-h-[8rem]">Loading navigation...</div>
          )}
        </nav>

        <div className="border-t border-line/70 p-4">
          <div className={`sidebar-user-card flex items-center gap-3 rounded-[22px] border p-4 ${isStaffWorkspace ? 'sidebar-user-card--staff' : ''}`}>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500 text-sm font-bold text-white shadow-[0_18px_40px_-24px_rgba(26,82,255,0.8)]">
              {user?.name?.charAt(0)?.toUpperCase() || 'I'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-content-primary">{user?.name || 'Loading user'}</p>
              <p className="truncate text-xs text-content-muted">{user?.email || 'Authenticated session'}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="btn-ghost h-10 w-10 p-0 text-content-muted hover:bg-danger/10 hover:text-danger"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

