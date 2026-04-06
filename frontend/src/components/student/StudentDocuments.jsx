import { useMemo, useState } from 'react';
import { Download, FileCheck2, FolderKanban, ShieldCheck } from 'lucide-react';
import StudentActionButton from './StudentActionButton';

const initialForm = {
  title: '',
  description: '',
  academicYear: '',
  type: 'Report',
  subCategory: 'Project Report',
  tags: '',
};

const getAssetUrl = (assetOrigin, filePath) => {
  if (!filePath) {
    return '';
  }

  if (/^https?:\/\//i.test(filePath)) {
    return filePath;
  }

  return `${assetOrigin}${filePath}`;
};

function DocumentMetric({ label, value, note, icon: Icon, tone = 'brand', progress = 0 }) {
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
    <div className="student-stat-card">
      <div className="student-stat-content space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className={toneClass}>
            <Icon size={19} />
          </div>
          <span className="badge student-glow-badge badge-info">{label}</span>
        </div>

        <div>
          <p className="metric-label">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-content-primary">{value}</p>
          <p className="mt-2 text-sm text-content-secondary">{note}</p>
        </div>

        <div className="student-progress-track">
          <div className={progressTone} style={{ width: `${Math.max(12, Math.min(100, Number(progress || 0)))}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function StudentDocuments({
  data,
  loading,
  submitting,
  onCreate,
  assetOrigin,
  readOnly = false,
  readOnlyReason = '',
}) {
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const documents = data?.documents || [];

  const documentMetrics = useMemo(() => {
    const approvedCount = documents.filter((document) => document.status === 'Approved').length;
    const pendingCount = documents.filter((document) => document.status === 'Pending').length;

    return [
      {
        label: 'Total Files',
        value: loading ? '--' : documents.length,
        note: 'Uploaded files across review categories',
        icon: FolderKanban,
        tone: 'brand',
        progress: Math.min(100, Math.max(12, documents.length * 16)),
      },
      {
        label: 'Approved',
        value: loading ? '--' : approvedCount,
        note: 'Files cleared in the review workflow',
        icon: FileCheck2,
        tone: 'success',
        progress: documents.length ? (approvedCount / documents.length) * 100 : 12,
      },
      {
        label: 'Pending Review',
        value: loading ? '--' : pendingCount,
        note: 'Items waiting for verification or action',
        icon: ShieldCheck,
        tone: 'warning',
        progress: documents.length ? (pendingCount / documents.length) * 100 : 12,
      },
    ];
  }, [documents, loading]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => payload.append(key, value));
    if (file) {
      payload.append('file', file);
    }

    const result = await onCreate(payload);
    if (result?.success === false) {
      setMessage(result.message || 'Unable to upload the document.');
      return;
    }

    setMessage('Document submitted successfully.');
    setForm(initialForm);
    setFile(null);
  };

  return (
    <section className="student-shell flex h-full flex-col gap-6 p-6 sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.14),transparent_20%)]" />

      <div className="relative flex flex-col gap-6">
        <div className="section-header">
          <div>
            <p className="eyebrow">Document Upload</p>
            <h3 className="mt-1 text-2xl font-semibold text-content-primary">Maintain internship, project, and accreditation documents</h3>
            <p className="section-subtitle mt-2 max-w-2xl">
              Keep student documents centralized, review-ready, and easy to access for approvals, audits, and downloads.
            </p>
          </div>
          <div className={`badge student-glow-badge ${readOnly ? 'badge-warning' : 'badge-info'}`}>
            {readOnly ? 'View-only access' : `${documents.length} files`}
          </div>
        </div>

        {message ? (
          <div className={`rounded-[24px] border px-4 py-3 text-sm shadow-[0_18px_48px_-32px_rgba(15,23,42,0.95)] backdrop-blur-md ${
            message.includes('successfully')
              ? 'border-success/25 bg-success/10 text-success'
              : 'border-danger/25 bg-danger/10 text-danger'
          }`}>
            {message}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {documentMetrics.map((card) => (
            <DocumentMetric key={card.label} {...card} />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(19rem,0.92fr)_minmax(0,1.08fr)]">
          <form className="student-shell-muted space-y-4 p-5 sm:p-6" onSubmit={handleSubmit}>
            <div>
              <p className="metric-label">Upload Document</p>
              <h4 className="mt-2 text-xl font-semibold text-content-primary">Submit a new file</h4>
              <p className="mt-2 text-sm text-content-secondary">
                PDF, image, and certificate uploads are kept structured for professional review and later download.
              </p>
            </div>

            {readOnly ? (
              <div className="rounded-[24px] border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
                Document uploads are disabled for graduated students. Existing files can still be opened or downloaded.
              </div>
            ) : null}

            <input
              className="input-field"
              placeholder="Document title"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              disabled={readOnly || submitting}
              title={readOnly ? readOnlyReason : undefined}
              required
            />
            <textarea
              className="textarea-field min-h-[7rem]"
              placeholder="Description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              disabled={readOnly || submitting}
              title={readOnly ? readOnlyReason : undefined}
              required
            />

            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="input-field"
                placeholder="Academic year (e.g. 2025-26)"
                value={form.academicYear}
                onChange={(event) => setForm((current) => ({ ...current, academicYear: event.target.value }))}
                disabled={readOnly || submitting}
                title={readOnly ? readOnlyReason : undefined}
                required
              />
              <select
                className="input-field"
                value={form.type}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                disabled={readOnly || submitting}
                title={readOnly ? readOnlyReason : undefined}
              >
                {['Report', 'Certificate', 'Internal', 'External'].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="input-field"
                placeholder="Sub-category"
                value={form.subCategory}
                onChange={(event) => setForm((current) => ({ ...current, subCategory: event.target.value }))}
                disabled={readOnly || submitting}
                title={readOnly ? readOnlyReason : undefined}
              />
              <input
                className="input-field"
                placeholder="Tags (comma separated)"
                value={form.tags}
                onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                disabled={readOnly || submitting}
                title={readOnly ? readOnlyReason : undefined}
              />
            </div>

            <input
              className="file-field"
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              disabled={readOnly || submitting}
              title={readOnly ? readOnlyReason : undefined}
              required
            />

            <StudentActionButton
              type="submit"
              disabled={readOnly || submitting}
              tooltip={readOnly ? readOnlyReason : undefined}
              className="btn-primary w-full justify-center"
            >
              {submitting ? 'Uploading...' : 'Submit document'}
            </StudentActionButton>
          </form>

          <div className="space-y-6">
            <section className="student-shell-muted p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="metric-label">Recent Documents</p>
                  <p className="mt-2 text-sm text-content-secondary">
                    Track review status, open uploaded files, and download approved submissions anytime.
                  </p>
                </div>
                <div className="student-stat-icon student-stat-icon--brand h-10 w-10">
                  <FolderKanban size={16} />
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {loading ? (
                  <div className="space-y-4">
                    <div className="skeleton h-28 rounded-[24px]" />
                    <div className="skeleton h-28 rounded-[24px]" />
                    <div className="skeleton h-28 rounded-[24px]" />
                  </div>
                ) : documents.length === 0 ? (
                  <div className="empty-state min-h-[12rem]">No documents uploaded yet.</div>
                ) : (
                  documents.slice(0, 5).map((document) => (
                    <article key={document._id} className="student-list-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-content-primary">{document.title}</p>
                          <p className="mt-1 text-sm text-content-secondary">
                            {(document.subCategory || document.type)} / {document.academicYear}
                          </p>
                        </div>
                        <span className={`badge student-glow-badge ${
                          document.status === 'Approved'
                            ? 'badge-success'
                            : document.status === 'Rejected'
                              ? 'badge-danger'
                              : 'badge-warning'
                        }`}
                        >
                          {document.status}
                        </span>
                      </div>

                      <p className="mt-4 text-sm leading-6 text-content-secondary">{document.description}</p>

                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-content-muted">
                        <span className="badge badge-info">{document.type}</span>
                        {document.file?.path ? (
                          <>
                            <a
                              className="badge badge-info hover:border-brand-300/30"
                              href={getAssetUrl(assetOrigin, document.file.path)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open file
                            </a>
                            <a
                              className="badge badge-info hover:border-brand-300/30"
                              href={getAssetUrl(assetOrigin, document.file.path)}
                              download
                            >
                              Download
                            </a>
                          </>
                        ) : null}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="student-shell-muted p-5 sm:p-6">
              <div className="flex items-center gap-4">
                <div className="student-stat-icon student-stat-icon--success h-12 w-12">
                  <Download size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-content-primary">Secure review workflow</p>
                  <p className="mt-1 text-sm text-content-secondary">
                    Student files remain accessible for download while uploads follow an approval-first review pipeline.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
