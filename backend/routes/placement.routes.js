const router = require("express").Router();

const {
  getPlacements,
  createPlacement,
  getPlacementStats,
  getPlacementDrives,
  createPlacementDrive,
  updatePlacementDrive,
} = require("../controllers/placement.controller");

const { protect } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorizeRoles');
const { validateRequest } = require('../middleware/validateRequest');
const { validatePlacementDrivePayload } = require('../utils/requestValidators');

// All placement routes require authentication
router.use(protect);

// Placement statistics (IQAC and HOD only)
router.get(
  "/stats",
  authorizeRoles("iqac_admin", "hod"),
  getPlacementStats
);

router.get(
  "/drives",
  authorizeRoles("iqac_admin", "hod"),
  getPlacementDrives
);

router.post(
  "/drives",
  authorizeRoles("iqac_admin", "hod"),
  validateRequest(validatePlacementDrivePayload),
  createPlacementDrive
);

router.put(
  "/drives/:id",
  authorizeRoles("iqac_admin", "hod"),
  validateRequest(validatePlacementDrivePayload),
  updatePlacementDrive
);

// List placements
router.get(
  "/",
  authorizeRoles("iqac_admin", "hod", "faculty"),
  getPlacements
);

// Create placement record
router.post(
  "/",
  authorizeRoles("iqac_admin", "hod"),
  createPlacement
);

module.exports = router;
