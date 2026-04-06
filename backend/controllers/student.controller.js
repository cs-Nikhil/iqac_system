const Student = require("../models/Student");
const Marks = require("../models/Marks");
const Attendance = require("../models/Attendance");
const {
  normalizeObjectId,
  buildStudentFilter,
  buildAtRiskStudentFilter,
  AT_RISK_STUDENT_SORT,
} = require("../utils/studentFilters");

const roundTo = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));

const buildStudentInsights = ({
  student,
  cgpaTrend = [],
  attendanceTrend = [],
  subjectPerformance = [],
  departmentAverageCgpa = 0,
}) => {
  const insights = [];
  const firstCgpa = cgpaTrend[0]?.cgpa ?? null;
  const latestCgpa = cgpaTrend[cgpaTrend.length - 1]?.cgpa ?? student.cgpa ?? 0;

  if (firstCgpa !== null && cgpaTrend.length > 1) {
    const cgpaDelta = roundTo(latestCgpa - firstCgpa, 2);
    insights.push({
      title: cgpaDelta >= 0 ? "CGPA Improvement" : "CGPA Dip",
      tone: cgpaDelta >= 0 ? "positive" : "warning",
      description:
        cgpaDelta >= 0
          ? `CGPA improved by ${cgpaDelta.toFixed(2)} points from ${cgpaTrend[0].label} to ${cgpaTrend[cgpaTrend.length - 1].label}.`
          : `CGPA declined by ${Math.abs(cgpaDelta).toFixed(2)} points across the tracked semesters.`,
    });
  }

  const firstAttendance = attendanceTrend[0]?.attendancePercentage ?? null;
  const latestAttendance =
    attendanceTrend[attendanceTrend.length - 1]?.attendancePercentage ??
    student.academicRecords?.avgAttendance ??
    0;

  if (firstAttendance !== null && attendanceTrend.length > 1) {
    const attendanceDelta = roundTo(latestAttendance - firstAttendance, 1);
    insights.push({
      title: attendanceDelta >= 0 ? "Attendance Growth" : "Attendance Drop",
      tone: attendanceDelta >= 0 ? "positive" : "warning",
      description:
        attendanceDelta >= 0
          ? `Attendance increased by ${attendanceDelta.toFixed(1)}% over the tracked semesters.`
          : `Attendance decreased by ${Math.abs(attendanceDelta).toFixed(1)}%, so closer mentoring may help.`,
    });
  }

  if (subjectPerformance.length > 0) {
    const strongestSubject = [...subjectPerformance].sort((left, right) => right.total - left.total)[0];
    const weakestSubject = [...subjectPerformance].sort((left, right) => left.total - right.total)[0];

    if (strongestSubject) {
      insights.push({
        title: "Subject Strength",
        tone: "positive",
        description: `${strongestSubject.subject} is the strongest recent subject with ${strongestSubject.total} marks.`,
      });
    }

    if (weakestSubject && weakestSubject.subject !== strongestSubject?.subject) {
      insights.push({
        title: "Subject Focus Area",
        tone: weakestSubject.total >= 50 ? "neutral" : "warning",
        description: `${weakestSubject.subject} is the weakest recent subject at ${weakestSubject.total} marks.`,
      });
    }
  }

  const comparisonDelta = roundTo((student.cgpa || 0) - departmentAverageCgpa, 2);
  insights.push({
    title: comparisonDelta >= 0 ? "Above Department Average" : "Below Department Average",
    tone: comparisonDelta >= 0 ? "positive" : "warning",
    description:
      comparisonDelta >= 0
        ? `Current CGPA is ${comparisonDelta.toFixed(2)} points above the department average.`
        : `Current CGPA is ${Math.abs(comparisonDelta).toFixed(2)} points below the department average.`,
  });

  return insights.slice(0, 4);
};

