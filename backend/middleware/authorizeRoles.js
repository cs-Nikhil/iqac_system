/**
 * Role-based access control middleware
 * Usage:
 * authorizeRoles("IQAC_HEAD", "HOD")
 * authorizeRoles("FACULTY")
 */

const authorizeRoles = (...allowedRoles) => {

  return (req, res, next) => {

    // Ensure user exists
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Check role permission
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Role '${req.user.role}' is not allowed`
      });
    }

    next();

  };

};

module.exports = { authorizeRoles };