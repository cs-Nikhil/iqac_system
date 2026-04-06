import React, { useEffect, useState } from 'react';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

const NBAAccreditation = () => {
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCriteria, setSelectedCriteria] = useState(null);
  const [activeTab, setActiveTab] = useState('criteria');

  useEffect(() => {
    loadNBACriteria();
  }, []);

  const loadNBACriteria = async () => {
    try {
      // Mock NBA criteria data
      const mockCriteria = [
        {
          _id: '1',
          code: '1',
          title: 'Vision, Mission and Program Educational Objectives',
          description: 'Statement of vision, mission and program educational objectives',
          weightage: 10,
          status: 'completed',
          documents: [
            { name: 'Vision Statement', type: 'pdf', uploaded: true },
            { name: 'Mission Statement', type: 'pdf', uploaded: true },
            { name: 'Program Outcomes', type: 'doc', uploaded: true }
          ],
          lastUpdated: '2024-01-15'
        },
        {
          _id: '2',
          code: '2',
          title: 'Program Outcomes (POs)',
          description: 'Program specific outcomes and graduate attributes',
          weightage: 20,
          status: 'in-progress',
          documents: [
            { name: 'PO Matrix', type: 'xlsx', uploaded: true }
          ],
          lastUpdated: '2024-02-20'
        },
        {
          _id: '3',
          code: '3',
          title: 'Curriculum',
          description: 'Curriculum structure and syllabus coverage',
          weightage: 15,
          status: 'in-progress',
          documents: [
            { name: 'Curriculum Matrix', type: 'pdf', uploaded: false },
            { name: 'Syllabus Coverage', type: 'doc', uploaded: true }
          ],
          lastUpdated: '2024-01-10'
        },
        {
          _id: '4',
          code: '4',
          title: 'Teaching-Learning and Evaluation Process',
          description: 'Teaching methods, learning resources and evaluation processes',
          weightage: 20,
          status: 'completed',
          documents: [
            { name: 'Teaching Methods', type: 'pdf', uploaded: true },
            { name: 'Evaluation Process', type: 'doc', uploaded: true }
          ],
          lastUpdated: '2024-01-05'
        },
        {
          _id: '5',
          code: '5',
          title: 'Student Performance',
          description: 'Student assessment and performance evaluation systems',
          weightage: 15,
          status: 'in-progress',
          documents: [
            { name: 'Assessment Guidelines', type: 'pdf', uploaded: true }
          ],
          lastUpdated: '2024-02-15'
        },
        {
          _id: '6',
          code: '6',
          title: 'Faculty Contributions',
          description: 'Faculty qualifications, research contributions and development activities',
          weightage: 10,
          status: 'completed',
          documents: [
            { name: 'Faculty Profiles', type: 'pdf', uploaded: true },
            { name: 'Research Publications', type: 'pdf', uploaded: true }
          ],
          lastUpdated: '2024-01-20'
        },
        {
          _id: '7',
          code: '7',
          title: 'Infrastructure and Learning Resources',
          description: 'Physical facilities, laboratories, library and learning resources',
          weightage: 10,
          status: 'in-progress',
          documents: [
            { name: 'Lab Inventory', type: 'xlsx', uploaded: true }
          ],
          lastUpdated: '2024-02-10'
        }
      ];
      setCriteria(mockCriteria);
    } catch (error) {
      console.error('Error loading NBA criteria:', error);
    } finally {
      setLoading(false);
    }
  };

  const overallProgress = criteria.length > 0 
    ? Math.round((criteria.filter(c => c.status === 'completed').length / criteria.length) * 100)
    : 0;

  const statusColor = (status) => {
    const colors = {
      completed: 'bg-green-100 text-green-800',
      'in-progress': 'bg-yellow-100 text-yellow-800',
      'not-started': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

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
              <h1 className="text-2xl font-bold text-gray-900">NBA Accreditation Management</h1>
            </div>
          </div>
        </div>

        {/* Progress Overview */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900">Overall Progress</h3>
                <div className="text-3xl font-bold text-blue-600">{overallProgress}%</div>
                <p className="text-sm text-gray-600 mt-2">Criteria completed</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900">Total Weightage</h3>
                <div className="text-3xl font-bold text-green-600">100%</div>
                <p className="text-sm text-gray-600 mt-2">Across all criteria</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900">Next Review</h3>
                <p className="text-lg font-semibold text-blue-600">2025</p>
                <p className="text-sm text-gray-600 mt-2">Scheduled NBA review</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white shadow mt-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8">
                <button
                  onClick={() => setActiveTab('criteria')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'criteria' 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Criteria Management
                </button>
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'documents' 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Document Upload
                </button>
                <button
                  onClick={() => setActiveTab('reports')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'reports' 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Reports
                </button>
              </nav>
            </div>
          </div>

          {activeTab === 'criteria' && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {criteria.map((criterion) => (
                  <div key={criterion._id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{criterion.code}. {criterion.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{criterion.description}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColor(criterion.status)}`}>
                          {criterion.status}
                        </span>
                        <span className="text-sm text-gray-600">Weight: {criterion.weightage}%</span>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Documents ({criterion.documents.length})</h4>
                      <div className="space-y-2">
                        {criterion.documents.map((doc, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                            <div className="flex items-center">
                              <div className={`w-3 h-3 rounded-full mr-3 ${
                                doc.uploaded ? 'bg-green-500' : 'bg-gray-300'
                              }`}></div>
                              <span className="text-sm text-gray-900">{doc.name}</span>
                              <span className={`ml-2 text-xs px-2 py-1 rounded ${
                                doc.type === 'pdf' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {doc.type.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600">
                              Last updated: {criterion.lastUpdated}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="p-6">
              <div className="bg-white rounded-lg shadow">
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Upload Documents</h3>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <div className="text-center">
                      <div className="text-gray-400 mb-4">
                        <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-4 4 0M7 20a2 2 0 01-2 2 0m10 10v6m0 0h6m-6 6v6m-6 18h6m-6 18a6 6 0 01 0 0-6 6" />
                        </svg>
                        <p className="mt-2 text-sm text-gray-600">Click to upload or drag and drop</p>
                        <p className="text-xs text-gray-500">PDF, DOC, DOC, XLSX up to 10MB</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="p-6">
              <div className="bg-white rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Accreditation Reports</h3>
                <div className="space-y-4">
                  <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    Generate NBA Report
                  </button>
                  <button className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 mt-2">
                    Generate NAAC Report
                  </button>
                  <button className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 mt-2">
                    Generate Compliance Report
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default NBAAccreditation;
