import { GraduationCap, Lock, Sparkles } from 'lucide-react';
import StudentStatusBadge from './StudentStatusBadge';

export default function StudentReadOnlyNotice({
  title = 'Graduated access is view-only',
  message,
  className = '',
}) {
  return (
    <section className={`page-transition student-shell overflow-hidden ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(37,99,235,0.18),transparent_28%,rgba(168,85,247,0.14)_62%,rgba(249,115,22,0.12)_100%)]" />
      <div className="pointer-events-none absolute -right-10 top-6 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.3),transparent_66%)] blur-2xl" />
      <div className="pointer-events-none absolute left-10 top-10 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.28),transparent_70%)] blur-2xl" />

      <div className="relative flex flex-col gap-5 p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="student-stat-icon student-stat-icon--warning animate-pulse">
              <Lock size={18} />
            </div>
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <p className="eyebrow">Student Status</p>
                <span className="student-status-pill">
                  <Sparkles size={12} />
                  Read-only access
                </span>
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-content-primary sm:text-[2rem]">
                {title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-content-secondary sm:text-[15px]">{message}</p>
            </div>
          </div>

          <StudentStatusBadge label="Graduated" className="badge-warning" />
        </div>

        <div className="student-shell-muted p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="student-stat-icon student-stat-icon--brand h-10 w-10">
              <GraduationCap size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-content-primary">Final academic record preserved</p>
              <p className="mt-1 text-sm leading-6 text-content-secondary">
                Viewing remains available across academics, attendance, performance, activities, documents,
                and placements. Update actions stay locked to preserve final student records.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
