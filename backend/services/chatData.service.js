const mongoose = require("mongoose");
const Student = require("../models/Student");
const Department = require("../models/Department");
const Faculty = require("../models/Faculty");
const Placement = require("../models/Placement");
const ResearchPaper = require("../models/ResearchPaper");
const Attendance = require("../models/Attendance");
const Marks = require("../models/Marks");
const FacultyAchievement = require("../models/FacultyAchievement");
const Document = require("../models/Document");
const NAACCriteria = require("../models/NAACCriteria");
const NBACriteria = require("../models/NBACriteria");
const { Event, Participation } = require("../models/Event");
const Subject = require("../models/Subject");
const User = require("../models/User");
const {
  getDepartmentRanking,
  getPlacementAnalytics,
  getAttendanceByDept,
} = require("./analytics.service");
const { resolveYearFilterContext } = require("./chatbotYearFilter.service");
const { resolveMentionedDepartments } = require("./chatbotFilter.service");
const { executeDatabaseKnowledgeQuery } = require("./databaseKnowledge.service");
const { executeRawDatabaseQuery } = require("./rawDatabase.service");

const STUDENT_ROLL_PATTERN = /(?:roll\s*(?:number|no)?|student)\s*[:#-]?\s*([A-Za-z]{2,10}\d{2,})/i;
const PLAIN_ROLL_PATTERN = /\b([A-Za-z]{2,10}\d{4,})\b/g;
const SUBJECT_CODE_PATTERN = /\b([A-Z]{2,6}\d{3}[A-Z]?)\b/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const SEMESTER_PATTERN = /semester\s*(\d{1,2})/i;
const ACADEMIC_YEAR_PATTERN = /(20\d{2})\s*-\s*(\d{2,4})/i;
const TOP_PATTERN = /\btop\s+(\d+)\b/i;

const normalizeText = (value = "") => value.trim().toLowerCase();
const detectPrimaryEntity = (message = "") => {
  const normalized = normalizeText(message);

  if (/\bstudents?\b/.test(normalized)) return "student";
  if (/\b(faculty|faculties|staff)\b/.test(normalized)) return "faculty";
  if (/\bdepartments?\b/.test(normalized)) return "department";
  return null;
};

const formatNumber = (value, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null;
  }

  return Number(Number(value).toFixed(digits));
};

const parseAcademicYear = (message) => {
  const match = message.match(ACADEMIC_YEAR_PATTERN);
  if (!match) {
    return null;
  }

  const startYear = match[1];
  const rawEnd = match[2];
  const endYear = rawEnd.length === 4 ? rawEnd.slice(2) : rawEnd;
  return `${startYear}-${endYear}`;
};

const parseSemester = (message) => {
  const match = message.match(SEMESTER_PATTERN);
  return match ? Number(match[1]) : null;
};

const parseTopLimit = (message) => {
  const match = message.match(TOP_PATTERN);
  return match ? Math.min(Number(match[1]), 10) : 5;
};

const detectIntentFlags = (message) => {
  const normalized = normalizeText(message);
  const wantsReport =
    normalized.includes("report") ||
    normalized.includes("summary report") ||
    normalized.includes("generate report") ||
    normalized.includes("prepare report") ||
    normalized.includes("pdf") ||
    normalized.includes("docx") ||
    normalized.includes("document format") ||
    normalized.includes("document file") ||
    normalized.includes("download report") ||
    normalized.includes("export report");

  let reportType = null;
  if (wantsReport) {
    if (normalized.includes("placement")) reportType = "placement";
    else if (normalized.includes("attendance")) reportType = "attendance";
    else if (normalized.includes("cgpa")) reportType = "cgpa";
    else if (normalized.includes("research") || normalized.includes("publication")) reportType = "research";
    else if (normalized.includes("achievement") || normalized.includes("award")) reportType = "achievement";
    else if (normalized.includes("document") || normalized.includes("accreditation")) reportType = "document";
    else if (normalized.includes("naac")) reportType = "naac";
    else if (normalized.includes("nba")) reportType = "nba";
    else if (normalized.includes("department")) reportType = "department";
    else if (normalized.includes("student")) reportType = "student";
    else reportType = "general";
  }

  return {
    wantsReport,
    reportType,
    wantsRanking:
      normalized.includes("rank") ||
      normalized.includes("ranking") ||
      normalized.includes("top department"),
    wantsPlacement: normalized.includes("placement") || normalized.includes("package"),
    wantsResearch:
      normalized.includes("research") ||
      normalized.includes("paper") ||
      normalized.includes("publication"),
    wantsAttendance: normalized.includes("attendance"),
    wantsCgpa: normalized.includes("cgpa"),
    wantsMarks:
      normalized.includes("marks") ||
      normalized.includes("grade") ||
      normalized.includes("result") ||
      normalized.includes("pass percentage"),
    wantsBacklogs:
      normalized.includes("backlog") || normalized.includes("at risk"),
    wantsDocuments:
      normalized.includes("document") ||
      normalized.includes("evidence") ||
      normalized.includes("file") ||
      normalized.includes("accreditation"),
    wantsAchievements:
      normalized.includes("achievement") ||
      normalized.includes("award") ||
      normalized.includes("certification") ||
      normalized.includes("recognition") ||
      normalized.includes("grant") ||
      normalized.includes("patent"),
    wantsNaac: normalized.includes("naac"),
    wantsNba: normalized.includes("nba"),
    wantsEvents:
      normalized.includes("event") ||
      normalized.includes("participation") ||
      normalized.includes("workshop") ||
      normalized.includes("seminar"),
    wantsTopStudents:
      normalized.includes("top students") ||
      normalized.includes("highest cgpa") ||
      normalized.includes("best students"),
  };
};

