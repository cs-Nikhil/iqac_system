import { useEffect, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { api } from '../../services/api';

const StudentDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const { data } = await api.get('/students/dashboard');
        setData(data.data);
      } catch (err) {
        console.error('Student dashboard error', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) return <div>Loading Student Portal...</div>;

  return (
    <ProtectedRoute roles={["STUDENT"]}>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Student Portal</h1>
          <div className="text-sm text-gray-500">
            Semester {data?.student.currentSemester} | CGPA {data?.student.cgpa}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3>Recent Marks</h3>
            <ul className="mt-4 space-y-2">
              {data?.marks.slice(0,3).map(m => (
                <li key={m._id}>{m.subject?.name}: {m.total}/100</li>
              ))}
            </ul>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3>Attendance</h3>
            <ul className="mt-4 space-y-2">
              {data?.attendance.slice(0,3).map(a => (
                <li key={a._id}>{a.subject?.name}: {a.percentage}%</li>
              ))}
            </ul>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3>Upcoming Events</h3>
            <p className="text-3xl font-bold">{data?.events.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold">CGPA Trend Chart</h3>
          <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center mt-4">
            {/* CGPA Trend Chart placeholder - integrate Chart.js/Recharts */}
            <div className="text-gray-500">
              CGPA Trend Chart<br />
              {data?.cgpaTrend.map(trend => (
                <div key={trend.semester} className="flex justify-between py-1">
                  <span>Sem {trend.semester}</span>
                  <span>{trend.gpa}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Upcoming Events</h3>
            <div className="space-y-3">
              {data?.events.slice(0,3).map(event => (
                <div key={event._id} className="p-4 border rounded-lg hover:shadow-md">
                  <h4 className="font-semibold">{event.title}</h4>
                  <p className="text-sm text-gray-600">{event.date}</p>
                  <button className="mt-2 bg-indigo-600 text-white px-4 py-1 rounded text-sm hover:bg-indigo-700">
                    Register
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Academic Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Current CGPA</span>
                <span className="font-bold">{data?.student.cgpa}</span>
              </div>
              <div className="flex justify-between">
                <span>Semester Credits</span>
                <span>{data?.student.credits}</span>
              </div>
              <div className="flex justify-between">
                <span>Backlogs</span>
                <span className="text-red-600 font-bold">{data?.student.backlogs || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default StudentDashboard;

