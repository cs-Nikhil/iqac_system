import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import Departments from './pages/Departments';
import Students from './pages/Students';
import StudentProgress from './pages/StudentProgress';
import StudentProgressDetail from './pages/StudentProgressDetail';
import Faculty from './pages/Faculty';
import FacultyResearch from './pages/FacultyResearch';
import {
  FacultyContributionsPage,
  FacultyDocumentsPage,
  FacultyOverviewPage,
  FacultyStudentsPage,
  FacultySubjectsPage,
  FacultyWorkspaceLayout,
} from './pages/FacultyWorkspace';
import Placements from './pages/Placements';
import Reports from './pages/Reports';
import Documents from './pages/Documents';
import Achievements from './pages/Achievements';
import Events from './pages/Events';
import NBA from './pages/NBA';
import NAAC from './pages/NAAC';
import UnauthorizedPage from './pages/UnauthorizedPage';
import { authService } from './services/authService';
import StudentWorkspaceLayout from './pages/student/StudentWorkspaceLayout';
import StudentOverviewPage from './pages/student/Overview';
import StudentEditProfilePage from './pages/student/EditProfile';
import StudentSubjectsPage from './pages/student/Subjects';
import StudentAttendancePage from './pages/student/Attendance';
import StudentBacklogsPage from './pages/student/Backlogs';
import StudentParticipationPage from './pages/student/Participation';
import StudentAchievementsPage from './pages/student/Achievements';
import StudentFeedbackPage from './pages/student/Feedback';
import StudentDocumentsPage from './pages/student/Documents';
import StudentPlacementsPage from './pages/student/Placements';
import { LEGACY_STUDENT_ROUTES, STUDENT_DASHBOARD_BASE, STUDENT_ROUTES } from './pages/student/studentRoutes';
import { FACULTY_WORKSPACE_BASE, FACULTY_WORKSPACE_ROUTES, FACULTY_WORKSPACE_SECTIONS } from './pages/faculty/facultyRoutes';

import Overview from './pages/staff/Overview';
import StudentRecords from './pages/staff/StudentRecords';
import StaffDepartments from './pages/staff/Departments';
import DepartmentDetails from './pages/staff/DepartmentDetails';
import StaffReports from './pages/staff/Reports';
import StaffDocuments from './pages/staff/Documentation';

function HomeRoute() {
  const user = authService.getCurrentUser();

  if (!user) {
    return <LandingPage />;
  }

  const targets = {
    iqac_admin: '/dashboard',
    hod: '/dashboard',
    faculty: FACULTY_WORKSPACE_ROUTES.root,
    staff: '/staff-dashboard',
    student: STUDENT_ROUTES.overview,
  };

  return <Navigate to={targets[user.role] || '/login'} replace />;
}

