import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock3 } from 'lucide-react';
import BacklogTracker from '../../components/student/BacklogTracker';
import { studentPortalAPI } from '../../services/api';
import { useStudentWorkspace } from './StudentWorkspaceLayout';

export default function Backlogs() {
  const { profile } = useStudentWorkspace();
  const [backlogs, setBacklogs] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadBacklogs = useCallback(async () => {
    setLoading(true);

    try {
      const response = await studentPortalAPI.getBacklogs();
      setBacklogs(response.data?.data || null);
    } catch {
      setBacklogs(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBacklogs();
  }, [loadBacklogs]);

  const criticalBacklogs = useMemo(() => {
    const currentSemester = Number(profile?.currentSemester || 1);

    return (backlogs?.backlogs || []).filter(
      (item) => Number(item.attempts || 0) > 1 || Number(item.semester || 0) <= currentSemester - 2
    );
  }, [backlogs, profile?.currentSemester]);

  return (
    <div className="space-y-6">
      <div className="page-transition">
        <BacklogTracker data={backlogs} loading={loading} />
      </div>

      <section className="card page-transition p-6">
        <div className="section-header">
          <div>
            <p className="eyebrow">Critical Subjects</p>
            <h2 className="mt-1 text-xl font-semibold text-content-primary">Priority backlogs to clear</h2>
            <p className="section-subtitle mt-1">
              Older backlogs and repeat attempts are highlighted here so they are not lost in the broader backlog list.
            </p>
          </div>
          <span className={`badge ${criticalBacklogs.length ? 'badge-warning' : 'badge-success'}`}>
            {criticalBacklogs.length} flagged
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {loading ? (
            <div className="space-y-3">
              <div className="skeleton-line w-full" />
              <div className="skeleton-line w-4/5" />
              <div className="skeleton-line w-3/5" />
            </div>
          ) : criticalBacklogs.length === 0 ? (
            <div className="empty-state min-h-[11rem]">No critical backlog subjects right now.</div>
          ) : (
            criticalBacklogs.map((item) => (
              <article key={`${item.subject?._id || item.subject?.code}-${item.semester}`} className="rounded-2xl border border-warning/20 bg-warning/10 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-content-primary">{item.subject?.name}</p>
                    <p className="mt-1 text-xs text-content-muted">
                      {item.subject?.code} · Semester {item.semester} · {item.academicYear}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge badge-warning">Attempt {item.attempts}</span>
                    <span className="badge badge-danger">Priority</span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-content-secondary">
                  <span className="inline-flex items-center gap-2">
                    <Clock3 size={13} className="text-warning" />
                    Older semester backlog
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle size={13} className="text-warning" />
                    Latest total {item.total}
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