const detectYearScopedEntity = (message = "", intentFlags = {}) => {
  if (intentFlags.wantsNaac) return "naac";
  if (intentFlags.wantsNba) return "nba";
  if (intentFlags.wantsDocuments) return "document";
  if (intentFlags.wantsAchievements) return "achievement";
  if (intentFlags.wantsResearch) return "research";
  if (intentFlags.wantsEvents) return "event";
  if (intentFlags.wantsPlacement) return "placement";
  if (intentFlags.wantsAttendance) return "attendance";
  if (intentFlags.wantsMarks || intentFlags.wantsBacklogs) return "mark";
  if (/\bstudents?\b/.test(normalizeText(message))) return "student";
  return detectPrimaryEntity(message);
};

const buildQueryFilters = (message) => {
  const intentFlags = detectIntentFlags(message);
  const yearContext = resolveYearFilterContext({
    message,
    entity: detectYearScopedEntity(message, intentFlags),
  });

  return {
    academicYear: yearContext.academicYear || parseAcademicYear(message),
    batchYear: yearContext.batchYear ?? null,
    year: yearContext.year ?? null,
    dateRange: yearContext.dateRange || null,
    semester: parseSemester(message),
    topLimit: parseTopLimit(message),
    ...intentFlags,
  };
};

const findMentionedDepartments = async (message) => {
  return resolveMentionedDepartments(message);
};

const findStudentFromMessage = async (message) => {
  const rollMatch = message.match(STUDENT_ROLL_PATTERN);
  let rollNumber = rollMatch?.[1]?.toUpperCase() || null;

  if (!rollNumber) {
    const plainMatches = [...message.matchAll(PLAIN_ROLL_PATTERN)]
      .map((match) => match[1].toUpperCase());

    if (plainMatches.length > 0) {
      const student = await Student.findOne({ rollNumber: { $in: plainMatches } })
        .populate("department", "name code");
      return student;
    }

    return null;
  }

  return Student.findOne({ rollNumber }).populate("department", "name code");
};

const findFacultyFromMessage = async (message) => {
  const faculties = await Faculty.find({ isActive: true })
    .select("name email designation qualification experience specialization phone department")
    .populate("department", "name code");
  const normalizedMessage = normalizeText(message);

  return faculties.find((faculty) => normalizedMessage.includes(normalizeText(faculty.name))) || null;
};

const findSubjectFromMessage = async (message) => {
  const subjectCodes = [...message.matchAll(SUBJECT_CODE_PATTERN)].map((match) => match[1].toUpperCase());
  if (subjectCodes.length) {
    const subject = await Subject.findOne({ code: { $in: subjectCodes } })
      .populate("department", "name code")
      .populate("faculty", "name email designation");
    if (subject) return subject;
  }

  const subjects = await Subject.find({})
    .select("name code semester credits type department faculty")
    .populate("department", "name code")
    .populate("faculty", "name email designation");
  const normalizedMessage = normalizeText(message);
  return subjects.find((subject) => normalizedMessage.includes(normalizeText(subject.name))) || null;
};

const findUserFromMessage = async (message) => {
  const emailMatch = message.match(EMAIL_PATTERN);
  if (!emailMatch) {
    return null;
  }

  return User.findOne({ email: emailMatch[0].toLowerCase() })
    .select("name email role isActive department createdAt")
    .populate("department", "name code");
};

const buildFacultySnapshot = async (faculty) => ({
  name: faculty.name,
  email: faculty.email,
  designation: faculty.designation,
  qualification: faculty.qualification,
  experience: faculty.experience,
  specialization: faculty.specialization,
  phone: faculty.phone,
  department: faculty.department?.name || null,
  departmentCode: faculty.department?.code || null,
});

