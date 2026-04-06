import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FolderUp } from 'lucide-react';
import Navbar from '../../components/Navbar';
import { API_ORIGIN, staffAPI } from '../../services/api';
import { WorkspaceHeader, downloadBlob, formatDate } from './shared';

const DOCUMENT_CATEGORIES = ['Academic', 'Administrative', 'Accreditation', 'Student', 'Faculty'];
const DOCUMENT_TYPES = ['Policy', 'Report', 'Certificate', 'Internal', 'NBA', 'NAAC'];
const ACADEMIC_YEARS = ['2023-24', '2024-25', '2025-26'];

const initialDocumentForm = {
  title: '',
  description: '',
  category: 'Academic',
  type: 'Policy',
  department: '',
  academicYear: '2025-26',
  accessLevel: 'Internal',
};

const buildDownloadName = (document) => {
  const baseName =
    document.file?.originalName ||
    document.file?.filename ||
    `${document.title || 'document'}.txt`;

  return baseName.replace(/[\\/:*?"<>|]+/g, '-');
};

export default function Documentation() {
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [documentForm, setDocumentForm] = useState(initialDocumentForm);
  const [documentFile, setDocumentFile] = useState(null);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [documentsResponse, departmentsResponse] = await Promise.all([
        staffAPI.getDocuments(),
        staffAPI.getDepartments(),
      ]);
      setDocuments(documentsResponse.data.documents || []);
      setDepartments(departmentsResponse.data.departments || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const visibleDocuments = useMemo(
    () =>
      documents.filter((document) =>
        `${document.title} ${document.category} ${document.type} ${document.department?.name || ''}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [documents, search]
  );

  const handleUploadDocument = async (event) => {
    event.preventDefault();
    setBusyAction('upload');
    setMessage(null);

    try {
      const payload = new FormData();

      Object.entries({
        ...documentForm,
        department: documentForm.department || undefined,
      }).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          payload.append(key, value);
        }
      });

      if (documentFile) {
        payload.append('file', documentFile);
      }

      await staffAPI.uploadDocument(payload);
      setDocumentForm(initialDocumentForm);
      setDocumentFile(null);
      setShowUploadForm(false);
      setMessage({ type: 'success', text: 'Document uploaded successfully.' });
      await loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to upload the document.' });
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
        subtitle="Upload shared files and keep a simple downloadable record for staff use."
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

        <section className="section overflow-hidden">
          <WorkspaceHeader
            title="Shared Documents"
            subtitle="Keep uploads lightweight, searchable, and easy to download."
            badge={`${documents.length} files`}
          />

          <div className="flex flex-col gap-4 border-b border-line/70 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <input
              className="input-field lg:max-w-md"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, type, or department"
            />

            <button type="button" className="btn-primary" onClick={() => setShowUploadForm((current) => !current)}>
              <FolderUp size={16} />
              {showUploadForm ? 'Close Upload' : 'Upload Document'}
            </button>
          </div>

          {showUploadForm ? (
            <form className="grid gap-4 border-b border-line/70 px-5 py-5 lg:grid-cols-2" onSubmit={handleUploadDocument}>
              <label className="block">
                <span className="metric-label block">Title</span>
                <input
                  className="input-field mt-2"
                  value={documentForm.title}
                  onChange={(event) => setDocumentForm((current) => ({ ...current, title: event.target.value }))}
                  required
                />
              </label>

              <label className="block">
                <span className="metric-label block">Document File</span>
                <input
                  className="file-field mt-2"
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
                  onChange={(event) => setDocumentFile(event.target.files?.[0] || null)}
                  required
                />
                <p className="mt-2 text-xs text-content-muted">
                  {documentFile ? `Selected: ${documentFile.name}` : 'Upload the file that should be stored and downloaded from this module.'}
                </p>
              </label>

              <label className="block">
                <span className="metric-label block">Category</span>
                <select
                  className="input-field mt-2"
                  value={documentForm.category}
                  onChange={(event) => setDocumentForm((current) => ({ ...current, category: event.target.value }))}
                >
                  {DOCUMENT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="metric-label block">Type</span>
                <select
                  className="input-field mt-2"
                  value={documentForm.type}
                  onChange={(event) => setDocumentForm((current) => ({ ...current, type: event.target.value }))}
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="metric-label block">Department</span>
                <select
                  className="input-field mt-2"
                  value={documentForm.department}
                  onChange={(event) => setDocumentForm((current) => ({ ...current, department: event.target.value }))}
                >
                  <option value="">Institution-wide</option>
                  {departments.map((department) => (
                    <option key={department._id} value={department._id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="metric-label block">Academic Year</span>
                <select
                  className="input-field mt-2"
                  value={documentForm.academicYear}
                  onChange={(event) => setDocumentForm((current) => ({ ...current, academicYear: event.target.value }))}
                >
                  {ACADEMIC_YEARS.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block lg:col-span-2">
                <span className="metric-label block">Description</span>
                <textarea
                  className="textarea-field mt-2 min-h-[110px]"
                  value={documentForm.description}
                  onChange={(event) => setDocumentForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Short document note or context"
                />
              </label>

              <div className="lg:col-span-2">
                <button type="submit" className="btn-primary" disabled={busyAction === 'upload'}>
                  <FolderUp size={16} />
                  {busyAction === 'upload' ? 'Uploading...' : 'Save Document'}
                </button>
              </div>
            </form>
          ) : null}

          <div className="overflow-x-auto">
            <table className="data-table min-w-[900px]">
              <thead>
                <tr className="table-head">
                  <th className="table-head-cell">File</th>
                  <th className="table-head-cell">Department</th>
                  <th className="table-head-cell">Type</th>
                  <th className="table-head-cell">Uploaded</th>
                  <th className="table-head-cell">Status</th>
                  <th className="table-head-cell">Download</th>
                </tr>
              </thead>
              <tbody>
                {visibleDocuments.length ? visibleDocuments.map((document) => (
                  <tr key={document._id} className="table-row">
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-content-primary">{document.title}</p>
                        <p className="mt-1 text-xs text-content-muted">{document.file?.originalName || 'Metadata upload'}</p>
                      </div>
                    </td>
                    <td className="table-cell">{document.department?.name || 'Institution-wide'}</td>
                    <td className="table-cell">
                      <p className="text-content-primary">{document.type}</p>
                      <p className="mt-1 text-xs text-content-muted">{document.category}</p>
                    </td>
                    <td className="table-cell text-xs text-content-muted">{formatDate(document.createdAt)}</td>
                    <td className="table-cell">
                      <span className={document.status === 'Approved' ? 'badge badge-success' : 'badge badge-warning'}>
                        {document.status}
                      </span>
                    </td>
                    <td className="table-cell">
                      <button type="button" className="btn-secondary" onClick={() => handleDownload(document)}>
                        <Download size={16} />
                        Download
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td className="table-cell" colSpan={6}>
                      <div className="empty-state min-h-[14rem]">No uploaded files match the current search.</div>
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
