import { useCallback, useEffect, useState } from 'react';
import { Clock3, Users } from 'lucide-react';
import Navbar from '../../components/Navbar';
import { staffAPI } from '../../services/api';
import { WorkspaceHeader, formatDate } from './shared';

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [reports, setReports] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsResponse, reportsResponse] = await Promise.all([
        staffAPI.getAnalytics(),
        staffAPI.getReports()
      ]);
      setAnalytics(analyticsResponse.data.data || null);
      setReports(reportsResponse.data.reports || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="flex min-h-full flex-col">
      <Navbar title="Staff Analytics" subtitle="Student, faculty, department, and system usage metrics visible to staff." onRefresh={loadData} loading={loading} />
      <div className="dashboard-container flex-1 py-6">

        <section className="section overflow-hidden">
          <WorkspaceHeader title="Analytics Panel" subtitle="Student, faculty, department, and system usage metrics visible to staff." badge="Read-only" />
          <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-2 lg:grid-cols-4">
            <div className="section-muted p-5"><p className="metric-label">Student statistics</p><p className="mt-3 text-3xl font-semibold text-content-primary">{analytics?.studentStats?.totalStudents ?? 0}</p><p className="metric-note mt-2">Average attendance: {analytics?.studentStats?.avgAttendance ?? 0}%</p></div>
            <div className="section-muted p-5"><p className="metric-label">Faculty statistics</p><p className="mt-3 text-3xl font-semibold text-content-primary">{analytics?.facultyStats?.totalFaculty ?? 0}</p><p className="metric-note mt-2">Research papers: {analytics?.facultyStats?.totalResearchPapers ?? 0}</p></div>
            <div className="section-muted p-5"><p className="metric-label">Department metrics</p><p className="mt-3 text-3xl font-semibold text-content-primary">{analytics?.departmentMetrics?.totalDepartments ?? 0}</p><p className="metric-note mt-2">HOD coverage: {analytics?.departmentMetrics?.coverageRate ?? 0}%</p></div>
            <div className="section-muted p-5"><p className="metric-label">System usage</p><p className="mt-3 text-3xl font-semibold text-content-primary">{analytics?.systemUsage?.totalReports ?? 0}</p><p className="metric-note mt-2">Recent exports across staff operations</p></div>
          </div>
          <div className="grid gap-4 border-t border-line/80 px-5 py-5 lg:grid-cols-2">
            <div className="section-muted p-5">
              <div className="flex items-center gap-3">
                <Clock3 size={16} className="text-content-muted" />
                <p className="text-sm font-semibold text-content-primary">Recent report history</p>
              </div>
              <div className="mt-4 space-y-3">
                {reports.slice(0, 5).map((report) => (
                  <div key={report._id} className="surface-inset flex items-center justify-between gap-3 p-3">
                    <div>
                      <p className="text-sm font-semibold text-content-primary">{report.title}</p>
                      <p className="text-xs text-content-muted">{report.generatedBy?.name || 'System'} · {formatDate(report.createdAt)}</p>
                    </div>
                    <span className="badge badge-info">{report.status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="section-muted p-5">
              <div className="flex items-center gap-3">
                <Users size={16} className="text-content-muted" />
                <p className="text-sm font-semibold text-content-primary">Role distribution</p>
              </div>
              <div className="mt-4 space-y-3">
                {(analytics?.roleDistribution || []).map((role) => (
                  <div key={role._id} className="surface-inset p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-content-secondary">{role._id}</p>
                      <p className="text-sm font-semibold text-content-primary">{role.total}</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-pill bg-panel-muted">
                      <div className="h-full rounded-pill bg-brand-500" style={{ width: `${role.total && analytics?.overview?.totalUsers ? Math.round((role.total / analytics.overview.totalUsers) * 100) : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