const buildSubjectSnapshot = async (subject) => ({
  name: subject.name,
  code: subject.code,
  semester: subject.semester,
  credits: subject.credits,
  type: subject.type,
  department: subject.department?.name || null,
  departmentCode: subject.department?.code || null,
  faculty: subject.faculty?.name || null,
  facultyEmail: subject.faculty?.email || null,
  facultyDesignation: subject.faculty?.designation || null,
});

const buildUserSnapshot = async (user) => ({
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  department: user.department?.name || null,
  departmentCode: user.department?.code || null,
  createdAt: user.createdAt,
});

const buildDepartmentComparison = async (departments, filters) => {
  const uniqueDepartments = departments
    .filter((department, index, arr) =>
      arr.findIndex((item) => item._id.toString() === department._id.toString()) === index
    )
    .slice(0, 2);

  if (uniqueDepartments.length < 2) {
    return null;
  }

  const snapshots = await Promise.all(
    uniqueDepartments.map((department) => buildDepartmentSnapshot(department, filters))
  );

  return {
    comparedDepartments: snapshots,
    summary: snapshots.map((item) => ({
      name: item.name,
      code: item.code,
      averageCGPA: item.averageCGPA,
      averageAttendance: item.averageAttendance,
      placementPercentage: item.placementPercentage,
      passPercentage: item.passPercentage,
      researchPapers: item.researchPapers,
      rank: item.rank,
      score: item.score,
    })),
  };
};

const buildOverviewSnapshot = async (filters) => {
  const marksMatch = {};
  const attendanceMatch = {};
  const placementMatch = {};

  if (filters.academicYear) {
    marksMatch.academicYear = filters.academicYear;
    attendanceMatch.academicYear = filters.academicYear;
    placementMatch.academicYear = filters.academicYear;
  }

  if (filters.semester) {
    marksMatch.semester = filters.semester;
    attendanceMatch.semester = filters.semester;
  }

  const [
    totalStudents,
    activeStudents,
    atRiskStudents,
    totalDepartments,
    totalPlacements,
    totalResearchPapers,
    totalFacultyAchievements,
    cgpaStats,
    attendanceStats,
    marksStats,
  ] = await Promise.all([
    Student.countDocuments(),
    Student.countDocuments({ isActive: true }),
    Student.countDocuments({ isAtRisk: true }),
    Department.countDocuments({ isActive: true }),
    Placement.countDocuments(placementMatch),
    ResearchPaper.countDocuments(),
    FacultyAchievement.countDocuments(),
    Student.aggregate([
      {
        $group: {
          _id: null,
          averageCGPA: { $avg: "$cgpa" },
          highestCGPA: { $max: "$cgpa" },
        },
      },
    ]),
    Attendance.aggregate([
      { $match: attendanceMatch },
      {
        $group: {
          _id: null,
          averageAttendance: { $avg: "$percentage" },
          belowThreshold: { $sum: { $cond: ["$isBelowThreshold", 1, 0] } },
        },
      },
    ]),
    Marks.aggregate([
      { $match: marksMatch },
      {
        $group: {
          _id: null,
          averageMarks: { $avg: "$total" },
          passCount: { $sum: { $cond: [{ $eq: ["$result", "PASS"] }, 1, 0] } },
          totalResults: { $sum: 1 },
        },
      },
    ]),
  ]);

  const markSummary = marksStats[0] || {};

  return {
    sourceDatabase: mongoose.connection?.db?.databaseName || null,
    filtersApplied: {
      academicYear: filters.academicYear,
      semester: filters.semester,
    },
    totalStudents,
    activeStudents,
    atRiskStudents,
    totalDepartments,
    totalPlacements,
    totalResearchPapers,
    totalFacultyAchievements,
    averageCGPA: formatNumber(cgpaStats[0]?.averageCGPA),
    highestCGPA: formatNumber(cgpaStats[0]?.highestCGPA),
    averageAttendance: formatNumber(attendanceStats[0]?.averageAttendance),
    attendanceBelowThreshold: attendanceStats[0]?.belowThreshold || 0,
    averageMarks: formatNumber(markSummary.averageMarks),
    passPercentage:
      markSummary.totalResults > 0
        ? formatNumber((markSummary.passCount / markSummary.totalResults) * 100)
        : null,
  };
};

