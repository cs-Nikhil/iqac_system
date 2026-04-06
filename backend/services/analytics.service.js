const mongoose = require('mongoose');
const Marks = require('../models/Marks');
const Attendance = require('../models/Attendance');
const Placement = require('../models/Placement');
const Student = require('../models/Student');
const ResearchPaper = require('../models/ResearchPaper');
const Department = require('../models/Department');
const FacultyAchievement = require('../models/FacultyAchievement');
const { Event, Participation } = require('../models/Event');

const resolveObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  return new mongoose.Types.ObjectId(value._id || value);
};


const getPassPercentageByDept = async (filters = {}) => {
  const matchStage = {};
  const pipeline = [];
  const departmentId = resolveObjectId(filters.departmentId || filters.department);

  if (filters.semester) matchStage.semester = parseInt(filters.semester);
  if (filters.academicYear) matchStage.academicYear = filters.academicYear;
  if (filters.studentId) matchStage.student = resolveObjectId(filters.studentId);

  pipeline.push({ $match: matchStage });
  pipeline.push(
    // Join to student to get department
    {
      $lookup: {
        from: 'students',
        localField: 'student',
        foreignField: '_id',
        as: 'studentData',
      },
    },
    { $unwind: '$studentData' },
  );

  if (departmentId) {
    pipeline.push({
      $match: {
        'studentData.department': departmentId,
      },
    });
  }

  pipeline.push(
    // Join to department
    {
      $lookup: {
        from: 'departments',
        localField: 'studentData.department',
        foreignField: '_id',
        as: 'deptData',
      },
    },
    { $unwind: '$deptData' },
    // Group by department
    {
      $group: {
        _id: '$deptData._id',
        deptName: { $first: '$deptData.name' },
        deptCode: { $first: '$deptData.code' },
        totalEntries: { $sum: 1 },
        passCount: { $sum: { $cond: [{ $eq: ['$result', 'PASS'] }, 1, 0] } },
        avgMarks: { $avg: '$total' },
      },
    },
    // Calculate pass percentage
    {
      $addFields: {
        passPercentage: {
          $round: [{ $multiply: [{ $divide: ['$passCount', '$totalEntries'] }, 100] }, 2],
        },
      },
    },
    { $sort: { passPercentage: -1 } },
  );

  return await Marks.aggregate(pipeline);
};

/**
 * Get average attendance by department.
 */
const getAttendanceByDept = async (filters = {}) => {
  const matchStage = {};
  const departmentId = resolveObjectId(filters.departmentId || filters.department);
  if (filters.semester) matchStage.semester = parseInt(filters.semester);
  if (filters.academicYear) matchStage.academicYear = filters.academicYear;

  const pipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: 'students',
        localField: 'student',
        foreignField: '_id',
        as: 'studentData',
      },
    },
    { $unwind: '$studentData' },
  ];

  if (departmentId) {
    pipeline.push({
      $match: {
        'studentData.department': departmentId,
      },
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: 'departments',
        localField: 'studentData.department',
        foreignField: '_id',
        as: 'deptData',
      },
    },
    { $unwind: '$deptData' },
    {
      $group: {
        _id: '$deptData._id',
        deptName: { $first: '$deptData.name' },
        deptCode: { $first: '$deptData.code' },
        avgAttendance: { $avg: '$percentage' },
        belowThreshold: { $sum: { $cond: ['$isBelowThreshold', 1, 0] } },
        totalRecords: { $sum: 1 },
      },
    },
    {
      $addFields: {
        avgAttendance: { $round: ['$avgAttendance', 2] },
      },
    },
    { $sort: { avgAttendance: -1 } },
  );

  return await Attendance.aggregate(pipeline);
};

/**
 * Get placement percentage by department for a given academic year.
 */
