import React, { useEffect, useState } from 'react';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

const StudentList = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    department: '',
    batchYear: '',
    cgpaMin: '',
    cgpaMax: '',
    atRisk: 'all'
  });

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      // Mock data - replace with actual API call
      const mockStudents = [
        {
          _id: '1',
          name: 'Rahul Kumar',
          rollNumber: 'CSE2021001',
          email: 'rahul.kumar@college.edu',
          department: { name: 'Computer Science', code: 'CSE' },
          batchYear: 2021,
          currentSemester: 6,
          cgpa: 8.5,
          isAtRisk: false,
          currentBacklogs: 0,
          totalBacklogsCleared: 0,
          phone: '9876543210',
          isActive: true
        },
        {
          _id: '2',
          name: 'Priya Sharma',
          rollNumber: 'ECE2021034',
          email: 'priya.sharma@college.edu',
          department: { name: 'Electronics', code: 'ECE' },
          batchYear: 2022,
          currentSemester: 4,
          cgpa: 6.2,
          isAtRisk: true,
          riskReasons: ['Low CGPA', 'Multiple Backlogs'],
          currentBacklogs: 4,
          totalBacklogsCleared: 2,
          phone: '9876543211',
          isActive: true
        },
        {
          _id: '3',
          name: 'Amit Patel',
          rollNumber: 'MECH2022056',
          email: 'amit.patel@college.edu',
          department: { name: 'Mechanical', code: 'MECH' },
          batchYear: 2020,
          currentSemester: 8,
          cgpa: 7.8,
          isAtRisk: false,
          currentBacklogs: 1,
          totalBacklogsCleared: 3,
          phone: '9876543212',
          isActive: true
        }
      ];
      setStudents(mockStudents);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const filteredStudents = students.filter(student => {
    const matchesDepartment = !filters.department || student.department.name.toLowerCase().includes(filters.department.toLowerCase());
    const matchesBatchYear = !filters.batchYear || student.batchYear.toString() === filters.batchYear;
    const matchesCGPA = !filters.cgpaMin || student.cgpa >= parseFloat(filters.cgpaMin);
    const matchesCGPAMax = !filters.cgpaMax || student.cgpa <= parseFloat(filters.cgpaMax);
    const matchesRisk = filters.atRisk === 'all' || 
      (filters.atRisk === 'at-risk' && student.isAtRisk) ||
      (filters.atRisk === 'not-at-risk' && !student.isAtRisk);

    return matchesDepartment && matchesBatchYear && matchesCGPA && matchesCGPAMax && matchesRisk;
  });

  const cgpaData = [
    { range: '0-6', students: filteredStudents.filter(s => s.cgpa >= 0 && s.cgpa < 6).length },
    { range: '6-7', students: filteredStudents.filter(s => s.cgpa >= 6 && s.cgpa < 7).length },
    { range: '7-8', students: filteredStudents.filter(s => s.cgpa >= 7 && s.cgpa < 8).length },
    { range: '8-9', students: filteredStudents.filter(s => s.cgpa >= 8 && s.cgpa <= 10).length },
    { range: '9-10', students: filteredStudents.filter(s => s.cgpa >= 9).length }
  ];

  const riskData = [
    { name: 'At Risk', value: filteredStudents.filter(s => s.isAtRisk).length, color: '#ef4444' },
    { name: 'Not At Risk', value: filteredStudents.filter(s => !s.isAtRisk).length, color: '#10b981' }
  ];

  const departmentData = [
    { name: 'CSE', students: filteredStudents.filter(s => s.department.code === 'CSE').length },
    { name: 'ECE', students: filteredStudents.filter(s => s.department.code === 'ECE').length },
    { name: 'MECH', students: filteredStudents.filter(s => s.department.code === 'MECH').length },
    { name: 'CIVIL', students: filteredStudents.filter(s => s.department.code === 'CIVIL').length },
    { name: 'IT', students: filteredStudents.filter(s => s.department.code === 'IT').length }
  ];

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
              <h1 className="text-2xl font-bold text-gray-900">Student Academic Monitoring</h1>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  {filteredStudents.length} of {students.length} students shown
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Department</label>
                <select
                  name="department"
                  value={filters.department}
                  onChange={handleFilterChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">All Departments</option>
                  <option value="CSE">Computer Science</option>
                  <option value="ECE">Electronics</option>
                  <option value="MECH">Mechanical</option>
                  <option value="CIVIL">Civil</option>
                  <option value="IT">Information Technology</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Batch Year</label>
                <select
                  name="batchYear"
                  value={filters.batchYear}
                  onChange={handleFilterChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">All Years</option>
                  <option value="2020">2020</option>
                  <option value="2021">2021</option>
                  <option value="2022">2022</option>
                  <option value="2023">2023</option>
                  <option value="2024">2024</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">CGPA Range</label>
                <div className="flex space-x-2 mt-1">
                  <input
                    type="number"
                    name="cgpaMin"
                    value={filters.cgpaMin}
                    onChange={handleFilterChange}
                    placeholder="Min"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <span className="self-center">to</span>
                  <input
                    type="number"
                    name="cgpaMax"
                    value={filters.cgpaMax}
                    onChange={handleFilterChange}
                    placeholder="Max"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Risk Status</label>
                <select
                  name="atRisk"
                  value={filters.atRisk}
                  onChange={handleFilterChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">All Students</option>
                  <option value="at-risk">At Risk Only</option>
                  <option value="not-at-risk">Not At Risk Only</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900">Total Students</h3>
              <p className="text-3xl font-bold text-blue-600">{filteredStudents.length}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900">Average CGPA</h3>
              <p className="text-3xl font-bold text-green-600">
                {filteredStudents.length > 0 
                  ? (filteredStudents.reduce((sum, s) => sum + s.cgpa, 0) / filteredStudents.length).toFixed(2)
                  : '0.00'
                }
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900">At Risk Students</h3>
              <p className="text-3xl font-bold text-red-600">
                {filteredStudents.filter(s => s.isAtRisk).length}
              </p>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CGPA Distribution */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">CGPA Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={cgpaData.map(range => ({
                      name: `${range} CGPA`,
                      value: range.students
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {cgpaData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][index]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Risk Analysis */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Risk Analysis</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={riskData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell key="cell-0" fill="#ef4444" />
                    <Cell key="cell-1" fill="#10b981" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Department-wise Distribution */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Department-wise Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={departmentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="students" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Student List Table */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white shadow overflow-hidden rounded-lg">
            <div className="px-4 py-5 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Student List</h3>
                <div className="text-sm text-gray-600">
                  Showing {filteredStudents.length} students
                </div>
              </div>
              
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CGPA</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredStudents.map((student) => (
                      <tr key={student._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <span className="text-sm font-medium text-blue-600">
                                  {student.name.charAt(0)}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{student.name}</div>
                              <div className="text-sm text-gray-500">{student.rollNumber}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.department?.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.cgpa.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            student.isAtRisk 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {student.isAtRisk ? 'At Risk' : 'Good'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button
                            onClick={() => console.log('View details:', student)}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default StudentList;
