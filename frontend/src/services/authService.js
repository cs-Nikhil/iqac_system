import { api } from './api';

const ROLE_ALIAS_MAP = Object.freeze({
  iqac_admin: 'iqac_admin',
  IQAC_ADMIN: 'iqac_admin',
  admin: 'iqac_admin',
  ADMIN: 'iqac_admin',
  iqac_head: 'iqac_admin',
  IQAC_HEAD: 'iqac_admin',
  staff: 'staff',
  STAFF: 'staff',
  hod: 'hod',
  HOD: 'hod',
  faculty: 'faculty',
  FACULTY: 'faculty',
  student: 'student',
  STUDENT: 'student',
});

export const normalizeRole = (role) => {
  if (!role) {
    return '';
  }

  const trimmedRole = String(role).trim();
  if (!trimmedRole) {
    return '';
  }

  const underscoredRole = trimmedRole.replace(/[\s-]+/g, '_');

  return (
    ROLE_ALIAS_MAP[trimmedRole] ||
    ROLE_ALIAS_MAP[underscoredRole] ||
    ROLE_ALIAS_MAP[underscoredRole.toLowerCase()] ||
    trimmedRole.toLowerCase()
  );
};

export const normalizeAuthUser = (user) => {
  if (!user || typeof user !== 'object') {
    return null;
  }

  const normalizedRole = normalizeRole(user.role);

  return normalizedRole
    ? {
        ...user,
        role: normalizedRole,
      }
    : { ...user };
};

// Auth services
export const authService = {
  login: async (email, password, role) => {
    const response = await api.post('/auth/login', { email, password, role });
    if (response.data.success) {
      const user = normalizeAuthUser(response.data.data);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(user));
      response.data.data = user;
    }
    return response.data;
  },

  register: async (name, email, password) => {
    const response = await api.post('/auth/register', { name, email, password });
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getCurrentUser: () => {
    try {
      const user = localStorage.getItem('user');
      return user ? normalizeAuthUser(JSON.parse(user)) : null;
    } catch {
      localStorage.removeItem('user');
      return null;
    }
  },

  getToken: () => {
    return localStorage.getItem('token');
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },
};

export default api;