const buildDepartmentSnapshot = async (department, filters) => {
  const studentMatch = { department: department._id };
  const marksMatch = {};
  const attendanceMatch = {};
  const placementFilters = {};

  if (filters.academicYear) {
    marksMatch.academicYear = filters.academicYear;
    attendanceMatch.academicYear = filters.academicYear;
    placementFilters.academicYear = filters.academicYear;
  }

  if (filters.semester) {
    marksMatch.semester = filters.semester;
    attendanceMatch.semester = filters.semester;
  }

  const [studentStats, marksStats, attendanceStats, placementStats, researchStats, ranking] =
    await Promise.all([
      Student.aggregate([
        { $match: studentMatch },
        {
          $group: {
            _id: null,
            totalStudents: { $sum: 1 },
            activeStudents: { $sum: { $cond: ["$isActive", 1, 0] } },
            atRiskStudents: { $sum: { $cond: ["$isAtRisk", 1, 0] } },
            averageCGPA: { $avg: "$cgpa" },
            highestCGPA: { $max: "$cgpa" },
            totalBacklogs: { $sum: "$currentBacklogs" },
          },
        },
      ]),
      Marks.aggregate([
        {
          $lookup: {
            from: "students",
            localField: "student",
            foreignField: "_id",
            as: "studentData",
          },
        },
        { $unwind: "$studentData" },
        {
          $match: {
            "studentData.department": department._id,
            ...marksMatch,
          },
        },
        {
          $group: {
            _id: null,
            averageMarks: { $avg: "$total" },
            passCount: { $sum: { $cond: [{ $eq: ["$result", "PASS"] }, 1, 0] } },
            totalResults: { $sum: 1 },
          },
        },
      ]),
      Attendance.aggregate([
        {
          $lookup: {
            from: "students",
            localField: "student",
            foreignField: "_id",
            as: "studentData",
          },
        },
        { $unwind: "$studentData" },
        {
          $match: {
            "studentData.department": department._id,
            ...attendanceMatch,
          },
        },
        {
          $group: {
            _id: null,
            averageAttendance: { $avg: "$percentage" },
            belowThreshold: { $sum: { $cond: ["$isBelowThreshold", 1, 0] } },
          },
        },
      ]),
      getPlacementAnalytics(placementFilters),
      ResearchPaper.aggregate([
        {
          $lookup: {
            from: "faculties",
            localField: "faculty",
            foreignField: "_id",
            as: "facultyData",
          },
        },
        { $unwind: "$facultyData" },
        { $match: { "facultyData.department": department._id } },
        {
          $group: {
            _id: null,
            paperCount: { $sum: 1 },
            avgCitations: { $avg: "$citations" },
          },
        },
      ]),
      getDepartmentRanking(),
    ]);

  const placementInfo = placementStats.find(
    (item) => item._id.toString() === department._id.toString()
  );
  const rankingInfo = ranking.find(
    (item) => item.deptId.toString() === department._id.toString()
  );
  const studentSummary = studentStats[0] || {};
  const marksSummary = marksStats[0] || {};
  const attendanceSummary = attendanceStats[0] || {};
  const researchSummary = researchStats[0] || {};

  return {
    name: department.name,
    code: department.code,
    filtersApplied: {
      academicYear: filters.academicYear,
      semester: filters.semester,
    },
    totalStudents: studentSummary.totalStudents || 0,
    activeStudents: studentSummary.activeStudents || 0,
    atRiskStudents: studentSummary.atRiskStudents || 0,
    averageCGPA: formatNumber(studentSummary.averageCGPA),
    highestCGPA: formatNumber(studentSummary.highestCGPA),
    totalBacklogs: studentSummary.totalBacklogs || 0,
    averageMarks: formatNumber(marksSummary.averageMarks),
    passPercentage:
      marksSummary.totalResults > 0
        ? formatNumber((marksSummary.passCount / marksSummary.totalResults) * 100)
        : null,
    averageAttendance: formatNumber(attendanceSummary.averageAttendance),
    attendanceBelowThreshold: attendanceSummary.belowThreshold || 0,
    placementPercentage: placementInfo?.placementPercentage || 0,
    placedCount: placementInfo?.placedCount || 0,
    averagePackage: formatNumber(placementInfo?.avgPackage),
    highestPackage: formatNumber(placementInfo?.maxPackage),
    researchPapers: researchSummary.paperCount || 0,
    averageCitations: formatNumber(researchSummary.avgCitations),
    rank: rankingInfo?.rank || null,
    score: formatNumber(rankingInfo?.score),
  };
};

