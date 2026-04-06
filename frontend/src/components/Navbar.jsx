import { LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationsMenu from './notifications/NotificationsMenu';

export default function Navbar({
  eyebrow = 'Overview',
  title,
  subtitle,
  onRefresh,
  loading,
  compact = false,
}) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b border-line/70 bg-canvas/80 backdrop-blur-xl">
      <div className="dashboard-container gap-4 py-4">
        <div className="toolbar">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-content-primary sm:text-[1.75rem]">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-content-muted">{subtitle}</p> : null}
          </div>

          <div className="toolbar-group">
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                className="btn-secondary h-10 w-10 p-0"
                aria-label="Refresh data"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            ) : null}

            {!compact ? <NotificationsMenu /> : null}

            <div className="hidden rounded-xl border border-line/70 bg-panel-muted/70 px-3 py-2 text-right lg:block">
              <p className="text-[11px] uppercase tracking-[0.2em] text-content-muted">Today</p>
              <p className="mt-1 text-xs font-medium text-content-secondary">
                {new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}
              </p>
            </div>

            <div className="hidden items-center gap-3 rounded-2xl border border-line/70 bg-panel-muted/70 px-3 py-2 lg:flex">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500 text-sm font-semibold text-white shadow-[0_16px_36px_-24px_rgba(26,82,255,0.8)]">
                {user?.name?.charAt(0)?.toUpperCase() || 'I'}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-content-primary">{user?.name || 'Workspace User'}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-content-muted">{user?.role || 'session'}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="btn-ghost h-10 w-10 p-0 text-content-muted hover:bg-danger/10 hover:text-danger"
                aria-label="Logout"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
