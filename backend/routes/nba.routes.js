const router = require("express").Router();

const { protect } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorizeRoles');

const {
  getNBACriteria,
  createNBACriterion,
  updateNBACriterion,
  addMeasurement,
  getNBADashboard,
} = require("../controllers/nba.controller");

// All NBA routes require authentication
router.use(protect);

// Get NBA criteria
router.get(
  "/criteria",
  authorizeRoles("iqac_admin", "hod"),
  getNBACriteria
);

// NBA dashboard (institution level)
router.get(
  "/dashboard",
  authorizeRoles("iqac_admin"),
  getNBADashboard
);

// Create criterion
router.post(
  "/criteria",
  authorizeRoles("iqac_admin", "hod"),
  createNBACriterion
);

// Update criterion
router.put(
  "/criteria/:id",
  authorizeRoles("iqac_admin", "hod"),
  updateNBACriterion
);

// Add measurements
router.post(
  "/criteria/:id/measurements",
  authorizeRoles("iqac_admin", "hod"),
  addMeasurement
);

module.exports = router;
