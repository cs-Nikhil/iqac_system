import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Briefcase, ClipboardCheck, GraduationCap, Trophy, Users } from 'lucide-react';
import Navbar from '../components/Navbar';
import KPICards from '../components/KPICards';
import { useAuth } from '../context/AuthContext';
import TrendLineCard from '../charts/TrendLineCard';
import PerformanceDistributionChart from '../charts/PerformanceDistributionChart';
import { DepartmentRankingChart } from '../charts/DepartmentRankingChart';
import { DepartmentPerformanceTrendChart } from '../charts/DepartmentPerformanceTrendChart';
import { analyticsAPI, studentsAPI } from '../services/api';

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="section chart-shell gap-4">
      <div>
        <h3 className="section-title">{title}</h3>
        {subtitle ? <p className="section-subtitle mt-1">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`.trim()} />;
}

export default function Dashboard() {
  const { user } = useAuth();
  const isHod = user?.role === 'hod';
  const [kpis, setKpis] = useState(null);
  const [passData, setPassData] = useState([]);
  const [placementData, setPlacementData] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [rankingData, setRankingData] = useState([]);
  const [performanceDistribution, setPerformanceDistribution] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiResponse, trendsResponse, rankingResponse, performanceResponse] = await Promise.all([
        analyticsAPI.kpis(),
        analyticsAPI.dashboardTrends(),
        analyticsAPI.departmentRanking(),
        isHod ? Promise.resolve(null) : studentsAPI.performance(),
      ]);

      setKpis(kpiResponse.data.kpis);
      setPassData(trendsResponse.data.data?.passPercentage || []);
      setPlacementData(trendsResponse.data.data?.placements || []);
      setAttendanceData(trendsResponse.data.data?.attendance || []);
      setRankingData(rankingResponse.data.data || []);
      setPerformanceDistribution(isHod ? null : performanceResponse?.data?.distribution || null);
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  }, [isHod]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const kpiCards = [
    { label: 'Total Students', value: kpis?.totalStudents ?? 0, icon: GraduationCap, tone: 'brand', loading, sub: 'Active enrollments' },
    { label: 'Faculty', value: kpis?.totalFaculty ?? 0, icon: Users, tone: 'success', loading, sub: 'Teaching staff' },
    { label: 'Placed', value: kpis?.totalPlacements ?? 0, icon: Briefcase, tone: 'warning', loading, sub: 'This academic year' },
    { label: 'Placement Rate', value: kpis?.placementPercentage ?? 0, icon: Trophy, tone: 'violet', loading, type: 'percentage', sub: 'Overall rate' },
    { label: 'Avg Attendance', value: kpis?.avgAttendance ?? 0, icon: ClipboardCheck, tone: 'cyan', loading, type: 'percentage', sub: 'Across subjects' },
    { label: 'Research Papers', value: kpis?.totalResearchPapers ?? 0, icon: BookOpen, tone: 'pink', loading, sub: 'Published works' },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <Navbar title="Dashboard" subtitle="IQAC analytics overview with year-wise performance trends" onRefresh={loadAll} loading={loading} />

      <div className="dashboard-container flex-1">
        <KPICards cards={kpiCards} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <TrendLineCard
            title="Year-Wise Pass Percentage"
            subtitle="Academic success trend from 2020 to 2024"
            metricLabel="Pass Percentage"
            data={passData}
            loading={loading}
            valueFormatter={(value) => `${Number(value).toFixed(1)}%`}
            yAxisFormatter={(value) => `${value}%`}
            yDomain={[0, 100]}
            emptyLabel="Pass percentage trend is not available yet."
            colors={{
              surfaceGlow: 'rgba(59, 130, 246, 0.18)',
              surfaceAccent: 'rgba(14, 165, 233, 0.12)',
              fillTop: '#60a5fa',
              fillMid: '#3b82f6',
              fillBottom: '#1d4ed8',
              strokeStart: '#7dd3fc',
              strokeEnd: '#3b82f6',
              dot: '#93c5fd',
              currentDot: '#dbeafe',
              dotStroke: '#0f172a',
              ring: '#93c5fd',
              glow: 'rgba(96, 165, 250, 0.36)',
              cursor: '#60a5fa',
            }}
          />

          <TrendLineCard
            title="Year-Wise Placements"
            subtitle="Placed students trend from 2020 to 2024"
            metricLabel="Placements"
            data={placementData}
            loading={loading}
            valueFormatter={(value) => `${Math.round(value).toLocaleString('en-IN')} Students`}
            yAxisFormatter={(value) => `${value}`}
            yDomain={[0, 'dataMax + 20']}
            emptyLabel="Placement trend is not available yet."
            colors={{
              surfaceGlow: 'rgba(16, 185, 129, 0.18)',
              surfaceAccent: 'rgba(34, 197, 94, 0.12)',
              fillTop: '#6ee7b7',
              fillMid: '#10b981',
              fillBottom: '#047857',
              strokeStart: '#86efac',
              strokeEnd: '#10b981',
              dot: '#86efac',
              currentDot: '#dcfce7',
              dotStroke: '#052e16',
              ring: '#34d399',
              glow: 'rgba(52, 211, 153, 0.34)',
              cursor: '#34d399',
            }}
          />

          <TrendLineCard
            title="Year-Wise Attendance"
            subtitle="Average attendance trend from 2020 to 2024"
            metricLabel="Attendance"
            data={attendanceData}
            loading={loading}
            valueFormatter={(value) => `${Number(value).toFixed(1)}%`}
            yAxisFormatter={(value) => `${value}%`}
            yDomain={[0, 100]}
            emptyLabel="Attendance trend is not available yet."
            colors={{
              surfaceGlow: 'rgba(250, 204, 21, 0.16)',
              surfaceAccent: 'rgba(249, 115, 22, 0.12)',
              fillTop: '#fde047',
              fillMid: '#facc15',
              fillBottom: '#f59e0b',
              strokeStart: '#fde68a',
              strokeEnd: '#f59e0b',
              dot: '#fde68a',
              currentDot: '#fef3c7',
              dotStroke: '#451a03',
              ring: '#fbbf24',
              glow: 'rgba(250, 204, 21, 0.32)',
              cursor: '#fbbf24',
            }}
          />
        </div>

        <div className={`grid grid-cols-1 gap-4 ${isHod ? '' : 'xl:grid-cols-3'}`}>
          {!isHod ? (
            <div>
              <ChartCard title="Performance Distribution" subtitle="Excellent, Good, Average, and At Risk student mix">
                {loading ? <Skeleton className="h-56" /> : <PerformanceDistributionChart distribution={performanceDistribution} />}
              </ChartCard>
            </div>
          ) : null}
          <div className={`flex flex-col gap-4 ${isHod ? '' : 'xl:col-span-2'}`}>
            <ChartCard title="Department Performance Score" subtitle="Composite ranking of pass, placement, attendance, and research">
              {loading ? <Skeleton className="h-56" /> : <DepartmentRankingChart data={rankingData} />}
            </ChartCard>
            <ChartCard title="Department Performance Trend" subtitle="Year-wise performance comparison across departments">
              {loading ? <Skeleton className="h-[260px]" /> : <DepartmentPerformanceTrendChart />}
            </ChartCard>
          </div>
        </div>

        <div className="table-shell">
          <div className="section-header border-b border-line/80 px-5 py-4">
            <div>
              <h3 className="section-title">Department Ranking Table</h3>
              <p className="section-subtitle mt-1">Live department score breakdown</p>
            </div>
            <span className="badge badge-info">Live</span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr className="table-head">
                  {['Rank', 'Department', 'Pass %', 'Avg Attendance', 'Placement %', 'Research', 'Score'].map((heading) => (
                    <th key={heading} className="table-head-cell">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 5 }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="table-row">
                    {Array.from({ length: 7 }).map((__, cellIndex) => (
                      <td key={cellIndex} className="table-cell">
                        <Skeleton className="h-4 w-16" />
                      </td>
                    ))}
                  </tr>
                )) : null}

                {!loading && rankingData.map((department, index) => (
                  <tr key={department.deptId} className="table-row">
                    <td className="table-cell">
                      <span
                        className={[
                          'font-display text-base font-bold',
                          index === 0 ? 'text-warning' : index === 1 ? 'text-content-secondary' : index === 2 ? 'text-amber-500' : 'text-content-muted',
                        ].join(' ')}
                      >
                        #{department.rank}
                      </span>
                    </td>
                    <td className="table-cell">
                      <p className="font-medium text-content-primary whitespace-nowrap">{department.department}</p>
                      <p className="mt-0.5 font-mono text-xs text-content-muted">{department.code}</p>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-20 overflow-hidden rounded-pill bg-panel-muted">
                          <div className="h-full rounded-pill bg-brand-500" style={{ width: `${department.passPercentage}%` }} />
                        </div>
                        <span className="text-xs text-content-secondary">{department.passPercentage}%</span>
                      </div>
                    </td>
                    <td className="table-cell text-xs">{department.avgAttendance}%</td>
                    <td className="table-cell text-xs">{department.placementPercentage}%</td>
                    <td className="table-cell text-xs">{department.researchPapers}</td>
                    <td className="table-cell">
                      <span className="font-display font-bold text-brand-300">{department.score}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
