import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';

const ProtectedRoute = ({ children, roles = [] }) => {
  const { user } = useAuth();
  const storedUser = authService.getCurrentUser();
  const activeUser =
    storedUser?.role && storedUser?.email !== user?.email
      ? storedUser
      : user || storedUser;
  const isAuthenticated = Boolean(activeUser);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles.length > 0 && !roles.includes(activeUser?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;

