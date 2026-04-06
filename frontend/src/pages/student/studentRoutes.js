export const STUDENT_DASHBOARD_BASE = '/student-dashboard';
export const LEGACY_STUDENT_DASHBOARD_BASE = '/dashboard';

const STUDENT_ROUTE_SEGMENTS = {
  overview: 'overview',
  profileEdit: 'profile/edit',
  subjects: 'subjects',
  attendance: 'attendance',
  backlogs: 'backlogs',
  participation: 'participation',
  achievements: 'achievements',
  feedback: 'feedback',
  documents: 'documents',
  placements: 'placements',
};

const buildStudentPath = (basePath, segment) => `${basePath}/${segment}`;

export const STUDENT_ROUTES = Object.freeze({
  root: STUDENT_DASHBOARD_BASE,
  ...Object.fromEntries(
    Object.entries(STUDENT_ROUTE_SEGMENTS).map(([key, segment]) => [
      key,
      buildStudentPath(STUDENT_DASHBOARD_BASE, segment),
    ])
  ),
});

export const LEGACY_STUDENT_ROUTES = Object.freeze(
  Object.fromEntries(
    Object.entries(STUDENT_ROUTE_SEGMENTS).map(([key, segment]) => [
      key,
      buildStudentPath(LEGACY_STUDENT_DASHBOARD_BASE, segment),
    ])
  )
);
