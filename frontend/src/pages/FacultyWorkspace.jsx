import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileText,
  FolderUp,
  GraduationCap,
  Loader2,
  TrendingUp,
  Trophy,
  Users2,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { API_ORIGIN, achievementsAPI, documentsAPI, facultyAPI, researchAPI } from '../services/api';

const CONTRIBUTION_CATEGORIES = ['Research', 'FDP', 'Workshop', 'Achievement'];
const DOCUMENT_CATEGORIES = ['Research', 'NAAC', 'NBA'];

const getAcademicYearValue = (startYear) =>
  `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;

const today = new Date();
const currentAcademicStartYear =
  today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
const currentAcademicYear = getAcademicYearValue(currentAcademicStartYear);

const academicYearOptions = Array.from({ length: 5 }, (_, index) =>
  getAcademicYearValue(currentAcademicStartYear - index)
);

const initialContributionForm = {
  category: 'Research',
  title: '',
  year: String(currentAcademicStartYear),
};

const initialDocumentForm = {
  academicYear: currentAcademicYear,
  category: 'Research',
  file: null,
};

const documentCategoryMeta = {
  Research: {
    category: 'Research',
    type: 'Report',
    tags: ['Research'],
  },
  NAAC: {
    category: 'Accreditation',
    type: 'NAAC',
    accreditationType: 'NAAC',
    isRequiredForAccreditation: 'true',
    tags: ['NAAC'],
  },
  NBA: {
    category: 'Accreditation',
    type: 'NBA',
    accreditationType: 'NBA',
    isRequiredForAccreditation: 'true',
    tags: ['NBA'],
  },
};

const subjectToneClass = {
  dark: {
    success:
      'border-emerald-400/18 bg-[linear-gradient(180deg,rgba(8,49,50,0.92),rgba(5,21,24,0.84))] shadow-[0_24px_70px_-52px_rgba(16,185,129,0.82)]',
    warning:
      'border-amber-400/18 bg-[linear-gradient(180deg,rgba(67,39,11,0.92),rgba(25,14,5,0.84))] shadow-[0_24px_70px_-52px_rgba(245,158,11,0.84)]',
    info:
      'border-blue-400/18 bg-[linear-gradient(180deg,rgba(18,39,84,0.92),rgba(8,18,44,0.84))] shadow-[0_24px_70px_-52px_rgba(59,130,246,0.88)]',
  },
  light: {
    success:
      'border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(220,252,231,0.92))] shadow-[0_24px_60px_-42px_rgba(16,185,129,0.16)]',
    warning:
      'border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,237,213,0.92))] shadow-[0_24px_60px_-42px_rgba(245,158,11,0.16)]',
    info:
      'border-blue-200/80 bg-[linear-gradient(180deg,rgba(239,246,255,0.98),rgba(219,234,254,0.92))] shadow-[0_24px_60px_-42px_rgba(59,130,246,0.16)]',
  },
};

const contributionBadgeClass = {
  Research: 'badge badge-info',
  Workshop: 'badge badge-warning',
  FDP: 'badge badge-success',
  Achievement: 'badge badge-warning',
};

const documentStatusClass = {
  Approved: 'badge badge-success',
  Pending: 'badge badge-warning',
  'Pending Approval': 'badge badge-warning',
  Rejected: 'badge badge-danger',
};

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const formatDecimal = (value) => Number(value || 0).toFixed(1);

const formatDate = (value) => {
  if (!value) return 'Just now';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const buildDownloadName = (document) => {
  const baseName =
    document.file?.originalName ||
    document.file?.filename ||
    `${document.title || 'document'}.txt`;

  return baseName.replace(/[\\/:*?"<>|]+/g, '-');
};

const getSafeFileTitle = (file) => {
  const rawName = file?.name || '';
  const withoutExtension = rawName.replace(/\.[^.]+$/, '');
  return withoutExtension || 'Faculty Document';
};

const normalizeText = (value) => String(value || '').replace(/â€¢/g, ' - ');

const getDocumentStatusLabel = (status) =>
  status === 'Pending Approval' ? 'Pending' : status || 'Pending';

const getSubjectIndicatorLabel = (subject) => {
  if (!subject.studentsEvaluated) return 'No Results Yet';
  if (subject.comparisonDelta > 1) return 'Above Dept Avg \u2705';
  if (subject.comparisonDelta < -1) return 'Below Dept Avg \u26a0\ufe0f';
  return 'At Dept Avg';
};

const getSubjectIndicatorClass = (subject, isLightTheme = false) => {
  if (!subject.studentsEvaluated) {
    return isLightTheme
      ? 'border-blue-200/80 bg-blue-50 text-blue-700'
      : 'border-blue-400/16 bg-blue-500/[0.10] text-blue-100';
  }

  if (subject.comparisonDelta > 1) {
    return isLightTheme
      ? 'border-emerald-200/80 bg-emerald-50 text-emerald-700'
      : 'border-emerald-400/20 bg-emerald-500/[0.10] text-emerald-100';
  }

  if (subject.comparisonDelta < -1) {
    return isLightTheme
      ? 'border-amber-200/80 bg-amber-50 text-amber-700'
      : 'border-amber-400/20 bg-amber-500/[0.10] text-amber-100';
  }

  return isLightTheme
    ? 'border-blue-200/80 bg-blue-50 text-blue-700'
    : 'border-blue-400/16 bg-blue-500/[0.10] text-blue-100';
};

const getOverviewInsight = (subjects, fallbackInsight) => {
  const evaluatedSubjects = subjects.filter((subject) => subject.studentsEvaluated > 0);

  if (!evaluatedSubjects.length) {
    return fallbackInsight || {
      title: 'No subject performance available yet',
      text: 'Results will appear once marks are added for your assigned subjects.',
    };
  }

  const focusSubject = [...evaluatedSubjects].sort(
    (left, right) =>
      left.comparisonDelta - right.comparisonDelta ||
      left.passPercentage - right.passPercentage ||
      right.failedStudents - left.failedStudents
  )[0];

  if (focusSubject.comparisonDelta < -1) {
    return {
      title: 'Your subject pass rate is below dept average',
      text: `${focusSubject.code} is ${Math.abs(focusSubject.comparisonDelta).toFixed(1)}% below the department average.`,
    };
  }

  if (focusSubject.comparisonDelta > 1) {
    return {
      title: 'Your subject pass rate is above dept average',
      text: `${focusSubject.code} is ${focusSubject.comparisonDelta.toFixed(1)}% above the department average.`,
    };
  }

  return {
    title: 'Your subject pass rate is aligned with dept average',
    text: `${focusSubject.code} is tracking close to the department average this academic year.`,
  };
};

function StatCard({ label, value, note, icon: Icon, accent = 'blue' }) {
  const { isLightTheme } = useTheme();
  const toneMap = isLightTheme
    ? {
        blue: 'border-blue-200/80 bg-[linear-gradient(180deg,rgba(239,246,255,0.98),rgba(219,234,254,0.92))]',
        emerald:
          'border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(220,252,231,0.92))]',
        amber:
          'border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,237,213,0.92))]',
        violet:
          'border-violet-200/80 bg-[linear-gradient(180deg,rgba(245,243,255,0.98),rgba(237,233,254,0.92))]',
      }
    : {
        blue: 'border-blue-400/18 bg-[linear-gradient(180deg,rgba(18,39,84,0.92),rgba(8,18,44,0.84))]',
        emerald:
          'border-emerald-400/18 bg-[linear-gradient(180deg,rgba(8,49,50,0.92),rgba(5,21,24,0.84))]',
        amber:
          'border-amber-400/18 bg-[linear-gradient(180deg,rgba(67,39,11,0.92),rgba(25,14,5,0.84))]',
        violet:
          'border-violet-400/18 bg-[linear-gradient(180deg,rgba(36,26,78,0.92),rgba(14,10,34,0.84))]',
      };
  const tone = toneMap[accent] || toneMap.blue;

  return (
    <div
      className={`rounded-[24px] border p-5 transition duration-300 hover:-translate-y-1 hover:scale-[1.02] ${isLightTheme ? 'shadow-[0_24px_60px_-44px_rgba(15,23,42,0.14)]' : 'shadow-[0_24px_70px_-50px_rgba(15,23,42,0.96)]'} ${tone}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isLightTheme ? 'text-content-muted' : 'text-white/60'}`}>
            {label}
          </p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-content-primary">
            {value}
          </p>
          <p className="mt-2 text-sm text-content-secondary">{note}</p>
        </div>
        <div
          className={[
            'flex h-11 w-11 items-center justify-center rounded-2xl border',
            isLightTheme
              ? 'border-line/70 bg-white/80 text-content-primary shadow-[0_14px_28px_-22px_rgba(15,23,42,0.14)]'
              : 'border-white/10 bg-white/[0.05] text-white/90',
          ].join(' ')}
        >
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function SectionShell({ title, subtitle, badge, children }) {
  return (
    <section className="section overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line/70 px-5 py-4">
        <div>
          <p className="eyebrow">{title}</p>
          <h2 className="mt-2 text-lg font-semibold text-content-primary">{subtitle}</h2>
        </div>
        {badge ? <span className="badge badge-info">{badge}</span> : null}
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function PageIntro({ eyebrow, title, description, actions }) {
  return (
    <section className="section overflow-hidden">
      <div className="flex flex-col gap-5 px-5 py-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-3xl">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-content-primary sm:text-[2rem]">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-7 text-content-secondary">{description}</p>
        </div>
        {actions ? <div className="flex w-full flex-col gap-3 xl:w-auto">{actions}</div> : null}
      </div>
    </section>
  );
}

function SubjectCard({ subject }) {
  const { isLightTheme } = useTheme();
  const toneMap = isLightTheme ? subjectToneClass.light : subjectToneClass.dark;
  const tone = toneMap[subject.tone] || toneMap.info;
  const softPanelClass = isLightTheme
    ? 'border border-line/70 bg-white/80 shadow-[0_16px_38px_-32px_rgba(15,23,42,0.14)]'
    : 'border border-white/8 bg-white/[0.03]';
  const indicatorCopy =
    !subject.studentsEvaluated
      ? 'Results will appear after marks are published.'
      : subject.comparisonDelta < -1
        ? `Lower than department average by ${Math.abs(subject.comparisonDelta).toFixed(1)}%.`
        : subject.comparisonDelta > 1
          ? `Higher than department average by ${subject.comparisonDelta.toFixed(1)}%.`
          : 'Aligned with department average.';

  return (
    <div
      className={`rounded-[24px] border p-5 transition duration-300 hover:-translate-y-1 hover:scale-[1.02] ${tone}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-content-primary">{subject.name}</p>
            <span className="badge badge-info">{subject.code}</span>
          </div>
          <p className="mt-2 text-sm text-content-secondary">
            Semester {subject.semester} - {subject.type} - {subject.credits} credits
          </p>
        </div>
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getSubjectIndicatorClass(subject, isLightTheme)}`}
        >
          {getSubjectIndicatorLabel(subject)}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className={`rounded-[18px] p-4 ${softPanelClass}`}>
          <p className="metric-label">Pass Percentage</p>
          <p className="mt-3 text-2xl font-semibold text-content-primary">
            {formatPercent(subject.passPercentage)}
          </p>
        </div>
        <div className={`rounded-[18px] p-4 ${softPanelClass}`}>
          <p className="metric-label">Average Marks</p>
          <p className="mt-3 text-2xl font-semibold text-content-primary">
            {formatDecimal(subject.averageMarks)}
          </p>
        </div>
        <div className={`rounded-[18px] p-4 ${softPanelClass}`}>
          <p className="metric-label">Failed Students</p>
          <p className="mt-3 text-2xl font-semibold text-content-primary">
            {subject.failedStudents}
          </p>
        </div>
      </div>

      <div className={`mt-5 rounded-[18px] p-4 ${softPanelClass}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-content-primary">{indicatorCopy}</p>
          <span className="text-xs text-content-muted">
            {subject.studentsEvaluated} evaluated
          </span>
        </div>
      </div>
    </div>
  );
}

