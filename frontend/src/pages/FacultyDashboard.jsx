import React from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { LogOut, BookOpen, Award, Users } from 'lucide-react';

const FacultyDashboard = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Faculty Dashboard</h1>
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
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
                <BookOpen className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <div className="ml-4">
              <h2 className="text-2xl font-bold text-gray-900">
                Welcome to Faculty Dashboard
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                You can manage student records, enter marks, and track academic progress.
              </p>
            </div>
          </div>
        </div>

        {/* Role Information */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Your Role: Faculty Member</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Academic Management</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Student attendance tracking</li>
                <li>• Marks and grade entry</li>
                <li>• Course management</li>
              </ul>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Student Support</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Academic counseling</li>
                <li>• Performance monitoring</li>
                <li>• Progress reports</li>
              </ul>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Professional Development</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Research activities</li>
                <li>• Achievement tracking</li>
                <li>• Training records</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
              <BookOpen className="h-6 w-6 text-blue-600 mb-2" />
              <h4 className="font-medium text-gray-900">Course Management</h4>
              <p className="text-sm text-gray-500">Manage your courses</p>
            </button>
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
              <Users className="h-6 w-6 text-green-600 mb-2" />
              <h4 className="font-medium text-gray-900">Student Records</h4>
              <p className="text-sm text-gray-500">View student information</p>
            </button>
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
              <Award className="h-6 w-6 text-purple-600 mb-2" />
              <h4 className="font-medium text-gray-900">Enter Marks</h4>
              <p className="text-sm text-gray-500">Grade and assessment entry</p>
            </button>
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
              <BookOpen className="h-6 w-6 text-yellow-600 mb-2" />
              <h4 className="font-medium text-gray-900">Attendance</h4>
              <p className="text-sm text-gray-500">Track student attendance</p>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FacultyDashboard;
