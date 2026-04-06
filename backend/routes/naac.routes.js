const router = require("express").Router();

const { protect } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorizeRoles');

const {
  getNAACCriteria,
  createNAACCriterium,
  updateNAACCriterium,
  addDataPoint,
  uploadDocument,
  addReview,
  getNAACDashboard,
} = require("../controllers/naac.controller");

// All NAAC routes require authentication
router.use(protect);

// Get NAAC criteria
router.get(
  "/criteria",
  authorizeRoles("iqac_admin", "faculty", "hod"),
  getNAACCriteria
);

// NAAC dashboard
router.get(
  "/dashboard",
  authorizeRoles("iqac_admin", "hod"),
  getNAACDashboard
);

// Create NAAC criterion
router.post(
  "/criteria",
  authorizeRoles("iqac_admin"),
  createNAACCriterium
);

// Update NAAC criterion
router.put(
  "/criteria/:id",
  authorizeRoles("iqac_admin"),
  updateNAACCriterium
);

// Add data point
router.post(
  "/criteria/:id/datapoints",
  authorizeRoles("iqac_admin"),
  addDataPoint
);

// Upload supporting document
router.post(
  "/criteria/:id/documents",
  authorizeRoles("iqac_admin"),
  uploadDocument
);

// Add review
router.post(
  "/criteria/:id/review",
  authorizeRoles("faculty", "hod"),
  addReview
);

module.exports = router;
