import React, { useEffect, useState } from 'react';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

const NAACDocumentation = () => {
  const [documentation, setDocumentation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('research');
  const [selectedDoc, setSelectedDoc] = useState(null);

  useEffect(() => {
    loadNAACDocumentation();
  }, []);

  const loadNAACDocumentation = async () => {
    try {
      // Mock NAAC documentation data
      const mockDocumentation = [
        {
          _id: '1',
          category: 'Curricular Aspects',
          title: 'Program Outcomes',
          description: 'Program specific outcomes and graduate attributes',
          weightage: 25,
          documents: [
            { name: 'PO Matrix', type: 'pdf', uploaded: true, size: '2.5 MB' },
            { name: 'Attainment Report', type: 'pdf', uploaded: true, size: '1.8 MB' }
          ],
          lastUpdated: '2024-01-15',
          status: 'completed'
        },
        {
          _id: '2',
          category: 'Teaching-Learning & Evaluation',
          title: 'Teaching Methods',
          description: 'Innovative teaching methods and evaluation processes',
          weightage: 20,
          documents: [
            { name: 'Teaching Methodology', type: 'doc', uploaded: true, size: '3.2 MB' },
            { name: 'Evaluation Guidelines', type: 'pdf', uploaded: true, size: '2.1 MB' }
          ],
          lastUpdated: '2024-02-10',
          status: 'completed'
        },
        {
          _id: '3',
          category: 'Research, Consultancy & Extension',
          title: 'Research Publications',
          description: 'Faculty research papers, publications and consultancy work',
          weightage: 15,
          documents: [
            { name: 'Research Papers 2023-24', type: 'pdf', uploaded: true, size: '8.5 MB' },
            { name: 'Consultancy Projects', type: 'doc', uploaded: true, size: '1.2 MB' }
          ],
          lastUpdated: '2024-01-20',
          status: 'completed'
        },
        {
          _id: '4',
          category: 'Infrastructure & Learning Resources',
          title: 'Library Resources',
          description: 'Library facilities, digital resources and learning materials',
          weightage: 15,
          documents: [
            { name: 'Library Inventory', type: 'xlsx', uploaded: true, size: '1.5 MB' },
            { name: 'Digital Resources', type: 'pdf', uploaded: true, size: '3.8 MB' }
          ],
          lastUpdated: '2024-02-05',
          status: 'completed'
        },
        {
          _id: '5',
          category: 'Student Support & Progression',
          title: 'Student Progression',
          description: 'Student mentoring, counseling and progression tracking',
          weightage: 20,
          documents: [
            { name: 'Mentoring Guidelines', type: 'pdf', uploaded: true, size: '2.1 MB' },
            { name: 'Counseling Reports', type: 'pdf', uploaded: true, size: '1.8 MB' }
          ],
          lastUpdated: '2024-02-15',
          status: 'in-progress'
        },
        {
          _id: '6',
          category: 'Governance & Leadership',
          title: 'Institutional Values',
          description: 'Leadership quality, institutional values and social responsibilities',
          weightage: 10,
          documents: [
            { name: 'Leadership Quality', type: 'pdf', uploaded: true, size: '1.5 MB' },
            { name: 'Social Responsibility Report', type: 'pdf', uploaded: true, size: '2.2 MB' }
          ],
          lastUpdated: '2024-01-10',
          status: 'completed'
        },
        {
          _id: '7',
          category: 'Best Practices',
          title: 'Innovative Practices',
          description: 'Best practices and innovative approaches adopted by the institution',
          weightage: 10,
          documents: [
            { name: 'Best Practices Manual', type: 'pdf', uploaded: true, size: '4.5 MB' },
            { name: 'Innovation Report', type: 'pdf', uploaded: true, size: '3.2 MB' }
          ],
          lastUpdated: '2024-02-20',
          status: 'completed'
        }
      ];
      setDocumentation(mockDocumentation);
    } catch (error) {
      console.error('Error loading NAAC documentation:', error);
    } finally {
      setLoading(false);
    }
  };

  const overallProgress = documentation.length > 0 
    ? Math.round((documentation.filter(d => d.status === 'completed').length / documentation.length) * 100)
    : 0;

  const statusColor = (status) => {
    const colors = {
      completed: 'bg-green-100 text-green-800',
      'in-progress': 'bg-yellow-100 text-yellow-800',
      'not-started': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const categoryColors = {
    'Curricular Aspects': 'bg-blue-50',
    'Teaching-Learning & Evaluation': 'bg-green-50',
    'Research, Consultancy & Extension': 'bg-purple-50',
    'Infrastructure & Learning Resources': 'bg-yellow-50',
    'Student Support & Progression': 'bg-pink-50',
    'Governance & Leadership': 'bg-indigo-50',
    'Best Practices': 'bg-orange-50'
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
              <h1 className="text-2xl font-bold text-gray-900">NAAC Documentation Management</h1>
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
                <p className="text-sm text-gray-600 mt-2">Documentation completed</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900">Total Weightage</h3>
                <div className="text-3xl font-bold text-green-600">100%</div>
                <p className="text-sm text-gray-600 mt-2">Across all criteria</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900">Next Review</h3>
                <p className="text-lg font-semibold text-blue-600">2025</p>
                <p className="text-sm text-gray-600 mt-2">Scheduled NAAC review</p>
              </div>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="bg-white shadow mt-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap gap-2 mb-6">
              {Object.keys(categoryColors).map(category => (
                <button
                  key={category}
                  onClick={() => setActiveTab(category)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === category 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {category.replace(/-/g, ' ')}
                </button>
              ))}
            </div>

            {/* Documentation Content */}
            <div className="p-6">
              {Object.entries(
                documentation.reduce((acc, [category, items]) => {
                  acc[category] = items;
                  return acc;
                }, {})
              ).map(([category, items]) => (
                activeTab === category && (
                  <div key={category} className={`${categoryColors[category]} rounded-lg p-6`}>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">{category}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {items.map((doc, index) => (
                        <div key={doc._id} className="bg-white rounded-lg shadow p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h4 className="text-md font-medium text-gray-900">{doc.title}</h4>
                              <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                              <div className="flex items-center mt-2 space-x-4">
                                <span className="text-sm text-gray-600">Weight: {doc.weightage}%</span>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColor(doc.status)}`}>
                                  {doc.status}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Documents: {doc.documents.length}</span>
                              <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                                Manage Documents
                              </button>
                            </div>
                          </div>
                          
                          <div className="mt-4">
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Documents</h4>
                            <div className="space-y-2">
                              {doc.documents.map((docItem, docIndex) => (
                                <div key={docIndex} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                  <div className="flex items-center">
                                    <div className={`w-3 h-3 rounded-full mr-3 ${
                                      docItem.uploaded ? 'bg-green-500' : 'bg-gray-300'
                                    }`}></div>
                                    <span className="text-sm text-gray-900">{docItem.name}</span>
                                    <span className={`ml-2 text-xs px-2 py-1 rounded ${
                                      docItem.type === 'pdf' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                    }`}>
                                      {docItem.type.toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    {docItem.size} • Last updated: {doc.lastUpdated}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default NAACDocumentation;