const buildStudentSnapshot = async (student, filters) => {
  const attendanceMatch = { student: student._id };
  const marksMatch = { student: student._id };
  const placementMatch = { student: student._id };

  if (filters.academicYear) {
    attendanceMatch.academicYear = filters.academicYear;
    marksMatch.academicYear = filters.academicYear;
    placementMatch.academicYear = filters.academicYear;
  }

  if (filters.semester) {
    attendanceMatch.semester = filters.semester;
    marksMatch.semester = filters.semester;
  }

  const [attendanceStats, marksStats, placements] = await Promise.all([
    Attendance.aggregate([
      { $match: attendanceMatch },
      {
        $group: {
          _id: null,
          averageAttendance: { $avg: "$percentage" },
          belowThresholdCount: { $sum: { $cond: ["$isBelowThreshold", 1, 0] } },
          latestAcademicYear: { $max: "$academicYear" },
        },
      },
    ]),
    Marks.aggregate([
      { $match: marksMatch },
      {
        $group: {
          _id: null,
          averageMarks: { $avg: "$total" },
          passedSubjects: {
            $sum: { $cond: [{ $eq: ["$result", "PASS"] }, 1, 0] },
          },
          totalSubjects: { $sum: 1 },
          latestSemester: { $max: "$semester" },
        },
      },
    ]),
    Placement.find(placementMatch)
      .sort({ placementDate: -1 })
      .select("company package role placementDate academicYear"),
  ]);

  const attendance = attendanceStats[0] || {};
  const marks = marksStats[0] || {};
  const latestPlacement = placements[0] || null;

  return {
    name: student.name,
    rollNumber: student.rollNumber,
    email: student.email || null,
    phone: student.phone || null,
    department: student.department?.name || null,
    departmentCode: student.department?.code || null,
    batchYear: student.batchYear,
    currentSemester: student.currentSemester,
    filtersApplied: {
      academicYear: filters.academicYear,
      semester: filters.semester,
    },
    cgpa: formatNumber(student.cgpa),
    isAtRisk: student.isAtRisk,
    riskReasons: student.riskReasons || [],
    currentBacklogs: student.currentBacklogs || 0,
    totalBacklogsCleared: student.totalBacklogsCleared || 0,
    averageAttendance: formatNumber(attendance.averageAttendance),
    attendanceBelowThresholdCount: attendance.belowThresholdCount || 0,
    latestAttendanceAcademicYear: attendance.latestAcademicYear || null,
    averageMarks: formatNumber(marks.averageMarks),
    passedSubjects: marks.passedSubjects || 0,
    totalSubjects: marks.totalSubjects || 0,
    latestSemester: marks.latestSemester || null,
    latestPlacement: latestPlacement
      ? {
          company: latestPlacement.company,
          package: formatNumber(latestPlacement.package),
          role: latestPlacement.role,
          academicYear: latestPlacement.academicYear,
        }
      : null,
  };
};

const buildPlacementOverview = async (filters, topLimit) => {
  const data = await getPlacementAnalytics({
    academicYear: filters.academicYear,
  });

  return data.slice(0, topLimit).map((item) => ({
    department: item.deptName,
    code: item.deptCode,
    placedCount: item.placedCount,
    placementPercentage: item.placementPercentage,
    averagePackage: formatNumber(item.avgPackage),
    highestPackage: formatNumber(item.maxPackage),
  }));
};

const buildAttendanceOverview = async (filters, topLimit) => {
  const data = await getAttendanceByDept({
    academicYear: filters.academicYear,
    semester: filters.semester,
  });

  return data.slice(0, topLimit).map((item) => ({
    department: item.deptName,
    code: item.deptCode,
    averageAttendance: formatNumber(item.avgAttendance),
    belowThreshold: item.belowThreshold,
  }));
};

const buildCgpaOverview = async (filters, topLimit) => {
  const topStudents = await Student.find({
    isActive: true,
    ...(filters.batchYear !== null && filters.batchYear !== undefined
      ? { batchYear: Number(filters.batchYear) }
      : {}),
  })
    .sort({ cgpa: -1 })
    .limit(topLimit)
    .select("name rollNumber cgpa")
    .lean();

  return {
    topStudents: topStudents.map((studentItem) => ({
      name: studentItem.name,
      rollNumber: studentItem.rollNumber,
      cgpa: formatNumber(studentItem.cgpa),
    })),
  };
};

const buildResearchOverview = async (filters, department, topLimit) => {
  const matchStage = {
    ...(department ? { department: department._id } : {}),
    ...(filters.year !== null && filters.year !== undefined
      ? { year: Number(filters.year) }
      : filters.academicYear
        ? { year: Number(String(filters.academicYear).slice(0, 4)) }
        : {}),
  };

  const pipeline = [{ $match: matchStage }];
  if (department) {
    pipeline.push(
      {
        $lookup: {
          from: "faculties",
          localField: "faculty",
          foreignField: "_id",
          as: "facultyData",
        },
      },
      { $unwind: "$facultyData" },
      { $match: { "facultyData.department": department._id } }
    );
  }

  pipeline.push(
    {
      $group: {
        _id: "$publicationType",
        count: { $sum: 1 },
        avgCitations: { $avg: "$citations" },
      },
    },
    { $sort: { count: -1 } },
    { $limit: topLimit }
  );

  const byType = await ResearchPaper.aggregate(pipeline);
  const totalCount = await ResearchPaper.countDocuments(matchStage);

  return {
    totalCount,
    byType: byType.map((item) => ({
      type: item._id,
      count: item.count,
      averageCitations: formatNumber(item.avgCitations),
    })),
  };
};

