const mongoose = require('mongoose');
const Student = require('../models/Student');
const analyticsService = require('../services/analytics.service');

// @desc    Get backlog analysis
// @route   GET /api/analytics/backlog-analysis
const getBacklogAnalysis = async (req, res) => {
  try {
    const data = await analyticsService.getBacklogAnalysis(req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get subject-wise pass percentage
// @route   GET /api/analytics/subject-wise-pass
const getSubjectWisePassPercentage = async (req, res) => {
  try {
    const data = await analyticsService.getSubjectWisePassPercentage(req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get CGPA distribution
// @route   GET /api/analytics/cgpa-distribution
const getCGPADistribution = async (req, res) => {
  try {
    const data = await analyticsService.getCGPADistribution(req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get individual student performance trend
// @route   GET /api/analytics/student-performance/:studentId
const getStudentPerformanceTrend = async (req, res) => {
  try {
    const data = await analyticsService.getStudentPerformanceTrend(req.params.studentId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get faculty achievements analytics
// @route   GET /api/analytics/faculty-achievements
const getFacultyAchievementsAnalytics = async (req, res) => {
  try {
    const data = await analyticsService.getFacultyAchievements(req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get student participation statistics
// @route   GET /api/analytics/student-participation
const getStudentParticipationStats = async (req, res) => {
  try {
    const data = await analyticsService.getStudentParticipationStats(req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get comprehensive student progress report
// @route   GET /api/analytics/student-progress/:studentId
const getStudentProgressReport = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    
    const [
      performanceTrend,
      attendanceData,
      participationData,
      backlogData,
    ] = await Promise.all([
        analyticsService.getStudentPerformanceTrend(studentId),
        analyticsService.getAttendanceByDept({ studentId }),
        analyticsService.getStudentParticipationStats({ studentId }),
        analyticsService.getBacklogAnalysis({ studentId }),
      ]);

    const progressReport = {
      studentId,
      performanceTrend,
      attendanceData,
      participationData,
      backlogData,
      generatedAt: new Date(),
    };

    res.json({ success: true, report: progressReport });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get department comprehensive report
// @route   GET /api/analytics/department-comprehensive/:departmentId
const getDepartmentComprehensiveReport = async (req, res) => {
  try {
    const departmentId = req.params.departmentId;
    const { academicYear } = req.query;
    
    const [
      passData,
      attendanceData,
      placementData,
      facultyAchievements,
      studentParticipation,
      backlogAnalysis,
      cgpaDistribution,
    ] = await Promise.all([
        analyticsService.getPassPercentageByDept({ departmentId, academicYear }),
        analyticsService.getAttendanceByDept({ departmentId, academicYear }),
        analyticsService.getPlacementAnalytics({ departmentId, academicYear }),
        analyticsService.getFacultyAchievements({ departmentId, academicYear }),
        analyticsService.getStudentParticipationStats({ departmentId, academicYear }),
        analyticsService.getBacklogAnalysis({ departmentId, academicYear }),
        analyticsService.getCGPADistribution({ departmentId, academicYear }),
      ]);

    const comprehensiveReport = {
      departmentId,
      academicYear,
      academics: {
        passData,
        attendanceData,
        cgpaDistribution,
        backlogAnalysis,
      },
        activities: {
          placementData,
          studentParticipation,
        },
      faculty: {
        achievements: facultyAchievements,
      },
      generatedAt: new Date(),
    };

    res.json({ success: true, report: comprehensiveReport });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get predictive analytics for at-risk students
// @route   GET /api/analytics/predictive-risk
const getPredictiveRiskAnalysis = async (req, res) => {
  try {
    const { departmentId, academicYear } = req.query;
    
    // Get current risk factors
    const [backlogData, attendanceData, performanceData] = await Promise.all([
      analyticsService.getBacklogAnalysis({ departmentId, academicYear }),
      analyticsService.getAttendanceByDept({ departmentId, academicYear }),
      analyticsService.getPassPercentageByDept({ departmentId, academicYear }),
    ]);

    // Calculate risk scores for each student
    const riskAnalysis = await Student.aggregate([
      { $match: { department: mongoose.Types.ObjectId(departmentId), isActive: true } },
      {
        $lookup: {
          from: 'marks',
          localField: '_id',
          foreignField: 'student',
          as: 'marksData',
        },
      },
      { $lookup: {
          from: 'attendance',
          localField: '_id',
          foreignField: 'student',
          as: 'attendanceData',
        },
      },
      {
        $project: {
          name: 1,
          rollNumber: 1,
          cgpa: 1,
          currentBacklogs: 1,
          avgAttendance: { $avg: '$attendanceData.percentage' },
          avgMarks: { $avg: '$marksData.total' },
          failedSubjects: {
            $size: {
              $filter: {
                input: '$marksData',
                cond: { $eq: ['$$this.result', 'FAIL'] },
              },
            },
          },
        },
      },
      {
        $addFields: {
          riskScore: {
            $add: [
              { $multiply: [{ $cond: [{ $gt: ['$currentBacklogs', 0] }, 1, 0] }, 30] }, // Backlog risk
              { $multiply: [{ $cond: [{ $lt: ['$avgAttendance', 75] }, 1, 0] }, 25] }, // Attendance risk
              { $multiply: [{ $cond: [{ $lt: ['$cgpa', 6] }, 1, 0] }, 25] }, // CGPA risk
              { $multiply: [{ $cond: [{ $gt: ['$failedSubjects', 2] }, 1, 0] }, 20] }, // Failed subjects risk
            ],
          },
          riskLevel: {
            $switch: {
              branches: [
                { case: { $gte: ['$riskScore', 80] }, then: 'Critical' },
                { case: { $gte: ['$riskScore', 60] }, then: 'High' },
                { case: { $gte: ['$riskScore', 40] }, then: 'Medium' },
                { case: { $gte: ['$riskScore', 20] }, then: 'Low' },
              ],
              default: 'Very Low',
            },
          },
        },
      },
      { $sort: { riskScore: -1 } },
      { $limit: 50 },
    ]);

    res.json({ success: true, riskAnalysis });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getBacklogAnalysis,
  getSubjectWisePassPercentage,
  getCGPADistribution,
  getStudentPerformanceTrend,
  getFacultyAchievementsAnalytics,
  getStudentParticipationStats,
  getStudentProgressReport,
  getDepartmentComprehensiveReport,
  getPredictiveRiskAnalysis,
};

