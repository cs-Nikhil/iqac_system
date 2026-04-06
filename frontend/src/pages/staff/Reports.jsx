import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileBarChart, FileSpreadsheet, Layers3 } from 'lucide-react';
import Navbar from '../../components/Navbar';
import { staffAPI } from '../../services/api';
import { WorkspaceHeader, downloadBlob } from './shared';

const getAcademicYearValue = (startYear) =>
  `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;

const today = new Date();
const currentAcademicStartYear =
  today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
const currentAcademicYear = getAcademicYearValue(currentAcademicStartYear);

const ACADEMIC_YEAR_OPTIONS = Array.from({ length: 4 }, (_, index) => {
  const startYear = currentAcademicStartYear - index;
  const academicYear = getAcademicYearValue(startYear);
  return { value: academicYear, label: academicYear };
});

const reportCards = [
  {
    key: 'student',
    title: 'Generate Student Report',
    description: 'Exports the current student performance sheet for the selected scope.',
    icon: FileSpreadsheet,
    fileName: 'student-report.csv',
  },
  {
    key: 'department',
    title: 'Generate Department Report',
    description: 'Exports department-level summary metrics for audit and review.',
    icon: FileBarChart,
    fileName: 'department-report.csv',
  },
  {
    key: 'backlog',
    title: 'Generate Backlog Report',
    description: 'Exports only students with active backlogs for follow-up tracking.',
    icon: Layers3,
    fileName: 'backlog-report.csv',
  },
];

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({
    academicYear: currentAcademicYear,
    department: '',
    semester: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await staffAPI.getDepartments();
      setDepartments(response.data.departments || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const exportReport = async (type) => {
    setBusyAction(type);
    setMessage(null);

    try {
      const exporterMap = {
        student: () => staffAPI.exportStudentPerformanceReport({ format: 'csv', ...filters }),
        department: () => staffAPI.exportDepartmentReport({ format: 'csv', ...filters }),
        backlog: () => staffAPI.exportBacklogReport({ format: 'csv', ...filters }),
      };

      const response = await exporterMap[type]();
      const selectedCard = reportCards.find((card) => card.key === type);
      downloadBlob(response.data, selectedCard?.fileName || `${type}-report.csv`);
      setMessage({ type: 'success', text: `${selectedCard?.title || 'Report'} downloaded successfully.` });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to generate the report right now.' });
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <Navbar
        title="Reports"
        subtitle="Generate only the core student, department, and backlog exports needed in the staff panel."
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
            title="Report Scope"
            subtitle="Choose the academic year and department once, then generate the export you need."
            badge="CSV"
          />

          <div className="grid gap-4 border-b border-line/70 px-5 py-5 md:grid-cols-3">
            <label className="block">
              <span className="metric-label block">Academic Year</span>
              <select
                className="input-field mt-2"
                value={filters.academicYear}
                onChange={(event) => setFilters((current) => ({ ...current, academicYear: event.target.value }))}
              >
                {ACADEMIC_YEAR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
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

            <label className="block">
              <span className="metric-label block">Semester</span>
              <select
                className="input-field mt-2"
                value={filters.semester}
                onChange={(event) => setFilters((current) => ({ ...current, semester: event.target.value }))}
              >
                <option value="">All semesters</option>
                {['1', '2', '3', '4', '5', '6', '7', '8'].map((semester) => (
                  <option key={semester} value={semester}>
                    Semester {semester}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 px-5 py-5 lg:grid-cols-3">
            {reportCards.map((card) => {
              const Icon = card.icon;
              const isBusy = busyAction === card.key;

              return (
                <div
                  key={card.key}
                  className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,18,40,0.96),rgba(5,11,25,0.92))] p-5 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.98)]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.05] text-brand-200">
                    <Icon size={19} />
                  </div>

                  <h3 className="mt-5 text-lg font-semibold tracking-tight text-content-primary">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-content-secondary">{card.description}</p>

                  <button
                    type="button"
                    className="btn-primary mt-6 w-full justify-center"
                    disabled={isBusy}
                    onClick={() => exportReport(card.key)}
                  >
                    <Download size={16} />
                    {isBusy ? 'Generating...' : card.title}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