const getPlacementAnalytics = async (filters = {}) => {
  const matchStage = {};
  const departmentId = resolveObjectId(filters.departmentId || filters.department);
  if (filters.academicYear) matchStage.academicYear = filters.academicYear;

  // Total placed per department
  const pipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: 'students',
        localField: 'student',
        foreignField: '_id',
        as: 'studentData',
      },
    },
    { $unwind: '$studentData' },
  ];

  if (departmentId) {
    pipeline.push({
      $match: {
        'studentData.department': departmentId,
      },
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: 'departments',
        localField: 'studentData.department',
        foreignField: '_id',
        as: 'deptData',
      },
    },
    { $unwind: '$deptData' },
    {
      $group: {
        _id: '$deptData._id',
        deptName: { $first: '$deptData.name' },
        deptCode: { $first: '$deptData.code' },
        placedCount: { $sum: 1 },
        avgPackage: { $avg: '$package' },
        maxPackage: { $max: '$package' },
      },
    },
    { $sort: { placedCount: -1 } },
  );

  const placedByDept = await Placement.aggregate(pipeline);

  // Enrich with total students to compute percentage
  const enriched = await Promise.all(placedByDept.map(async (d) => {
    const totalStudents = await Student.countDocuments({ department: d._id, isActive: true });
    return {
      ...d,
      totalStudents,
      placementPercentage: totalStudents > 0
        ? Math.round((d.placedCount / totalStudents) * 100)
        : 0,
      avgPackage: Math.round(d.avgPackage * 100) / 100,
    };
  }));

  return enriched.sort((a, b) => b.placementPercentage - a.placementPercentage);
};

/**
 * Department ranking algorithm:
 * Score = (passPercentage * 0.30) + (avgAttendance * 0.25) +
 *         (placementPercentage * 0.30) + (researchNormalized * 0.15)
 */
const getDepartmentRanking = async (filters = {}) => {
  const departmentId = resolveObjectId(filters.departmentId || filters.department);
  const [passData, attendanceData, placementData] = await Promise.all([
    getPassPercentageByDept({ departmentId, academicYear: filters.academicYear, semester: filters.semester }),
    getAttendanceByDept({ departmentId, academicYear: filters.academicYear, semester: filters.semester }),
    getPlacementAnalytics({ departmentId, academicYear: filters.academicYear }),
  ]);

  // Research papers per department
  const researchPipeline = [
    {
      $lookup: {
        from: 'faculties',
        localField: 'faculty',
        foreignField: '_id',
        as: 'facultyData',
      },
    },
    { $unwind: '$facultyData' },
  ];

  if (departmentId) {
    researchPipeline.push({
      $match: {
        'facultyData.department': departmentId,
      },
    });
  }

  researchPipeline.push(
    {
      $group: {
        _id: '$facultyData.department',
        paperCount: { $sum: 1 },
      },
    },
  );

  const researchData = await ResearchPaper.aggregate(researchPipeline);

  // Find max paper count for normalization
  const maxPapers = Math.max(...researchData.map(r => r.paperCount), 1);

  // Build maps for fast lookup
  const passMap = Object.fromEntries(passData.map(d => [d._id.toString(), d]));
  const attMap = Object.fromEntries(attendanceData.map(d => [d._id.toString(), d]));
  const placMap = Object.fromEntries(placementData.map(d => [d._id.toString(), d]));
  const resMap = Object.fromEntries(researchData.map(d => [d._id.toString(), d]));

  const departmentFilter = departmentId
    ? { _id: departmentId, isActive: true }
    : { isActive: true };

  const departments = await Department.find(departmentFilter);

  const ranked = departments.map((dept) => {
    const id = dept._id.toString();
    const pp = passMap[id]?.passPercentage || 0;
    const att = attMap[id]?.avgAttendance || 0;
    const plac = placMap[id]?.placementPercentage || 0;
    const resNorm = ((resMap[id]?.paperCount || 0) / maxPapers) * 100;

    const score = (pp * 0.30) + (att * 0.25) + (plac * 0.30) + (resNorm * 0.15);

    return {
      department: dept.name,
      code: dept.code,
      deptId: dept._id,
      passPercentage: pp,
      avgAttendance: att,
      placementPercentage: plac,
      researchPapers: resMap[id]?.paperCount || 0,
      score: Math.round(score * 100) / 100,
    };
  });

  return ranked.sort((a, b) => b.score - a.score).map((d, i) => ({ ...d, rank: i + 1 }));
};

