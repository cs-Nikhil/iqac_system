const router = require("express").Router();

const {
  getStudents,
  getStudentPerformanceDistribution,
  getStudentById,
  createStudent,
  updateStudent,
  getAtRiskStudents,
} = require("../controllers/student.controller");

const { getStudentDashboard } = require("../controllers/studentDashboard.controller");

const { protect } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorizeRoles');

// All routes require login
router.use(protect);

// Student self dashboard
router.get(
  "/dashboard",
  authorizeRoles("student"),
  getStudentDashboard
);

// At-risk students (for IQAC and HOD)
router.get(
  "/at-risk",
  authorizeRoles("iqac_admin", "hod"),
  getAtRiskStudents
);

router.get(
  "/performance",
  authorizeRoles("iqac_admin", "hod", "faculty"),
  getStudentPerformanceDistribution
);

// List students
router.get(
  "/",
  authorizeRoles("iqac_admin", "hod", "faculty"),
  getStudents
);

// Get student by ID
router.get(
  "/:id",
  authorizeRoles("iqac_admin", "hod", "faculty", "staff"),
  getStudentById
);

// Create student
router.post(
  "/",
  authorizeRoles("iqac_admin", "hod"),
  createStudent
);

// Update student
router.put(
  "/:id",
  authorizeRoles("iqac_admin", "hod"),
  updateStudent
);

module.exports = router;
