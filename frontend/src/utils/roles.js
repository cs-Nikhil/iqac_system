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
