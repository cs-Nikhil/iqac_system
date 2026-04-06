const Marks = require("../models/Marks");
const Attendance = require("../models/Attendance");
const Event = require("../models/Event");
const Student = require("../models/Student");

// ============================
// Student Dashboard
// ============================
// GET /api/students/dashboard
// Access: STUDENT
const getStudentDashboard = async (req, res) => {

  try {

    const user = req.user;

    if (user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Student role required"
      });
    }

    // Find student profile
    const student = await Student
      .findOne({ email: user.email })
      .populate("department", "name code");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student record not found. Contact admin."
      });
    }

    const studentFilter = { student: student._id };

    // ============================
    // Recent Marks
    // ============================
    const recentMarks = await Marks.find(studentFilter)
      .populate("subject", "name code")
      .sort({ createdAt: -1 })
      .limit(10);

    // ============================
    // Recent Attendance
    // ============================
    const recentAttendance = await Attendance.find(studentFilter)
      .populate("subject", "name code")
      .sort({ date: -1 })
      .limit(10);

    // ============================
    // CGPA Trend
    // ============================
    const cgpaTrend = await Marks.aggregate([
      { $match: { student: student._id } },
      {
        $group: {
          _id: "$semester",
          avgMarks: { $avg: "$total" },
          subjects: { $sum: 1 },
          passed: {
            $sum: {
              $cond: [{ $eq: ["$result", "PASS"] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          semester: "$_id",
          avgMarks: { $round: ["$avgMarks", 2] },
          passRate: {
            $round: [
              { $multiply: [{ $divide: ["$passed", "$subjects"] }, 100] },
              1
            ]
          }
        }
      }
    ]);

    // ============================
    // Event Participation
    // ============================
    const events = await Event.find({
      "participations.student": student._id
    }).populate("department", "name code");

    // ============================
    // Dashboard Response
    // ============================
    const dashboard = {
      student: {
        id: student._id,
        name: student.name,
        rollNumber: student.rollNumber,
        department: student.department,
        cgpa: student.cgpa,
        performanceScore: student.performanceScore,
        performanceCategory: student.performanceCategory,
        currentSemester: student.currentSemester
      },
      marks: recentMarks,
      attendance: recentAttendance,
      cgpaTrend,
      events
    };

    res.json({
      success: true,
      data: dashboard
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard: " + error.message
    });

  }

};

module.exports = {
  getStudentDashboard
};
