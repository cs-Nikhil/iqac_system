import { useState, useEffect } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import PlacementPieChart from '../../charts/PlacementPieChart';
import { api } from '../../services/api';

const InstitutionalDashboard = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const { data } = await api.get('/reports/institution');
        setReport(data.data);
      } catch (err) {
        console.error('Report fetch error', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, []);

  if (loading) return <div>Loading Institutional KPIs...</div>;

  return (
    <ProtectedRoute roles={["IQAC_HEAD"]}>
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Institutional Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold">Total Students</h3>
            <p className="text-3xl font-bold text-blue-600">{report?.metrics.totalStudents}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold">Pass %</h3>
            <p className="text-3xl font-bold text-green-600">{report?.metrics.overallPassPercentage}%</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold">Research Output</h3>
            <p className="text-3xl font-bold text-purple-600">{report?.metrics.researchOutput}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold">Event Participations</h3>
            <p className="text-3xl font-bold text-orange-600">{report?.metrics.eventParticipationMetrics.totalParticipations}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold">Placement Statistics</h3>
            <p>Total: {report?.metrics.placementStats.totalPlacements}</p>
            <p>Rate: {report?.metrics.placementStats.placementRate}%</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <PlacementPieChart />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default InstitutionalDashboard;