/**
 * Get CGPA trend across semesters (aggregated across all students or by department).
 */
const getCGPATrend = async (filters = {}) => {
  const matchStage = {};
  const departmentId = resolveObjectId(filters.departmentId || filters.department);
  if (filters.studentId) matchStage.student = resolveObjectId(filters.studentId);
  if (filters.academicYear) matchStage.academicYear = filters.academicYear;

  const pipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: 'students',
        localField: 'student',
        foreignField: '_id',
        as: 'studentData',
      },
    },
    { $unwind: '$studentData' },
  ];

  if (departmentId) {
    pipeline.push({
      $match: {
        'studentData.department': departmentId,
      },
    });
  }

  if (filters.batchYear) {
    pipeline.push({
      $match: {
        'studentData.batchYear': parseInt(filters.batchYear),
      },
    });
  }

  pipeline.push(
    {
      // First compute each student's semester GPA from subject-level marks.
      $group: {
        _id: {
          semester: '$semester',
          student: '$student',
        },
        semesterCGPA: { $avg: '$gradePoints' },
        semesterAvgMarks: { $avg: '$total' },
      },
    },
    {
      // Then roll those student semester GPAs up to the semester trend line.
      $group: {
        _id: '$_id.semester',
        avgCGPA: { $avg: '$semesterCGPA' },
        avgGradePoints: { $avg: '$semesterCGPA' },
        avgMarks: { $avg: '$semesterAvgMarks' },
        studentCount: { $sum: 1 },
      },
    },
    {
      $addFields: {
        avgCGPA: { $round: ['$avgCGPA', 2] },
        avgGradePoints: { $round: ['$avgGradePoints', 2] },
        avgMarks: { $round: ['$avgMarks', 2] },
      },
    },
    { $sort: { _id: 1 } },
  );

  return await Marks.aggregate(pipeline);
};

const getAverageCGPAByDept = async (filters = {}) => {
  const matchStage = { isActive: true };
  const departmentId = resolveObjectId(filters.departmentId || filters.department);

  if (departmentId) {
    matchStage.department = departmentId;
  }

  if (filters.batchYear) {
    matchStage.batchYear = parseInt(filters.batchYear, 10);
  }

  return Student.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: 'departments',
        localField: 'department',
        foreignField: '_id',
        as: 'deptData',
      },
    },
    { $unwind: '$deptData' },
    {
      $group: {
        _id: '$department',
        deptName: { $first: '$deptData.name' },
        deptCode: { $first: '$deptData.code' },
        averageCGPA: { $avg: '$cgpa' },
        highestCGPA: { $max: '$cgpa' },
        studentCount: { $sum: 1 },
      },
    },
    {
      $addFields: {
        averageCGPA: { $round: ['$averageCGPA', 2] },
        highestCGPA: { $round: ['$highestCGPA', 2] },
      },
    },
    { $sort: { averageCGPA: -1 } },
  ]);
};

/**
 * Get backlog analysis by department and academic year
 */
