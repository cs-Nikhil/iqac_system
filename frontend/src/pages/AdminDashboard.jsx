import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { 
  LogOut, Users, GraduationCap, Briefcase, 
  BookOpen, Trophy, FileText, BarChart3, 
  Search, Award, Target, TrendingUp 
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeModule, setActiveModule] = useState('dashboard');
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Mock data for demonstration - replace with actual API calls
      const mockKpis = {
        totalStudents: 2456,
        totalFaculty: 156,
        totalDepartments: 8,
        totalResearchPapers: 89,
        placementPercentage: 87.5,
        averageCGPA: 7.8,
        totalAchievements: 234
      };
      setKpis(mockKpis);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'departments', label: 'Departments', icon: Briefcase },
    { id: 'students', label: 'Students', icon: GraduationCap, subItems: [
      { id: 'student-list', label: 'Student List' },
      { id: 'academic-progress', label: 'Academic Progress' },
      { id: 'student-reports', label: 'Student Reports' }
    ]},
    { id: 'faculty', label: 'Faculty', icon: Users, subItems: [
      { id: 'faculty-list', label: 'Faculty List' },
      { id: 'research-papers', label: 'Research Papers' },
      { id: 'faculty-achievements', label: 'Faculty Achievements' }
    ]},
    { id: 'departments', label: 'Departments', icon: Briefcase },
    { id: 'placements', label: 'Placements', icon: Target },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
    { id: 'department-performance', label: 'Department Analytics', icon: BarChart3 },
    { id: 'nba', label: 'NBA Credentials', icon: FileText },
    { id: 'naac', label: 'NAAC Documentation', icon: FileText },
    { id: 'reports', label: 'Report Generation', icon: FileText },
    { id: 'search', label: 'Advanced Search', icon: Search }
  ];

  const cgpaData = [
    { year: '2020', cgpa: 7.2 },
    { year: '2021', cgpa: 7.5 },
    { year: '2022', cgpa: 7.8 },
    { year: '2023', cgpa: 8.1 },
    { year: '2024', cgpa: 7.9 }
  ];

  const placementData = [
    { name: 'Placed', value: 87.5, color: '#10b981' },
    { name: 'Not Placed', value: 12.5, color: '#ef4444' }
  ];

  const departmentData = [
    { name: 'CSE', students: 450, faculty: 35, placement: 92 },
    { name: 'ECE', students: 380, faculty: 28, placement: 85 },
    { name: 'MECH', students: 420, faculty: 32, placement: 88 },
    { name: 'CIVIL', students: 350, faculty: 25, placement: 90 },
    { name: 'IT', students: 400, faculty: 30, placement: 86 }
  ];

  const researchData = [
    { year: '2020', papers: 12 },
    { year: '2021', papers: 15 },
    { year: '2022', papers: 18 },
    { year: '2023', papers: 22 },
    { year: '2024', papers: 22 }
  ];

  const KpiCard = ({ title, value, icon: Icon, change, changeType }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className={`text-sm ${changeType === 'positive' ? 'text-green-600' : 'text-red-600'}`}>
              {changeType === 'positive' ? '↑' : '↓'} {change}%
            </p>
          )}
        </div>
        <div className="p-3 bg-blue-100 rounded-full">
          <Icon className="h-6 w-6 text-blue-600" />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gray-900 text-white transition-all duration-300 fixed h-full z-10`}>
        <div className="p-4">
          <h1 className={`text-xl font-bold ${sidebarOpen ? 'text-left' : 'text-center'}`}>
            {sidebarOpen ? 'IQAC System' : 'IQ'}
          </h1>
        </div>
        <nav className="mt-8">
          {menuItems.map((item) => (
            <div key={item.id}>
              <button
                onClick={() => setActiveModule(item.id)}
                className={`w-full flex items-center px-4 py-3 hover:bg-gray-800 transition-colors ${
                  activeModule === item.id ? 'bg-gray-800 border-l-4 border-blue-500' : ''
                }`}
              >
                <item.icon className="h-5 w-5 mr-3" />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
              {item.subItems && sidebarOpen && (
                <div className="ml-8 mt-2 space-y-1">
                  {item.subItems.map((subItem) => (
                    <button
                      key={subItem.id}
                      onClick={() => setActiveModule(subItem.id)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                    >
                      {subItem.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className={`${sidebarOpen ? 'ml-64' : 'ml-20'} flex-1 transition-all duration-300`}>
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4 flex justify-between items-center">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-md hover:bg-gray-100"
              >
                <BarChart3 className="h-5 w-5 text-gray-600" />
              </button>
              <h2 className="ml-4 text-xl font-semibold text-gray-900">
                IQAC Admin Dashboard
              </h2>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user?.name}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-6">
          {activeModule === 'dashboard' && (
            <div>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KpiCard title="Total Students" value={kpis?.totalStudents} icon={GraduationCap} change="+5.2%" changeType="positive" />
                <KpiCard title="Total Faculty" value={kpis?.totalFaculty} icon={Users} change="+3.1%" changeType="positive" />
                <KpiCard title="Total Departments" value={kpis?.totalDepartments} icon={Briefcase} />
                <KpiCard title="Research Papers" value={kpis?.totalResearchPapers} icon={FileText} change="+12%" changeType="positive" />
                <KpiCard title="Placement %" value={`${kpis?.placementPercentage}%`} icon={Target} change="+2.3%" changeType="positive" />
                <KpiCard title="Average CGPA" value={kpis?.averageCGPA} icon={TrendingUp} change="+0.3" changeType="positive" />
                <KpiCard title="Total Achievements" value={kpis?.totalAchievements} icon={Award} />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* CGPA Trend */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">CGPA Trend (Year-wise)</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={cgpaData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="cgpa" stroke="#3b82f6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Placement Pie Chart */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Placement Statistics</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={placementData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {placementData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Department Performance */}
              <div className="bg-white rounded-lg shadow p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Performance</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Placement %</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {departmentData.map((dept) => (
                        <tr key={dept.name}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dept.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dept.students}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dept.faculty}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dept.placement}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Research Publications Trend */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Research Publications Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={researchData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="papers" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Module placeholders for other menu items */}
          {activeModule !== 'dashboard' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {menuItems.find(item => item.id === activeModule)?.label || 'Module'}
              </h3>
              <p className="text-gray-600">
                This module is under development. Please check back later for updates.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
