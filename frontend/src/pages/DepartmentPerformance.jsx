import React, { useEffect, useState } from 'react';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, Radar, PieChart, Pie, Cell } from 'recharts';

const DepartmentPerformance = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [timeRange, setTimeRange] = useState('yearly');

  useEffect(() => {
    loadDepartmentData();
  }, []);

  const loadDepartmentData = async () => {
    try {
      // Mock data - replace with actual API call
      const mockDepartments = [
        {
          _id: '1',
          name: 'Computer Science',
          code: 'CSE',
          hod: { name: 'Dr. Rajesh Kumar', email: 'hod.cse@college.edu' },
          totalStudents: 450,
          totalFaculty: 35,
          averageCGPA: 8.2,
          passPercentage: 92.5,
          placementRate: 88.0,
          researchPapers: 45,
          accreditations: {
            nba: { status: 'Accredited', validUntil: '2026', score: 85 },
            naac: { status: 'Accredited', grade: 'A', validUntil: '2025', score: 3.65 }
          },
          performance: {
            teachingQuality: 4.2,
            infrastructure: 4.5,
            researchOutput: 4.0,
            studentSatisfaction: 4.3,
            industryCollaboration: 3.8
          }
        },
        {
          _id: '2',
          name: 'Electronics & Communication',
          code: 'ECE',
          hod: { name: 'Dr. Priya Nair', email: 'hod.ece@college.edu' },
          totalStudents: 380,
          totalFaculty: 28,
          averageCGPA: 7.8,
          passPercentage: 89.0,
          placementRate: 85.0,
          researchPapers: 32,
          accreditations: {
            nba: { status: 'Accredited', validUntil: '2026', score: 82 },
            naac: { status: 'Accredited', grade: 'A', validUntil: '2025', score: 3.58 }
          },
          performance: {
            teachingQuality: 4.0,
            infrastructure: 4.3,
            researchOutput: 3.9,
            studentSatisfaction: 4.1,
            industryCollaboration: 3.5
          }
        },
        {
          _id: '3',
          name: 'Mechanical Engineering',
          code: 'MECH',
          hod: { name: 'Dr. Amit Sharma', email: 'hod.mech@college.edu' },
          totalStudents: 420,
          totalFaculty: 32,
          averageCGPA: 7.5,
          passPercentage: 87.0,
          placementRate: 86.0,
          researchPapers: 28,
          accreditations: {
            nba: { status: 'Accredited', validUntil: '2026', score: 80 },
            naac: { status: 'Accredited', grade: 'A', validUntil: '2025', score: 3.45 }
          },
          performance: {
            teachingQuality: 3.9,
            infrastructure: 4.1,
            researchOutput: 3.7,
            studentSatisfaction: 4.0,
            industryCollaboration: 3.6
          }
        },
        {
          _id: '4',
          name: 'Information Technology',
          code: 'IT',
          hod: { name: 'Dr. Suresh Kumar', email: 'hod.it@college.edu' },
          totalStudents: 400,
          totalFaculty: 30,
          averageCGPA: 7.9,
          passPercentage: 90.0,
          placementRate: 87.0,
          researchPapers: 25,
          accreditations: {
            nba: { status: 'Accredited', validUntil: '2026', score: 88 },
            naac: { status: 'Accredited', grade: 'A', validUntil: '2025', score: 3.72 }
          },
          performance: {
            teachingQuality: 4.4,
            infrastructure: 4.6,
            researchOutput: 4.1,
            studentSatisfaction: 4.4,
            industryCollaboration: 3.9
          }
        }
      ];
      setDepartments(mockDepartments);
    } catch (error) {
      console.error('Error loading department data:', error);
    } finally {
      setLoading(false);
    }
  };

  const performanceData = [
    { metric: 'Teaching Quality', departments: departments.map(d => ({ name: d.name, value: d.performance.teachingQuality, fullMark: 5 })) },
    { metric: 'Infrastructure', departments: departments.map(d => ({ name: d.name, value: d.performance.infrastructure, fullMark: 5 })) },
    { metric: 'Research Output', departments: departments.map(d => ({ name: d.name, value: d.performance.researchOutput, fullMark: 5 })) },
    { metric: 'Student Satisfaction', departments: departments.map(d => ({ name: d.name, value: d.performance.studentSatisfaction, fullMark: 5 })) },
    { metric: 'Industry Collaboration', departments: departments.map(d => ({ name: d.name, value: d.performance.industryCollaboration, fullMark: 5 })) }
  ];

  const radarData = selectedDepartment ? [
    { metric: 'Academic Performance', value: selectedDepartment.performance.teachingQuality, fullMark: 5 },
    { metric: 'Research & Innovation', value: selectedDepartment.performance.researchOutput, fullMark: 5 },
    { metric: 'Student Outcomes', value: selectedDepartment.performance.studentSatisfaction, fullMark: 5 },
    { metric: 'Industry Interface', value: selectedDepartment.performance.industryCollaboration, fullMark: 5 },
    { metric: 'Infrastructure Quality', value: selectedDepartment.performance.infrastructure, fullMark: 5 }
  ] : [];

  const accreditationData = selectedDepartment ? [
    { subject: 'NBA Score', value: selectedDepartment.accreditations.nba.score, fullMark: 100 },
    { subject: 'NAAC Score', value: selectedDepartment.accreditations.naac.score * 25, fullMark: 100 },
    { subject: 'Placement Rate', value: selectedDepartment.placementRate, fullMark: 100 },
    { subject: 'Pass Percentage', value: selectedDepartment.passPercentage, fullMark: 100 }
  ] : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <h1 className="text-2xl font-bold text-gray-900">Department Performance Analytics</h1>
            </div>
          </div>
        </div>

        {/* Department Selector */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Select Department</h2>
              <select
                value={selectedDepartment || ''}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept._id} value={dept._id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {selectedDepartment && (
          <>
            {/* Department Overview Cards */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{selectedDepartment.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">HOD: {selectedDepartment.hod.name}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Students</span>
                      <span className="text-2xl font-bold text-blue-600">{selectedDepartment.totalStudents}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Faculty</span>
                      <span className="text-2xl font-bold text-green-600">{selectedDepartment.totalFaculty}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Average CGPA</span>
                      <span className="text-2xl font-bold text-purple-600">{selectedDepartment.averageCGPA}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Pass Rate</span>
                      <span className="text-2xl font-bold text-orange-600">{selectedDepartment.passPercentage}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Placement Rate</span>
                      <span className="text-2xl font-bold text-teal-600">{selectedDepartment.placementRate}%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Research Output</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Papers</span>
                    <span className="text-2xl font-bold text-indigo-600">{selectedDepartment.researchPapers}</span>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Accreditation Status</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">NBA Status</span>
                      <div>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          selectedDepartment.accreditations.nba.status === 'Accredited' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {selectedDepartment.accreditations.nba.status}
                        </span>
                        <span className="ml-2 text-sm text-gray-600">
                          Valid until: {selectedDepartment.accreditations.nba.validUntil}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">NBA Score</span>
                      <span className="text-lg font-bold text-blue-600">{selectedDepartment.accreditations.nba.score}/100</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">NAAC Status</span>
                      <div>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          selectedDepartment.accreditations.naac.status === 'Accredited' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {selectedDepartment.accreditations.naac.status}
                        </span>
                        <span className="ml-2 text-sm text-gray-600">
                          Grade: {selectedDepartment.accreditations.naac.grade}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">NAAC Score</span>
                      <span className="text-lg font-bold text-purple-600">{selectedDepartment.accreditations.naac.score}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Comparison Charts */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Performance Metrics Comparison */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics Comparison</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={performanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="metric" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Department Radar Chart */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {selectedDepartment.name} - Performance Radar
                  </h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis type="number" domain={[0, 360]} />
                      <Radar
                        nameKey="metric"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.6}
                      />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            {/* Accreditation Scores */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Accreditation Scores</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={accreditationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="subject" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Department-wise Comparison */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">All Departments Comparison</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg CGPA</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pass %</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Placement %</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Research Papers</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NBA Score</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NAAC Score</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {departments.map((dept) => (
                        <tr key={dept._id} className={dept.averageCGPA >= 8 ? 'bg-green-50' : dept.averageCGPA >= 7 ? 'bg-yellow-50' : 'bg-red-50'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dept.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dept.totalStudents}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dept.totalFaculty}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dept.averageCGPA.toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dept.passPercentage}%</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dept.placementRate}%</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dept.researchPapers}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dept.accreditations.nba.score}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dept.accreditations.naac.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default DepartmentPerformance;
