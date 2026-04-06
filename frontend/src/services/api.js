import axios from 'axios';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://iqac-system.onrender.com').replace(/\/$/, '');
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, '');

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

const mapResponse = (response, mapper) => ({
  ...response,
  data: mapper(response.data),
});

const withPagination = (payload = {}, listKey, fallbackKey = 'data') => ({
  ...payload,
  [listKey]: payload[listKey] ?? payload[fallbackKey] ?? [],
  total:
    payload.total ??
    payload.count ??
    payload.pagination?.total ??
    0,
  page: payload.page ?? payload.pagination?.page ?? 1,
  pages: payload.pages ?? payload.pagination?.pages ?? 1,
});

const toAcademicYearValue = (value) => {
  if (value == null || value === '') {
    return value;
  }

  const normalized = String(value).trim();

  if (/^\d{4}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  if (/^\d{4}$/.test(normalized)) {
    const startYear = Number(normalized);
    return `${normalized}-${String((startYear + 1) % 100).padStart(2, '0')}`;
  }

  return normalized;
};

const normalizeAcademicYearParams = (params = {}) => {
  const normalizedParams = { ...params };

  if (normalizedParams.year && !normalizedParams.academicYear) {
    normalizedParams.academicYear = toAcademicYearValue(normalizedParams.year);
  }

  delete normalizedParams.year;

  return normalizedParams;
};

const normalizeDepartmentParams = (params = {}) => {
  const normalizedParams = { ...params };

  if (normalizedParams.department && !normalizedParams.departmentId) {
    normalizedParams.departmentId = normalizedParams.department;
  }

  delete normalizedParams.department;

  return normalizedParams;
};

const normalizeAnalyticsParams = (params = {}) =>
  normalizeDepartmentParams(normalizeAcademicYearParams(params));

const normalizeResearchParams = (params = {}) => {
  const normalizedParams = { ...params };

  if (normalizedParams.academicYear && !normalizedParams.year) {
    const startYear = parseInt(String(normalizedParams.academicYear).slice(0, 4), 10);
    normalizedParams.year = Number.isFinite(startYear) ? startYear : normalizedParams.academicYear;
  }

  delete normalizedParams.academicYear;

  return normalizedParams;
};

export const studentsAPI = {
  getAll: (params) =>
    api
      .get('/students', { params })
      .then((response) =>
        mapResponse(response, (data) => withPagination(data, 'students'))
      ),

  getById: (id) => api.get(`/students/${id}`),

  atRisk: () =>
    api
      .get('/students/at-risk')
      .then((response) =>
        mapResponse(response, (data) => ({
          ...data,
          students: data.students ?? data.data ?? [],
          total: data.count ?? data.data?.length ?? 0,
        }))
      ),

  performance: (params) =>
    api
      .get('/students/performance', { params })
      .then((response) =>
        mapResponse(response, (data) => ({
          ...data,
          distribution: data.distribution ?? data.data ?? {},
        }))
      ),

  dashboard: () => api.get('/students/dashboard'),
};

export const facultyAPI = {
  getAll: (params) =>
    api
      .get('/faculty', { params })
      .then((response) =>
        mapResponse(response, (data) => withPagination(data, 'faculty'))
      ),

  getWorkspace: (params) =>
    api.get('/faculty/workspace', {
      params: normalizeAcademicYearParams(params),
    }),

  getById: (id) => api.get(`/faculty/${id}`),
};

export const departmentsAPI = {
  getAll: () =>
    api
      .get('/departments')
      .then((response) =>
        mapResponse(response, (data) => ({
          ...data,
          departments: data.departments ?? data.data ?? [],
        }))
      ),

  getSummary: (params) => api.get('/departments/summary', { params }),

  getById: (id) => api.get(`/departments/${id}`),
};

export const analyticsAPI = {
  kpis: () =>
    api
      .get('/analytics/kpis')
      .then((response) =>
        mapResponse(response, (data) => ({
          ...data,
          kpis: data.kpis ?? data.data ?? {},
        }))
      ),

  passPercentage: (params) =>
    api.get('/analytics/pass-percentage', {
      params: normalizeAcademicYearParams(params),
    }),

  placement: (params) =>
    api.get('/analytics/placement', {
      params: normalizeAcademicYearParams(params),
    }),

  attendance: (params) =>
    api.get('/analytics/attendance', {
      params: normalizeAcademicYearParams(params),
    }),

  dashboardTrends: (params) =>
    api.get('/analytics/dashboard-trends', {
      params: normalizeAcademicYearParams(params),
    }),

  research: (params) =>
    api.get('/analytics/research', {
      params: normalizeAcademicYearParams(params),
    }),

  cgpaTrend: (params) => {
    const normalizedParams = normalizeAnalyticsParams(params);
    return api.get('/analytics/cgpa-trend', { params: normalizedParams });
  },

  departmentRanking: (params) =>
    api.get('/analytics/department-ranking', {
      params: normalizeAcademicYearParams(params),
    }),

  department: (params) =>
    api.get('/analytics/department', {
      params: normalizeAnalyticsParams(params),
    }),
};

export const enhancedAnalyticsAPI = {
  backlogAnalysis: (params) =>
    api.get('/analytics/backlog-analysis', {
      params: normalizeAnalyticsParams(params),
    }),

  subjectWisePass: (params) =>
    api.get('/analytics/subject-wise-pass', {
      params: normalizeAcademicYearParams(params),
    }),

  cgpaDistribution: (params) => {
    const normalizedParams = normalizeAnalyticsParams(params);
    return api.get('/analytics/cgpa-distribution', { params: normalizedParams });
  },

  studentPerformance: (studentId) =>
    api.get(`/analytics/student-performance/${studentId}`),
};

export const placementsAPI = {
  getAll: (params) =>
    api.get('/placements', {
      params: normalizeAcademicYearParams(params),
    }),

  stats: (params) =>
    api.get('/placements/stats', {
      params: normalizeAcademicYearParams(params),
    }),

  getDrives: (params) =>
    api
      .get('/placements/drives', {
        params: normalizeAcademicYearParams(params),
      })
      .then((response) =>
        mapResponse(response, (data) => ({
          ...data,
          drives: data.data?.drives ?? data.drives ?? [],
          summary: data.data?.summary ?? data.summary ?? {},
          total: data.data?.total ?? data.total ?? 0,
        }))
      ),

  createDrive: (payload) => api.post('/placements/drives', payload),

  updateDrive: (id, payload) => api.put(`/placements/drives/${id}`, payload),
};

export const reportsAPI = {
  downloadAQAR: (params) =>
    api.get('/reports/aqar', {
      params: normalizeAcademicYearParams(params),
      responseType: 'blob',
    }),

  downloadDepartmentRanking: (params) =>
    api.get('/reports/department-ranking', {
      params: normalizeAcademicYearParams(params),
      responseType: 'blob',
    }),

  downloadPlacementStats: (params) =>
    api.get('/reports/placement-stats', {
      params: normalizeAcademicYearParams(params),
      responseType: 'blob',
    }),
};

export const documentsAPI = {
  getAll: (params) =>
    api
      .get('/documents', { params })
      .then((response) =>
        mapResponse(response, (data) => ({
          ...data,
          documents: data.documents ?? data.data ?? [],
        }))
      ),

  getStats: () =>
    api
      .get('/documents/stats')
      .then((response) =>
        mapResponse(response, (data) => ({
          ...data,
          stats: data.stats ?? data.data ?? {},
        }))
      ),

  getById: (id) => api.get(`/documents/${id}`),

  create: (payload) =>
    api.post('/documents', payload, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),

  approve: (id) => api.post(`/documents/${id}/approve`),

  reject: (id) => api.post(`/documents/${id}/reject`),
};

export const researchAPI = {
  getAll: (params) =>
    api
      .get('/research', {
        params: normalizeResearchParams(params),
      })
      .then((response) =>
        mapResponse(response, (data) =>
          withPagination(
            {
              ...data,
              papers: data.papers ?? data.data ?? [],
            },
            'papers',
            'papers'
          )
        )
      ),

  getStats: () =>
    api
      .get('/research/stats')
      .then((response) =>
        mapResponse(response, (data) => ({
          ...data,
          stats: data.stats ?? data.data ?? {},
        }))
      ),

  create: (payload) => api.post('/research/upload', payload),
};


export const achievementsAPI = {
  getAll: (params) =>
    api
      .get('/achievements', {
        params: normalizeAcademicYearParams(params),
      })
      .then((response) =>
        mapResponse(response, (data) => withPagination(data, 'achievements'))
      ),

  create: (payload) => api.post('/achievements', payload),

  update: (id, payload) => api.put(`/achievements/${id}`, payload),

  delete: (id) => api.delete(`/achievements/${id}`),
};

export const eventsAPI = {
  getAll: (params) =>
    api
      .get('/events', { params })
      .then((response) =>
        mapResponse(response, (data) => withPagination(data, 'events'))
      ),

  create: (payload) => api.post('/events', payload),

  update: (id, payload) => api.put(`/events/${id}`, payload),

  register: (eventId, payload) =>
    api.post(`/events/${eventId}/participate`, payload),

  markAttendance: (eventId) =>
    api.post(`/events/${eventId}/attendance/mark`),

  getParticipations: (eventId, params) =>
    api
      .get(`/events/${eventId}/participations`, { params })
      .then((response) =>
        mapResponse(response, (data) =>
          withPagination(
            {
              ...data,
              participations: data.participations ?? data.data ?? [],
            },
            'participations',
            'participations'
          )
        )
      ),
};

export const notificationsAPI = {
  getAll: (params) =>
    api
      .get('/notifications', { params })
      .then((response) =>
        mapResponse(response, (data) => ({
          ...data,
          notifications: data.data?.notifications ?? data.notifications ?? [],
          unreadCount: data.data?.unreadCount ?? data.unreadCount ?? 0,
        }))
      ),

  markRead: (id) => api.post(`/notifications/${id}/read`),

  markAllRead: () => api.post('/notifications/read-all'),
};

export const nbaAPI = {
  getCriteria: (params) =>
    api
      .get('/nba/criteria', {
        params: normalizeAcademicYearParams(params),
      })
      .then((response) =>
        mapResponse(response, (data) => ({
          ...data,
          criteria: data.criteria ?? data.data ?? [],
        }))
      ),

  getDashboard: (params) =>
    api
      .get('/nba/dashboard', {
        params: normalizeAcademicYearParams(params),
      })
      .then((response) =>
        mapResponse(response, (data) => ({
          ...data,
          dashboard: data.dashboard ?? data.data ?? {},
        }))
      ),

  createCriterion: (payload) => api.post('/nba/criteria', payload),

  updateCriterion: (id, payload) => api.put(`/nba/criteria/${id}`, payload),

  addMeasurement: (id, payload) =>
    api.post(`/nba/criteria/${id}/measurements`, payload),
};

export const naacAPI = {
  getCriteria: (params) =>
    api
      .get('/naac/criteria', {
        params: normalizeAcademicYearParams(params),
      })
      .then((response) =>
        mapResponse(response, (data) => ({
          ...data,
          criteria: data.criteria ?? data.data ?? [],
        }))
      ),

  getDashboard: (params) =>
    api
      .get('/naac/dashboard', {
        params: normalizeAcademicYearParams(params),
      })
      .then((response) =>
        mapResponse(response, (data) => ({
          ...data,
          dashboard: data.dashboard ?? data.data ?? {},
        }))
      ),

  createCriterion: (payload) => api.post('/naac/criteria', payload),

  updateCriterion: (id, payload) => api.put(`/naac/criteria/${id}`, payload),

  addDataPoint: (id, payload) => api.post(`/naac/criteria/${id}/datapoints`, payload),

  addReview: (id, payload) => api.post(`/naac/criteria/${id}/review`, payload),
};

export const adminAPI = {
  resetUserPassword: (id, payload) =>
    api.put(`/admin/users/${id}/reset-password`, payload),
};

export const chatbotAPI = {
  chat: (messageOrPayload, extra = {}) =>
    api.post(
      '/chatbot',
      typeof messageOrPayload === 'string'
        ? { message: messageOrPayload, ...extra }
        : (messageOrPayload || {})
    ),
  planQuery: (message) =>
    api.post('/chatbot', { message, mode: 'query_plan' }),
  routeQuery: (message) =>
    api.post('/chatbot', { message, mode: 'query_routing' }),
  extractQueryParameters: (message) =>
    api.post('/chatbot', { message, mode: 'query_parameters' }),
  understandQuery: (message) =>
    api.post('/chatbot', { message, mode: 'query_understanding' }),
  planReport: (message) =>
    api.post('/chatbot', { message, mode: 'report_plan' }),
  exportReport: (messageOrPayload, format) =>
    api.post(
      '/chatbot/export',
      typeof messageOrPayload === 'string'
        ? { message: messageOrPayload, format }
        : { ...(messageOrPayload || {}), ...(format ? { format } : {}) },
      { responseType: 'blob' }
    ),
  exportInsight: (payload) =>
    api.post('/chatbot/export-insight', payload, {
      responseType: 'blob',
    }),
};

export const staffAPI = {
  getAnalytics: (params) =>
    api.get('/staff/analytics', {
      params: normalizeAcademicYearParams(params),
    }),

  getUsers: (params) =>
    api
      .get('/staff/users', { params })
      .then((response) =>
        mapResponse(response, (data) => {
          const payload = data.data || {};
          return {
            ...payload,
            users: payload.users ?? [],
            total: payload.pagination?.total ?? 0,
            page: payload.pagination?.page ?? 1,
            pages: payload.pagination?.pages ?? 1,
          };
        })
      ),

  getUserById: (id) => api.get(`/staff/users/${id}`),

  createUser: (payload) => api.post('/staff/users/create', payload),

  updateUser: (id, payload) => api.put(`/staff/users/${id}`, payload),

  disableUser: (id) => api.patch(`/staff/users/${id}/disable`),

  getStudents: (params) =>
    api
      .get('/staff/students', { params })
      .then((response) =>
        mapResponse(response, (data) => {
          const payload = data.data || {};
          return {
            ...payload,
            students: payload.students ?? [],
            total: payload.pagination?.total ?? 0,
            page: payload.pagination?.page ?? 1,
            pages: payload.pagination?.pages ?? 1,
          };
        })
      ),

  updateStudent: (id, payload) => api.put(`/staff/students/${id}`, payload),

  getFaculty: (params) =>
    api
      .get('/staff/faculty', { params })
      .then((response) =>
        mapResponse(response, (data) => {
          const payload = data.data || {};
          return {
            ...payload,
            faculty: payload.faculty ?? [],
            total: payload.pagination?.total ?? 0,
            page: payload.pagination?.page ?? 1,
            pages: payload.pagination?.pages ?? 1,
          };
        })
      ),

  updateFaculty: (id, payload) => api.put(`/staff/faculty/${id}`, payload),

  getDepartments: () =>
    api
      .get('/staff/departments')
      .then((response) =>
        mapResponse(response, (data) => ({
          departments: data.data ?? [],
        }))
      ),

  getDepartmentDetails: (id, params) =>
    api.get(`/staff/departments/${id}/details`, {
      params: normalizeAcademicYearParams(params),
    }),

  updateDepartment: (id, payload) =>
    api.put(`/staff/departments/${id}`, payload),

  getDocuments: (params) =>
    api
      .get('/staff/documents', { params })
      .then((response) =>
        mapResponse(response, (data) => {
          const payload = data.data || {};
          return {
            ...payload,
            documents: payload.documents ?? [],
            total: payload.pagination?.total ?? 0,
            page: payload.pagination?.page ?? 1,
            pages: payload.pagination?.pages ?? 1,
          };
        })
      ),

  uploadDocument: (payload) =>
    api.post('/staff/documents/upload', payload, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),

  getReports: () =>
    api
      .get('/staff/reports')
      .then((response) =>
        mapResponse(response, (data) => ({
          reports: data.data ?? [],
        }))
      ),

  getDepartmentReport: (params) =>
    api.get('/staff/reports/department', {
      params: normalizeAcademicYearParams(params),
    }),

  getStudentPerformanceReport: (params) =>
    api.get('/staff/reports/student-performance', {
      params: normalizeAcademicYearParams(params),
    }),

  getBacklogReport: (params) =>
    api.get('/staff/reports/backlog', {
      params: normalizeAcademicYearParams(params),
    }),

  getFacultyWorkloadReport: (params) =>
    api.get('/staff/reports/faculty-workload', {
      params: normalizeAcademicYearParams(params),
    }),

  exportDepartmentReport: (params) =>
    api.get('/staff/reports/department', {
      params: {
        ...normalizeAcademicYearParams(params),
        format: params?.format || 'pdf',
      },
      responseType: 'blob',
    }),

  exportStudentPerformanceReport: (params) =>
    api.get('/staff/reports/student-performance', {
      params: normalizeAcademicYearParams(params),
      responseType: 'blob',
    }),

  exportBacklogReport: (params) =>
    api.get('/staff/reports/backlog', {
      params: {
        ...normalizeAcademicYearParams(params),
        format: params?.format || 'csv',
      },
      responseType: 'blob',
    }),

  exportFacultyWorkloadReport: (params) =>
    api.get('/staff/reports/faculty-workload', {
      params: normalizeAcademicYearParams(params),
      responseType: 'blob',
    }),
};

export const studentPortalAPI = {
  getProfile: () => api.get('/student/profile'),

  updateProfile: (payload) => api.put('/student/profile', payload),

  getAcademicProgress: () => api.get('/student/academic-progress'),

  getSubjectsPerformance: (sem) =>
    api.get('/student/subjects', {
      params: { sem },
    }),

  getAttendance: () => api.get('/student/attendance'),

  getBacklogs: () => api.get('/student/backlogs'),

  getParticipationHub: () => api.get('/student/participation'),

  getAchievements: () => api.get('/student/achievements'),

  createAchievement: (payload) =>
    api.post('/student/achievements', payload, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),

  getFeedback: () => api.get('/student/feedback'),

  createFeedback: (payload) => api.post('/student/feedback', payload),

  getDocuments: () => api.get('/student/documents'),

  createDocument: (payload) =>
    api.post('/student/documents', payload, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),

  getPlacements: () => api.get('/student/placements'),

  applyToPlacement: (payload) =>
    api.post('/student/placements/apply', payload, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
};

export default api;