const buildFacultyAchievementOverview = async (filters, department, topLimit) => {
  const match = { isActive: true };

  if (filters.dateRange) {
    match.date = filters.dateRange;
  } else if (filters.academicYear) {
    const [startYear] = String(filters.academicYear).split("-").map(Number);
    if (Number.isFinite(startYear)) {
      match.date = {
        $gte: new Date(`${startYear}-07-01T00:00:00.000Z`),
        $lt: new Date(`${startYear + 1}-07-01T00:00:00.000Z`),
      };
    }
  }

  const pipeline = [{ $match: match }];

  pipeline.push(
    {
      $lookup: {
        from: "faculties",
        localField: "faculty",
        foreignField: "_id",
        as: "facultyData",
      },
    },
    { $unwind: "$facultyData" }
  );

  if (department) {
    pipeline.push({
      $match: {
        "facultyData.department": department._id,
      },
    });
  }

  const [byType, byLevel, totals] = await Promise.all([
    FacultyAchievement.aggregate([
      ...pipeline,
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalPoints: { $sum: "$points" },
        },
      },
      { $sort: { count: -1, totalPoints: -1 } },
      { $limit: topLimit },
    ]),
    FacultyAchievement.aggregate([
      ...pipeline,
      {
        $group: {
          _id: "$level",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: topLimit },
    ]),
    FacultyAchievement.aggregate([
      ...pipeline,
      {
        $group: {
          _id: null,
          totalAchievements: { $sum: 1 },
          totalPoints: { $sum: "$points" },
          uniqueFacultyIds: { $addToSet: "$faculty" },
        },
      },
    ]),
  ]);

  const summary = totals[0] || {};

  return {
    totalAchievements: summary.totalAchievements || 0,
    totalPoints: summary.totalPoints || 0,
    totalFaculty: Array.isArray(summary.uniqueFacultyIds)
      ? summary.uniqueFacultyIds.length
      : 0,
    byType: byType.map((item) => ({
      type: item._id || "Unknown",
      count: item.count,
      totalPoints: item.totalPoints || 0,
    })),
    byLevel: byLevel.map((item) => ({
      level: item._id || "Unknown",
      count: item.count,
    })),
  };
};

const buildMarksOverview = async (filters, department) => {
  const matchStage = {};
  if (filters.academicYear) {
    matchStage.academicYear = filters.academicYear;
  }
  if (filters.semester) {
    matchStage.semester = filters.semester;
  }

  const pipeline = [{ $match: matchStage }];

  if (department) {
    pipeline.push(
      {
        $lookup: {
          from: "students",
          localField: "student",
          foreignField: "_id",
          as: "studentData",
        },
      },
      { $unwind: "$studentData" },
      { $match: { "studentData.department": department._id } }
    );
  }

  pipeline.push({
    $group: {
      _id: null,
      averageMarks: { $avg: "$total" },
      averageGradePoints: { $avg: "$gradePoints" },
      passCount: { $sum: { $cond: [{ $eq: ["$result", "PASS"] }, 1, 0] } },
      failCount: { $sum: { $cond: [{ $eq: ["$result", "FAIL"] }, 1, 0] } },
      totalResults: { $sum: 1 },
    },
  });

  const result = await Marks.aggregate(pipeline);
  const summary = result[0] || {};

  return {
    averageMarks: formatNumber(summary.averageMarks),
    averageGradePoints: formatNumber(summary.averageGradePoints),
    passCount: summary.passCount || 0,
    failCount: summary.failCount || 0,
    passPercentage:
      summary.totalResults > 0
        ? formatNumber((summary.passCount / summary.totalResults) * 100)
        : null,
    totalResults: summary.totalResults || 0,
  };
};

const buildBacklogOverview = async (department, topLimit) => {
  const match = department ? { department: department._id } : {};
  const stats = await Student.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalStudents: { $sum: 1 },
        studentsWithBacklogs: { $sum: { $cond: [{ $gt: ["$currentBacklogs", 0] }, 1, 0] } },
        totalBacklogs: { $sum: "$currentBacklogs" },
        averageBacklogs: { $avg: "$currentBacklogs" },
      },
    },
  ]);

  const topBacklogStudents = await Student.find({
    ...match,
    currentBacklogs: { $gt: 0 },
  })
    .sort({ currentBacklogs: -1, cgpa: 1 })
    .limit(topLimit)
    .select("name rollNumber currentBacklogs cgpa")
    .lean();

  const summary = stats[0] || {};
  return {
    totalStudents: summary.totalStudents || 0,
    studentsWithBacklogs: summary.studentsWithBacklogs || 0,
    totalBacklogs: summary.totalBacklogs || 0,
    averageBacklogs: formatNumber(summary.averageBacklogs),
    topStudents: topBacklogStudents.map((item) => ({
      name: item.name,
      rollNumber: item.rollNumber,
      currentBacklogs: item.currentBacklogs,
      cgpa: formatNumber(item.cgpa),
    })),
  };
};

