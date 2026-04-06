
import { useState, useEffect } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { api } from '../../services/api';

const FacultyDashboard = () => {
  const [research, setResearch] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await api.get('/research');
        setResearch(data.papers);
      } catch (err) {
        console.error('Faculty data error', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div>Loading Faculty Dashboard...</div>;

  return (
    <ProtectedRoute roles={["FACULTY"]}>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Faculty Dashboard</h1>
          <button 
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            onClick={() => window.location.href = '/research/upload'}
          >
            + Upload Research
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold">My Research Papers</h3>
            <p className="text-3xl font-bold text-blue-600">{research.length}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold">Total Citations</h3>
            <p className="text-3xl font-bold text-purple-600">{research.reduce((sum, p) => sum + (p.citations || 0), 0)}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold">Avg Impact Factor</h3>
            <p className="text-3xl font-bold text-green-600">{Math.round(research.reduce((sum, p) => sum + (p.impactFactor || 0), 0) / research.length) || 0}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold">Recent Publications</h3>
            <ul className="mt-4 space-y-2 max-h-64 overflow-y-auto">
              {research.slice(0,5).map(p => (
                <li key={p._id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                  <span>{p.title}</span>
                  <div className="text-sm text-gray-500">
                    {p.year} | <button className="text-blue-600 hover:underline">Edit</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold">Department Reports</h3>
            <button 
              className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
              onClick={() => window.location.href = '/dashboard/department'}
            >
              View Department Analytics
            </button>
            <p className="mt-2 text-sm text-gray-500">(Pass %, Attendance, etc.)</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold">Assigned Students</h3>
          <p className="text-gray-500">Student marks update coming soon...</p>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default FacultyDashboard;

