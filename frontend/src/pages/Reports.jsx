import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  GraduationCap,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Users,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { analyticsAPI, departmentsAPI, reportsAPI, staffAPI } from '../services/api';

const getAcademicYearValue = (startYear) =>
  `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;

const today = new Date();
const currentAcademicStartYear =
  today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;

const ACADEMIC_YEARS = Array.from({ length: 5 }, (_, i) => {
  const startYear = currentAcademicStartYear - i;
  const academicYear = getAcademicYearValue(startYear);
  return { value: academicYear, label: academicYear };
});

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

const formatNum = (n) => (n == null ? '—' : Number(n).toLocaleString('en-IN'));
const formatPct = (n, d = 1) => (n == null ? '—' : `${Number(n).toFixed(d)}%`);

function StatCard({ label, value, subtext, icon: Icon, tone = 'brand' }) {
  const TONE = {
    brand: {
      ring: 'ring-brand-400/20',
      bg: 'bg-brand-500/12',
      icon: 'bg-brand-500/15 text-brand-300',
      glow: 'rgba(59,130,246,0.14)',
      accent: 'rgba(37,99,235,0.16)',
    },
    success: {
      ring: 'ring-success/20',
      bg: 'bg-success/10',
      icon: 'bg-success/15 text-success',
      glow: 'rgba(16,185,129,0.14)',
      accent: 'rgba(5,150,105,0.16)',
    },
    warning: {
      ring: 'ring-warning/20',
      bg: 'bg-warning/10',
      icon: 'bg-warning/15 text-warning',
      glow: 'rgba(245,158,11,0.14)',
      accent: 'rgba(217,119,6,0.16)',
    },
    violet: {
      ring: 'ring-violet-400/20',
      bg: 'bg-violet-500/10',
      icon: 'bg-violet-500/15 text-violet-300',
      glow: 'rgba(139,92,246,0.14)',
      accent: 'rgba(109,40,217,0.16)',
    },
    info: {
      ring: 'ring-info/20',
      bg: 'bg-info/10',
      icon: 'bg-info/15 text-info',
      glow: 'rgba(6,182,212,0.14)',
      accent: 'rgba(8,145,178,0.16)',
    },
  }[tone] || {};

  return (
    <div
      className="section card-hover relative overflow-hidden p-5"
      style={{
        background: `radial-gradient(circle at top left, ${TONE.glow}, transparent 40%), radial-gradient(circle at bottom right, ${TONE.accent}, transparent 36%)`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="metric-label">{label}</p>
          <p className="mt-3 text-2xl font-display font-bold text-content-primary">{value}</p>
          {subtext ? <p className="metric-note mt-1.5">{subtext}</p> : null}
        </div>
        {Icon ? (
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${TONE.icon} ${TONE.ring}`}>
            <Icon size={18} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, badge, children, tone = {} }) {
  return (
    <section
      className="section chart-shell relative overflow-hidden p-5 sm:p-6"
      style={{
        background:
          tone.glow
            ? `radial-gradient(circle at top left, ${tone.glow}, transparent 40%), radial-gradient(circle at bottom right, ${tone.accent || 'transparent'}, transparent 36%)`
            : undefined,
      }}
    >
      <div className="relative z-[1] flex items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="section-title">{title}</h3>
          {subtitle ? <p className="section-subtitle mt-1">{subtitle}</p> : null}
        </div>
        {badge ? <span className="badge badge-info shrink-0">{badge}</span> : null}
      </div>
      <div className="relative z-[1]">{children}</div>
    </section>
  );
}