const getBacklogAnalysis = async (filters = {}) => {
  const matchStage = {};
  const pipeline = [];

  if (filters.studentId) matchStage._id = mongoose.Types.ObjectId(filters.studentId);
  if (filters.departmentId) matchStage.department = mongoose.Types.ObjectId(filters.departmentId);

  pipeline.push({ $match: matchStage });

  if (filters.academicYear) {
    pipeline.push(
      {
        $addFields: {
          academicYearBacklogs: {
            $filter: {
              input: '$backlogHistory',
              as: 'backlog',
              cond: { $eq: ['$$backlog.academicYear', filters.academicYear] },
            },
          },
          academicYearClearedBacklogs: {
            $filter: {
              input: '$backlogHistory',
              as: 'backlog',
              cond: { $eq: ['$$backlog.clearedInYear', filters.academicYear] },
            },
          },
        },
      },
      {
        $addFields: {
          backlogCount: { $size: '$academicYearBacklogs' },
          clearedCount: { $size: '$academicYearClearedBacklogs' },
        },
      },
    );
  } else {
    pipeline.push({
      $addFields: {
        backlogCount: '$currentBacklogs',
        clearedCount: '$totalBacklogsCleared',
      },
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: 'departments',
        localField: 'department',
        foreignField: '_id',
        as: 'deptData',
      },
    },
    { $unwind: '$deptData' },
    {
      $group: {
        _id: '$department',
        deptName: { $first: '$deptData.name' },
        deptCode: { $first: '$deptData.code' },
        totalStudents: { $sum: 1 },
        studentsWithBacklogs: { $sum: { $cond: [{ $gt: ['$backlogCount', 0] }, 1, 0] } },
        avgBacklogs: { $avg: '$backlogCount' },
        totalBacklogs: { $sum: '$backlogCount' },
        maxBacklogs: { $max: '$backlogCount' },
        totalCleared: { $sum: '$clearedCount' },
      },
    },
    {
      $addFields: {
        backlogPercentage: {
          $round: [{ $multiply: [{ $divide: ['$studentsWithBacklogs', '$totalStudents'] }, 100] }, 2],
        },
      },
    },
    { $sort: { backlogPercentage: -1 } },
  );

  return await Student.aggregate(pipeline);
};

/**
 * Get subject-wise pass percentage analysis
 */
const getSubjectWisePassPercentage = async (filters = {}) => {
  const matchStage = {};
  const departmentId = resolveObjectId(filters.departmentId || filters.department);
  const subjectIds = Array.isArray(filters.subjectIds)
    ? filters.subjectIds.map(resolveObjectId).filter(Boolean)
    : [];
  if (filters.semester) matchStage.semester = parseInt(filters.semester);
  if (filters.academicYear) matchStage.academicYear = filters.academicYear;
  if (subjectIds.length) matchStage.subject = { $in: subjectIds };

  return await Marks.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: 'subjects',
        localField: 'subject',
        foreignField: '_id',
        as: 'subjectData',
      },
    },
    { $unwind: '$subjectData' },
    {
      $lookup: {
        from: 'departments',
        localField: 'subjectData.department',
        foreignField: '_id',
        as: 'deptData',
      },
    },
    { $unwind: '$deptData' },
    ...(departmentId
      ? [
          {
            $match: {
              'deptData._id': departmentId,
            },
          },
        ]
      : []),
    {
      $group: {
        _id: '$subject',
        subjectName: { $first: '$subjectData.name' },
        subjectCode: { $first: '$subjectData.code' },
        deptName: { $first: '$deptData.name' },
        deptCode: { $first: '$deptData.code' },
        semester: { $first: '$subjectData.semester' },
        totalStudents: { $sum: 1 },
        passCount: { $sum: { $cond: [{ $eq: ['$result', 'PASS'] }, 1, 0] } },
        avgMarks: { $avg: '$total' },
        avgGradePoints: { $avg: '$gradePoints' },
      },
    },
    {
      $addFields: {
        passPercentage: {
          $round: [{ $multiply: [{ $divide: ['$passCount', '$totalStudents'] }, 100] }, 2],
        },
      },
    },
    { $sort: { passPercentage: 1 } },
  ]);
};

const getSubjectFailureAnalysis = async (filters = {}) => {
  const subjectStats = await getSubjectWisePassPercentage(filters);

  return subjectStats
    .map((item) => ({
      ...item,
      failureCount: (item.totalStudents || 0) - (item.passCount || 0),
      failurePercentage: item.totalStudents
        ? Number((((item.totalStudents - item.passCount) / item.totalStudents) * 100).toFixed(2))
        : 0,
    }))
    .sort((a, b) => {
      if (b.failureCount !== a.failureCount) {
        return b.failureCount - a.failureCount;
      }
      return b.failurePercentage - a.failurePercentage;
    });
};

