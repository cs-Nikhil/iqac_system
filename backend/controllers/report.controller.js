
const Placement = require("../models/Placement");
const ResearchPaper = require("../models/ResearchPaper");
const Marks = require("../models/Marks");
const Student = require("../models/Student");
const Event = require("../models/Event");

const reportService = require("../services/report.service");

// ============================
// Institutional Report
// ============================
const getInstitutionReport = async (req, res) => {
  try {
    const { academicYear } = req.query;

    const studentFilter = { isActive: true };
    const placementFilter = {};
    const marksFilter = {};

    if (academicYear) {
      placementFilter.academicYear = academicYear;
      marksFilter.academicYear = academicYear;
    }

    const [
      totalStudents,
      passStats,
      totalPlacements,
      researchOutput,
      eventParticipation
    ] = await Promise.all([
      Student.countDocuments(studentFilter),

      Marks.aggregate([
        { $match: marksFilter },
        {
          $group: {
            _id: null,
            totalSubjects: { $sum: 1 },
            passedSubjects: {
              $sum: {
                $cond: [{ $eq: ["$result", "PASS"] }, 1, 0]
              }
            },
            avgMarks: { $avg: "$total" }
          }
        },
        {
          $project: {
            passPercentage: {
              $round: [
                { $multiply: [{ $divide: ["$passedSubjects", "$totalSubjects"] }, 100] },
                2
              ]
            },
            avgMarks: { $round: ["$avgMarks", 2] }
          }
        }
      ]).then(r => r[0] || { passPercentage: 0, avgMarks: 0 }),

      Placement.countDocuments(placementFilter),

      ResearchPaper.countDocuments(),

      Event.aggregate([
        {
          $unwind: {
            path: "$participations",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $group: {
            _id: null,
            totalParticipations: { $sum: 1 }
          }
        }
      ]).then(r => r[0]?.totalParticipations || 0)
    ]);

    const placementRate =
      totalStudents > 0
        ? Math.round((totalPlacements / totalStudents) * 100)
        : 0;

    const report = {
      timestamp: new Date().toISOString(),
      metrics: {
        totalStudents,
        overallPassPercentage: passStats.passPercentage,
        avgMarks: passStats.avgMarks,
        placementStats: {
          totalPlacements,
          placementRate
        },
        researchOutput,
        eventParticipationMetrics: {
          totalParticipations: eventParticipation
        }
      }
    };

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate institutional report: " + error.message
    });
  }
};

// ============================
// AQAR Report
// ============================
const generateAQARReport = async (res, filters) => {
  await reportService.generateAQARReport(res, filters);
};

// ============================
// Student Progress Report
// ============================
const generateStudentProgressReport = async (res, filters) => {
  await reportService.generateStudentProgressReport(res, filters);
};

// ============================
// Department Performance Report
// ============================
const generateDepartmentPerformanceReport = async (res, filters) => {
  await reportService.generateDepartmentPerformanceReport(res, filters);
};

// ============================
// Faculty Research Report
// ============================
const generateFacultyResearchReport = async (res, filters) => {
  await reportService.generateFacultyResearchReport(res, filters);
};

// ============================
// Student Progress CSV
// ============================
const generateStudentProgressCSV = async (res, filters) => {
  await reportService.generateStudentProgressCSV(res, filters);
};

// ============================
// Department Ranking Report
// ============================
const generateDepartmentRankingReport = async (res, filters) => {
  await reportService.generateDepartmentRankingReport(res, filters);
};

// ============================
// Placement Stats Report
// ============================
const generatePlacementStatsReport = async (res, filters) => {
  await reportService.generatePlacementStatsReport(res, filters);
};

module.exports = {
  getInstitutionReport,
  generateAQARReport,
  generateStudentProgressReport,
  generateDepartmentPerformanceReport,
  generateFacultyResearchReport,
  generateStudentProgressCSV,
  generateDepartmentRankingReport,
  generatePlacementStatsReport,
};