function DeptRow({ dept, index }) {
  const score = dept.score ?? dept.placementPercentage ?? 0;
  const bar = Math.min(Math.round(score), 100);
  const COLORS = ['bg-brand-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-cyan-500', 'bg-rose-500'];
  return (
    <tr className="table-row">
      <td className="table-cell font-medium text-content-primary">
        <span className="flex items-center gap-2">
          <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white ${COLORS[index % COLORS.length]}`}>
            {index + 1}
          </span>
          {dept.department || dept.deptName || dept.name}
        </span>
      </td>
      <td className="table-cell">{formatPct(dept.passPercentage ?? 0)}</td>
      <td className="table-cell">{formatPct(dept.avgAttendance ?? 0)}</td>
      <td className="table-cell">{formatPct(dept.placementPercentage ?? 0)}</td>
      <td className="table-cell">
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-pill bg-panel-muted">
            <div className={`h-full rounded-pill ${COLORS[index % COLORS.length]}`} style={{ width: `${bar}%` }} />
          </div>
          <span className="text-xs font-semibold text-content-muted w-8 text-right">{score}</span>
        </div>
      </td>
    </tr>
  );
}

const EXPORT_SECTIONS = [
  { id: 'aqar', label: 'Full AQAR Report', desc: 'Comprehensive NAAC-ready institutional report (all departments)', icon: FileText, pdfOnly: true, tone: 'brand' },
  { id: 'department-ranking', label: 'Department Ranking', desc: 'Performance scores, pass %, attendance, placement ranked by dept', icon: Building2, tone: 'success' },
  { id: 'student-summary', label: 'Student Summary', desc: 'Cohort-level performance distribution across all departments', icon: GraduationCap, tone: 'info' },
  { id: 'placement-stats', label: 'Placement Statistics', desc: 'Placement rate, package averages per department', icon: Briefcase, tone: 'warning' },
  { id: 'faculty-research', label: 'Faculty & Research', desc: 'Faculty counts, research paper output per department', icon: BookOpen, tone: 'violet' },
];

export default function AdminReports() {
  const [kpis, setKpis] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [passData, setPassData] = useState([]);
  const [placementData, setPlacementData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);
  const [academicYear, setAcademicYear] = useState(ACADEMIC_YEARS[0]?.value || getAcademicYearValue(currentAcademicStartYear));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, rankRes, passRes, placementRes] = await Promise.allSettled([
        analyticsAPI.kpis(),
        analyticsAPI.departmentRanking(),
        analyticsAPI.passPercentage({ academicYear }),
        analyticsAPI.placement({ academicYear }),
      ]);

      if (kpiRes.status === 'fulfilled') setKpis(kpiRes.value.data.kpis || kpiRes.value.data);
      if (rankRes.status === 'fulfilled') {
        const d = rankRes.value.data;
        setRanking(d.ranking || d.data || []);
      }
      if (passRes.status === 'fulfilled') {
        const d = passRes.value.data;
        setPassData(d.departments || d.data || []);
      }
      if (placementRes.status === 'fulfilled') {
        const d = placementRes.value.data;
        setPlacementData(d.departments || d.placements || d.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [academicYear]);

  useEffect(() => { load(); }, [load]);

  const exportSection = async (sectionId, format) => {
    const actionId = `${sectionId}-${format}`;
    setBusy(actionId);
    setMessage(null);

    try {
      // ── PDF exports ────────────────────────────────────────────────────────
      if (format === 'pdf') {
        if (sectionId === 'aqar') {
          const res = await reportsAPI.downloadAQAR({ academicYear });
          downloadBlob(res.data, `AQAR_Report_${academicYear}.pdf`);
          setMessage({ type: 'success', text: 'Full AQAR PDF generated and downloaded successfully.' });
          return;
        }

        // Each section has its own dedicated backend PDF generator
        const PDF_MAP = {
          'department-ranking': () =>
            reportsAPI.downloadDepartmentRanking({ academicYear }),               // /reports/department-ranking
          'student-summary': () =>
            staffAPI.exportStudentPerformanceReport({ format: 'pdf', academicYear }), // /staff/reports/student-performance
          'placement-stats': () =>
            reportsAPI.downloadPlacementStats({ academicYear }),                  // /reports/placement-stats
          'faculty-research': () =>
            staffAPI.exportFacultyWorkloadReport({ format: 'pdf', academicYear }), // /staff/reports/faculty-workload
        };

        const FILE_NAMES = {
          'department-ranking': `Department_Ranking_${academicYear}.pdf`,
          'student-summary': `Student_Summary_${academicYear}.pdf`,
          'placement-stats': `Placement_Stats_${academicYear}.pdf`,
          'faculty-research': `Faculty_Workload_${academicYear}.pdf`,
        };

        const fetcher = PDF_MAP[sectionId];
        if (fetcher) {
          const res = await fetcher();
          downloadBlob(res.data, FILE_NAMES[sectionId]);
          setMessage({ type: 'success', text: `${FILE_NAMES[sectionId]} downloaded successfully.` });
        }
        return;
      }


      // ── CSV exports ────────────────────────────────────────────────────────
      if (format === 'csv') {
        let csvContent = '';
        let fileName = '';

        if (sectionId === 'department-ranking') {
          fileName = `Department_Ranking_${academicYear}.csv`;
          csvContent = [
            'Rank,Department,Pass %,Attendance %,Placement %,Score',
            ...ranking.map((d, i) =>
              `"${i + 1}","${d.department || d.deptName || ''}","${d.passPercentage ?? ''}","${d.avgAttendance ?? ''}","${d.placementPercentage ?? ''}","${d.score ?? ''}"`
            ),
          ].join('\n');
        } else if (sectionId === 'student-summary') {
          const kpiData = kpis || {};
          fileName = `Student_Summary_${academicYear}.csv`;
          csvContent = [
            'Metric,Value',
            `"Total Students","${kpiData.totalStudents ?? ''}"`,
            `"Average CGPA","${kpiData.averageCGPA ?? ''}"`,
            `"At-Risk Students","${kpiData.atRiskStudents ?? ''}"`,
            `"Average Attendance","${kpiData.avgAttendance ?? ''}"`,
            '',
            'Department,Pass %,Average Marks,Pass Count,Total Entries',
            ...passData.map((d) =>
              `"${d.deptName || d.department || ''}","${d.passPercentage ?? ''}","${d.avgMarks ?? ''}","${d.passCount ?? ''}","${d.totalEntries ?? ''}"`
            ),
          ].join('\n');
        } else if (sectionId === 'placement-stats') {
          fileName = `Placement_Stats_${academicYear}.csv`;
          csvContent = [
            'Department,Total Students,Placed,Placement %,Avg Package (LPA)',
            ...placementData.map((d) =>
              `"${d.deptName || d.department || ''}","${d.totalStudents ?? ''}","${d.placedCount ?? ''}","${d.placementPercentage ?? ''}","${d.avgPackage ? Number(d.avgPackage).toFixed(2) : ''}"`
            ),
          ].join('\n');
        } else if (sectionId === 'faculty-research') {
          fileName = `Faculty_Research_${academicYear}.csv`;
          csvContent = [
            'Department,Total Faculty,Active Faculty,Research Papers',
            ...ranking.map((d) =>
              `"${d.department || ''}","${d.totalFaculty ?? ''}","${d.activeFaculty ?? ''}","${d.researchPapers ?? ''}"`
            ),
          ].join('\n');
        }

        downloadBlob(new Blob([csvContent], { type: 'text/csv' }), fileName);
        setMessage({ type: 'success', text: `${fileName} generated and downloaded.` });
      }
    } catch (e) {
      setMessage({ type: 'error', text: e?.response?.data?.message || 'Failed to generate report. Please try again.' });
    } finally {
      setBusy('');
    }
  };

  const kpiCards = [
    { label: 'Total Students', value: loading ? '—' : formatNum(kpis?.totalStudents), icon: GraduationCap, tone: 'brand', subtext: 'Across all departments' },
    { label: 'Total Faculty', value: loading ? '—' : formatNum(kpis?.totalFaculty), icon: Users, tone: 'success', subtext: 'Teaching & research staff' },
    { label: 'Average CGPA', value: loading ? '—' : (kpis?.averageCGPA ? Number(kpis.averageCGPA).toFixed(2) : '—'), icon: BarChart3, tone: 'info', subtext: 'Institutional average' },
    { label: 'Total Departments', value: loading ? '—' : formatNum(kpis?.totalDepartments), icon: Building2, tone: 'warning', subtext: 'Active academic units' },
    { label: 'Research Papers', value: loading ? '—' : formatNum(kpis?.totalResearchPapers), icon: BookOpen, tone: 'violet', subtext: 'Publications & conferences' },
    { label: 'Students At Risk', value: loading ? '—' : formatNum(kpis?.atRiskStudents), icon: AlertTriangle, tone: 'warning', subtext: 'Requiring intervention' },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <Navbar
        title="Institutional Reports"
        subtitle="Whole-institution analytics, AQAR exports, and department ranking"
        onRefresh={load}
        loading={loading}
      />

      <div className="dashboard-container flex-1">
        {/* Header bar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-display font-bold text-content-primary flex items-center gap-2">
              <Sparkles size={18} className="text-brand-300" />
              Institutional Report Generator
            </h1>
            <p className="section-subtitle mt-1">
              Generate NAAC-ready AQAR reports and data exports covering all departments
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="metric-label whitespace-nowrap">Academic Year</label>
              <select
                className="input-field h-9 appearance-none cursor-pointer py-0 text-sm"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
              >
                {ACADEMIC_YEARS.map((y) => (
                  <option key={y.value} value={y.value}>{y.label}</option>
                ))}
              </select>
            </div>
            <button onClick={load} disabled={loading} className="btn-ghost h-9 px-3 gap-2">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Message banner */}
        {message ? (
          <div className={`section mb-6 px-5 py-4 ${message.type === 'success' ? 'border-success/40 bg-success/10' : 'border-danger/40 bg-danger/10'}`}>
            <div className="flex items-center gap-3">
              {message.type === 'success'
                ? <CheckCircle2 size={18} className="text-success shrink-0" />
                : <AlertTriangle size={18} className="text-danger shrink-0" />}
              <p className="text-sm font-medium text-content-primary">{message.text}</p>
            </div>
          </div>
        ) : null}

        {/* Live KPI Snapshot */}
        <div className="mb-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="eyebrow">Live Institutional Snapshot</span>
            <span className="badge badge-info">{ACADEMIC_YEARS.find((y_) => y_.value === academicYear)?.label || academicYear}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            {kpiCards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>
        </div>

        {/* Department Ranking Table */}
        <SectionCard
          title="Department Performance Ranking"
          subtitle="Composite score across pass %, attendance, placement, and research"
          badge={`${ranking.length} departments`}
          tone={{ glow: 'rgba(59,130,246,0.10)', accent: 'rgba(139,92,246,0.08)' }}
        >
          {loading ? (
            <div className="skeleton h-[16rem] w-full rounded-2xl" />
          ) : ranking.length ? (
            <div className="overflow-x-auto rounded-2xl border border-line/60">
              <table className="data-table w-full">
                <thead>
                  <tr className="table-head">
                    {['Department', 'Pass %', 'Attendance %', 'Placement %', 'Score'].map((h) => (
                      <th key={h} className="table-head-cell">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((dept, i) => (
                    <DeptRow key={dept.department || i} dept={dept} index={i} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state min-h-[12rem]">No department ranking data available.</div>
          )}
        </SectionCard>

        {/* Export Cards */}
        <div className="mt-6">
          <div className="mb-4">
            <span className="eyebrow">Export Reports</span>
            <p className="section-subtitle mt-1">Download whole-institution reports as PDF or CSV</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {EXPORT_SECTIONS.map(({ id, label, desc, icon: Icon, pdfOnly, tone }) => {
              const TONE_STYLES = {
                brand: 'bg-brand-500/15 text-brand-300 ring-brand-400/20',
                success: 'bg-success/15 text-success ring-success/20',
                info: 'bg-info/15 text-info ring-info/20',
                warning: 'bg-warning/15 text-warning ring-warning/20',
                violet: 'bg-violet-500/15 text-violet-300 ring-violet-400/20',
              }[tone] || '';

              const isBusyPdf = busy === `${id}-pdf`;
              const isBusyCsv = busy === `${id}-csv`;
              const anyBusy = busy !== '';

              return (
                <div key={id} className="section flex flex-col gap-5 p-5 transition duration-300 hover:border-brand-500/30 hover:shadow-elevated">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${TONE_STYLES}`}>
                      <Icon size={20} className="opacity-90" />
                    </div>
                    <div className="pt-0.5">
                      <p className="text-sm font-semibold text-content-primary mb-0.5">{label}</p>
                      <p className="text-[11px] text-content-muted leading-tight">{desc}</p>
                    </div>
                  </div>

                  <div className="mt-auto grid gap-2">
                    <button
                      type="button"
                      className="btn-primary w-full justify-center"
                      disabled={anyBusy}
                      onClick={() => exportSection(id, 'pdf')}
                    >
                      {isBusyPdf ? <Loader2 size={15} className="animate-spin text-white" /> : <Download size={15} className="text-white/90" />}
                      Export PDF
                    </button>

                    {!pdfOnly ? (
                      <button
                        type="button"
                        className="btn-secondary w-full justify-center"
                        disabled={anyBusy}
                        onClick={() => exportSection(id, 'csv')}
                      >
                        {isBusyCsv ? <Loader2 size={15} className="animate-spin text-content-primary" /> : <Download size={15} className="text-content-muted" />}
                        <span className="font-semibold">Export CSV</span>
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 rounded-xl border border-line/50 bg-panel-muted/30 px-4 py-2.5 text-xs text-content-muted">
                        <FileText size={12} />
                        PDF-only export (multi-page NAAC format)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Differentiator note */}
        <div className="mt-6 section flex items-start gap-4 p-5 border-brand-400/20 bg-brand-500/5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
            <Sparkles size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-content-primary">Admin vs Staff Reports</p>
            <p className="mt-1 text-sm text-content-muted leading-relaxed">
              This page generates <strong className="text-content-primary">institution-wide</strong> reports covering all departments in aggregate — ideal for NAAC, AQAR, and accreditation submissions.
              <br />
              The <strong className="text-content-primary">Staff Reports Panel</strong> (under Staff Hub › Reports) generates per-department, per-faculty, and per-student breakdowns for operational day-to-day use.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
