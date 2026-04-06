const router = require("express").Router();

const { protect } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorizeRoles');

const {
  getAchievements,
  createAchievement,
  updateAchievement,
  deleteAchievement,
} = require("../controllers/achievement.controller");

// All routes require authentication
router.use(protect);

// View achievements
router.get(
  "/",
  authorizeRoles("iqac_admin", "hod", "faculty"),
  getAchievements
);

// Create achievement
router.post(
  "/",
  authorizeRoles("iqac_admin", "hod", "faculty"),
  createAchievement
);

// Update achievement
router.put(
  "/:id",
  authorizeRoles("iqac_admin", "hod"),
  updateAchievement
);

// Delete achievement
router.delete(
  "/:id",
  authorizeRoles("iqac_admin", "hod"),
  deleteAchievement
);

module.exports = router;