function FacultyLegacyRedirect() {
  const user = authService.getCurrentUser();
  const { section = 'overview' } = useParams();
  const normalizedSection = FACULTY_WORKSPACE_SECTIONS.includes(section) ? section : 'overview';

  if (user?.role === 'faculty') {
    return <Navigate to={FACULTY_WORKSPACE_ROUTES[normalizedSection]} replace />;
  }

  return <Navigate to="/faculty" replace />;
}

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route
          element={
            <ProtectedRoute roles={['iqac_admin', 'hod', 'faculty', 'staff', 'student']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute roles={['iqac_admin', 'hod']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/departments"
            element={
              <ProtectedRoute roles={['iqac_admin', 'hod']}>
                <Departments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/students"
            element={
              <ProtectedRoute roles={['iqac_admin', 'hod']}>
                <Students />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student-progress"
            element={
              <ProtectedRoute roles={['iqac_admin', 'hod']}>
                <StudentProgress />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student-progress/:id"
            element={
              <ProtectedRoute roles={['iqac_admin', 'hod', 'staff']}>
                <StudentProgressDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty"
            element={
              <ProtectedRoute roles={['iqac_admin', 'hod']}>
                <Faculty />
              </ProtectedRoute>
            }
          />
          <Route
            path={`${FACULTY_WORKSPACE_BASE}/*`}
            element={
              <ProtectedRoute roles={['iqac_admin', 'hod', 'faculty']}>
                <FacultyWorkspaceLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<FacultyOverviewPage />} />
            <Route path="subjects" element={<FacultySubjectsPage />} />
            <Route path="students" element={<FacultyStudentsPage />} />
            <Route path="contributions" element={<FacultyContributionsPage />} />
            <Route path="documents" element={<FacultyDocumentsPage />} />
          </Route>
          <Route path="/faculty/:section" element={<FacultyLegacyRedirect />} />
          <Route
            path={`${STUDENT_DASHBOARD_BASE}/*`}
            element={
              <ProtectedRoute roles={['student']}>
                <StudentWorkspaceLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<StudentOverviewPage />} />
            <Route path="profile/edit" element={<StudentEditProfilePage />} />
            <Route path="subjects" element={<StudentSubjectsPage />} />
            <Route path="attendance" element={<StudentAttendancePage />} />
            <Route path="backlogs" element={<StudentBacklogsPage />} />
            <Route path="participation" element={<StudentParticipationPage />} />
            <Route path="achievements" element={<StudentAchievementsPage />} />
            <Route path="feedback" element={<StudentFeedbackPage />} />
            <Route path="documents" element={<StudentDocumentsPage />} />
            <Route path="placements" element={<StudentPlacementsPage />} />
          </Route>
          {Object.entries(LEGACY_STUDENT_ROUTES).map(([key, path]) => (
            <Route
              key={path}
              path={path}
              element={
                <ProtectedRoute roles={['student']}>
                  <Navigate to={STUDENT_ROUTES[key]} replace />
                </ProtectedRoute>
              }
            />
          ))}
          <Route
            path="/research"
            element={
              <ProtectedRoute roles={['iqac_admin', 'hod', 'faculty']}>
                <FacultyResearch />
              </ProtectedRoute>
            }
          />
          <Route
            path="/placements"
            element={
              <ProtectedRoute roles={['iqac_admin', 'hod']}>
                <Placements />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute roles={['iqac_admin', 'hod']}>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <ProtectedRoute roles={['iqac_admin']}>
                <Documents />
              </ProtectedRoute>
            }
          />
          <Route
            path="/achievements"
            element={
              <ProtectedRoute roles={['iqac_admin', 'hod']}>
                <Achievements />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events"
            element={
              <ProtectedRoute roles={['iqac_admin', 'hod']}>
                <Events />
              </ProtectedRoute>
            }
          />
          <Route
            path="/nba"
            element={
              <ProtectedRoute roles={['iqac_admin', 'hod']}>
                <NBA />
              </ProtectedRoute>
            }
          />
          <Route
            path="/naac"
            element={
              <ProtectedRoute roles={['iqac_admin', 'hod']}>
                <NAAC />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff-dashboard"
            element={
              <ProtectedRoute roles={['staff', 'iqac_admin']}>
                <Overview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff-dashboard/students"
            element={
              <ProtectedRoute roles={['staff', 'iqac_admin']}>
                <StudentRecords />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff-dashboard/departments"
            element={
              <ProtectedRoute roles={['staff', 'iqac_admin']}>
                <StaffDepartments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff-dashboard/departments/:departmentId"
            element={
              <ProtectedRoute roles={['staff', 'iqac_admin']}>
                <DepartmentDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff-dashboard/reports"
            element={
              <ProtectedRoute roles={['staff', 'iqac_admin']}>
                <StaffReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff-dashboard/documents"
            element={
              <ProtectedRoute roles={['staff', 'iqac_admin']}>
                <StaffDocuments />
              </ProtectedRoute>
            }
          />
          <Route path="/staff-dashboard/documentation" element={<Navigate to="/staff-dashboard/documents" replace />} />
          <Route path="/staff-dashboard/users" element={<Navigate to="/staff-dashboard" replace />} />
          <Route path="/staff-dashboard/faculty" element={<Navigate to="/staff-dashboard" replace />} />
          <Route path="/staff-dashboard/analytics" element={<Navigate to="/staff-dashboard" replace />} />
        </Route>

        <Route path="/admin-dashboard" element={<Navigate to="/dashboard" replace />} />
        <Route path="/hod-dashboard" element={<Navigate to="/dashboard" replace />} />
        <Route path="/faculty-dashboard" element={<Navigate to={FACULTY_WORKSPACE_ROUTES.root} replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

