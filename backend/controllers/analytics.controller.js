const analyticsService = require("../services/analytics.service");
const Department = require("../models/Department");
const Student = require("../models/Student");
const Faculty = require("../models/Faculty");
const Placement = require("../models/Placement");
const ResearchPaper = require("../models/ResearchPaper");
const Attendance = require("../models/Attendance");
const Marks = require("../models/Marks");
const mongoose = require("mongoose");

const resolveDepartmentId = (department) => {
  if (!department) return null;
  return department._id || department;
};
const TREND_START_YEAR = 2020;
const TREND_END_YEAR = 2024;
const TREND_YEARS = Array.from(
  { length: TREND_END_YEAR - TREND_START_YEAR + 1 },
  (_, index) => TREND_START_YEAR + index
);

const academicYearStartExpression = {
  $toInt: {
    $substrBytes: ["$academicYear", 0, 4]
  }
};

const buildCompleteTrend = (rows = [], digits = 1) => {
  const valueByYear = new Map(
    rows.map((row) => [Number(row.year), Number(row.value ?? 0)])
  );

  return TREND_YEARS.map((year) => {
    const rawValue = valueByYear.get(year) ?? 0;
    const value = Number.isFinite(rawValue)
      ? Number(rawValue.toFixed(digits))
      : 0;

    return {
      year: String(year),
      value: digits === 0 ? Math.round(value) : value
    };
  });
};

const buildStudentScopedPipeline = (departmentId) => [
  {
    $lookup: {
      from: "students",
      localField: "student",
      foreignField: "_id",
      as: "studentData"
    }
  },
  { $unwind: "$studentData" },
  ...(departmentId
    ? [
        {
          $match: {
            "studentData.department": departmentId
          }
        }
      ]
    : [])
];


