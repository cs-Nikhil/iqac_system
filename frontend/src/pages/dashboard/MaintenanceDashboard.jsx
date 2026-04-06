import { useState, useEffect } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { api } from '../../services/api';

const MaintenanceDashboard = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data } = await api.get('/admin/users');  // future endpoint
        setUsers(data);
      } catch (err) {
        console.error('Users error', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  if (loading) return <div>Loading User Management...</div>;

  return (
    <ProtectedRoute roles={["MAINTENANCE"]}>
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">User Management Dashboard</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xl font-semibold mb-4">Create User</h3>
            <form className="space-y-4">
              <input type="text" placeholder="Name" className="w-full p-3 border rounded-lg" />
              <input type="email" placeholder="Email" className="w-full p-3 border rounded-lg" />
              <select className="w-full p-3 border rounded-lg">
                <option>Role</option>
                <option>IQAC_HEAD</option>
                <option>HOD</option>
                <option>FACULTY</option>
                <option>MAINTENANCE</option>
                <option>STUDENT</option>
              </select>
              <select className="w-full p-3 border rounded-lg">
                <option>Department</option>
                <option>Computer Science</option>
                <option>Mechanical</option>
              </select>
              <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700">
                Create User
              </button>
            </form>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700">
                Reset Password (Batch)
              </button>
              <button className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700">
                Generate Temp Password
              </button>
              <button className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700">
                Assign Departments
              </button>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4">Users Overview</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">Email</th>
                  <th className="px-6 py-3 text-left">Role</th>
                  <th className="px-6 py-3 text-left">Dept</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-6 py-3">Dr. John Doe</td>
                  <td className="px-6 py-3">john@dept.edu</td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">HOD</span>
                  </td>
                  <td className="px-6 py-3">CS</td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">Active</span>
                  </td>
                  <td className="px-6 py-3">
                    <button className="text-orange-600 hover:underline mr-2">Reset PW</button>
                    <button className="text-blue-600 hover:underline">Edit</button>
                  </td>
                </tr>
                {/* more rows */}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default MaintenanceDashboard;

