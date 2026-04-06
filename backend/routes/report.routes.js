
const router = require("express").Router();

const { protect } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/authorizeRoles");

const {
  generateAQARReport,
  generateStudentProgressReport,
  generateDepartmentPerformanceReport,
  generateFacultyResearchReport,
  generateStudentProgressCSV,
  getInstitutionReport,
  generateDepartmentRankingReport,
  generatePlacementStatsReport,
} = require("../controllers/report.controller");


// All report routes require authentication
router.use(protect);

// ----------------------------
// AQAR Report (NAAC)
// ----------------------------
router.get(
  "/aqar",
  authorizeRoles("iqac_admin", "hod"),
  async (req, res) => {
    try {
      await generateAQARReport(res, req.query);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to generate report: " + error.message
      });
    }
  }
);

// ----------------------------
// Student Progress Report (PDF)
// ----------------------------
router.get(
  "/student-progress",
  authorizeRoles("iqac_admin", "hod", "staff"),
  async (req, res) => {
    try {
      await generateStudentProgressReport(res, req.query);
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          "Failed to generate student progress report: " + error.message
      });
    }
  }
);

// ----------------------------
// Department Performance Report (PDF)
// ----------------------------
router.get(
  "/department-performance",
  authorizeRoles("iqac_admin", "hod", "staff"),
  async (req, res) => {
    try {
      await generateDepartmentPerformanceReport(res, req.query);
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          "Failed to generate department performance report: " +
          error.message
      });
    }
  }
);

// ----------------------------
// Faculty Research Report (PDF)
// ----------------------------
router.get(
  "/faculty-research",
  authorizeRoles("iqac_admin", "hod", "staff"),
  async (req, res) => {
    try {
      await generateFacultyResearchReport(res, req.query);
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          "Failed to generate faculty research report: " + error.message
      });
    }
  }
);

// ----------------------------
// Student Progress Report (CSV)
// ----------------------------
router.get(
  "/student-progress-csv",
  authorizeRoles("iqac_admin", "hod", "staff"),
  async (req, res) => {
    try {
      await generateStudentProgressCSV(res, req.query);
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          "Failed to generate student progress CSV: " + error.message
      });
    }
  }
);

// ----------------------------
// Institutional Report
// ----------------------------
router.get(
  "/institution",
  authorizeRoles("iqac_admin", "hod"),
  async (req, res) => {
    try {
      await getInstitutionReport(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          "Failed to generate institutional report: " + error.message
      });
    }
  }
);

// ----------------------------
// NAAC SSR Report
// ----------------------------
router.get(
  "/naac",
  authorizeRoles("iqac_admin"),
  async (req, res) => {
    try {
      const AccreditationService = require("../services/accreditation.service");

      const report = await AccreditationService.getNAACReport();

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// ----------------------------
// NBA Department Report
// ----------------------------
router.get(
  "/nba",
  authorizeRoles("iqac_admin"),
  async (req, res) => {
    try {
      const { department } = req.query;

      const AccreditationService = require("../services/accreditation.service");

      const report = await AccreditationService.getNBAReport(department);

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// ----------------------------
// Department Ranking Report (PDF)
// ----------------------------
router.get(
  "/department-ranking",
  authorizeRoles("iqac_admin", "hod"),
  async (req, res) => {
    try {
      await generateDepartmentRankingReport(res, req.query);
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to generate department ranking report: " + error.message });
    }
  }
);

// ----------------------------
// Placement Statistics Report (PDF)
// ----------------------------
router.get(
  "/placement-stats",
  authorizeRoles("iqac_admin", "hod"),
  async (req, res) => {
    try {
      await generatePlacementStatsReport(res, req.query);
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to generate placement stats report: " + error.message });
    }
  }
);

module.exports = router;
