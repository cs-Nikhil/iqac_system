import { useEffect, useState, useCallback } from 'react';
import { Search, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import StudentProgressAnalytics from '../components/StudentProgressAnalytics';
import { analyticsAPI, studentsAPI, departmentsAPI } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const TOP_STUDENTS_LIMIT = 50;

const getStudentPerformanceScore = (student) => Number(student?.performanceScore || 0);

const sortStudentsByPerformance = (students = []) => (
  [...students].sort((left, right) => {
    const scoreDifference = getStudentPerformanceScore(right) - getStudentPerformanceScore(left);
    if (scoreDifference !== 0) return scoreDifference;

    const cgpaDifference = Number(right?.cgpa || 0) - Number(left?.cgpa || 0);
    if (cgpaDifference !== 0) return cgpaDifference;

    const backlogDifference = Number(left?.currentBacklogs || 0) - Number(right?.currentBacklogs || 0);
    if (backlogDifference !== 0) return backlogDifference;

    const attendanceDifference =
      Number(right?.academicRecords?.avgAttendance || 0) - Number(left?.academicRecords?.avgAttendance || 0);
    if (attendanceDifference !== 0) return attendanceDifference;

    return String(left?.rollNumber || '').localeCompare(String(right?.rollNumber || ''));
  })
);

export default function StudentProgress() {
  const navigate = useNavigate();
  const [analyticsStudents, setAnalyticsStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [cgpaTrend, setCgpaTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '', department: '', batchYear: '', semester: '',
  });

  const cleanParams = (params) => {
    const normalized = { ...params };
    Object.keys(normalized).forEach((key) => !normalized[key] && delete normalized[key]);
    return normalized;
  };

  const loadPageData = useCallback(async () => {
    setLoading(true);
    try {
      const analyticsParams = cleanParams({ ...filters, limit: 5000 });
      const trendParams = cleanParams({
        department: filters.department,
        batchYear: filters.batchYear,
      });

      const [analyticsResponse, trendResponse] = await Promise.all([
        studentsAPI.getAll(analyticsParams),
        analyticsAPI.cgpaTrend(trendParams),
      ]);

      setAnalyticsStudents(analyticsResponse.data.students || []);
      setCgpaTrend(
        (trendResponse.data.data || []).map((item) => ({
          semester: item._id,
          avgCGPA: item.avgCGPA,
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    departmentsAPI.getAll().then(r => setDepartments(r.data.departments));
  }, []);

  const setFilter = (k, v) => {
    setFilters(f => ({ ...f, [k]: v }));
  };

  const handleViewProgress = (student) => {
    navigate(`/student-progress/${student._id}`);
  };

  const rankedStudents = sortStudentsByPerformance(analyticsStudents);
  const topStudents = rankedStudents.slice(0, TOP_STUDENTS_LIMIT);

  const getCGPAColor = (cgpa) => {
    if (cgpa >= 8) return 'text-emerald-400';
    if (cgpa >= 6) return 'text-amber-400';
    return 'text-red-400';
  };

  const getPerformanceBadge = (student) => {
    const category = student.performanceCategory || (student.isAtRisk ? 'At Risk' : 'Good');

    if (category === 'Excellent') {
      return { label: category, className: 'badge badge-info text-[10px]' };
    }

    if (category === 'Good') {
      return { label: category, className: 'badge badge-success text-[10px]' };
    }

    if (category === 'Average') {
      return { label: category, className: 'badge badge-warning text-[10px]' };
    }

    return { label: 'At Risk', className: 'badge badge-danger text-[10px]' };
  };

  return (
    <div className="flex flex-col h-full">
      <Navbar 
        title="Student Progress Analysis" 
        subtitle="Individual Performance Tracking & CGPA Trends" 
        onRefresh={loadPageData} 
        loading={loading} 
      />

      <div className="p-6 space-y-4 flex-1 overflow-y-auto">
        {/* Filters */}
        <div className="section p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input pl-8 h-9 text-xs"
              placeholder="Search students..."
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)}
            />
          </div>

          <select className="input h-9 text-xs w-40" value={filters.department} onChange={e => setFilter('department', e.target.value)}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d._id} value={d._id}>{d.code}</option>)}
          </select>

          <select className="input h-9 text-xs w-32" value={filters.batchYear} onChange={e => setFilter('batchYear', e.target.value)}>
            <option value="">All Batches</option>
            <option value="2020">2020</option>
            <option value="2021">2021</option>
            <option value="2022">2022</option>
            <option value="2023">2023</option>
            <option value="2024">2024</option>
          </select>

          <select className="input h-9 text-xs w-32" value={filters.semester} onChange={e => setFilter('semester', e.target.value)}>
            <option value="">All Sems</option>
            {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
          </select>
        </div>

        <StudentProgressAnalytics
          students={analyticsStudents}
          cgpaTrend={cgpaTrend}
          loading={loading}
        />

        {/* Students List */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1e2738] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Top Performing Students</h3>
              <p className="mt-1 text-xs text-slate-500">Ranked by unified performance score</p>
            </div>
            <span className="badge badge-info">
              {analyticsStudents.length > topStudents.length
                ? `Showing ${topStudents.length} of ${analyticsStudents.length}`
                : `${topStudents.length} students`}
            </span>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2738]">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Rank</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Roll No</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Department</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Score</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">CGPA</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Backlogs</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2738]">
                {loading && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-3 bg-[#1e2738] rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))}

                {!loading && topStudents.map((student, index) => {
                  const performance = getPerformanceBadge(student);

                  return (
                    <tr key={student._id} className="hover:bg-[#161b27] transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-display text-sm font-bold text-brand-300">#{index + 1}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-brand-600/30 flex items-center justify-center text-xs font-bold text-brand-300">
                            {student.name.charAt(0)}
                          </div>
                          <span className="font-medium text-slate-200">{student.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-300">{student.rollNumber}</td>
                      <td className="px-5 py-3">
                        <span className="badge badge-info text-[10px]">{student.department?.code}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-display text-sm font-bold text-sky-300">
                          {getStudentPerformanceScore(student).toFixed(1)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`font-display font-bold text-sm ${getCGPAColor(student.cgpa)}`}>
                          {student.cgpa?.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-300">{student.currentBacklogs || 0}</span>
                          {student.currentBacklogs > 0 && (
                            <AlertTriangle size={12} className="text-amber-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={performance.className}>{performance.label}</span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleViewProgress(student)}
                          className="btn-ghost h-7 px-3 text-xs flex items-center gap-1"
                        >
                          View Progress
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {!loading && topStudents.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-slate-500 text-sm">
                      No students found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}

// Student Progress Modal Component
function StudentProgressModal({ student, progressData, onClose }) {
  const [activeTab, setActiveTab] = useState('performance');

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="chart-tooltip text-xs">
        <p className="mb-1 text-content-muted">{label}</p>
        {payload.map(p => (
          <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  };

  const chartData = progressData.map(semester => ({
    semester: `Sem ${semester._id.semester}`,
    avgGradePoints: semester.avgGradePoints,
    avgMarks: semester.avgMarks,
    passedSubjects: semester.passedSubjects,
    totalSubjects: semester.totalSubjects,
  }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#1e2738]">
          <div>
            <h3 className="text-lg font-semibold text-white">{student.name}</h3>
            <p className="text-xs text-slate-500">{student.rollNumber} • {student.department?.code}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ×
          </button>
        </div>

        <div className="flex border-b border-[#1e2738]">
          <button
            onClick={() => setActiveTab('performance')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'performance' 
                ? 'text-brand-400 border-b-2 border-brand-400' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Academic Performance
          </button>
          <button
            onClick={() => setActiveTab('subjects')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'subjects' 
                ? 'text-brand-400 border-b-2 border-brand-400' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Subject Details
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'performance' && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-[#0f1117] rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">Current CGPA</p>
                  <p className="text-lg font-display font-bold text-white">{student.cgpa?.toFixed(2)}</p>
                </div>
                <div className="bg-[#0f1117] rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">Current Backlogs</p>
                  <p className="text-lg font-display font-bold text-amber-400">{student.currentBacklogs || 0}</p>
                </div>
                <div className="bg-[#0f1117] rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">Total Cleared</p>
                  <p className="text-lg font-display font-bold text-emerald-400">{student.totalBacklogsCleared || 0}</p>
                </div>
                <div className="bg-[#0f1117] rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">Current Semester</p>
                  <p className="text-lg font-display font-bold text-white">{student.currentSemester}</p>
                </div>
              </div>

              {/* Performance Chart */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Performance Trend</h4>
                <div className="chart-surface">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="semester" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="avgGradePoints" stroke="#1a52ff" strokeWidth={2} />
                      <Line type="monotone" dataKey="avgMarks" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'subjects' && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-white mb-3">Subject-wise Performance</h4>
              {progressData.map((semester, index) => (
                <div key={index} className="border border-[#1e2738] rounded-lg p-3">
                  <h5 className="font-medium text-slate-200 mb-2">
                    Semester {semester._id.semester} ({semester._id.academicYear})
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {semester.subjects.map((subject, subIndex) => (
                      <div key={subIndex} className="flex items-center justify-between p-2 bg-[#0f1117] rounded">
                        <div>
                          <p className="text-sm font-medium text-slate-200">{subject.name}</p>
                          <p className="text-xs text-slate-500">{subject.code}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-slate-300">{subject.total}</span>
                          <span className={`badge text-[10px] ${
                            subject.grade === 'F' ? 'badge-danger' : 'badge-success'
                          }`}>
                            {subject.grade}
                          </span>
                          <span className="text-xs text-slate-500">{subject.gradePoints}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