const getDepartmentWiseStatistics = async (filters = {}) => {
  const departmentId = resolveObjectId(filters.departmentId || filters.department);
  const [passData, attendanceData, placementData, cgpaData] = await Promise.all([
    getPassPercentageByDept(filters),
    getAttendanceByDept(filters),
    getPlacementAnalytics(filters),
    getAverageCGPAByDept({ ...filters, departmentId }),
  ]);

  const passMap = new Map(passData.map((item) => [String(item._id), item]));
  const attendanceMap = new Map(attendanceData.map((item) => [String(item._id), item]));
  const placementMap = new Map(placementData.map((item) => [String(item._id), item]));

  return cgpaData.map((item) => {
    const key = String(item._id);
    return {
      deptId: item._id,
      deptName: item.deptName,
      deptCode: item.deptCode,
      studentCount: item.studentCount,
      averageCGPA: item.averageCGPA,
      highestCGPA: item.highestCGPA,
      passPercentage: passMap.get(key)?.passPercentage || 0,
      averageAttendance: attendanceMap.get(key)?.avgAttendance || 0,
      attendanceBelowThreshold: attendanceMap.get(key)?.belowThreshold || 0,
      placementPercentage: placementMap.get(key)?.placementPercentage || 0,
      placedCount: placementMap.get(key)?.placedCount || 0,
      averagePackage: placementMap.get(key)?.avgPackage || 0,
      highestPackage: placementMap.get(key)?.maxPackage || 0,
    };
  }).sort((a, b) => b.averageCGPA - a.averageCGPA);
};

/**
 * Get CGPA distribution analysis
 */
const getCGPADistribution = async (filters = {}) => {
  const matchStage = {};
  if (filters.departmentId) matchStage.department = mongoose.Types.ObjectId(filters.departmentId);
  if (filters.batchYear) matchStage.batchYear = parseInt(filters.batchYear);

  return await Student.aggregate([
    { $match: matchStage },
    {
      $bucket: {
        groupBy: '$cgpa',
        boundaries: [0, 4, 5, 6, 7, 8, 9, 10],
        output: {
          count: { $sum: 1 },
          students: { $push: { name: '$name', rollNumber: '$rollNumber', cgpa: '$cgpa' } },
        },
      },
    },
    {
      $project: {
        range: {
          $switch: {
            branches: [
              { case: { $eq: ['$_id', 0] }, then: '0.0 - 3.9' },
              { case: { $eq: ['$_id', 4] }, then: '4.0 - 4.9' },
              { case: { $eq: ['$_id', 5] }, then: '5.0 - 5.9' },
              { case: { $eq: ['$_id', 6] }, then: '6.0 - 6.9' },
              { case: { $eq: ['$_id', 7] }, then: '7.0 - 7.9' },
              { case: { $eq: ['$_id', 8] }, then: '8.0 - 8.9' },
              { case: { $eq: ['$_id', 9] }, then: '9.0 - 10.0' },
            ],
            default: 'Unknown',
          },
        },
        count: 1,
        students: 1,
      },
    },
    { $sort: { range: 1 } },
  ]);
};

/**
 * Get individual student performance trend
 */
const getStudentPerformanceTrend = async (studentId) => {
  return await Marks.aggregate([
    { $match: { student: mongoose.Types.ObjectId(studentId) } },
    {
      $lookup: {
        from: 'subjects',
        localField: 'subject',
        foreignField: '_id',
        as: 'subjectData',
      },
    },
    { $unwind: '$subjectData' },
    {
      $group: {
        _id: {
          semester: '$semester',
          academicYear: '$academicYear',
        },
        avgGradePoints: { $avg: '$gradePoints' },
        avgMarks: { $avg: '$total' },
        totalSubjects: { $sum: 1 },
        passedSubjects: { $sum: { $cond: [{ $eq: ['$result', 'PASS'] }, 1, 0] } },
        subjects: {
          $push: {
            name: '$subjectData.name',
            code: '$subjectData.code',
            total: '$total',
            grade: '$grade',
            gradePoints: '$gradePoints',
          },
        },
      },
    },
    { $sort: { '_id.semester': 1 } },
  ]);
};

/**
 * Get faculty achievements analytics
 */
