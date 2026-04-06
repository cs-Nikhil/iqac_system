import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { staffAPI } from '../../services/api';
import { WorkspaceHeader } from './shared';

const STUDENT_LIMIT = 12;
const SEMESTERS = ['1', '2', '3', '4', '5', '6', '7', '8'];

const performanceBadgeClass = {
  Excellent: 'badge badge-info',
  Good: 'badge badge-success',
  Average: 'badge badge-warning',
  'At Risk': 'badge badge-danger',
};

const formatDecimal = (value) => Number(value || 0).toFixed(2);
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

export default function StudentRecords() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({
    search: '',
    department: '',
    semester: '',
    page: 1,
  });

  const deferredSearch = useDeferredValue(filters.search);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [studentsResponse, departmentsResponse] = await Promise.all([
        staffAPI.getStudents({
          search: deferredSearch || undefined,
          department: filters.department || undefined,
          semester: filters.semester || undefined,
          page: filters.page,
          limit: STUDENT_LIMIT,
        }),
        staffAPI.getDepartments(),
      ]);

      setStudents(studentsResponse.data.students || []);
      setPagination({
        page: studentsResponse.data.page || 1,
        pages: studentsResponse.data.pages || 1,
        total: studentsResponse.data.total || 0,
      });
      setDepartments(departmentsResponse.data.departments || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [deferredSearch, filters.department, filters.page, filters.semester]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentRange = useMemo(() => {
    if (!pagination.total) {
      return '0-0';
    }

    const start = (pagination.page - 1) * STUDENT_LIMIT + 1;
    const end = Math.min(start + students.length - 1, pagination.total);

    return `${start}-${end}`;
  }, [pagination.page, pagination.total, students.length]);

  return (
    <div className="flex min-h-full flex-col">
      <Navbar
        title="Students"
        subtitle="A simple monitoring table for department, CGPA, attendance, and backlog review."
        onRefresh={loadData}
        loading={loading}
        compact
      />

      <div className="dashboard-container flex-1 py-6">
        <section className="section overflow-hidden">
          <WorkspaceHeader
            title="Student Monitoring"
            subtitle="Filter by semester or department and review the latest performance values."
            badge={`${pagination.total} students`}
          />

          <div className="space-y-5 px-5 py-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
              <label className="block">
                <span className="metric-label block">Search Students</span>
                <div className="relative mt-2">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                  <input
                    className="input-field pl-9"
                    value={filters.search}
                    onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))}
                    placeholder="Search by name, roll number, or email"
                  />
                </div>
              </label>

              <label className="block">
                <span className="metric-label block">Department</span>
                <select
                  className="input-field mt-2"
                  value={filters.department}
                  onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value, page: 1 }))}
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
                  onChange={(event) => setFilters((current) => ({ ...current, semester: event.target.value, page: 1 }))}
                >
                  <option value="">All semesters</option>
                  {SEMESTERS.map((semester) => (
                    <option key={semester} value={semester}>
                      Semester {semester}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-content-secondary">
              Showing <span className="font-medium text-content-primary">{currentRange}</span> of{' '}
              <span className="font-medium text-content-primary">{pagination.total}</span> students
              {filters.department ? ' in the selected department' : ''}.
            </div>
          </div>

          <div className="overflow-x-auto border-t border-line/70">
            <table className="data-table min-w-[1040px]">
              <thead>
                <tr className="table-head">
                  <th className="table-head-cell">Name</th>
                  <th className="table-head-cell">Department</th>
                  <th className="table-head-cell">CGPA</th>
                  <th className="table-head-cell">Attendance</th>
                  <th className="table-head-cell">Backlogs</th>
                  <th className="table-head-cell">Action</th>
                </tr>
              </thead>
              <tbody>
                {students.length ? students.map((student) => (
                  <tr key={student._id} className="table-row">
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-content-primary">{student.name}</p>
                        <p className="mt-1 text-xs text-content-muted">
                          {student.rollNumber} · Semester {student.currentSemester || 'NA'}
                        </p>
                      </div>
                    </td>
                    <td className="table-cell">
                      <p className="font-medium text-content-primary">{student.department?.name || 'NA'}</p>
                      <p className="mt-1 text-xs text-content-muted">{student.department?.code || 'Department code unavailable'}</p>
                    </td>
                    <td className="table-cell font-medium text-content-primary">{formatDecimal(student.cgpa)}</td>
                    <td className="table-cell">{formatPercent(student.academicRecords?.avgAttendance)}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-content-primary">{student.currentBacklogs ?? 0}</span>
                        <span className={performanceBadgeClass[student.performanceCategory] || 'badge badge-warning'}>
                          {student.performanceCategory || 'Average'}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <Link
                        to={`/student-progress/${student._id}`}
                        state={{
                          backTo: '/staff-dashboard/students',
                          backLabel: 'Back to Student Monitoring',
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-blue-400/16 bg-blue-500/[0.06] px-3 py-2 text-xs font-semibold text-blue-200 transition duration-300 hover:scale-[1.03] hover:border-blue-300/24 hover:bg-blue-500/[0.12] hover:text-white"
                      >
                        View Progress
                        <ArrowUpRight size={13} />
                      </Link>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td className="table-cell" colSpan={6}>
                      <div className="empty-state min-h-[14rem]">No students match the current department and semester filter.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-line/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-content-muted">
              Page <span className="font-medium text-content-primary">{pagination.page}</span> of{' '}
              <span className="font-medium text-content-primary">{pagination.pages}</span>
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn-secondary"
                disabled={pagination.page <= 1}
                onClick={() => setFilters((current) => ({ ...current, page: Math.max(current.page - 1, 1) }))}
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={pagination.page >= pagination.pages}
                onClick={() => setFilters((current) => ({ ...current, page: Math.min(current.page + 1, pagination.pages) }))}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
