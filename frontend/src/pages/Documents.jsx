import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  FileClock,
  FileX2,
  Search,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useTheme } from '../context/ThemeContext';
import { API_ORIGIN, departmentsAPI, documentsAPI } from '../services/api';

const STATUS_OPTIONS = ['Pending Approval', 'Approved', 'Rejected', 'Archived'];

const formatDate = (value) => {
  if (!value) return 'Just now';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const downloadBlob = (data, fileName) => {
  const blob = data instanceof Blob ? data : new Blob([data]);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const buildDownloadName = (document) => {
  const baseName =
    document.file?.originalName ||
    document.file?.filename ||
    `${document.title || 'document'}.txt`;

  return baseName.replace(/[\\/:*?"<>|]+/g, '-');
};

const statusBadgeClass = {
  Approved: 'badge badge-success',
  Rejected: 'badge badge-danger',
  Archived: 'badge badge-warning',
  'Pending Approval': 'badge badge-info',
};

const getDocumentsTheme = (isLightTheme) => ({
  heroShell: isLightTheme
    ? 'border-line/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-[0_24px_70px_-42px_rgba(15,23,42,0.16)]'
    : 'border-white/10 bg-[linear-gradient(135deg,rgba(8,15,36,0.96),rgba(4,10,24,0.92))] shadow-[0_26px_90px_-56px_rgba(15,23,42,0.98)]',
  heroGlow: isLightTheme
    ? 'bg-[radial-gradient(circle_at_14%_18%,rgba(59,130,246,0.12),transparent_28%),radial-gradient(circle_at_82%_14%,rgba(16,185,129,0.08),transparent_24%)]'
    : 'bg-[radial-gradient(circle_at_14%_18%,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_82%_14%,rgba(16,185,129,0.14),transparent_24%)]',
  statToneClass: {
    blue: isLightTheme
      ? 'border-blue-200/80 bg-blue-50/90 text-blue-700 shadow-[0_18px_40px_-30px_rgba(59,130,246,0.18)]'
      : 'border-blue-400/14 bg-blue-500/10 text-blue-100 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.98)]',
    emerald: isLightTheme
      ? 'border-emerald-200/80 bg-emerald-50/90 text-emerald-700 shadow-[0_18px_40px_-30px_rgba(16,185,129,0.18)]'
      : 'border-emerald-400/14 bg-emerald-500/10 text-emerald-100 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.98)]',
    amber: isLightTheme
      ? 'border-amber-200/80 bg-amber-50/90 text-amber-700 shadow-[0_18px_40px_-30px_rgba(245,158,11,0.18)]'
      : 'border-amber-400/14 bg-amber-500/10 text-amber-100 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.98)]',
    rose: isLightTheme
      ? 'border-rose-200/80 bg-rose-50/90 text-rose-700 shadow-[0_18px_40px_-30px_rgba(244,63,94,0.18)]'
      : 'border-rose-400/14 bg-rose-500/10 text-rose-100 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.98)]',
  },
  statIconShell: isLightTheme
    ? 'border-white/80 bg-white/80 text-slate-700'
    : 'border-white/10 bg-white/10 text-white/90',
  queueShell: isLightTheme
    ? 'border-line/70 bg-white/95 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.16)]'
    : 'border-white/8 bg-[linear-gradient(180deg,rgba(10,18,40,0.96),rgba(5,11,25,0.92))] shadow-[0_24px_70px_-46px_rgba(15,23,42,0.98)]',
});

function StatCard({ label, value, icon: Icon, tone, theme }) {
  const toneClass = {
    blue: theme.statToneClass.blue,
    emerald: theme.statToneClass.emerald,
    amber: theme.statToneClass.amber,
    rose: theme.statToneClass.rose,
  }[tone] || theme.statToneClass.blue;

  return (
    <div className={`rounded-[22px] border p-5 ${toneClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="metric-label">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-content-primary">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${theme.statIconShell}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function QueueCard({ document, onApprove, onReject, onDownload, busyAction, theme }) {
  const isPending = document.status === 'Pending Approval';

  return (
    <div className={`rounded-[24px] border p-5 ${theme.queueShell}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-content-primary">{document.title}</p>
          <p className="mt-2 text-sm leading-6 text-content-secondary">
            {document.category} | {document.type} | {document.department?.name || 'Institution-wide'}
          </p>
        </div>
        <span className={statusBadgeClass[document.status] || 'badge badge-warning'}>
          {document.status}
        </span>
      </div>

      <div className="mt-4 space-y-2 text-sm text-content-secondary">
        <p>Uploaded by: <span className="text-content-primary">{document.uploadedBy?.name || 'Unknown'}</span></p>
        <p>Uploaded on: <span className="text-content-primary">{formatDate(document.createdAt)}</span></p>
        {document.description ? <p className="line-clamp-2">{document.description}</p> : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="btn-secondary" onClick={() => onDownload(document)}>
          <Download size={16} />
          Download
        </button>
        {isPending ? (
          <>
            <button
              type="button"
              className="btn-primary"
              disabled={busyAction === `approve-${document._id}`}
              onClick={() => onApprove(document._id)}
            >
              <CheckCircle2 size={16} />
              {busyAction === `approve-${document._id}` ? 'Approving...' : 'Approve'}
            </button>
            <button
              type="button"
              className="btn-secondary border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"
              disabled={busyAction === `reject-${document._id}`}
              onClick={() => onReject(document._id)}
            >
              <AlertTriangle size={16} />
              {busyAction === `reject-${document._id}` ? 'Rejecting...' : 'Reject'}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function Documents() {
  const { isLightTheme } = useTheme();
  const theme = getDocumentsTheme(isLightTheme);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({
    status: 'Pending Approval',
    department: '',
    search: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [documentsResponse, statsResponse, departmentsResponse] = await Promise.all([
        documentsAPI.getAll({
          status: filters.status || undefined,
          department: filters.department || undefined,
        }),
        documentsAPI.getStats(),
        departmentsAPI.getAll(),
      ]);

      setDocuments(documentsResponse.data.documents || []);
      setStats(statsResponse.data.stats || null);
      setDepartments(departmentsResponse.data.departments || []);
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to load documents right now.' });
    } finally {
      setLoading(false);
    }
  }, [filters.department, filters.status]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredDocuments = useMemo(
    () =>
      documents.filter((document) =>
        `${document.title} ${document.category} ${document.type} ${document.department?.name || ''} ${document.uploadedBy?.name || ''}`
          .toLowerCase()
          .includes(filters.search.toLowerCase())
      ),
    [documents, filters.search]
  );

  const pendingQueue = useMemo(
    () => filteredDocuments.filter((document) => document.status === 'Pending Approval'),
    [filteredDocuments]
  );

  const handleDecision = async (id, type) => {
    setBusyAction(`${type}-${id}`);
    setMessage(null);

    try {
      if (type === 'approve') {
        await documentsAPI.approve(id);
      } else {
        await documentsAPI.reject(id);
      }

      setMessage({
        type: 'success',
        text: `Document ${type === 'approve' ? 'approved' : 'rejected'} successfully.`,
      });
      await loadData();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || `Unable to ${type} this document.`,
      });
    } finally {
      setBusyAction('');
    }
  };

  const handleDownload = (document) => {
    const filePath = document.file?.path;

    if (filePath && filePath !== '/uploads/manual-entry') {
      const normalizedUrl = filePath.startsWith('http') ? filePath : `${API_ORIGIN}${filePath}`;
      window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const metadata = [
      `Title: ${document.title || 'NA'}`,
      `Category: ${document.category || 'NA'}`,
      `Type: ${document.type || 'NA'}`,
      `Department: ${document.department?.name || 'Institution-wide'}`,
      `Academic Year: ${document.academicYear || 'NA'}`,
      `Uploaded By: ${document.uploadedBy?.name || 'NA'}`,
      `Status: ${document.status || 'Pending'}`,
      `Uploaded: ${formatDate(document.createdAt)}`,
      '',
      document.description || 'No document description provided.',
    ].join('\n');

    downloadBlob(new Blob([metadata], { type: 'text/plain;charset=utf-8' }), buildDownloadName(document));
  };

  return (
    <div className="flex min-h-full flex-col">
      <Navbar
        title="Documents"
        subtitle="Review staff and department uploads, then approve or reject them from one queue."
        onRefresh={loadData}
        loading={loading}
        compact
      />

      <div className="dashboard-container flex-1 py-6">
        {message ? (
          <div className={`section mb-2 px-5 py-4 ${message.type === 'success' ? 'border-success/30 bg-success/10' : 'border-danger/30 bg-danger/10'}`}>
            <div className="flex items-center gap-3">
              {message.type === 'success' ? <CheckCircle2 size={18} className="text-success" /> : <AlertTriangle size={18} className="text-danger" />}
              <p className="text-sm font-medium text-content-primary">{message.text}</p>
            </div>
          </div>
        ) : null}

        <section className={`relative overflow-hidden rounded-[28px] border p-6 sm:p-7 ${theme.heroShell}`}>
          <div className={`pointer-events-none absolute inset-0 ${theme.heroGlow}`} />
          <div className="relative">
            <span className="badge badge-info">IQAC ADMIN</span>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-content-primary sm:text-[2.2rem]">
              Document approvals and audit readiness in one place.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-content-secondary">
              Staff uploads now land in a real approval queue. Review pending files, approve the valid ones, and reject incomplete submissions without leaving the admin workspace.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Documents" value={stats?.totalDocs ?? 0} icon={FileClock} tone="blue" theme={theme} />
          <StatCard label="Pending Approval" value={stats?.pendingDocs ?? 0} icon={Clock3} tone="amber" theme={theme} />
          <StatCard label="Approved" value={stats?.approvedDocs ?? 0} icon={FileCheck2} tone="emerald" theme={theme} />
          <StatCard label="Rejected" value={stats?.rejectedDocs ?? 0} icon={FileX2} tone="rose" theme={theme} />
        </section>

        <section className="section overflow-hidden">
          <div className="grid gap-4 border-b border-line/70 px-5 py-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
            <label className="block">
              <span className="metric-label block">Search</span>
              <div className="relative mt-2">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                <input
                  className="input-field pl-9"
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Search title, type, uploader, or department"
                />
              </div>
            </label>

            <label className="block">
              <span className="metric-label block">Status</span>
              <select
                className="input-field mt-2"
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="metric-label block">Department</span>
              <select
                className="input-field mt-2"
                value={filters.department}
                onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}
              >
                <option value="">All departments</option>
                {departments.map((department) => (
                  <option key={department._id} value={department._id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 px-5 py-5 xl:grid-cols-2">
            {pendingQueue.length ? pendingQueue.slice(0, 6).map((document) => (
              <QueueCard
                key={document._id}
                document={document}
                busyAction={busyAction}
                onApprove={(id) => handleDecision(id, 'approve')}
                onReject={(id) => handleDecision(id, 'reject')}
                onDownload={handleDownload}
                theme={theme}
              />
            )) : (
              <div className="empty-state min-h-[15rem] xl:col-span-2">
                No pending documents match the current filters.
              </div>
            )}
          </div>
        </section>

        <section className="section overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line/70 px-5 py-4">
            <div>
              <h3 className="section-title">Document Ledger</h3>
              <p className="section-subtitle mt-1">A full view of the currently filtered documents and their approval state.</p>
            </div>
            <span className="badge badge-info">{filteredDocuments.length} loaded</span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table min-w-[1040px]">
              <thead>
                <tr className="table-head">
                  <th className="table-head-cell">Title</th>
                  <th className="table-head-cell">Department</th>
                  <th className="table-head-cell">Uploader</th>
                  <th className="table-head-cell">Status</th>
                  <th className="table-head-cell">Reviewed By</th>
                  <th className="table-head-cell">Uploaded</th>
                  <th className="table-head-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.length ? filteredDocuments.map((document) => (
                  <tr key={document._id} className="table-row">
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-content-primary">{document.title}</p>
                        <p className="mt-1 text-xs text-content-muted">{document.category} | {document.type}</p>
                      </div>
                    </td>
                    <td className="table-cell">{document.department?.code || document.department?.name || 'Institution-wide'}</td>
                    <td className="table-cell">
                      <div>
                        <p className="text-content-primary">{document.uploadedBy?.name || 'Unknown'}</p>
                        <p className="mt-1 text-xs text-content-muted">{document.uploadedBy?.email || 'No email'}</p>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={statusBadgeClass[document.status] || 'badge badge-warning'}>
                        {document.status}
                      </span>
                    </td>
                    <td className="table-cell">
                      {document.approvedBy?.name ? (
                        <div>
                          <p className="text-content-primary">{document.approvedBy.name}</p>
                          <p className="mt-1 text-xs text-content-muted">{formatDate(document.approvedAt)}</p>
                        </div>
                      ) : (
                        <span className="text-content-muted">Not reviewed</span>
                      )}
                    </td>
                    <td className="table-cell text-xs text-content-muted">{formatDate(document.createdAt)}</td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn-secondary" onClick={() => handleDownload(document)}>
                          <Download size={16} />
                          Download
                        </button>
                        {document.status === 'Pending Approval' ? (
                          <>
                            <button
                              type="button"
                              className="btn-primary"
                              disabled={busyAction === `approve-${document._id}`}
                              onClick={() => handleDecision(document._id, 'approve')}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn-secondary border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"
                              disabled={busyAction === `reject-${document._id}`}
                              onClick={() => handleDecision(document._id, 'reject')}
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td className="table-cell" colSpan={7}>
                      <div className="empty-state min-h-[14rem]">No documents match the selected status, department, and search filters.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