function ContributionCard({ item }) {
  const { isLightTheme } = useTheme();

  return (
    <div
      className={`rounded-[20px] border p-4 transition duration-300 hover:scale-[1.02] ${isLightTheme ? 'border-line/70 bg-white/85 shadow-[0_16px_38px_-32px_rgba(15,23,42,0.14)]' : 'border-white/8 bg-white/[0.03]'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-content-primary">{item.title}</p>
          {item.note ? (
            <p className="mt-2 text-sm text-content-secondary">{normalizeText(item.note)}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className={contributionBadgeClass[item.category] || 'badge badge-info'}>
            {item.category}
          </span>
          <span className="badge badge-info">{item.year}</span>
        </div>
      </div>
    </div>
  );
}

function DocumentRow({ document, onDownload }) {
  const { isLightTheme } = useTheme();
  const fileName =
    document.file?.originalName || document.file?.filename || document.title || 'Document';

  return (
    <div
      className={`rounded-[20px] border p-4 transition duration-300 hover:scale-[1.02] ${isLightTheme ? 'border-line/70 bg-white/85 shadow-[0_16px_38px_-32px_rgba(15,23,42,0.14)]' : 'border-white/8 bg-white/[0.03]'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-content-primary">{fileName}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="badge badge-info">{document.displayCategory}</span>
            <span className={documentStatusClass[document.status] || 'badge badge-info'}>
              {getDocumentStatusLabel(document.status)}
            </span>
          </div>
          <p className="mt-3 text-sm text-content-secondary">
            {document.academicYear || 'Academic year not tagged'} - Uploaded{' '}
            {formatDate(document.createdAt)}
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => onDownload(document)}>
          <FileText size={16} />
          Download
        </button>
      </div>
    </div>
  );
}

function useFacultyWorkspace() {
  return useOutletContext();
}

export function FacultyWorkspaceLayout() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submittingContribution, setSubmittingContribution] = useState(false);
  const [submittingDocument, setSubmittingDocument] = useState(false);
  const [showContributionForm, setShowContributionForm] = useState(true);
  const [message, setMessage] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [filters, setFilters] = useState({ academicYear: currentAcademicYear });
  const [contributionForm, setContributionForm] = useState(initialContributionForm);
  const [documentForm, setDocumentForm] = useState(initialDocumentForm);
  const [documentUploadKey, setDocumentUploadKey] = useState(0);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await facultyAPI.getWorkspace({ academicYear: filters.academicYear });
      setWorkspace(response.data.data || null);
    } catch (error) {
      setWorkspace(null);
      setMessage({
        type: 'error',
        text:
          error.response?.data?.message ||
          'Unable to load the faculty workspace right now.',
      });
    } finally {
      setLoading(false);
    }
  }, [filters.academicYear]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const subjects = workspace?.subjects || [];
  const students = workspace?.students || [];
  const contributions = workspace?.contributions || [];
  const documents = workspace?.documents || [];
  const summary = workspace?.summary || {};
  const faculty = workspace?.faculty || {};
  const subjectPerformanceInsight = workspace?.subjectPerformanceInsight || null;

  if (user?.role && user.role !== 'faculty') {
    return <Navigate to="/faculty" replace />;
  }

  const handleContributionSubmit = async (event) => {
    event.preventDefault();
    setSubmittingContribution(true);
    setMessage(null);

    try {
      const year = Number(contributionForm.year || currentAcademicStartYear);

      if (contributionForm.category === 'Research') {
        await researchAPI.create({
          title: contributionForm.title,
          journal: 'Faculty Self Report',
          year,
          publicationType: 'Journal',
          indexing: 'Others',
          citations: 0,
          impactFactor: 0,
          coAuthors: [],
        });
      } else {
        await achievementsAPI.create({
          title: contributionForm.title,
          issuingOrganization: 'Faculty Self Report',
          date: `${year}-07-01`,
          type:
            contributionForm.category === 'Workshop'
              ? 'Workshop'
              : contributionForm.category === 'FDP'
                ? 'FDP'
                : 'Recognition',
          category:
            contributionForm.category === 'Achievement'
              ? 'Academic'
              : 'Professional Development',
          level: 'Institutional',
        });
      }

      await loadWorkspace();
      setContributionForm(initialContributionForm);
      setShowContributionForm(false);
      setMessage({ type: 'success', text: 'Contribution saved successfully.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Unable to save this contribution.',
      });
    } finally {
      setSubmittingContribution(false);
    }
  };

  const handleDocumentSubmit = async (event) => {
    event.preventDefault();
    setSubmittingDocument(true);
    setMessage(null);

    try {
      const payload = new FormData();
      const categoryMeta = documentCategoryMeta[documentForm.category];

      payload.append('title', getSafeFileTitle(documentForm.file));
      payload.append('academicYear', documentForm.academicYear);
      payload.append('category', categoryMeta.category);
      payload.append('type', categoryMeta.type);

      if (categoryMeta.accreditationType) {
        payload.append('accreditationType', categoryMeta.accreditationType);
      }

      if (categoryMeta.isRequiredForAccreditation) {
        payload.append(
          'isRequiredForAccreditation',
          categoryMeta.isRequiredForAccreditation
        );
      }

      payload.append('tags', [...categoryMeta.tags, documentForm.academicYear].join(','));

      if (documentForm.file) {
        payload.append('file', documentForm.file);
      }

      await documentsAPI.create(payload);

      await loadWorkspace();
      setDocumentForm(initialDocumentForm);
      setDocumentUploadKey((current) => current + 1);
      setMessage({ type: 'success', text: 'Document uploaded successfully.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Unable to upload this document.',
      });
    } finally {
      setSubmittingDocument(false);
    }
  };

  const handleDocumentDownload = (documentItem) => {
    const filePath = documentItem.file?.path;

    if (filePath && filePath !== '/uploads/manual-entry') {
      const normalizedUrl = filePath.startsWith('http')
        ? filePath
        : `${API_ORIGIN}${filePath}`;
      window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const metadata = [
      `Title: ${documentItem.title || 'NA'}`,
      `Category: ${documentItem.displayCategory || 'NA'}`,
      `Academic Year: ${documentItem.academicYear || 'NA'}`,
      `Status: ${getDocumentStatusLabel(documentItem.status)}`,
      `Uploaded: ${formatDate(documentItem.createdAt)}`,
      '',
      'No file was attached to this document entry.',
    ].join('\n');

    const blob = new Blob([metadata], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', buildDownloadName(documentItem));
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const contextValue = useMemo(
    () => ({
      contributionForm,
      contributions,
      documentForm,
      documents,
      documentUploadKey,
      faculty,
      filters,
      handleContributionSubmit,
      handleDocumentDownload,
      handleDocumentSubmit,
      loading,
      setContributionForm,
      setDocumentForm,
      setFilters,
      setShowContributionForm,
      showContributionForm,
      subjectPerformanceInsight,
      subjects,
      students,
      submittingContribution,
      submittingDocument,
      summary,
    }),
    [
      contributionForm,
      contributions,
      documentForm,
      documents,
      documentUploadKey,
      faculty,
      filters,
      handleContributionSubmit,
      handleDocumentDownload,
      handleDocumentSubmit,
      loading,
      showContributionForm,
      subjectPerformanceInsight,
      subjects,
      students,
      submittingContribution,
      submittingDocument,
      summary,
    ]
  );

  return (
    <div className="flex min-h-full flex-col">
      <Navbar
        title="Faculty Panel"
        subtitle="Navigate focused overview, subjects, students, contributions, and documents aligned to IQAC tracking."
        onRefresh={loadWorkspace}
        loading={loading}
        compact
      />

      <div className="dashboard-container flex-1 py-6">
        {message ? (
          <div
            className={`section mb-2 px-5 py-4 ${
              message.type === 'success'
                ? 'border-success/30 bg-success/10'
                : 'border-danger/30 bg-danger/10'
            }`}
          >
            <div className="flex items-center gap-3">
              {message.type === 'success' ? (
                <CheckCircle2 size={18} className="text-success" />
              ) : (
                <AlertTriangle size={18} className="text-danger" />
              )}
              <p className="text-sm font-medium text-content-primary">{message.text}</p>
            </div>
          </div>
        ) : null}

        <Outlet context={contextValue} />
      </div>
    </div>
  );
}

export function FacultyOverviewPage() {
  const { isLightTheme } = useTheme();
  const { faculty, filters, loading, setFilters, subjectPerformanceInsight, subjects, summary } =
    useFacultyWorkspace();
  const overviewInsight = useMemo(
    () => getOverviewInsight(subjects, subjectPerformanceInsight),
    [subjectPerformanceInsight, subjects]
  );

  return (
    <div className="space-y-4">
      <section
        className={[
          'relative overflow-hidden rounded-[28px] p-6 sm:p-7',
          isLightTheme
            ? 'border border-line/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.94))] shadow-[0_26px_90px_-56px_rgba(15,23,42,0.14)]'
            : 'border border-white/10 bg-[linear-gradient(135deg,rgba(8,15,36,0.96),rgba(4,10,24,0.92))] shadow-[0_26px_90px_-56px_rgba(15,23,42,0.98)]',
        ].join(' ')}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_82%_14%,rgba(16,185,129,0.14),transparent_24%)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <span className="badge badge-info">{filters.academicYear}</span>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-content-primary sm:text-[2.2rem]">
              {loading
                ? 'Loading faculty overview...'
                : faculty.name
                  ? `${faculty.name}${faculty.department?.code ? ` - ${faculty.department.code}` : ''}`
                  : 'Faculty Panel'}
            </h2>
            <p className="mt-3 text-sm leading-7 text-content-secondary">
              {(faculty.designation || 'Faculty')}
              {faculty.department?.name
                ? ` - ${faculty.department.name}.`
                : ' - Department mapping pending.'}{' '}
              Overview stays focused on high-level academic performance and pending IQAC actions.
            </p>
          </div>

          <div
            className={[
              'w-full max-w-sm rounded-[24px] border p-4 backdrop-blur-xl',
              isLightTheme
                ? 'border-line/70 bg-white/90 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.14)]'
                : 'border-white/10 bg-white/[0.03]',
            ].join(' ')}
          >
            <label className="block">
              <span className="metric-label block">Academic Year</span>
              <select
                className="input-field mt-2"
                value={filters.academicYear}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    academicYear: event.target.value,
                  }))
                }
              >
                {academicYearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <div className={`mt-4 rounded-[20px] border p-4 ${isLightTheme ? 'border-blue-200/80 bg-blue-50/80' : 'border-blue-400/16 bg-blue-500/[0.06]'}`}>
              <p className="metric-label">Subject Performance Insight</p>
              <p className="mt-3 text-lg font-semibold text-content-primary">
                {overviewInsight.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-content-secondary">
                {overviewInsight.text}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Assigned Subjects"
          value={summary.assignedSubjects ?? 0}
          note="Subjects currently mapped to your faculty profile."
          icon={BookOpen}
          accent="blue"
        />
        <StatCard
          label="Average Pass %"
          value={formatPercent(summary.averagePassPercentage)}
          note="Weighted pass percentage across your evaluated subjects."
          icon={GraduationCap}
          accent="emerald"
        />
        <StatCard
          label="Contributions Count"
          value={summary.totalContributions ?? 0}
          note="Research, FDPs, workshops, and achievements logged."
          icon={Trophy}
          accent="violet"
        />
        <StatCard
          label="Pending Documents"
          value={summary.pendingDocuments ?? 0}
          note="Uploads currently waiting for IQAC approval."
          icon={FileText}
          accent="amber"
        />
      </section>
    </div>
  );
}