// ============================
// Pass Percentage Analytics
// ============================
const getPassPercentage = async (req, res) => {

  try {

    if (req.user.role === "hod") {
      req.query.departmentId = resolveDepartmentId(req.user.department);
    }

    const data = await analyticsService.getPassPercentageByDept(req.query);

    res.json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Placement Analytics
// ============================
const getPlacementAnalytics = async (req, res) => {

  try {

    if (req.user.role === "hod") {
      req.query.departmentId = resolveDepartmentId(req.user.department);
    }

    const data = await analyticsService.getPlacementAnalytics(req.query);

    res.json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Attendance Analytics
// ============================
const getAttendanceAnalytics = async (req, res) => {

  try {

    if (req.user.role === "hod") {
      req.query.departmentId = resolveDepartmentId(req.user.department);
    }

    const data = await analyticsService.getAttendanceByDept(req.query);

    res.json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Research Analytics
// ============================
const getResearchAnalytics = async (req, res) => {

  try {

    if (req.user.role === "hod") {
      req.query.departmentId = resolveDepartmentId(req.user.department);
    }

    const departmentId = req.query.departmentId;
    const pipeline = [
      {
        $lookup: {
          from: "faculties",
          localField: "faculty",
          foreignField: "_id",
          as: "facultyData"
        }
      },
      { $unwind: "$facultyData" }
    ];

    if (departmentId) {
      pipeline.push({
        $match: {
          "facultyData.department": new mongoose.Types.ObjectId(departmentId)
        }
      });
    }

    pipeline.push(
      {
        $group: {
          _id: "$year",
          count: { $sum: 1 },
          citations: { $sum: "$citations" }
        }
      },
      { $sort: { _id: 1 } }
    );

    const byYear = await ResearchPaper.aggregate(pipeline);

    res.json({
      success: true,
      data: byYear
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Department Ranking
// ============================
const getDepartmentRanking = async (req, res) => {

  try {

    if (req.user.role === "hod") {
      req.query.departmentId = resolveDepartmentId(req.user.department);
    }

    const data = await analyticsService.getDepartmentRanking(req.query);

    res.json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// CGPA Trend
// ============================
const getCGPATrend = async (req, res) => {

  try {

    if (req.user.role === "hod") {
      req.query.departmentId = resolveDepartmentId(req.user.department);
    }

    const data = await analyticsService.getCGPATrend(req.query);

    res.json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Dashboard KPIs
// ============================
const getDashboardKPIs = async (req, res) => {

  try {

    const studentFilter = { isActive: true };
    const facultyFilter = { isActive: true };
    const departmentFilter = { isActive: true };

    if (req.user.role === "hod") {
      const scopedDepartmentId = resolveDepartmentId(req.user.department);
      studentFilter.department = scopedDepartmentId;
      facultyFilter.department = scopedDepartmentId;
      departmentFilter._id = scopedDepartmentId;
    }

    const departmentId =
      req.user.role === "hod"
        ? new mongoose.Types.ObjectId(resolveDepartmentId(req.user.department))
        : null;
    const studentAggregateMatch = {
      ...studentFilter,
      ...(departmentId ? { department: departmentId } : {})
    };

    const placementPromise = departmentId
      ? Placement.aggregate([
          {
            $lookup: {
              from: "students",
              localField: "student",
              foreignField: "_id",
              as: "studentData"
            }
          },
          { $unwind: "$studentData" },
          {
            $match: {
              "studentData.department": departmentId
            }
          },
          { $count: "count" }
        ])
      : Placement.countDocuments();

    const attendancePromise = departmentId
      ? Attendance.aggregate([
          {
            $lookup: {
              from: "students",
              localField: "student",
              foreignField: "_id",
              as: "studentData"
            }
          },
          { $unwind: "$studentData" },
          {
            $match: {
              "studentData.department": departmentId
            }
          },
          { $group: { _id: null, avg: { $avg: "$percentage" } } }
        ])
      : Attendance.aggregate([
          { $group: { _id: null, avg: { $avg: "$percentage" } } }
        ]);

    const researchPromise = departmentId
      ? ResearchPaper.aggregate([
          {
            $lookup: {
              from: "faculties",
              localField: "faculty",
              foreignField: "_id",
              as: "facultyData"
            }
          },
          { $unwind: "$facultyData" },
          {
            $match: {
              "facultyData.department": departmentId
            }
          },
          { $count: "count" }
        ])
      : ResearchPaper.countDocuments();

    const [
      totalStudents,
      totalFaculty,
      totalDepartments,
      studentCgpaResult,
      atRiskStudents,
      totalPlacementsResult,
      attendanceAvg,
      researchCountResult
    ] = await Promise.all([
      Student.countDocuments(studentFilter),
      Faculty.countDocuments(facultyFilter),
      Department.countDocuments(departmentFilter),
      Student.aggregate([
        { $match: studentAggregateMatch },
        { $group: { _id: null, averageCGPA: { $avg: "$cgpa" } } }
      ]),
      Student.countDocuments({
        ...studentFilter,
        $or: [
          { isAtRisk: true },
          { performanceCategory: "At Risk" }
        ]
      }),
      placementPromise,
      attendancePromise,
      researchPromise
    ]);

    const totalPlacements = Array.isArray(totalPlacementsResult)
      ? (totalPlacementsResult[0]?.count || 0)
      : totalPlacementsResult;

    const totalResearchPapers = Array.isArray(researchCountResult)
      ? (researchCountResult[0]?.count || 0)
      : researchCountResult;

    const averageCGPA = studentCgpaResult[0]?.averageCGPA
      ? Number(studentCgpaResult[0].averageCGPA.toFixed(2))
      : 0;

    const placementPct =
      totalStudents > 0
        ? Math.round((totalPlacements / totalStudents) * 100)
        : 0;

    res.json({
      success: true,
      data: {
        totalStudents,
        totalFaculty,
        totalDepartments,
        totalPlacements,
        placementPercentage: placementPct,
        averageCGPA,
        atRiskStudents,
        avgAttendance: attendanceAvg[0]
          ? Math.round(attendanceAvg[0].avg)
          : 0,
        totalResearchPapers
      }
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Dashboard Trends
// ============================
const getDashboardTrends = async (req, res) => {

  try {

    if (req.user.role === "hod") {
      req.query.departmentId = resolveDepartmentId(req.user.department);
    }

    const resolvedDepartmentId = resolveDepartmentId(req.query.departmentId || req.query.department);
    const scopedDepartmentId = resolvedDepartmentId
      ? new mongoose.Types.ObjectId(resolvedDepartmentId)
      : null;
    const yearMatch = {
      $gte: TREND_START_YEAR,
      $lte: TREND_END_YEAR
    };

    const [passPercentage, placements, attendance] = await Promise.all([
      Marks.aggregate([
        {
          $match: {
            academicYear: { $exists: true, $ne: null }
          }
        },
        ...buildStudentScopedPipeline(scopedDepartmentId),
        {
          $addFields: {
            startYear: academicYearStartExpression
          }
        },
        {
          $match: {
            startYear: yearMatch
          }
        },
        {
          $group: {
            _id: "$startYear",
            totalEntries: { $sum: 1 },
            passEntries: {
              $sum: {
                $cond: [{ $eq: ["$result", "PASS"] }, 1, 0]
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            year: "$_id",
            value: {
              $round: [
                {
                  $multiply: [
                    { $divide: ["$passEntries", "$totalEntries"] },
                    100
                  ]
                },
                1
              ]
            }
          }
        },
        { $sort: { year: 1 } }
      ]),
      Placement.aggregate([
        {
          $match: {
            academicYear: { $exists: true, $ne: null }
          }
        },
        ...buildStudentScopedPipeline(scopedDepartmentId),
        {
          $addFields: {
            startYear: academicYearStartExpression
          }
        },
        {
          $match: {
            startYear: yearMatch
          }
        },
        {
          $group: {
            _id: "$startYear",
            value: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            year: "$_id",
            value: 1
          }
        },
        { $sort: { year: 1 } }
      ]),
      Attendance.aggregate([
        {
          $match: {
            academicYear: { $exists: true, $ne: null }
          }
        },
        ...buildStudentScopedPipeline(scopedDepartmentId),
        {
          $addFields: {
            startYear: academicYearStartExpression
          }
        },
        {
          $match: {
            startYear: yearMatch
          }
        },
        {
          $group: {
            _id: "$startYear",
            value: { $avg: "$percentage" }
          }
        },
        {
          $project: {
            _id: 0,
            year: "$_id",
            value: { $round: ["$value", 1] }
          }
        },
        { $sort: { year: 1 } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        passPercentage: buildCompleteTrend(passPercentage),
        placements: buildCompleteTrend(placements, 0),
        attendance: buildCompleteTrend(attendance)
      }
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


module.exports = {
  getPassPercentage,
  getPlacementAnalytics,
  getAttendanceAnalytics,
  getResearchAnalytics,
  getDepartmentRanking,
  getCGPATrend,
  getDashboardKPIs,
  getDashboardTrends
};