// ============================
// Get Students (with filters)
// ============================
const getStudents = async (req, res) => {
  try {

    const { page = 1, limit = 20 } = req.query;
    const filter = buildStudentFilter(req.query, req.user);

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const total = await Student.countDocuments(filter);

    const students = await Student.find(filter)
      .populate("department", "name code")
      .sort({ rollNumber: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      success: true,
      data: students,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
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
// Student Performance Distribution
// ============================
const getStudentPerformanceDistribution = async (req, res) => {

  try {

    const filter = buildStudentFilter(req.query, req.user);
    const distribution = await Student.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$performanceCategory",
          count: { $sum: 1 }
        }
      }
    ]);

    const counts = {
      excellent: 0,
      good: 0,
      average: 0,
      atRisk: 0,
    };

    distribution.forEach((item) => {
      if (item._id === "Excellent") counts.excellent = item.count;
      if (item._id === "Good") counts.good = item.count;
      if (item._id === "Average") counts.average = item.count;
      if (item._id === "At Risk") counts.atRisk = item.count;
    });

    res.json({
      success: true,
      data: counts
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Get Student Details
// ============================
const getStudentById = async (req, res) => {

  try {

    const student = await Student
      .findById(req.params.id)
      .populate("department", "name code")
      .populate("backlogHistory.subject", "name code");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    const studentDepartmentId = normalizeObjectId(student.department);
    const userDepartmentId = normalizeObjectId(req.user.department);

    // Department-based restriction for HOD and faculty views
    if (
      (req.user.role === "hod" || req.user.role === "faculty") &&
      (!studentDepartmentId || !userDepartmentId || studentDepartmentId !== userDepartmentId)
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const [marksSummary, attendanceSummary, marksRecords, departmentAverage] = await Promise.all([
      Marks.aggregate([
      { $match: { student: student._id } },
      {
        $group: {
          _id: "$semester",
          academicYear: { $first: "$academicYear" },
          avgMarks: { $avg: "$total" },
          totalSubjects: { $sum: 1 },
          passed: {
            $sum: {
              $cond: [{ $eq: ["$result", "PASS"] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]),
      Attendance.aggregate([
      { $match: { student: student._id } },
      {
        $group: {
          _id: "$semester",
          academicYear: { $first: "$academicYear" },
          avgAttendance: { $avg: "$percentage" }
        }
      },
      { $sort: { _id: 1 } }
    ]),
      Marks.find({ student: student._id })
        .populate("subject", "name code semester")
        .sort({ semester: -1, total: -1, createdAt: -1 })
        .lean(),
      Student.aggregate([
        {
          $match: {
            department: student.department._id,
            isActive: true,
          }
        },
        {
          $group: {
            _id: "$department",
            avgCgpa: { $avg: "$cgpa" },
          }
        }
      ]),
    ]);

    const cgpaTrend = (student.academicRecords?.semesterCgpa || [])
      .map((record) => ({
        semester: record.semester,
        label: `Sem ${record.semester}`,
        academicYear: record.academicYear,
        cgpa: roundTo(record.cgpa, 2),
      }))
      .sort((left, right) => left.semester - right.semester);

    const normalizedAttendanceSummary = attendanceSummary.map((entry) => ({
      semester: entry._id,
      label: `Sem ${entry._id}`,
      academicYear: entry.academicYear,
      attendancePercentage: roundTo(entry.avgAttendance, 1),
    }));

    const latestSemester = marksRecords[0]?.semester || student.currentSemester || 1;
    const subjectPerformance = marksRecords
      .filter((record) => record.semester === latestSemester)
      .map((record) => ({
        subject: record.subject?.name || "Unknown Subject",
        code: record.subject?.code || "NA",
        semester: record.semester,
        academicYear: record.academicYear,
        total: roundTo(record.total, 0),
        grade: record.grade,
        result: record.result,
      }))
      .sort((left, right) => right.total - left.total);

    const backlogHistoryEntries = (student.backlogHistory || []).map((entry) => ({
      subject: entry.subject?.name || "Unknown Subject",
      code: entry.subject?.code || "NA",
      semester: entry.semester,
      academicYear: entry.academicYear,
      attempts: entry.attempts || 1,
      clearedInSemester: entry.clearedInSemester || null,
      clearedInYear: entry.clearedInYear || null,
    }));

    const activeBacklogEntries = marksRecords
      .filter((record) => record.result === "FAIL")
      .map((record) => ({
        subject: record.subject?.name || "Unknown Subject",
        code: record.subject?.code || "NA",
        semester: record.semester,
        academicYear: record.academicYear,
        attempts: 1,
        clearedInSemester: null,
        clearedInYear: null,
      }));

    const backlogHistory = [...backlogHistoryEntries, ...activeBacklogEntries].filter(
      (entry, index, collection) =>
        index ===
        collection.findIndex(
          (current) =>
            current.code === entry.code &&
            current.semester === entry.semester &&
            current.academicYear === entry.academicYear
        )
    );

    const departmentAverageCgpa = roundTo(departmentAverage[0]?.avgCgpa || 0, 2);
    const insights = buildStudentInsights({
      student,
      cgpaTrend,
      attendanceTrend: normalizedAttendanceSummary,
      subjectPerformance,
      departmentAverageCgpa,
    });

    res.json({
      success: true,
      data: {
        student,
        overview: {
          name: student.name,
          rollNumber: student.rollNumber,
          department: student.department,
          batchYear: student.batchYear,
          currentSemester: student.currentSemester,
          cgpa: roundTo(student.cgpa, 2),
          attendancePercentage: roundTo(student.academicRecords?.avgAttendance || 0, 1),
          currentBacklogs: student.currentBacklogs || 0,
          performanceScore: roundTo(student.performanceScore || 0, 1),
          performanceCategory: student.performanceCategory || "Average",
        },
        cgpaTrend,
        attendanceTrend: normalizedAttendanceSummary,
        marksSummary: marksSummary.map((entry) => ({
          semester: entry._id,
          academicYear: entry.academicYear,
          avgMarks: roundTo(entry.avgMarks, 1),
          totalSubjects: entry.totalSubjects,
          passedSubjects: entry.passed,
        })),
        attendanceSummary: normalizedAttendanceSummary,
        subjectPerformance,
        backlogHistory,
        comparison: {
          studentCgpa: roundTo(student.cgpa, 2),
          departmentAverageCgpa,
        },
        insights,
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
// Create Student
// ============================
const createStudent = async (req, res) => {

  try {

    if (req.user.role === "hod") {
      req.body.department = normalizeObjectId(req.user.department);
    }

    const student = await Student.create(req.body);

    await student.populate("department", "name code");

    res.status(201).json({
      success: true,
      data: student
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Update Student
// ============================
const updateStudent = async (req, res) => {

  try {

    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    const studentDepartmentId = normalizeObjectId(student.department);
    const userDepartmentId = normalizeObjectId(req.user.department);

    if (
      req.user.role === "hod" &&
      (!studentDepartmentId || !userDepartmentId || studentDepartmentId !== userDepartmentId)
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    Object.assign(student, req.body);

    await student.save();

    await student.populate("department", "name code");

    res.json({
      success: true,
      data: student
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// At Risk Students
// ============================
const getAtRiskStudents = async (req, res) => {

  try {

    const filter = buildAtRiskStudentFilter(req.query, req.user);

    const students = await Student.find(filter)
      .populate("department", "name code")
      .sort(AT_RISK_STUDENT_SORT);

    res.json({
      success: true,
      count: students.length,
      data: students
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


module.exports = {
  getStudents,
  getStudentPerformanceDistribution,
  getStudentById,
  createStudent,
  updateStudent,
  getAtRiskStudents
};
