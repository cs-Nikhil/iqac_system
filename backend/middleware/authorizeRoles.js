const { normalizeRole } = require("../utils/roles");

/**
 * Role-based access control middleware
 * Usage:
 * authorizeRoles("IQAC_HEAD", "HOD")
 * authorizeRoles("FACULTY")
 */

const authorizeRoles = (...allowedRoles) => {
  const normalizedAllowedRoles = allowedRoles.map(normalizeRole);

  return (req, res, next) => {

    // Ensure user exists
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Check role permission
    const normalizedUserRole = normalizeRole(req.user.role);

    if (normalizedUserRole) {
      req.user.role = normalizedUserRole;
    }

    if (!normalizedAllowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Role '${req.user.role}' is not allowed`
      });
    }

    next();

  };

};

module.exports = { authorizeRoles };
