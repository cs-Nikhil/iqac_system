const mongoose = require('mongoose');
const Marks = require('../models/Marks');
const Attendance = require('../models/Attendance');
const ResearchPaper = require('../models/ResearchPaper');
const FacultyAchievement = require('../models/FacultyAchievement');
const { Event } = require('../models/Event');
const Department = require('../models/Department');
const analyticsService = require('../services/analytics.service');

// @desc    Get department dashboard metrics (HOD or IQAC_HEAD)
// @route   GET /api/dashboard/department
// @access  Private/HOD+IQAC_HEAD
const getDepartmentDashboard = async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'hod' && user.role !== 'iqac_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. HOD or IQAC_HEAD required.'
      });
    }

    const departmentId =
      user.role === 'hod'
        ? (user.department?._id || user.department)
        : (req.query.departmentId || null);
    const normalizedDepartmentId = departmentId
      ? new mongoose.Types.ObjectId(departmentId._id || departmentId)
      : null;

    const [
      departmentInfo,
      passData,
      attendanceData,
      placementData,
      researchCount,
      achievementCount,
      departmentalEvents,
      overallPass,
      overallAttendance
    ] = await Promise.all([
      normalizedDepartmentId ? Department.findById(normalizedDepartmentId).select('name code') : null,
      analyticsService.getPassPercentageByDept({ departmentId: normalizedDepartmentId }),
      analyticsService.getAttendanceByDept({ departmentId: normalizedDepartmentId }),
      analyticsService.getPlacementAnalytics({ departmentId: normalizedDepartmentId }),
      normalizedDepartmentId
        ? ResearchPaper.aggregate([
            {
              $lookup: {
                from: 'faculties',
                localField: 'faculty',
                foreignField: '_id',
                as: 'facultyData',
              },
            },
            { $unwind: '$facultyData' },
            {
              $match: {
                'facultyData.department': normalizedDepartmentId,
              },
            },
            { $count: 'count' },
          ]).then((result) => result[0]?.count || 0)
        : ResearchPaper.countDocuments(),
      normalizedDepartmentId
        ? FacultyAchievement.aggregate([
            {
              $lookup: {
                from: 'faculties',
                localField: 'faculty',
                foreignField: '_id',
                as: 'facultyData',
              },
            },
            { $unwind: '$facultyData' },
            {
              $match: {
                'facultyData.department': normalizedDepartmentId,
              },
            },
            { $count: 'count' },
          ]).then((result) => result[0]?.count || 0)
        : FacultyAchievement.countDocuments({ isActive: true }),
      Event.countDocuments(
        normalizedDepartmentId
          ? { department: normalizedDepartmentId, isActive: true }
          : { isActive: true }
      ),
      Marks.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            passed: { $sum: { $cond: [{ $eq: ['$result', 'PASS'] }, 1, 0] } }
          }
        },
        {
          $project: {
            passPercentage: {
              $round: [{ $multiply: [{ $divide: ['$passed', '$total'] }, 100] }, 1]
            }
          }
        }
      ]).then((result) => result[0]?.passPercentage || 0),
      Attendance.aggregate([
        { $group: { _id: null, avgAttendance: { $avg: '$percentage' } } },
        {
          $project: {
            avgAttendance: { $round: ['$avgAttendance', 1] }
          }
        }
      ]).then((result) => result[0]?.avgAttendance || 0),
    ]);

    const passPercentage = departmentId
      ? (passData[0]?.passPercentage || 0)
      : overallPass;

    const avgAttendance = departmentId
      ? (attendanceData[0]?.avgAttendance || 0)
      : overallAttendance;

    const placementPercentage = departmentId
      ? (placementData[0]?.placementPercentage || 0)
      : 0;

    const dashboard = {
      department: departmentInfo?.name || 'Institution Overview',
      code: departmentInfo?.code || 'ALL',
      passPercentage,
      avgAttendance,
      placementPercentage,
      researchPapers: researchCount,
      facultyAchievements: achievementCount,
      departmentalEvents
    };

    res.json({
      success: true,
      data: dashboard
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data: ' + error.message
    });
  }
};

module.exports = { getDepartmentDashboard };