export function FacultySubjectsPage() {
  const { faculty, filters, loading, setFilters, subjects } = useFacultyWorkspace();

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="My Subjects"
        title={`${faculty.name || 'Faculty'} Subject Performance`}
        description="Each card shows pass percentage, average marks, failed students, and department comparison without mixing in other faculty tasks."
        actions={
          <label className="block xl:min-w-[15rem]">
            <span className="metric-label block">Academic Year</span>
            <select
              className="input-field mt-2"
              value={filters.academicYear}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  academicYear: event.target.value,
                }))
              }
            >
              {academicYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <SectionShell
        title="My Subjects"
        subtitle="Assigned subjects with pass %, average marks, failed students, and performance indicators."
        badge={`${subjects.length} subjects`}
      >
        {loading ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="skeleton min-h-[16rem] rounded-[24px]" />
            <div className="skeleton min-h-[16rem] rounded-[24px]" />
          </div>
        ) : subjects.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {subjects.map((subject) => (
              <SubjectCard key={subject.id} subject={subject} />
            ))}
          </div>
        ) : (
          <div className="empty-state min-h-[14rem]">
            No assigned subjects were found for this faculty account yet.
          </div>
        )}
      </SectionShell>
    </div>
  );
}

export function FacultyStudentsPage() {
  const { faculty, loading, students, summary } = useFacultyWorkspace();

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="My Students"
        title={`${faculty.name || 'Faculty'} Student Watchlist`}
        description="Students are derived from the learners mapped to your assigned subject records, with at-risk cases surfaced first for faster mentoring follow-up."
        actions={
          <span className="badge badge-info">
            {loading ? 'Loading...' : `${summary.trackedStudents ?? students.length} tracked`}
          </span>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tracked Students"
          value={summary.trackedStudents ?? 0}
          note="Students appearing in your assigned-subject result data."
          icon={Users2}
          accent="blue"
        />
        <StatCard
          label="At-Risk Students"
          value={summary.atRiskStudents ?? 0}
          note="Students needing intervention based on results or risk status."
          icon={AlertTriangle}
          accent="amber"
        />
        <StatCard
          label="Average Pass %"
          value={formatPercent(summary.averagePassPercentage)}
          note="Average pass percentage across the tracked cohort."
          icon={GraduationCap}
          accent="emerald"
        />
        <StatCard
          label="Average Marks"
          value={formatDecimal(summary.averageMarks)}
          note="Weighted marks average across your assigned subject data."
          icon={TrendingUp}
          accent="violet"
        />
      </section>

      <SectionShell
        title="Student Focus"
        subtitle="Students ordered by intervention priority, performance risk, and recent subject outcomes."
        badge={`${students.length} students`}
      >
        {loading ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="skeleton min-h-[15rem] rounded-[24px]" />
            <div className="skeleton min-h-[15rem] rounded-[24px]" />
          </div>
        ) : students.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {students.map((student) => (
              <article key={student._id} className="section-muted p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-content-primary">{student.name}</p>
                      <span className="badge badge-info">{student.rollNumber}</span>
                      <span className={student.isAtRisk ? 'badge badge-warning' : 'badge badge-success'}>
                        {student.isAtRisk ? 'At Risk' : 'Stable'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-content-secondary">
                      Semester {student.currentSemester} • {student.department?.code || student.department?.name || 'Department pending'}
                    </p>
                  </div>
                  <span className="badge badge-info">{student.performanceCategory}</span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="surface-inset p-4">
                    <p className="metric-label">Pass Percentage</p>
                    <p className="mt-2 text-xl font-semibold text-content-primary">{formatPercent(student.passPercentage)}</p>
                  </div>
                  <div className="surface-inset p-4">
                    <p className="metric-label">Average Marks</p>
                    <p className="mt-2 text-xl font-semibold text-content-primary">{formatDecimal(student.averageMarks)}</p>
                  </div>
                  <div className="surface-inset p-4">
                    <p className="metric-label">CGPA</p>
                    <p className="mt-2 text-xl font-semibold text-content-primary">{student.cgpa.toFixed(2)}</p>
                  </div>
                  <div className="surface-inset p-4">
                    <p className="metric-label">Backlogs</p>
                    <p className="mt-2 text-xl font-semibold text-content-primary">{student.currentBacklogs}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="badge badge-info">{student.trackedSubjects} tracked subjects</span>
                  <span className={student.failedSubjects ? 'badge badge-warning' : 'badge badge-success'}>
                    {student.failedSubjects} failed subjects
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state min-h-[14rem]">
            No students have been mapped to your assigned subjects for this academic year yet.
          </div>
        )}
      </SectionShell>
    </div>
  );
}

export function FacultyContributionsPage() {
  const {
    contributionForm,
    contributions,
    handleContributionSubmit,
    loading,
    setContributionForm,
    setShowContributionForm,
    showContributionForm,
    submittingContribution,
  } = useFacultyWorkspace();

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Contributions"
        title="Faculty Contributions"
        description="Capture research, FDPs, workshops, and achievements in a dedicated area so the overview stays uncluttered."
        actions={
          <>
            <span className="badge badge-info">
              {loading ? 'Loading...' : `${contributions.length} entries`}
            </span>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowContributionForm((current) => !current)}
            >
              <Trophy size={16} />
              {showContributionForm ? 'Hide Form' : 'Add Contribution'}
            </button>
          </>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="section overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line/70 px-5 py-4">
            <div>
              <p className="eyebrow">Add Contribution</p>
              <h2 className="mt-2 text-lg font-semibold text-content-primary">
                Structured contribution input
              </h2>
              <p className="mt-2 text-sm text-content-muted">
                Add the title, category, and year for IQAC-ready contribution tracking.
              </p>
            </div>
          </div>

          {showContributionForm ? (
            <form className="space-y-4 px-5 py-5" onSubmit={handleContributionSubmit}>
              <label className="block">
                <span className="metric-label block">Title</span>
                <input
                  className="input-field mt-2"
                  value={contributionForm.title}
                  onChange={(event) =>
                    setContributionForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="metric-label block">Category</span>
                  <select
                    className="input-field mt-2"
                    value={contributionForm.category}
                    onChange={(event) =>
                      setContributionForm((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                  >
                    {CONTRIBUTION_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="metric-label block">Year</span>
                  <input
                    className="input-field mt-2"
                    type="number"
                    min="2000"
                    max={today.getFullYear() + 1}
                    value={contributionForm.year}
                    onChange={(event) =>
                      setContributionForm((current) => ({
                        ...current,
                        year: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
              </div>

              <button type="submit" className="btn-primary" disabled={submittingContribution}>
                {submittingContribution ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Trophy size={16} />
                )}
                {submittingContribution ? 'Adding Contribution...' : 'Add Contribution'}
              </button>
            </form>
          ) : (
            <div className="px-5 py-5">
              <div className="rounded-[22px] border border-blue-400/16 bg-blue-500/[0.05] p-5">
                <p className="text-base font-semibold text-content-primary">
                  Contribution form is hidden
                </p>
                <p className="mt-2 text-sm leading-6 text-content-secondary">
                  Use the Add Contribution button when you want to log a new entry.
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="section overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line/70 px-5 py-4">
            <div>
              <p className="eyebrow">Contribution Ledger</p>
              <h2 className="mt-2 text-lg font-semibold text-content-primary">
                Logged faculty contributions
              </h2>
            </div>
            <span className="badge badge-info">{contributions.length} entries</span>
          </div>

          <div className="grid gap-4 px-5 py-5">
            {loading ? (
              <>
                <div className="skeleton min-h-[6.5rem] rounded-[20px]" />
                <div className="skeleton min-h-[6.5rem] rounded-[20px]" />
                <div className="skeleton min-h-[6.5rem] rounded-[20px]" />
              </>
            ) : contributions.length ? (
              contributions.map((item) => (
                <ContributionCard key={`${item.category}-${item.id}`} item={item} />
              ))
            ) : (
              <div className="empty-state min-h-[14rem]">
                No faculty contributions have been added yet.
              </div>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}

export function FacultyDocumentsPage() {
  const {
    documentForm,
    documents,
    documentUploadKey,
    handleDocumentDownload,
    handleDocumentSubmit,
    loading,
    setDocumentForm,
    submittingDocument,
  } = useFacultyWorkspace();

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Documents"
        title="Faculty Documents"
        description="Upload academic files with academic year and accreditation category so document management stays separate from overview and subject tracking."
        actions={
          <span className="badge badge-info">
            {loading ? 'Loading...' : `${documents.length} files`}
          </span>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="section overflow-hidden">
          <div className="border-b border-line/70 px-5 py-4">
            <p className="eyebrow">Document Upload</p>
            <h2 className="mt-2 text-lg font-semibold text-content-primary">
              Upload with metadata
            </h2>
            <p className="mt-2 text-sm text-content-muted">
              Tag each upload with academic year and category before sending it for review.
            </p>
          </div>

          <form className="space-y-4 px-5 py-5" onSubmit={handleDocumentSubmit}>
            <label className="block">
              <span className="metric-label block">Academic Year</span>
              <select
                className="input-field mt-2"
                value={documentForm.academicYear}
                onChange={(event) =>
                  setDocumentForm((current) => ({
                    ...current,
                    academicYear: event.target.value,
                  }))
                }
              >
                {academicYearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="metric-label block">Category</span>
              <select
                className="input-field mt-2"
                value={documentForm.category}
                onChange={(event) =>
                  setDocumentForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
              >
                {DOCUMENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="metric-label block">File</span>
              <input
                key={documentUploadKey}
                className="input-field mt-2 file:mr-3 file:rounded-full file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                onChange={(event) =>
                  setDocumentForm((current) => ({
                    ...current,
                    file: event.target.files?.[0] || null,
                  }))
                }
                required
              />
            </label>

            <button type="submit" className="btn-primary" disabled={submittingDocument}>
              {submittingDocument ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <FolderUp size={16} />
              )}
              {submittingDocument ? 'Uploading Document...' : 'Upload Document'}
            </button>
          </form>
        </section>

        <section className="section overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line/70 px-5 py-4">
            <div>
              <p className="eyebrow">Uploaded Files</p>
              <h2 className="mt-2 text-lg font-semibold text-content-primary">
                Tagged document ledger
              </h2>
            </div>
            <span className="badge badge-info">{documents.length} files</span>
          </div>

          <div className="grid gap-4 px-5 py-5">
            {loading ? (
              <>
                <div className="skeleton min-h-[7rem] rounded-[20px]" />
                <div className="skeleton min-h-[7rem] rounded-[20px]" />
                <div className="skeleton min-h-[7rem] rounded-[20px]" />
              </>
            ) : documents.length ? (
              documents.map((document) => (
                <DocumentRow
                  key={document._id}
                  document={document}
                  onDownload={handleDocumentDownload}
                />
              ))
            ) : (
              <div className="empty-state min-h-[14rem]">
                No tagged academic documents have been uploaded yet.
              </div>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}

export default FacultyWorkspaceLayout;
