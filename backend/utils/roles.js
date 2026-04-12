const CANONICAL_ROLES = Object.freeze([
  "iqac_admin",
  "staff",
  "hod",
  "faculty",
  "student",
]);

const ROLE_ALIAS_MAP = Object.freeze({
  iqac_admin: "iqac_admin",
  IQAC_ADMIN: "iqac_admin",
  admin: "iqac_admin",
  ADMIN: "iqac_admin",
  iqac_head: "iqac_admin",
  IQAC_HEAD: "iqac_admin",
  staff: "staff",
  STAFF: "staff",
  hod: "hod",
  HOD: "hod",
  faculty: "faculty",
  FACULTY: "faculty",
  student: "student",
  STUDENT: "student",
});

const normalizeRole = (role) => {
  if (!role) {
    return "";
  }

  const trimmedRole = String(role).trim();
  if (!trimmedRole) {
    return "";
  }

  const underscoredRole = trimmedRole.replace(/[\s-]+/g, "_");

  return (
    ROLE_ALIAS_MAP[trimmedRole] ||
    ROLE_ALIAS_MAP[underscoredRole] ||
    ROLE_ALIAS_MAP[underscoredRole.toLowerCase()] ||
    trimmedRole.toLowerCase()
  );
};

const getRoleAliases = (role) => {
  const normalizedRole = normalizeRole(role);

  switch (normalizedRole) {
    case "iqac_admin":
      return ["iqac_admin", "IQAC_ADMIN", "admin", "ADMIN", "iqac_head", "IQAC_HEAD"];
    case "staff":
      return ["staff", "STAFF"];
    case "hod":
      return ["hod", "HOD"];
    case "faculty":
      return ["faculty", "FACULTY"];
    case "student":
      return ["student", "STUDENT"];
    default:
      return normalizedRole ? [normalizedRole, role].filter(Boolean) : [];
  }
};

const isSupportedRole = (role) => CANONICAL_ROLES.includes(normalizeRole(role));

module.exports = {
  CANONICAL_ROLES,
  getRoleAliases,
  isSupportedRole,
  normalizeRole,
};
