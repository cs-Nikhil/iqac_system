import { useCallback, useEffect, useState } from 'react';
import { Building2, GraduationCap, TrendingUp, Users } from 'lucide-react';
import DepartmentAnalyticsChart from '../components/DepartmentAnalyticsChart';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { analyticsAPI, departmentsAPI } from '../services/api';

const KPI_TONES = [
  { shell: 'bg-brand-500/15 text-brand-300 ring-brand-400/20', text: 'text-brand-300' },
  { shell: 'bg-success/15 text-success ring-success/20', text: 'text-success' },
  { shell: 'bg-warning/15 text-warning ring-warning/20', text: 'text-warning' },
  { shell: 'bg-violet-500/15 text-violet-300 ring-violet-400/20', text: 'text-violet-300' },
];

function SummaryCard({ label, value, icon: Icon, tone, compact = false }) {
  return (
    <div className="section card-hover flex items-center gap-4 p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${tone.shell}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="metric-label">{label}</p>
        <p className={`mt-2 font-display font-bold text-content-primary ${compact ? 'text-base sm:text-lg' : 'text-xl'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

const normalizeAdmissionsData = (items = []) =>
  items
    .map((item) => {
      const year = String(item?.year ?? '').trim();
      const count = Number(item?.count ?? 0);
      const isValidYear = /^\d{4}$/.test(year) && Number(year) >= 2000 && Number(year) <= 2100;

      return isValidYear && Number.isFinite(count)
        ? { year, count }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.year) - Number(b.year));

const normalizeAttendanceData = (items = []) =>
  items
    .map((item) => {
      const year = String(item?.year ?? '').trim();
      const percentage = Number(item?.percentage ?? 0);
      const isValidYear = /^\d{4}$/.test(year) && Number(year) >= 2000 && Number(year) <= 2100;

      return isValidYear && Number.isFinite(percentage)
        ? { year, percentage }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.year) - Number(b.year));

export default function Departments() {
  const { user } = useAuth();
  const isHod = user?.role === 'hod';

  const [departments, setDepartments] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [departmentSummary, setDepartmentSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isHod) {
        const summaryResponse = await departmentsAPI.getSummary();
        setDepartmentSummary(summaryResponse.data.data);
        setDepartments([]);
        setRanking([]);
        return;
      }

      const [departmentResponse, rankingResponse] = await Promise.all([
        departmentsAPI.getAll(),
        analyticsAPI.departmentRanking(),
      ]);

      setDepartments(departmentResponse.data.departments);
      setRanking(rankingResponse.data.data || []);
      setDepartmentSummary(null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [isHod]);

  useEffect(() => {
    load();
  }, [load]);

  const getRankInfo = (departmentId) => ranking.find((item) => item.deptId?.toString() === departmentId?.toString()) || {};

  const getScoreColor = (score) => {
    if (score >= 70) return 'text-success';
    if (score >= 50) return 'text-warning';
    return 'text-danger';
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return 'badge-warning';
    if (rank === 2) return 'badge-info';
    if (rank === 3) return 'badge-danger';
    return 'badge-info';
  };

  const summaryCards = isHod
    ? [
        {
          label: 'Department Name',
          value: loading ? '-' : departmentSummary?.department || '-',
          icon: Building2,
          compact: true,
        },
        {
          label: 'Total Students',
          value: loading ? '-' : (departmentSummary?.total_students ?? 0).toLocaleString('en-IN'),
          icon: GraduationCap,
        },
        {
          label: 'Total Faculty',
          value: loading ? '-' : (departmentSummary?.total_faculty ?? 0).toLocaleString('en-IN'),
          icon: Users,
        },
        {
          label: 'Avg Department Score',
          value: loading ? '-' : (departmentSummary?.avg_score ?? 0).toFixed(1),
          icon: TrendingUp,
        },
      ]
    : [
        { label: 'Total Departments', value: departments.length, icon: Building2 },
        {
          label: 'Total Students',
          value: departments.reduce((sum, item) => sum + (item.studentCount || 0), 0).toLocaleString('en-IN'),
          icon: GraduationCap,
        },
        {
          label: 'Total Faculty',
          value: departments.reduce((sum, item) => sum + (item.facultyCount || 0), 0),
          icon: Users,
        },
        {
          label: 'Avg Score',
          value: ranking.length ? (ranking.reduce((sum, item) => sum + item.score, 0) / ranking.length).toFixed(1) : '-',
          icon: TrendingUp,
        },
      ];

  const admissionsData = normalizeAdmissionsData(departmentSummary?.admissions_by_year);
  const attendanceData = normalizeAttendanceData(departmentSummary?.attendance_by_year);

  return (
    <div className="flex min-h-full flex-col">
      <Navbar
        title={isHod ? 'Department Dashboard' : 'Departments'}
        subtitle={isHod ? 'Department-specific performance, people, and admissions insights' : 'Department performance and analytics'}
        onRefresh={load}
        loading={loading}
      />

      <div className="dashboard-container flex-1">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card, index) => (
            <SummaryCard
              key={card.label}
              label={card.label}
              value={card.value}
              icon={card.icon}
              tone={KPI_TONES[index]}
              compact={card.compact}
            />
          ))}
        </div>

        {isHod ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <DepartmentAnalyticsChart
              title="Year-Wise Student Admissions"
              subtitle={`Student intake trend for ${departmentSummary?.department || 'this department'}`}
              badge={departmentSummary?.code}
              metricLabel="Admissions"
              trendLabel="Admissions Trend"
              data={admissionsData}
              valueKey="count"
              valueFormatter={(value) => `${Math.round(value).toLocaleString('en-IN')} Students`}
              yAxisFormatter={(value) => `${value}`}
              yDomain={[0, 'dataMax + 20']}
              emptyLabel="Admissions data is not available for this department yet."
              loading={loading}
              colors={{
                surfaceGlow: 'rgba(56, 189, 248, 0.18)',
                surfaceAccent: 'rgba(139, 92, 246, 0.14)',
                fillTop: '#38bdf8',
                fillMid: '#4d7eff',
                fillBottom: '#8b5cf6',
                strokeStart: '#38bdf8',
                strokeEnd: '#8b5cf6',
                dot: '#7dd3fc',
                currentDot: '#c084fc',
                dotStroke: '#0f172a',
                ring: '#93c5fd',
                glow: 'rgba(96, 165, 250, 0.36)',
                cursor: '#60a5fa',
              }}
            />

            <DepartmentAnalyticsChart
              title="Year-Wise Attendance"
              subtitle={`Average attendance performance for ${departmentSummary?.department || 'this department'}`}
              badge="Attendance"
              metricLabel="Attendance"
              trendLabel="Attendance Trend"
              data={attendanceData}
              valueKey="percentage"
              valueFormatter={(value) => `${Number(value).toFixed(1)}%`}
              yAxisFormatter={(value) => `${value}%`}
              yDomain={[0, 100]}
              emptyLabel="Attendance data is not available for this department yet."
              loading={loading}
              colors={{
                surfaceGlow: 'rgba(16, 185, 129, 0.18)',
                surfaceAccent: 'rgba(250, 204, 21, 0.12)',
                fillTop: '#34d399',
                fillMid: '#14b8a6',
                fillBottom: '#fbbf24',
                strokeStart: '#34d399',
                strokeEnd: '#fbbf24',
                dot: '#6ee7b7',
                currentDot: '#fde68a',
                dotStroke: '#052e2b',
                ring: '#34d399',
                glow: 'rgba(52, 211, 153, 0.34)',
                cursor: '#34d399',
              }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {loading ? Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="section space-y-4 p-5">
                <div className="skeleton h-5 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((__, tileIndex) => (
                    <div key={tileIndex} className="skeleton h-16" />
                  ))}
                </div>
              </div>
            )) : null}

            {!loading && departments.map((department) => {
              const info = getRankInfo(department._id);
              return (
                <div key={department._id} className="section card-hover space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/20">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight text-content-primary">{department.name}</p>
                        <p className="mt-1 font-mono text-xs text-content-muted">{department.code}</p>
                      </div>
                    </div>
                    {info.rank ? <span className={`badge ${getRankBadge(info.rank)}`}>#{info.rank}</span> : null}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Students', value: department.studentCount, tone: 'text-brand-300' },
                      { label: 'Faculty', value: department.facultyCount, tone: 'text-success' },
                      { label: 'Seats', value: department.totalSeats, tone: 'text-warning' },
                    ].map((stat) => (
                      <div key={stat.label} className="surface-inset p-3 text-center">
                        <p className={`text-lg font-display font-bold ${stat.tone}`}>{stat.value}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-content-muted">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {info.score !== undefined ? (
                    <div className="space-y-3">
                      {[
                        { label: 'Pass %', value: info.passPercentage, fill: 'bg-brand-500' },
                        { label: 'Attendance', value: info.avgAttendance, fill: 'bg-success' },
                        { label: 'Placement', value: info.placementPercentage, fill: 'bg-warning' },
                      ].map((metric) => (
                        <div key={metric.label} className="flex items-center gap-3">
                          <span className="w-20 text-[11px] uppercase tracking-[0.18em] text-content-muted">{metric.label}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-pill bg-panel-muted">
                            <div className={`h-full rounded-pill ${metric.fill}`} style={{ width: `${metric.value}%` }} />
                          </div>
                          <span className="w-10 text-right text-xs text-content-secondary">{metric.value}%</span>
                        </div>
                      ))}

                      <div className="flex items-center justify-between border-t border-line/70 pt-3">
                        <span className="text-xs text-content-muted">Performance score</span>
                        <span className={`font-display text-lg font-bold ${getScoreColor(info.score)}`}>{info.score}</span>
                      </div>
                    </div>
                  ) : null}

                  {department.hod ? (
                    <div className="flex items-center gap-3 border-t border-line/70 pt-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                        {department.hod.name?.charAt(0)}
                      </div>
                      <p className="text-xs text-content-muted">
                        HOD: <span className="font-medium text-content-secondary">{department.hod.name}</span>
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
