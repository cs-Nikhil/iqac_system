import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { normalizeRole } from '../utils/roles';

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

  const normalizedUserRole = normalizeRole(activeUser?.role);
  const normalizedRoles = roles.map(normalizeRole).filter(Boolean);

  if (normalizedRoles.length > 0 && !normalizedRoles.includes(normalizedUserRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;

