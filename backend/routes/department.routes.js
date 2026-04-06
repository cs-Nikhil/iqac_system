const router = require("express").Router();

const {
  getDepartments,
  getDepartmentById,
  getDepartmentSummary,
  createDepartment,
  updateDepartment
} = require("../controllers/department.controller");

const { protect } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorizeRoles');

// All routes require authentication
router.use(protect);

// Get all departments
router.get(
  "/",
  authorizeRoles("iqac_admin", "hod", "faculty"),
  getDepartments
);

router.get(
  "/summary",
  authorizeRoles("iqac_admin", "hod"),
  getDepartmentSummary
);

// Get department by ID
router.get(
  "/:id",
  authorizeRoles("iqac_admin", "hod", "faculty"),
  getDepartmentById
);

// Create department
router.post(
  "/",
  authorizeRoles("iqac_admin"),
  createDepartment
);

// Update department
router.put(
  "/:id",
  authorizeRoles("iqac_admin"),
  updateDepartment
);

module.exports = router;
