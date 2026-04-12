const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Student = require("../models/Student");

const PUBLIC_ROLE = "student";
const STAFF_ROLES = ["iqac_admin", "staff", "hod", "faculty"];
const DEFAULT_STUDENT_LOGIN_PASSWORD =
  process.env.DEFAULT_STUDENT_LOGIN_PASSWORD || "Student@123";
const normalizeRole = (role) => User.normalizeRole(role);
const isSupportedRole = (role) => User.isSupportedRole(role);

// ============================
// Generate JWT Token
// ============================
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

// ============================
// Safe User Response
// ============================
const buildUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: normalizeRole(user.role),
  department: user.department,
});

// ============================
// Register Student
// ============================
// POST /api/auth/register
const register = async (req, res) => {

  try {

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required"
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: PUBLIC_ROLE
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "Student registered successfully",
      token,
      data: buildUserResponse(user)
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};

// ============================
// Create Staff Account
// ============================
// POST /api/auth/staff
const createStaffAccount = async (req, res) => {

  try {

    const { name, email, password, role, department } = req.body;

    // Role validation
    if (!STAFF_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${STAFF_ROLES.join(", ")}`
      });
    }

    if ((role === "hod" || role === "faculty") && !department) {
      return res.status(400).json({
        success: false,
        message: "Department is required for HOD and FACULTY roles"
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      department
    });

    res.status(201).json({
      success: true,
      message: "Staff account created successfully",
      data: buildUserResponse(user)
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};

// ============================
// Login
// ============================
const provisionSeededStudentUser = async ({ email, password }) => {
  if (password !== DEFAULT_STUDENT_LOGIN_PASSWORD) {
    return null;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const student = await Student.findOne({ email: normalizedEmail }).populate("department", "name code");

  if (!student) {
    return null;
  }

  if (student.user) {
    const linkedUser = await User
      .findById(student.user)
      .select("+password")
      .populate("department", "name code");

    if (linkedUser) {
      return linkedUser;
    }
  }

  const createdUser = await User.create({
    name: student.name,
    email: student.email,
    password: DEFAULT_STUDENT_LOGIN_PASSWORD,
    role: PUBLIC_ROLE
  });

  student.user = createdUser._id;
  await student.save();

  return User
    .findById(createdUser._id)
    .select("+password")
    .populate("department", "name code");
};

// ============================
// Login
// ============================
// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedRole = normalizeRole(role);

    if (!normalizedEmail || !password || !normalizedRole) {
      return res.status(400).json({
        success: false,
        message: "Email, password and role are required"
      });
    }

    if (!isSupportedRole(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role selected"
      });
    }

    let user = await User
      .findOne({ email: normalizedEmail })
      .select("+password")
      .populate("department", "name code");

    if (!user && normalizedRole === PUBLIC_ROLE) {
      user = await provisionSeededStudentUser({ email: normalizedEmail, password });
    }

    if (!user || normalizeRole(user.role) !== normalizedRole || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email, password or role"
      });
    }

    const persistedRole = String(user.role || "").trim();
    if (persistedRole && persistedRole !== normalizedRole) {
      user.role = normalizedRole;
      User.updateOne({ _id: user._id }, { $set: { role: normalizedRole } }).catch(() => {});
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated"
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: "Login successful",
      token,
      data: buildUserResponse(user)
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============================
// Get Current User
// ============================
// GET /api/auth/me
const getMe = async (req, res) => {

  try {

    const user = await User
      .findById(req.user.id)
      .populate("department", "name code");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      data: buildUserResponse(user)
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};

module.exports = {
  register,
  createStaffAccount,
  login,
  getMe
};
