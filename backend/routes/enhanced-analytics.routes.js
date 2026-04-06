const router = require("express").Router();

const { protect } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorizeRoles');

const {
  getBacklogAnalysis,
  getSubjectWisePassPercentage,
  getCGPADistribution,
  getStudentPerformanceTrend,
  getFacultyAchievementsAnalytics,
  getStudentParticipationStats,
  getStudentProgressReport,
  getDepartmentComprehensiveReport,
  getPredictiveRiskAnalysis,
} = require("../controllers/enhanced-analytics.controller");

// All enhanced analytics require authentication
router.use(protect);

// Backlog analysis
router.get(
  "/backlog-analysis",
  authorizeRoles("faculty", "hod"),
  getBacklogAnalysis
);

// Subject pass percentage
router.get(
  "/subject-wise-pass",
  authorizeRoles("iqac_admin", "hod", "faculty"),
  getSubjectWisePassPercentage
);

// CGPA distribution
router.get(
  "/cgpa-distribution",
  authorizeRoles("iqac_admin", "faculty", "hod"),
  getCGPADistribution
);

// Student performance trend
router.get(
  "/student-performance/:studentId",
  authorizeRoles("iqac_admin", "hod", "faculty"),
  getStudentPerformanceTrend
);

// Faculty achievements analytics
router.get(
  "/faculty-achievements",
  authorizeRoles("faculty", "hod"),
  getFacultyAchievementsAnalytics
);

// Student participation statistics
router.get(
  "/student-participation",
  authorizeRoles("faculty", "hod"),
  getStudentParticipationStats
);

// Student progress report
router.get(
  "/student-progress/:studentId",
  authorizeRoles("iqac_admin", "hod", "faculty"),
  getStudentProgressReport
);

// Department comprehensive report
router.get(
  "/department-comprehensive/:departmentId",
  authorizeRoles("iqac_admin"),
  getDepartmentComprehensiveReport
);

// Predictive risk analysis
router.get(
  "/predictive-risk",
  authorizeRoles("iqac_admin"),
  getPredictiveRiskAnalysis
);

module.exports = router;
