const router = require("express").Router();

const {
  getResearchPapers,
  createResearchPaper,
  getResearchStats
} = require("../controllers/research.controller");

const { protect } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorizeRoles');

// All research routes require authentication
router.use(protect);

// Research statistics (for IQAC and HOD)
router.get(
  "/stats",
  authorizeRoles("iqac_admin", "hod"),
  getResearchStats
);

// List research papers
router.get(
  "/",
  authorizeRoles("iqac_admin", "hod", "faculty"),
  getResearchPapers
);

// Upload research paper
router.post(
  "/upload",
  authorizeRoles("faculty", "hod", "iqac_admin"),
  createResearchPaper
);

module.exports = router;
