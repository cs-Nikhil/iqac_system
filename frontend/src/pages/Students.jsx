import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { departmentsAPI, studentsAPI } from '../services/api';

const BATCH_YEARS = [2020, 2021, 2022, 2023, 2024];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function Students() {
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: '',
    department: '',
    batchYear: '',
    semester: '',
    isAtRisk: '',
  });

  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT, ...filters };
      Object.keys(params).forEach((key) => !params[key] && delete params[key]);
      const response = await studentsAPI.getAll(params);
      setStudents(response.data.students);
      setTotal(response.data.total);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    departmentsAPI.getAll().then((response) => setDepartments(response.data.departments));
  }, []);

  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const totalPages = Math.ceil(total / LIMIT);

  const getCgpaColor = (cgpa) => {
    if (cgpa >= 8) return 'text-success';
    if (cgpa >= 6) return 'text-warning';
    return 'text-danger';
  };

  const getPerformanceBadge = (student) => {
    const category = student.performanceCategory || (student.isAtRisk ? 'At Risk' : 'Good');

    if (category === 'Excellent') {
      return { label: category, className: 'badge badge-info' };
    }

    if (category === 'Good') {
      return { label: category, className: 'badge badge-success' };
    }

    if (category === 'Average') {
      return { label: category, className: 'badge badge-warning' };
    }

    return { label: 'At Risk', className: 'badge badge-danger' };
  };

  return (
    <div className="flex min-h-full flex-col">
      <Navbar title="Students" subtitle={`${total.toLocaleString('en-IN')} total students`} onRefresh={load} loading={loading} />

      <div className="dashboard-container flex-1">
        <div className="section p-4">
          <div className="toolbar">
            <div className="relative min-w-0 flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
              <input
                className="input-field pl-9"
                placeholder="Search by name or roll number"
                value={filters.search}
                onChange={(event) => setFilter('search', event.target.value)}
              />
            </div>

            <div className="toolbar-group">
              <select className="input-field w-full sm:w-40" value={filters.department} onChange={(event) => setFilter('department', event.target.value)}>
                <option value="">All Departments</option>
                {departments.map((department) => (
                  <option key={department._id} value={department._id}>{department.code}</option>
                ))}
              </select>

              <select className="input-field w-full sm:w-36" value={filters.batchYear} onChange={(event) => setFilter('batchYear', event.target.value)}>
                <option value="">All Batches</option>
                {BATCH_YEARS.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              <select className="input-field w-full sm:w-32" value={filters.semester} onChange={(event) => setFilter('semester', event.target.value)}>
                <option value="">All Semesters</option>
                {SEMESTERS.map((semester) => (
                  <option key={semester} value={semester}>Sem {semester}</option>
                ))}
              </select>

              <label className="inline-flex items-center gap-2 rounded-xl border border-warning/20 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-500"
                  checked={filters.isAtRisk === 'true'}
                  onChange={(event) => setFilter('isAtRisk', event.target.checked ? 'true' : '')}
                />
                <AlertTriangle size={13} />
                At-risk only
              </label>
            </div>
          </div>
        </div>

        <div className="table-shell">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr className="table-head">
                  {['Roll No.', 'Name', 'Department', 'Batch', 'Semester', 'CGPA', 'Status', 'Actions'].map((heading) => (
                    <th key={heading} className="table-head-cell">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 8 }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="table-row">
                    {Array.from({ length: 8 }).map((__, cellIndex) => (
                      <td key={cellIndex} className="table-cell">
                        <div className="skeleton h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                )) : null}

                {!loading && students.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12">
                      <div className="empty-state">No students found for the selected filters.</div>
                    </td>
                  </tr>
                ) : null}

                {!loading && students.map((student) => {
                  const performance = getPerformanceBadge(student);

                  return (
                    <tr key={student._id} className="table-row">
                      <td className="table-cell font-mono text-xs">{student.rollNumber}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/15 text-sm font-bold text-brand-300 ring-1 ring-brand-400/20">
                            {student.name.charAt(0)}
                          </div>
                          <span className="font-medium text-content-primary">{student.name}</span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="badge badge-info">{student.department?.code}</span>
                      </td>
                      <td className="table-cell text-xs">{student.batchYear}</td>
                      <td className="table-cell text-xs">Sem {student.currentSemester}</td>
                      <td className="table-cell">
                        <span className={`font-display text-sm font-bold ${getCgpaColor(student.cgpa)}`}>
                          {student.cgpa?.toFixed(2)}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={performance.className}>
                          {performance.label === 'At Risk' ? <AlertTriangle size={10} /> : null}
                          {performance.label}
                        </span>
                      </td>
                      <td className="table-cell">
                        <Link to={`/student-progress/${student._id}`} className="font-semibold text-content-primary hover:text-brand-300 transition-colors">
                          View Progress
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="toolbar border-t border-line/80 px-5 py-4">
              <p className="text-sm text-content-muted">
                Showing {(page - 1) * LIMIT + 1} to {Math.min(page * LIMIT, total)} of {total}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="btn-secondary h-9 w-9 p-0"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="rounded-xl border border-line/70 bg-panel-muted/70 px-3 py-2 text-xs font-medium text-content-secondary">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary h-9 w-9 p-0"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
