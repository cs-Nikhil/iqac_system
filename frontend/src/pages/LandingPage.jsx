import {
  Activity,
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';

const NAV_ITEMS = [
  { label: 'Features', href: '#features' },
  { label: 'Preview', href: '#preview' },
  { label: 'Roles', href: '#roles' },
  { label: 'Stats', href: '#stats' },
];

const HERO_POINTS = [
  'Centralized academic quality monitoring',
  'Live dashboards for departments and IQAC teams',
  'Accreditation workflows with cleaner evidence visibility',
];

const FEATURE_ITEMS = [
  {
    icon: Users,
    title: 'Role-Based Access',
    description: 'Deliver focused workspaces for administrators, faculty, staff, and students without clutter.',
    accent: 'from-brand-400 to-brand-600',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description: 'Track performance, pass trends, attendance, and operational health from one intelligent surface.',
    accent: 'from-info to-brand-500',
  },
  {
    icon: ShieldCheck,
    title: 'Accreditation Support',
    description: 'Organize NAAC and NBA requirements with evidence-friendly workflows and reporting clarity.',
    accent: 'from-violet-400 to-fuchsia-500',
  },
  {
    icon: GraduationCap,
    title: 'Student Monitoring',
    description: 'Spot risk indicators, progression shifts, and academic performance gaps before they become issues.',
    accent: 'from-warning to-orange-500',
  },
  {
    icon: Briefcase,
    title: 'Placement Tracking',
    description: 'Monitor student readiness, placement outcomes, and drive activity through one connected system.',
    accent: 'from-emerald-400 to-cyan-500',
  },
  {
    icon: FileText,
    title: 'Research Management',
    description: 'Capture faculty contributions, publications, and evidence records in a governed shared workspace.',
    accent: 'from-pink-400 to-rose-500',
  },
];

const STATS = [
  { value: '500+', label: 'Students Managed' },
  { value: '50+', label: 'Faculty Members' },
  { value: '10+', label: 'Dashboards' },
  { value: 'Realtime', label: 'Data Processing' },
];

const ROLES = [
  {
    icon: LayoutDashboard,
    title: 'Admin',
    summary: 'Full analytics access',
    description: 'Monitor institutional KPIs, department performance, workflow status, and quality metrics in one place.',
  },
  {
    icon: FileText,
    title: 'Faculty',
    summary: 'Manage achievements and research',
    description: 'Update academic contributions, research outputs, and supporting records without bouncing between tools.',
  },
  {
    icon: GraduationCap,
    title: 'Student',
    summary: 'Track performance and placements',
    description: 'View attendance, performance, achievements, and placement readiness through a clear self-service view.',
  },
];

const METRIC_CARDS = [
  { label: 'Institution Score', value: '94.2%' },
  { label: 'Placement Readiness', value: '88%' },
  { label: 'Open Evidence Tasks', value: '24' },
];

const DEPARTMENT_ROWS = [
  { name: 'Computer Science', score: '92%', status: 'Healthy' },
  { name: 'Electronics', score: '88%', status: 'Reviewing' },
  { name: 'Mechanical', score: '81%', status: 'Attention' },
];

const ACTIVITY_FEED = [
  { label: 'NAAC evidence sync completed', time: '2 min ago' },
  { label: 'Attendance alert generated', time: '19 min ago' },
  { label: 'Placement analytics refreshed', time: 'Today' },
];

const CHART_BARS = [
  { label: 'Jan', height: '44%' },
  { label: 'Feb', height: '58%' },
  { label: 'Mar', height: '54%' },
  { label: 'Apr', height: '71%' },
  { label: 'May', height: '66%' },
  { label: 'Jun', height: '88%' },
];

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

function SectionIntro({ eyebrow, title, description, centered = false }) {
  return (
    <div className={cn(centered && 'mx-auto max-w-3xl text-center')}>
      <p className="eyebrow text-brand-300">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-content-primary sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 max-w-3xl text-base leading-8 text-content-secondary sm:text-lg">
        {description}
      </p>
    </div>
  );
}

function StatusBadge({ status }) {
  const tone = {
    Healthy: 'border-success/20 bg-success/10 text-success',
    Reviewing: 'border-warning/20 bg-warning/10 text-warning',
    Attention: 'border-danger/20 bg-danger/10 text-danger',
  }[status] || 'border-line/70 bg-panel-muted/60 text-content-secondary';

  return (
    <span className={cn('inline-flex rounded-pill border px-3 py-1 text-xs font-semibold', tone)}>
      {status}
    </span>
  );
}

function DashboardPreview({ compact = false }) {
  const metricCards = compact ? METRIC_CARDS.slice(0, 2) : METRIC_CARDS;
  const rows = compact ? DEPARTMENT_ROWS.slice(0, 2) : DEPARTMENT_ROWS;

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-slate-950/85 p-4 text-white shadow-[0_40px_120px_-56px_rgba(2,6,23,0.95)] backdrop-blur-2xl sm:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.18),_transparent_28%)]" />
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 via-blue-500 to-violet-500 text-white shadow-lg shadow-blue-500/20">
              <LayoutDashboard size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">IQAC Command Center</p>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                Real-time analytics dashboard
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-2 rounded-pill border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
            <Sparkles size={14} className="text-sky-300" />
            Live Sync
          </span>
        </div>

        <div className={cn('mt-5 grid gap-4', compact ? 'lg:grid-cols-1' : 'lg:grid-cols-[1.3fr_0.9fr]')}>
          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-400">Department health trend</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Accreditation readiness improving
                </h3>
              </div>

              <span className="inline-flex items-center gap-1 rounded-pill border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                <TrendingUp size={14} />
                +18.2%
              </span>
            </div>

            <div className={cn('mt-6 grid grid-cols-6 gap-3', compact ? 'h-32' : 'h-40')}>
              {CHART_BARS.map((bar) => (
                <div key={bar.label} className="flex h-full flex-col justify-end gap-2">
                  <div className="relative flex-1 overflow-hidden rounded-[20px] border border-white/10 bg-white/5">
                    <div
                      className="absolute inset-x-0 bottom-0 rounded-[18px] bg-gradient-to-t from-cyan-400 via-blue-500 to-violet-500 shadow-[0_0_26px_rgba(59,130,246,0.35)]"
                      style={{ height: bar.height }}
                    />
                  </div>
                  <span className="text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {bar.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {metricCards.map((metric) => (
              <div key={metric.label} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {metric.label}
                </p>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <p className="text-2xl font-semibold tracking-tight">{metric.value}</p>
                  <div className="h-9 w-16 rounded-pill bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 opacity-90" />
                </div>
              </div>
            ))}

            {!compact ? (
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Activity feed
                </p>
                <div className="mt-4 space-y-3">
                  {ACTIVITY_FEED.map((item) => (
                    <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                      <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400/10 text-emerald-200">
                        <CheckCircle2 size={14} />
                      </span>
                      <div>
                        <p className="text-sm font-medium leading-6 text-slate-100">{item.label}</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 rounded-[26px] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-400">Department overview</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">Operational quality snapshot</p>
            </div>
            <Activity size={18} className="text-slate-400" />
          </div>

          <div className="mt-4 space-y-3">
            {rows.map((row) => (
              <div key={row.name} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-100">{row.name}</p>
                  <p className="text-sm text-slate-400">Score: {row.score}</p>
                </div>
                <StatusBadge status={row.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, accent }) {
  return (
    <article className="section card-hover group flex h-full flex-col gap-5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg', accent)}>
          <Icon size={22} />
        </div>
        <ChevronRight size={18} className="text-content-muted transition duration-300 group-hover:translate-x-1 group-hover:text-content-primary" />
      </div>
      <div>
        <h3 className="text-2xl font-semibold tracking-tight text-content-primary">{title}</h3>
        <p className="mt-3 text-base leading-7 text-content-secondary">{description}</p>
      </div>
    </article>
  );
}

function RoleCard({ icon: Icon, title, summary, description }) {
  return (
    <article className="section card-hover flex h-full flex-col gap-5 p-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/20">
        <Icon size={22} />
      </div>
      <div>
        <p className="eyebrow text-brand-300">{title}</p>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-content-primary">{summary}</h3>
        <p className="mt-3 text-base leading-7 text-content-secondary">{description}</p>
      </div>
    </article>
  );
}

export default function LandingPage() {
  return (
    <div className="page-transition relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(77,126,255,0.2),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.12),_transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.12),_transparent_24%)]" />

      <div className="mx-auto max-w-7xl">
        <header className="sticky top-4 z-40">
          <div className="flex items-center justify-between gap-4 rounded-[24px] border border-line/70 bg-panel/70 px-4 py-3 shadow-panel backdrop-blur-2xl sm:px-6">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 via-blue-500 to-violet-500 text-white shadow-lg shadow-blue-500/20">
                <GraduationCap size={20} />
              </div>
              <div>
                <p className="text-base font-semibold tracking-tight text-content-primary">IQAC System</p>
                <p className="text-xs uppercase tracking-[0.22em] text-content-muted">Academic quality workspace</p>
              </div>
            </Link>

            <nav className="hidden items-center gap-8 lg:flex">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium text-content-secondary transition hover:text-content-primary"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>
              <Link to="/login" className="btn-primary">
                Login
              </Link>
            </div>
          </div>
        </header>

        <main className="pb-16 pt-8">
          <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,13,30,0.92),rgba(16,24,50,0.9)_38%,rgba(28,20,58,0.9)_100%)] px-6 py-12 text-white shadow-[0_44px_120px_-56px_rgba(2,6,23,0.96)] sm:px-8 sm:py-14 lg:px-12 lg:py-16">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_82%_20%,rgba(99,102,241,0.2),transparent_24%),radial-gradient(circle_at_84%_78%,rgba(168,85,247,0.2),transparent_28%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30" />

            <div className="relative z-10 grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="animate-[page-fade-in_0.8s_ease-out]">
                <span className="inline-flex items-center gap-2 rounded-pill border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-xl">
                  <Sparkles size={16} className="text-sky-200" />
                  Modern institutional operations platform
                </span>

                <h1 className="mt-8 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl xl:text-[4.1rem] xl:leading-[1.02]">
                  Modern IQAC Monitoring & Accreditation Platform
                </h1>

                <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">
                  Centralize student performance, department analytics, and accreditation workflows in one intelligent system.
                </p>

                <div className="mt-10 flex flex-wrap gap-4">
                  <Link to="/login" className="btn-primary px-6 py-3 text-base">
                    Get Started
                    <ArrowRight size={18} />
                  </Link>
                </div>

                <div className="mt-10 grid gap-3 sm:grid-cols-3">
                  {HERO_POINTS.map((point) => (
                    <div key={point} className="rounded-[22px] border border-white/10 bg-white/10 px-4 py-4 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:bg-white/15">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                        <CheckCircle2 size={16} />
                      </span>
                      <p className="mt-3 text-sm leading-6 text-slate-100">{point}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="animate-[ambient-float_12s_ease-in-out_infinite]">
                <DashboardPreview compact />
              </div>
            </div>
          </section>

          <section className="py-10">
            <div className="section flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="eyebrow text-brand-300">Operational Focus</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-content-primary">
                  A landing page that feels connected to the product, not separate from it.
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {['Analytics', 'Accreditation', 'Placements'].map((item) => (
                  <div key={item} className="section-muted px-4 py-3 text-sm font-semibold text-content-primary">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="preview" className="py-20">
            <SectionIntro
              eyebrow="Product Preview"
              title="A cleaner product story with a believable dashboard surface."
              description="The preview area now shows charts, KPI tiles, workflow activity, and department snapshots so the page immediately feels more credible and product-led."
            />

            <div className="mt-10 section p-4 sm:p-6 lg:p-8">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="eyebrow text-brand-300">Preview Canvas</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-content-primary sm:text-3xl">
                    Real-time analytics dashboard
                  </h3>
                </div>
                <div className="inline-flex items-center gap-2 rounded-pill border border-line/70 bg-panel-muted/70 px-4 py-2 text-sm text-content-secondary">
                  <BarChart3 size={16} className="text-brand-300" />
                  Charts, tables, alerts, and reporting
                </div>
              </div>

              <DashboardPreview />
            </div>
          </section>

          <section id="features" className="py-20">
            <SectionIntro
              eyebrow="Features"
              title="Everything the institution needs, presented like a modern SaaS product."
              description="The features grid now has clearer hierarchy, better hover states, richer icon treatment, and descriptions that explain why each capability matters."
            />

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {FEATURE_ITEMS.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>
          </section>

          <section id="stats" className="py-20">
            <div className="section p-6 sm:p-8 lg:p-10">
              <SectionIntro
                eyebrow="Stats"
                title="Operational proof points users can absorb in seconds."
                description="The stats row is now framed as a product confidence layer with larger values, stronger alignment, and cleaner spacing."
                centered
              />

              <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {STATS.map((stat) => (
                  <div key={stat.label} className="section-muted p-6 text-center transition duration-300 hover:-translate-y-1 hover:shadow-elevated">
                    <p className="text-4xl font-display font-bold tracking-tight text-content-primary sm:text-5xl">
                      {stat.value}
                    </p>
                    <p className="mt-3 text-sm font-semibold uppercase tracking-[0.24em] text-content-muted">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="roles" className="py-20">
            <SectionIntro
              eyebrow="Role-Based Access"
              title="One platform, three focused experiences."
              description="The role section now explains how the same system serves admins, faculty, and students through distinct value propositions instead of generic cards."
            />

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {ROLES.map((role) => (
                <RoleCard key={role.title} {...role} />
              ))}
            </div>
          </section>

          <section className="py-20">
            <div className="section relative overflow-hidden p-8 sm:p-10 lg:p-12">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(77,126,255,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.18),_transparent_28%)]" />
              <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <p className="eyebrow text-brand-300">Call To Action</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-content-primary sm:text-4xl lg:text-5xl">
                    Start Managing Academic Quality Efficiently
                  </h2>
                  <p className="mt-4 text-base leading-8 text-content-secondary sm:text-lg">
                    Bring analytics, accreditation workflows, research records, and student monitoring into one clean operational system.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Link to="/login" className="btn-primary px-6 py-3 text-base">
                    Get Started Now
                    <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-line/60 px-2 py-8 text-center text-sm text-content-muted">
          Copyright 2026 IQAC System. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