const getFacultyAchievements = async (filters = {}) => {
  const matchStage = {};
  const departmentId = resolveObjectId(filters.departmentId || filters.department);
  if (filters.type) matchStage.type = filters.type;
  if (filters.level) matchStage.level = filters.level;
  if (filters.dateRange) {
    matchStage.date = filters.dateRange;
  } else if (filters.academicYear) {
    const [startYear] = filters.academicYear.split('-').map(Number);
    matchStage.date = {
      $gte: new Date(`${startYear}-07-01`),
      $lt: new Date(`${startYear + 1}-07-01`),
    };
  }

  return await FacultyAchievement.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: 'faculties',
        localField: 'faculty',
        foreignField: '_id',
        as: 'facultyData',
      },
    },
    { $unwind: '$facultyData' },
    ...(departmentId
      ? [
          {
            $match: {
              'facultyData.department': departmentId,
            },
          },
        ]
      : []),
    {
      $lookup: {
        from: 'departments',
        localField: 'facultyData.department',
        foreignField: '_id',
        as: 'deptData',
      },
    },
    { $unwind: '$deptData' },
    {
      $group: {
        _id: '$deptData._id',
        deptName: { $first: '$deptData.name' },
        deptCode: { $first: '$deptData.code' },
        totalAchievements: { $sum: 1 },
        byType: {
          $push: {
            type: '$type',
            level: '$level',
            points: '$points',
          },
        },
        totalPoints: { $sum: '$points' },
      },
    },
    { $sort: { totalPoints: -1 } },
  ]);
};

/**
 * Get student participation statistics
 */
const getStudentParticipationStats = async (filters = {}) => {
  const matchStage = {};
  const departmentId = resolveObjectId(filters.departmentId || filters.department);
  if (filters.eventType) matchStage['event.type'] = filters.eventType;
  if (filters.level) matchStage['event.level'] = filters.level;
  if (filters.dateRange) {
    matchStage['event.startDate'] = filters.dateRange;
  } else if (filters.academicYear) {
    const [startYear] = filters.academicYear.split('-').map(Number);
    matchStage['event.startDate'] = {
      $gte: new Date(`${startYear}-07-01`),
      $lt: new Date(`${startYear + 1}-07-01`),
    };
  }

  return await Participation.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: 'events',
        localField: 'event',
        foreignField: '_id',
        as: 'eventData',
      },
    },
    { $unwind: '$eventData' },
    {
      $lookup: {
        from: 'students',
        localField: 'student',
        foreignField: '_id',
        as: 'studentData',
      },
    },
    { $unwind: '$studentData' },
    {
      $lookup: {
        from: 'departments',
        localField: 'studentData.department',
        foreignField: '_id',
        as: 'deptData',
      },
    },
    { $unwind: '$deptData' },
    ...(departmentId
      ? [
          {
            $match: {
              'deptData._id': departmentId,
            },
          },
        ]
      : []),
    {
      $group: {
        _id: '$deptData._id',
        deptName: { $first: '$deptData.name' },
        deptCode: { $first: '$deptData.code' },
        totalParticipants: { $sum: 1 },
        totalEvents: { $addToSet: '$event' },
        winners: { $sum: { $cond: [{ $in: ['$role', ['Winner', 'Runner-up']] }, 1, 0] } },
        totalPoints: { $sum: '$pointsEarned' },
        byEventType: {
          $push: {
            type: '$eventData.type',
            role: '$role',
            points: '$pointsEarned',
          },
        },
      },
    },
    {
      $addFields: {
        uniqueEvents: { $size: '$totalEvents' },
        avgPointsPerParticipant: { $divide: ['$totalPoints', '$totalParticipants'] },
      },
    },
    { $sort: { totalPoints: -1 } },
  ]);
};

module.exports = {
  getPassPercentageByDept,
  getAttendanceByDept,
  getPlacementAnalytics,
  getDepartmentRanking,
  getCGPATrend,
  getAverageCGPAByDept,
  getBacklogAnalysis,
  getSubjectWisePassPercentage,
  getSubjectFailureAnalysis,
  getDepartmentWiseStatistics,
  getCGPADistribution,
  getStudentPerformanceTrend,
  getFacultyAchievements,
  getStudentParticipationStats,
};