const buildDocumentOverview = async (filters, department) => {
  const match = {};
  if (filters.academicYear) {
    match.academicYear = filters.academicYear;
  }
  if (department) {
    match.department = department._id;
  }

  const [statusCounts, accreditationCounts, totalDocuments] = await Promise.all([
    Document.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Document.aggregate([
      { $match: match },
      { $group: { _id: "$accreditationType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Document.countDocuments(match),
  ]);

  return {
    totalDocuments,
    byStatus: statusCounts.map((item) => ({ status: item._id || "Unknown", count: item.count })),
    byAccreditation: accreditationCounts.map((item) => ({
      accreditationType: item._id || "Unknown",
      count: item.count,
    })),
  };
};

const buildNaacOverview = async (filters) => {
  const match = {};
  if (filters.academicYear) {
    match.academicYear = filters.academicYear;
  }

  const [totalCriteria, byStatus, byCompliance] = await Promise.all([
    NAACCriteria.countDocuments(match),
    NAACCriteria.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    NAACCriteria.aggregate([
      { $match: match },
      { $group: { _id: "$complianceLevel", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  return {
    totalCriteria,
    byStatus: byStatus.map((item) => ({ status: item._id, count: item.count })),
    byCompliance: byCompliance.map((item) => ({
      complianceLevel: item._id,
      count: item.count,
    })),
  };
};

const buildNbaOverview = async (filters, department) => {
  const match = {};
  if (filters.academicYear) {
    match.academicYear = filters.academicYear;
  }
  if (department) {
    match.program = department._id;
  }

  const [totalCriteria, byStatus, avgCompliance] = await Promise.all([
    NBACriteria.countDocuments(match),
    NBACriteria.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    NBACriteria.aggregate([
      { $match: match },
      { $group: { _id: null, averageComplianceScore: { $avg: "$complianceScore" } } },
    ]),
  ]);

  return {
    totalCriteria,
    averageComplianceScore: formatNumber(avgCompliance[0]?.averageComplianceScore),
    byStatus: byStatus.map((item) => ({ status: item._id, count: item.count })),
  };
};

const buildEventOverview = async (filters, department, topLimit) => {
  const eventMatch = {
    ...(filters.dateRange ? { startDate: filters.dateRange } : {}),
  };
  if (department) {
    eventMatch.department = department._id;
  }

  const [eventCount, byType, participationStats] = await Promise.all([
    Event.countDocuments(eventMatch),
    Event.aggregate([
      { $match: eventMatch },
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: topLimit },
    ]),
    Participation.aggregate([
      {
        $lookup: {
          from: "events",
          localField: "event",
          foreignField: "_id",
          as: "eventData",
        },
      },
      { $unwind: "$eventData" },
      ...(department ? [{ $match: { "eventData.department": department._id } }] : []),
      {
        $group: {
          _id: null,
          totalParticipations: { $sum: 1 },
          winners: {
            $sum: { $cond: [{ $in: ["$role", ["Winner", "Runner-up"]] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  return {
    totalEvents: eventCount,
    byType: byType.map((item) => ({ type: item._id, count: item.count })),
    totalParticipations: participationStats[0]?.totalParticipations || 0,
    winners: participationStats[0]?.winners || 0,
  };
};

const buildLiveDataContext = async (message, accessScope = null) => {
  const filters = buildQueryFilters(message);
  const primaryEntity = detectPrimaryEntity(message);
  const canUseInstitutionAnalytics = Boolean(accessScope?.canUseInstitutionAnalytics);
  const canUseDepartmentAnalytics = Boolean(accessScope?.canUseDepartmentAnalytics);
  const resolvedDepartments = accessScope?.role === "hod" && accessScope?.department
    ? [accessScope.department]
    : await findMentionedDepartments(message);
  const [overview, student, faculty, subject, user] = await Promise.all([
    canUseInstitutionAnalytics ? buildOverviewSnapshot(filters) : Promise.resolve(null),
    accessScope?.role === "student"
      ? Promise.resolve(accessScope.studentProfile || null)
      : findStudentFromMessage(message),
    accessScope?.role === "faculty" || accessScope?.role === "hod"
      ? Promise.resolve(accessScope.facultyProfile || null)
      : findFacultyFromMessage(message),
    accessScope?.role === "faculty" ? Promise.resolve(null) : findSubjectFromMessage(message),
    canUseInstitutionAnalytics ? findUserFromMessage(message) : Promise.resolve(null),
  ]);
  const departments = resolvedDepartments || [];
  const department = departments[0] || accessScope?.department || null;

  const facts = {
    sourceDatabase: mongoose.connection?.db?.databaseName || null,
    primaryEntity,
    queryFilters: {
      academicYear: filters.academicYear,
      batchYear: filters.batchYear,
      year: filters.year,
      semester: filters.semester,
      topLimit: filters.topLimit,
      wantsReport: filters.wantsReport,
      reportType: filters.reportType,
    },
    overview,
    accessScope: accessScope
      ? {
          role: accessScope.role,
          scopeKey: accessScope.scopeKey,
          departmentCode: accessScope.departmentCode || null,
          rolePromptContext: accessScope.rolePromptContext || null,
        }
      : null,
  };

  if (student) {
    facts.student = await buildStudentSnapshot(student, filters);
  }

  if (faculty) {
    facts.faculty = await buildFacultySnapshot(faculty);
  }

  if (subject) {
    facts.subject = await buildSubjectSnapshot(subject);
  }

  if (user) {
    facts.user = await buildUserSnapshot(user);
  }

  if (
    department &&
    primaryEntity !== "student" &&
    primaryEntity !== "faculty" &&
    (canUseDepartmentAnalytics || canUseInstitutionAnalytics)
  ) {
    facts.department = await buildDepartmentSnapshot(department, filters);
  }

  if (
    canUseInstitutionAnalytics &&
    departments.length >= 2 &&
    primaryEntity !== "student" &&
    primaryEntity !== "faculty"
  ) {
    facts.departmentComparison = await buildDepartmentComparison(departments, filters);
  }

  if (filters.wantsRanking && canUseInstitutionAnalytics) {
    facts.departmentRanking = (await getDepartmentRanking()).slice(0, filters.topLimit);
  }

  if (filters.wantsPlacement && canUseInstitutionAnalytics && !facts.department?.placementPercentage) {
    facts.placementOverview = await buildPlacementOverview(filters, filters.topLimit);
  }

  if (
    filters.wantsAttendance &&
    canUseInstitutionAnalytics &&
    !facts.department?.averageAttendance &&
    !facts.student?.averageAttendance
  ) {
    facts.attendanceOverview = await buildAttendanceOverview(filters, filters.topLimit);
  }

  if (filters.wantsCgpa && canUseInstitutionAnalytics) {
    facts.cgpaOverview = await buildCgpaOverview(filters, filters.topLimit);
  }

  if (filters.wantsResearch && (canUseInstitutionAnalytics || canUseDepartmentAnalytics)) {
    facts.researchOverview = await buildResearchOverview(
      filters,
      department,
      filters.topLimit
    );
  }

  if (filters.wantsAchievements && (canUseInstitutionAnalytics || canUseDepartmentAnalytics)) {
    facts.achievementOverview = await buildFacultyAchievementOverview(
      filters,
      department,
      filters.topLimit
    );
  }

  if (filters.wantsMarks && (canUseInstitutionAnalytics || canUseDepartmentAnalytics)) {
    facts.marksOverview = await buildMarksOverview(filters, department);
  }

  if (filters.wantsBacklogs && canUseInstitutionAnalytics) {
    facts.backlogOverview = await buildBacklogOverview(department, filters.topLimit);
  }

  if (filters.wantsDocuments && (canUseInstitutionAnalytics || canUseDepartmentAnalytics)) {
    facts.documentOverview = await buildDocumentOverview(filters, department);
  }

  if (filters.wantsNaac && canUseInstitutionAnalytics) {
    facts.naacOverview = await buildNaacOverview(filters);
  }

  if (filters.wantsNba && (canUseInstitutionAnalytics || canUseDepartmentAnalytics)) {
    facts.nbaOverview = await buildNbaOverview(filters, department);
  }

  if (filters.wantsEvents && (canUseInstitutionAnalytics || canUseDepartmentAnalytics)) {
    facts.eventOverview = await buildEventOverview(
      filters,
      department,
      filters.topLimit
    );
  }

  const shouldRunDatabaseKnowledgeQuery = !filters.wantsReport;

  if (shouldRunDatabaseKnowledgeQuery) {
    const databaseKnowledge = await executeDatabaseKnowledgeQuery(message, accessScope);
    if (databaseKnowledge) {
      facts.databaseKnowledge = databaseKnowledge;
    }

    const rawDatabaseKnowledge = canUseInstitutionAnalytics
      ? await executeRawDatabaseQuery(message)
      : null;
    if (rawDatabaseKnowledge) {
      facts.rawDatabaseKnowledge = rawDatabaseKnowledge;
    }
  }

  return facts;
};

module.exports = {
  buildLiveDataContext,
  buildQueryFilters,
};
