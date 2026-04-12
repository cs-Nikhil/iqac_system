const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { normalizeRole } = require("../utils/roles");

const protect = async (req, res, next) => {
  try {

    let token;

    // =========================
    // Extract token
    // =========================
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Token missing."
      });
    }

    // =========================
    // Verify token
    // =========================
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // =========================
    // Find user
    // =========================
    const user = await User
      .findById(decoded.id)
      .select("-password")
      .populate("department", "name code");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists"
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated"
      });
    }

    const normalizedRole = normalizeRole(user.role);
    if (normalizedRole) {
      if (user.role !== normalizedRole) {
        User.updateOne({ _id: user._id }, { $set: { role: normalizedRole } }).catch(() => {});
      }
      user.role = normalizedRole;
    }

    // =========================
    // Attach user to request
    // =========================
    req.user = user;

    // Optional helper IDs for controllers
    switch (user.role) {

      case "student":
        req.user.studentId = user._id;
        break;

      case "faculty":
        req.user.facultyId = user._id;
        break;

      case "hod":
        req.user.facultyId = user._id;
        break;

      default:
        break;
    }

    next();

  } catch (error) {

    let message = "Authentication failed";

    if (error.name === "TokenExpiredError") {
      message = "Session expired. Please login again.";
    }

    if (error.name === "JsonWebTokenError") {
      message = "Invalid authentication token";
    }

    return res.status(401).json({
      success: false,
      message
    });

  }
};

module.exports = { protect };
