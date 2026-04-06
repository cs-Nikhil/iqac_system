import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { FACULTY_WORKSPACE_ROUTES } from './faculty/facultyRoutes';
import { STUDENT_ROUTES } from './student/studentRoutes';

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'hod', label: 'HOD' },
  { value: 'staff', label: 'Staff' },
  { value: 'iqac_admin', label: 'IQAC Admin' },
];

const PLATFORM_POINTS = [
  'Unified dashboards for IQAC, HOD, faculty, staff, and students',
  'Reports, analytics, documents, and accreditation workflows in one system',
  'Dark-first responsive workspace with a full light theme toggle',
];

const inputClassName = 'input-field h-12 w-full pl-11 pr-4';

export default function LoginPage() {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'student',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (event) => {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await login(formData.email, formData.password, formData.role);

      if (response.success) {
        const roleRedirects = {
          iqac_admin: '/dashboard',
          staff: '/staff-dashboard',
          hod: '/dashboard',
          faculty: FACULTY_WORKSPACE_ROUTES.root,
          student: STUDENT_ROUTES.root,
        };

        const signedInRole = response.user?.role || formData.role;
        const redirectTarget = roleRedirects[signedInRole] || '/';

        window.location.replace(redirectTarget);
      } else {
        setError(response.message || 'Login failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.12),transparent_24%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1500px] flex-col gap-6 lg:grid lg:grid-cols-[1.02fr_0.98fr]">
        <section className="section relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-start justify-between gap-4">
            <Link to="/" className="inline-flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/20">
                <GraduationCap size={22} />
              </div>
              <div>
                <p className="text-lg font-semibold text-content-primary">IQAC Management System</p>
                <p className="text-sm text-content-muted">Institutional quality assurance platform</p>
              </div>
            </Link>

            <ThemeToggle />
          </div>

          <div className="max-w-xl">
            <p className="eyebrow text-brand-300">Secure Access</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-content-primary sm:text-5xl">
              One platform for analytics, accreditation, and academic visibility.
            </h1>
            <p className="mt-5 text-base leading-8 text-content-secondary sm:text-lg">
              Access the correct workspace for your role and continue with dashboards, documents,
              reports, placements, and chatbot-assisted insights.
            </p>

            <div className="mt-8 grid gap-4">
              {PLATFORM_POINTS.map((item) => (
                <div key={item} className="surface-inset flex items-start gap-3 px-4 py-4">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/20">
                    <CheckCircle2 size={16} />
                  </span>
                  <p className="text-sm leading-7 text-content-secondary">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-content-muted">
            <ShieldCheck size={16} />
            <span>Authorized access only</span>
          </div>
        </section>

        <section className="flex min-h-[calc(100vh-2rem)] items-center justify-center lg:min-h-0">
          <div className="w-full max-w-xl">
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <Link to="/" className="inline-flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-[0_18px_40px_-26px_rgba(37,99,235,0.6)]">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <p className="text-base font-semibold text-content-primary">IQAC Management System</p>
                  <p className="text-sm text-content-muted">Secure institutional access</p>
                </div>
              </Link>

              <ThemeToggle />
            </div>

            <div className="section max-w-xl p-6 sm:p-8">
              <div className="section-header gap-4">
                <div>
                  <p className="eyebrow text-brand-300">Welcome Back</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-content-primary">
                    Sign in to continue
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-7 text-content-secondary">
                    Choose your role and enter your credentials to open the correct responsive workspace.
                  </p>
                </div>

                <span className="badge badge-info">Secure Login</span>
              </div>

              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                {error ? (
                  <div
                    role="alert"
                    className="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger"
                  >
                    {error}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-content-secondary">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-content-muted"
                    />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className={inputClassName}
                      placeholder="Enter your email address"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-medium text-content-secondary">
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-content-muted"
                    />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className={`${inputClassName} pr-12`}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-xl p-2 text-content-muted transition hover:bg-panel-muted hover:text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-300/30"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="role" className="block text-sm font-medium text-content-secondary">
                    Select role
                  </label>
                  <div className="relative">
                    <ShieldCheck
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-content-muted"
                    />
                    <select
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      className={`${inputClassName} appearance-none pr-12`}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={18}
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-content-muted"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary h-12 w-full justify-center"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-b-white" />
                      Signing in...
                    </span>
                  ) : (
                    <>
                      <LogIn size={16} />
                      Sign in
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 rounded-[24px] border border-line/70 bg-panel-muted/50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-content-muted">
                  Access Notes
                </p>
                <p className="mt-2 text-sm leading-7 text-content-secondary">
                  Your role controls which workspace, pages, and chatbot guidance are available after sign-in.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
