import { ArrowLeft, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';

export default function UnauthorizedPage() {
  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.12),transparent_24%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col">
        <div className="mb-6 flex items-center justify-end">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="section w-full max-w-xl space-y-6 p-8 text-center sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-danger/10 text-danger ring-1 ring-danger/20">
              <Shield size={30} />
            </div>

            <div>
              <p className="eyebrow">Access Control</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-content-primary">Access Denied</h1>
              <p className="mt-3 text-sm leading-7 text-content-muted sm:text-base">
                You do not have permission to access this page. If you believe this is an error, contact your administrator and verify that you are signed in with the correct role.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link to="/login" className="btn-primary">
                <ArrowLeft size={16} />
                Back to Login
              </Link>
              <button type="button" onClick={() => window.history.back()} className="btn-secondary">
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
