const router = require("express").Router();

const {
  getPassPercentage,
  getPlacementAnalytics,
  getAttendanceAnalytics,
  getResearchAnalytics,
  getDepartmentRanking,
  getCGPATrend,
  getDashboardKPIs,
  getDashboardTrends,
} = require("../controllers/analytics.controller");

const { getDepartmentDashboard } = require("../controllers/dashboard.controller");

const { protect } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorizeRoles');

// All analytics routes require authentication
router.use(protect);

// Dashboard KPIs (IQAC Head + HOD)
router.get(
  "/kpis",
  authorizeRoles("iqac_admin", "hod"),
  getDashboardKPIs
);

router.get(
  "/dashboard-trends",
  authorizeRoles("iqac_admin", "hod"),
  getDashboardTrends
);

// Pass percentage analytics
router.get(
  "/pass-percentage",
  authorizeRoles("iqac_admin", "hod", "faculty"),
  getPassPercentage
);

// Placement analytics
router.get(
  "/placement",
  authorizeRoles("iqac_admin", "hod"),
  getPlacementAnalytics
);

// Attendance analytics
router.get(
  "/attendance",
  authorizeRoles("iqac_admin", "hod", "faculty"),
  getAttendanceAnalytics
);

// Research analytics
router.get(
  "/research",
  authorizeRoles("iqac_admin", "hod"),
  getResearchAnalytics
);

// Department ranking
router.get(
  "/department-ranking",
  authorizeRoles("iqac_admin", "hod"),
  getDepartmentRanking
);

// CGPA trend
router.get(
  "/cgpa-trend",
  authorizeRoles("iqac_admin", "hod", "faculty"),
  getCGPATrend
);

// Department dashboard
router.get(
  "/department",
  authorizeRoles("iqac_admin", "hod"),
  getDepartmentDashboard
);

module.exports = router;
