const mongoose = require("mongoose");
const { buildLiveDataContext } = require("../services/chatData.service");
const { handleAnalyticsQuery } = require("../services/chatbotAnalytics.service");
const { buildChatbotReport } = require("../services/chatbotReport.service");
const {
  buildUniversalReport,
  validateReportDataset,
} = require("../services/chatbotUniversalReport.service");
const {
  extractFilters,
  filterRowsByConditions,
  parseAdvancedFilters,
} = require("../services/chatbotFilter.service");
const {
  applyDataLimitPolicy,
} = require("../services/chatbotDataLimit.service");
const {
  buildEntityQuery,
  detectEntity,
  getModel,
  isSingleQuery: isEntitySingleQuery,
  resolveEntityDataQuery,
} = require("../services/chatbotEntityData.service");
const {
  detectEntity: detectCountEntity,
  isCountQuery,
  resolveCountQuery,
} = require("../services/chatbotCount.service");
const {
  getGeminiResponse,
} = require("../services/geminiService");
const {
  buildUniversalInsightResponse,
} = require("../services/chatbotInsight.service");
const {
  runInstitutionalAnalyticsEngine,
} = require("../services/institutionalAnalyticsEngine.service");
const {
  resolveStrictEntityQuery,
} = require("../services/strictEntityQueryEngine.service");
const {
  buildQueryPlan,
} = require("../services/chatbotQueryPlanner.service");
const {
  buildQueryRoutingDecision,
  shouldBuildQueryRoutingDecision,
} = require("../services/chatbotQueryRouting.service");
const {
  buildDynamicInsight,
  extractUsableData,
  generateDynamicReport,
  getContextEntry,
  inferEntityTypeFromData,
  isContextQuery,
  normalizeDataset,
  setContextEntry,
} = require("../services/chatbotContext.service");
const {
  formatUnifiedResponse,
  getDeterministicReply,
  isTopQuery,
} = require("../services/chatbotResponse.service");
const {
  detectDataQueryType,
  enhanceStudentDataResponse,
  extractDepartment,
  formatStudentResponse,
  formatStudentRows,
  formatTopStudents,
  getTopLimit,
  getTopPerformers,
  processStudentData,
  shouldUseStudentCollectionQuery,
} = require("../services/chatbotStudentData.service");
const {
  getSubjectFailureAnalysis,
  isSubjectQuery,
} = require("../services/chatbotSubjectAnalytics.service");
const {
  getYearScopeLabel,
} = require("../services/chatbotYearFilter.service");
const {
  buildAccessDeniedMessage,
  decoratePayloadWithAccessScope,
  resolveChatbotAccessScope,
  scopeMatchesMetadata,
  validateAndApplyRoleScope,
} = require("../services/chatbotAccessScope.service");
const {
  buildFileBaseName,
  exportInsightAsPdf,
  exportReportAsPdf,
  exportReportAsDocx,
} = require("../services/chatExport.service");
const {
  buildRecommendationPayload,
  detectRecommendationIntent,
  extractExplicitStudentData,
  sanitizeStudentData: sanitizeRecommendationStudentData,
} = require("../services/chatbotRecommendation.service");
const {
  buildPlacementCountResponse,
  buildPlacementDataResponse,
  buildPlacementReportDomainResponse,
  isPlacementDomainQuery,
} = require("../services/chatbotPlacement.service");
const {
  buildSchemaAwareQueryPlan,
  shouldBuildSchemaAwareQueryPlan,
} = require("../services/schemaAwareQueryPlanner.service");
const {
  buildReportExecutionPlan,
  shouldBuildReportExecutionPlan,
} = require("../services/reportExecutionPlanner.service");
const {
  extractQueryParameters,
  shouldExtractQueryParameters,
} = require("../services/queryParameterExtractor.service");
const {
  formatReportResponse,
} = require("../services/reportResponseFormatter.service");
const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Marks = require("../models/Marks");
const Placement = require("../models/Placement");

let sessions = {};
const chatSessions = new Map();

const ROLL_NUMBER_PATTERN = /\b([A-Za-z]{2,10}\d{2,})\b/i;
const FOLLOW_UP_PREFIX_PATTERN = /^(and|also|then|next|what about|how about|what about the|how about the)\b/i;
const FILTER_RESULT_EXPIRY_MS = 10 * 60 * 1000;
const LIST_QUERY_PATTERN = /\b(students?|all|list|who have|who has|top|highest|lowest)\b/i;
const TOP_PACKAGE_PATTERN = /\b(top|highest)\s+package\b|\bpackage\b.*\b(top|highest)\b/i;
const CORE_QUERY_PATTERNS = {
  attendance: /\b(attendance|present|absent|classes)\b/i,
  marks: /\b(mark|marks|grade|grades|score|scores|result|results)\b/i,
  cgpa: /\b(cgpa|performance|gpa)\b/i,
  backlog: /\b(backlog|backlogs|arrear|arrears|failed subject|failed subjects)\b/i,
  placement: /\b(placement|placed|company|package|job|offer)\b/i,
};

const getClientSessionKey = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  const clientIp = Array.isArray(forwarded)
    ? forwarded[0]
    : String(forwarded || req.ip || req.connection?.remoteAddress || "anonymous")
        .split(",")[0]
        .trim();

  return req.user?._id ? `user:${req.user._id}` : `ip:${clientIp}`;
};

const getUserId = (req) => req.user?.id || req.user?._id || req.ip;
const getContextStoreKey = (req) => getClientSessionKey(req);

const getStoredContext = (req) => getContextEntry(getContextStoreKey(req));

const rememberContextState = (
  req,
  {
    message,
    payload = {},
    rawData = null,
    entityType = null,
    queryType = null,
    preserveExistingData = false,
    accessScope = null,
  } = {}
) => {
  const current = getStoredContext(req);
  const normalizedData = normalizeDataset(
    rawData !== null ? rawData : extractUsableData(payload)
  );
  const lastData =
    normalizedData.length > 0
      ? normalizedData
      : preserveExistingData
        ? current?.lastData || null
        : null;

  if (!lastData && !current) {
    return null;
  }

  return setContextEntry(getContextStoreKey(req), {
    lastData,
    entityType:
      entityType ||
      payload.entity ||
      payload.meta?.entity ||
      inferEntityTypeFromData(lastData || [], current?.entityType || "generic"),
    queryType:
      queryType ||
      payload.queryType ||
      payload.meta?.queryType ||
      payload.type ||
      current?.queryType ||
      null,
    lastQuery: message || current?.lastQuery || null,
    lastPayload: payload || current?.lastPayload || null,
    accessScopeKey: accessScope?.scopeKey || current?.accessScopeKey || null,
    accessRole: accessScope?.role || current?.accessRole || null,
  });
};

const cleanupFilterSessions = () => {
  const expiryTime = Date.now() - FILTER_RESULT_EXPIRY_MS;
  for (const [userId, value] of Object.entries(sessions)) {
    if ((value?.updatedAt || 0) < expiryTime) {
      delete sessions[userId];
    }
  }
};

const getLatestContext = (req) => {
  cleanupFilterSessions();
  const userId = getUserId(req);
  return userId ? sessions[userId] || null : null;
};

const updateLatestContext = (req, value = {}) => {
  cleanupFilterSessions();
  const userId = getUserId(req);
  if (!userId) {
    return null;
  }

  sessions[userId] = {
    ...(sessions[userId] || {}),
    ...value,
    updatedAt: Date.now(),
  };

  return sessions[userId];
};

const clearLatestContext = (req) => {
  const userId = getUserId(req);
  if (userId && sessions[userId]) {
    delete sessions[userId];
  }
};

const cleanupExpiredSessions = () => {
  const expiryTime = Date.now() - FILTER_RESULT_EXPIRY_MS;
  for (const [key, value] of chatSessions.entries()) {
    if ((value?.updatedAt || 0) < expiryTime) {
      chatSessions.delete(key);
    }
  }
};

const getSession = (req) => {
  cleanupExpiredSessions();
  return chatSessions.get(getClientSessionKey(req)) || null;
};

const setSession = (req, value) => {
  chatSessions.set(getClientSessionKey(req), {
    ...value,
    updatedAt: Date.now(),
  });
};

const updateSession = (req, value = {}) => {
  const current = getSession(req) || {};
  const next = {
    ...current,
    ...value,
  };

  Object.keys(next).forEach((key) => {
    if (next[key] === null || next[key] === undefined) {
      delete next[key];
    }
  });

  setSession(req, next);
};

const sanitizeDepartment = (department) => {
  if (!department) {
    return null;
  }

  if (typeof department === "string") {
    return {
      _id: "",
      name: department,
      code: null,
    };
  }

  return {
    _id: String(department._id || department.id || ""),
    name: department.name || department.department || null,
    code: department.code || department.departmentCode || null,
  };
};

const sanitizeStudent = (student) => {
  if (!student) {
    return null;
  }

  return {
    _id: String(student._id || student.id || ""),
    name: student.name || null,
    rollNumber: student.rollNumber || null,
    email: student.email || null,
    department:
      sanitizeDepartment(student.department) ||
      (student.department || student.departmentCode
        ? {
            _id: "",
            name: student.department || null,
            code: student.departmentCode || null,
          }
        : null),
  };
};

const extractDepartmentContext = (liveFacts = {}) => {
  if (liveFacts.department) {
    return sanitizeDepartment(liveFacts.department);
  }

  if (liveFacts.student?.department || liveFacts.student?.departmentCode) {
    return {
      _id: "",
      name: liveFacts.student.department || null,
      code: liveFacts.student.departmentCode || null,
    };
  }

  return null;
};

const extractStudentContext = (liveFacts = {}) =>
  liveFacts.student ? sanitizeStudent(liveFacts.student) : null;

const clearPendingSession = (req) => {
  updateSession(req, {
    pendingIntent: null,
    candidateStudents: null,
  });
};

const ADMIN_DATABASE_PARAMETER_ENTITIES = new Set([
  "research_papers",
  "achievements",
  "documents",
  "naac",
  "nba",
]);

const ADMIN_DATABASE_COLLECTIONS = new Set([
  "researchpapers",
  "facultyachievements",
  "documents",
  "naaccriterias",
  "nbacriterias",
]);

const recordConversationState = (
  req,
  { message, intent, liveFacts, rows = [], keepExistingRows = false, accessScope = null }
) => {
  const currentSession = getSession(req) || {};
  const currentLatest = getLatestContext(req);
  const lastStudent = extractStudentContext(liveFacts) || currentSession.lastStudent || null;
  const lastDepartment =
    extractDepartmentContext(liveFacts) || currentSession.lastDepartment || null;

  clearPendingSession(req);
  updateSession(req, {
    lastStudent,
    lastDepartment,
    lastIntent: intent,
    lastContextType: lastStudent ? "student" : lastDepartment ? "department" : "general",
    accessScopeKey: accessScope?.scopeKey || currentSession.accessScopeKey || null,
  });

  updateLatestContext(req, {
    lastIntent: intent,
    lastQuery: message,
    lastResult: keepExistingRows
      ? currentLatest?.lastResult || []
      : Array.isArray(rows)
        ? rows
        : [],
    accessScopeKey: accessScope?.scopeKey || currentLatest?.accessScopeKey || null,
  });
};

const resolveSelectedStudentRecommendationData = async (req, accessScope = null) => {
  const session = getSession(req);
  let selectedStudentId =
    req.body?.selectedStudentId ||
    req.body?.selectedStudent?._id ||
    session?.lastStudent?._id ||
    null;

  if (accessScope?.role === "student") {
    selectedStudentId = accessScope.studentId || selectedStudentId;
  }

  if (
    accessScope?.role === "hod" &&
    selectedStudentId &&
    session?.lastStudent?.departmentCode &&
    accessScope.departmentCode &&
    String(session.lastStudent.departmentCode).toUpperCase() !==
      String(accessScope.departmentCode).toUpperCase()
  ) {
    return {
      studentData: null,
      studentContext: null,
    };
  }

  if (
    accessScope?.role === "faculty" &&
    selectedStudentId &&
    Array.isArray(accessScope.accessibleStudentIds) &&
    !accessScope.accessibleStudentIds.map(String).includes(String(selectedStudentId))
  ) {
    return {
      studentData: null,
      studentContext: null,
    };
  }

  if (!selectedStudentId || !mongoose.Types.ObjectId.isValid(selectedStudentId)) {
    return {
      studentData: null,
      studentContext: null,
    };
  }

  const student = await Student.findById(selectedStudentId)
    .select("name rollNumber cgpa currentBacklogs academicRecords.avgAttendance department")
    .populate("department", "name code")
    .lean();

  if (!student) {
    return {
      studentData: null,
      studentContext: null,
    };
  }

  let attendanceValue = Number(student.academicRecords?.avgAttendance);
  if (!Number.isFinite(attendanceValue)) {
    const attendanceStats = await Attendance.aggregate([
      { $match: { student: student._id } },
      {
        $group: {
          _id: null,
          averageAttendance: { $avg: "$percentage" },
        },
      },
    ]);

    attendanceValue = Number(attendanceStats[0]?.averageAttendance);
  }

  return {
    studentData: sanitizeRecommendationStudentData({
      cgpa: student.cgpa,
      attendance: Number.isFinite(attendanceValue) ? attendanceValue : null,
      backlogs: student.currentBacklogs,
    }),
    studentContext: student,
  };
};

const resolveRecommendationRequest = async (req, message, accessScope = null) => {
  const explicitStudentData = extractExplicitStudentData({
    message,
    payload: req.body || {},
  });

  if (explicitStudentData) {
    return {
      studentData: explicitStudentData,
      studentContext: null,
    };
  }

  return resolveSelectedStudentRecommendationData(req, accessScope);
};

const pluralize = (count, singular, plural = `${singular}s`) =>
  Number(count) === 1 ? singular : plural;

const detectCoreIntent = (message = "") => {
  if (CORE_QUERY_PATTERNS.attendance.test(message)) return "attendance";
  if (CORE_QUERY_PATTERNS.marks.test(message)) return "marks";
  if (CORE_QUERY_PATTERNS.cgpa.test(message)) return "cgpa";
  if (CORE_QUERY_PATTERNS.backlog.test(message)) return "backlog";
  if (CORE_QUERY_PATTERNS.placement.test(message)) return "placement";
  return null;
};

const isListQuery = (message = "") => LIST_QUERY_PATTERN.test(message);

const shouldUseCoreStudentRecordRouting = ({
  message = "",
  session = null,
  entity = null,
} = {}) => {
  if (session?.pendingIntent) {
    return true;
  }

  if (entity && entity !== "student") {
    return false;
  }

  const coreIntent = detectCoreIntent(message);
  if (!coreIntent) {
    return false;
  }

  if (entity === "student") {
    return isEntitySingleQuery(message);
  }

  if (isListQuery(message) || /\bstudents?\b/i.test(message)) {
    return false;
  }

  return /\bof\b/i.test(message) || Boolean(message.match(ROLL_NUMBER_PATTERN));
};

const getRequestedTopLimit = (message = "", fallback = null) => {
  const match = message.match(/\btop\s+(\d+)\b/i);
  if (!match) {
    return fallback;
  }

  return Math.min(Math.max(parseInt(match[1], 10), 1), 25);
};

const extractStudentSearchText = (message = "") => {
  const trimmed = message.trim();
  if (!trimmed) {
    return "";
  }

  const rollMatch = trimmed.match(ROLL_NUMBER_PATTERN);
  if (rollMatch) {
    return rollMatch[1].toUpperCase();
  }

  return trimmed
    .replace(/\b(attendance|cgpa|performance|gpa|grade|grades|mark|marks|score|scores|result|results|backlog|backlogs|arrear|arrears|placement|placed|company|package|job|offer|student|details|info|information|show|tell|give|fetch|for|of|about|please|what|how|and)\b/gi, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const findCandidateStudents = async (message = "") => {
  const rollMatch = message.match(ROLL_NUMBER_PATTERN);
  if (rollMatch) {
    const student = await Student.findOne({
      rollNumber: rollMatch[1].toUpperCase(),
    })
      .populate("department", "name code")
      .lean();

    return student ? [student] : [];
  }

  const searchText = extractStudentSearchText(message);
  if (!searchText) {
    return [];
  }

  const nameRegex = new RegExp(searchText.split(/\s+/).join(".*"), "i");

  return Student.find({
    $or: [
      { name: { $regex: nameRegex } },
      { rollNumber: { $regex: new RegExp(searchText, "i") } },
      { email: { $regex: new RegExp(searchText, "i") } },
    ],
  })
    .populate("department", "name code")
    .sort({ name: 1, rollNumber: 1 })
    .limit(10)
    .lean();
};

const mapCandidateRow = (student = {}) => ({
  _id: String(student._id || student.id || ""),
  name: student.name || null,
  rollNumber: student.rollNumber || null,
  department: student.department?.name || student.department || null,
  departmentCode: student.department?.code || student.departmentCode || null,
});

const formatCandidatePrompt = (intent, candidates = []) => {
  const promptByIntent = {
    attendance: "I found multiple students for the attendance query.",
    marks: "I found multiple students for the marks query.",
    cgpa: "I found multiple students for the CGPA query.",
    backlog: "I found multiple students for the backlog query.",
    placement: "I found multiple students for the placement query.",
  };

  return [
    promptByIntent[intent] || "I found multiple matching students.",
    "Please reply with the roll number of the correct student:",
    ...candidates.map((student, index) => {
      const departmentCode = student.department?.code || student.departmentCode;
      return `${index + 1}. ${student.name} (${student.rollNumber})${departmentCode ? ` - ${departmentCode}` : ""}`;
    }),
  ].join("\n");
};

const selectStudentFromCandidates = (message = "", candidates = []) => {
  if (!candidates.length) {
    return null;
  }

  const normalized = message.trim().toLowerCase();
  const rollMatch = message.match(ROLL_NUMBER_PATTERN)?.[1]?.toUpperCase();
  if (rollMatch) {
    return candidates.find((student) => student.rollNumber === rollMatch) || null;
  }

  const numericChoice = Number.parseInt(normalized, 10);
  if (Number.isInteger(numericChoice) && numericChoice >= 1 && numericChoice <= candidates.length) {
    return candidates[numericChoice - 1];
  }

  return candidates.find((student) =>
    normalized.includes(String(student.name || "").toLowerCase())
  ) || null;
};

const formatAcademicSuffix = (record = {}) => {
  const parts = [];
  if (record.academicYear) parts.push(`academic year ${record.academicYear}`);
  if (record.semester) parts.push(`semester ${record.semester}`);
  return parts.length ? ` for ${parts.join(", ")}` : "";
};

const mapStudentRow = (student = {}) => ({
  name: student.name || null,
  rollNumber: student.rollNumber || null,
  department: student.department?.name || student.department || null,
  departmentCode: student.department?.code || student.departmentCode || null,
  batchYear: student.batchYear ?? null,
  cgpa: student.cgpa ?? null,
  averageAttendance:
    student.averageAttendance ??
    student.academicRecords?.avgAttendance ??
    null,
  currentBacklogs: student.currentBacklogs ?? 0,
  email: student.email || null,
});

const mapFacultyRow = (faculty = {}) => ({
  name: faculty.name || null,
  email: faculty.email || null,
  department: faculty.department || null,
  departmentCode: faculty.departmentCode || null,
  designation: faculty.designation || null,
  specialization: faculty.specialization || null,
  qualification: faculty.qualification || null,
  experience: faculty.experience ?? null,
});

const mapSubjectRow = (subject = {}) => ({
  name: subject.name || null,
  code: subject.code || null,
  semester: subject.semester ?? null,
  credits: subject.credits ?? null,
  type: subject.type || null,
  department: subject.department || null,
  departmentCode: subject.departmentCode || null,
  faculty: subject.faculty || null,
});

const mapUserRow = (user = {}) => ({
  name: user.name || null,
  email: user.email || null,
  role: user.role || null,
  isActive: user.isActive ?? null,
  department: user.department || null,
  departmentCode: user.departmentCode || null,
});

const mapDepartmentRow = (department = {}) => ({
  name: department.name || null,
  code: department.code || null,
  totalStudents: department.totalStudents ?? null,
  averageCGPA: department.averageCGPA ?? null,
  averageAttendance: department.averageAttendance ?? null,
  placementPercentage: department.placementPercentage ?? null,
  rank: department.rank ?? null,
  score: department.score ?? null,
});

const mapOverviewRow = (overview = {}) => ({
  activeStudents: overview.activeStudents ?? null,
  totalDepartments: overview.totalDepartments ?? null,
  averageCGPA: overview.averageCGPA ?? null,
  averageAttendance: overview.averageAttendance ?? null,
  totalPlacements: overview.totalPlacements ?? null,
  totalResearchPapers: overview.totalResearchPapers ?? null,
  atRiskStudents: overview.atRiskStudents ?? null,
});

const buildMarksReply = async (student) => {
  const latestRecord = await Marks.findOne({ student: student._id })
    .sort({ academicYear: -1, semester: -1, updatedAt: -1 })
    .populate("subject", "name code")
    .lean();

  if (!latestRecord) {
    return `I could not find marks records for ${student.name} (${student.rollNumber}).`;
  }

  const latestSemesterRecords = await Marks.find({
    student: student._id,
    academicYear: latestRecord.academicYear,
    semester: latestRecord.semester,
  })
    .populate("subject", "name code")
    .sort({ total: -1, updatedAt: -1 })
    .lean();

  const averageMarks = latestSemesterRecords.length
    ? Number(
        (
          latestSemesterRecords.reduce(
            (sum, item) => sum + Number(item.total || 0),
            0
          ) / latestSemesterRecords.length
        ).toFixed(2)
      )
    : Number(latestRecord.total || 0);

  const failedSubjects = latestSemesterRecords.filter(
    (item) => item.result === "FAIL"
  ).length;

  const highlights = latestSemesterRecords
    .slice(0, 3)
    .map(
      (item) =>
        `${item.subject?.code || item.subject?.name || "Subject"} ${item.total}`
    )
    .join(", ");

  return [
    `${student.name} (${student.rollNumber}) has an average of ${averageMarks} marks in semester ${latestRecord.semester}, ${latestRecord.academicYear}.`,
    highlights ? `Recent subject scores: ${highlights}.` : null,
    failedSubjects
      ? `${failedSubjects} ${pluralize(failedSubjects, "subject")} need attention in that semester.`
      : "No failed subjects were found in the latest marks snapshot.",
  ].filter(Boolean).join(" ");
};

const buildAttendanceReply = async (student) => {
  const attendanceRecords = await Attendance.find({ student: student._id })
    .populate("subject", "name code")
    .sort({ academicYear: -1, semester: -1, updatedAt: -1 })
    .lean();

  if (!attendanceRecords.length) {
    return `I could not find attendance records for ${student.name} (${student.rollNumber}).`;
  }

  const latestRecord = attendanceRecords[0];
  const averageAttendance = Number(
    (
      attendanceRecords.reduce(
        (sum, item) => sum + Number(item.percentage || 0),
        0
      ) / attendanceRecords.length
    ).toFixed(2)
  );

  return [
    `${student.name} (${student.rollNumber}) has an overall attendance of ${averageAttendance}%.`,
    latestRecord.subject?.code
      ? `Latest attendance record is ${latestRecord.percentage}% in ${latestRecord.subject.code}${formatAcademicSuffix(latestRecord)}.`
      : `Latest attendance record is ${latestRecord.percentage}%${formatAcademicSuffix(latestRecord)}.`,
    latestRecord.isBelowThreshold ? "This record is below the 75% threshold." : null,
  ].filter(Boolean).join(" ");
};

const buildCgpaReply = async (student) => {
  const latestMarks = await Marks.find({ student: student._id })
    .sort({ academicYear: -1, semester: -1, updatedAt: -1 })
    .limit(5)
    .populate("subject", "name code")
    .lean();

  const latestSemesterCgpa = student.academicRecords?.semesterCgpa?.length
    ? student.academicRecords.semesterCgpa[
        student.academicRecords.semesterCgpa.length - 1
      ]
    : null;

  return [
    `${student.name} (${student.rollNumber}) currently has a CGPA of ${student.cgpa ?? "N/A"}.`,
    latestSemesterCgpa
      ? `Latest semester CGPA is ${latestSemesterCgpa.cgpa} for semester ${latestSemesterCgpa.semester} in ${latestSemesterCgpa.academicYear}.`
      : null,
    latestMarks[0]?.total !== undefined
      ? `Most recent marks entry is ${latestMarks[0].total} in ${latestMarks[0].subject?.code || "the latest subject"}${formatAcademicSuffix(latestMarks[0])}.`
      : null,
  ].filter(Boolean).join(" ");
};

const buildBacklogReply = async (student) => {
  const failedMarks = await Marks.find({
    student: student._id,
    result: "FAIL",
  })
    .sort({ academicYear: -1, semester: -1, updatedAt: -1 })
    .populate("subject", "name code")
    .lean();

  const latestBacklog = failedMarks[0];

  return [
    `${student.name} (${student.rollNumber}) currently has ${student.currentBacklogs || 0} active ${pluralize(student.currentBacklogs || 0, "backlog")}.`,
    student.totalBacklogsCleared
      ? `Total cleared backlogs: ${student.totalBacklogsCleared}.`
      : null,
    latestBacklog?.subject?.code
      ? `Latest failed subject record is ${latestBacklog.subject.code}${formatAcademicSuffix(latestBacklog)}.`
      : null,
  ].filter(Boolean).join(" ");
};

const buildPlacementReply = async (student) => {
  const placement = await Placement.findOne({ student: student._id })
    .sort({ placementDate: -1, updatedAt: -1 })
    .lean();

  if (!placement) {
    return `I could not find a placement record for ${student.name} (${student.rollNumber}).`;
  }

  return [
    `${student.name} (${student.rollNumber}) was placed at ${placement.company} as ${placement.role}.`,
    `Package: ${placement.package} LPA.`,
    placement.location ? `Location: ${placement.location}.` : null,
    placement.academicYear ? `Academic year: ${placement.academicYear}.` : null,
    placement.placementType ? `Placement type: ${placement.placementType}.` : null,
  ].filter(Boolean).join(" ");
};

const resolveCoreStudentQuery = async ({ intent, student }) => {
  if (intent === "attendance") return buildAttendanceReply(student);
  if (intent === "marks") return buildMarksReply(student);
  if (intent === "cgpa") return buildCgpaReply(student);
  if (intent === "backlog") return buildBacklogReply(student);
  if (intent === "placement") return buildPlacementReply(student);
  return null;
};

const isLikelyFollowUpMessage = (message = "") => {
  const trimmed = message.trim();
  if (!trimmed || ROLL_NUMBER_PATTERN.test(trimmed) || /^\d+$/.test(trimmed)) {
    return false;
  }

  if (FOLLOW_UP_PREFIX_PATTERN.test(trimmed)) {
    return true;
  }

  const words = trimmed
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  return words.length <= 4 && Boolean(detectCoreIntent(trimmed));
};

const buildDepartmentFollowUpMessage = ({ intent, department }) => {
  if (!intent || !department) {
    return null;
  }

  const departmentLabel = department.code || department.name;
  if (!departmentLabel) {
    return null;
  }

  if (intent === "attendance") {
    return `department wise attendance in ${departmentLabel}`;
  }

  if (intent === "cgpa" || intent === "marks") {
    return `department wise statistics in ${departmentLabel}`;
  }

  if (intent === "placement") {
    return `department wise placement percentage in ${departmentLabel}`;
  }

  return null;
};

const buildContextAwareMessage = ({ message, session }) => {
  const intent = detectCoreIntent(message);
  if (!intent || !session || !isLikelyFollowUpMessage(message)) {
    return message;
  }

  if (session.lastContextType === "student" && session.lastStudent?.rollNumber) {
    return `${intent} of ${session.lastStudent.rollNumber}`;
  }

  if (session.lastContextType === "department" && session.lastDepartment) {
    return (
      buildDepartmentFollowUpMessage({
        intent,
        department: session.lastDepartment,
      }) || message
    );
  }

  return message;
};

const buildConsistentRows = (rows = [], lastQuery = "") => {
  const sampleRow = Array.isArray(rows) ? rows.find((row) => row && typeof row === "object") : null;
  const parsed = parseAdvancedFilters(lastQuery, {
    sampleData: sampleRow,
  });
  if (!parsed.conditions.length) {
    if (/\bbacklog|backlogs|arrear|arrears\b/i.test(lastQuery)) {
      return rows.filter(
        (row) => Number(row.backlogCount ?? row.currentBacklogs ?? 0) > 0
      );
    }

    return rows;
  }

  return filterRowsByConditions(rows, parsed.conditions, parsed.joiner);
};

const normalizeRowsForMessage = (rows = [], message = "") =>
  buildConsistentRows(rows, message);

const hasStudentReportRows = (rows = []) =>
  Array.isArray(rows) &&
  rows.some(
    (row) =>
      row &&
      (Object.prototype.hasOwnProperty.call(row, "cgpa") ||
        Object.prototype.hasOwnProperty.call(row, "averageAttendance") ||
        Object.prototype.hasOwnProperty.call(row, "currentBacklogs"))
  );

const buildFilteredRowsReport = ({ rows = [], lastQuery = "" }) => {
  const filters = extractFilters(lastQuery);
  const consistentRows = buildConsistentRows(rows, lastQuery).filter((row) =>
    filters.department
      ? String(row.departmentCode || "").toUpperCase() === filters.department
      : true
  );
  const previewRows = consistentRows.slice(0, 10);
  const validation = validateReportDataset({
    entityType: "student",
    fullRows: consistentRows,
    previewRows,
    filters,
  });
  const reportTitle = "# Filtered Student Report";
  const totalRecords = consistentRows.length;
  const averageCgpa = totalRecords
    ? Number(
        (
          consistentRows.reduce(
            (sum, item) => sum + Number(item.cgpa || 0),
            0
          ) / totalRecords
        ).toFixed(2)
      )
    : 0;
  const averageAttendance = totalRecords
    ? Number(
        (
          consistentRows.reduce(
            (sum, item) => sum + Number(item.averageAttendance || 0),
            0
          ) / totalRecords
        ).toFixed(2)
      )
    : 0;
  const averageBacklogs = totalRecords
    ? Number(
        (
          consistentRows.reduce(
            (sum, item) => sum + Number(item.currentBacklogs || 0),
            0
          ) / totalRecords
        ).toFixed(2)
      )
    : 0;

  const lines = [
    `Filter used: ${lastQuery || "Latest filtered student set"}`,
    `Students covered: ${totalRecords}`,
    `Average CGPA: ${averageCgpa}`,
    `Average attendance: ${averageAttendance}%`,
    `Average backlogs: ${averageBacklogs}`,
    `Preview rows shown: ${previewRows.length}`,
    ...previewRows.map(
      (item, index) =>
        `${index + 1}. ${item.name} (${item.rollNumber}) - CGPA ${item.cgpa ?? "N/A"}, attendance ${item.averageAttendance ?? "N/A"}%, backlogs ${item.currentBacklogs ?? 0}`
    ),
  ];

  return {
    title: reportTitle,
    reportText: [reportTitle, "Filtered Students Summary", ...lines.map((line) => `- ${line}`)].join("\n\n"),
    summary: {
      totalStudents: totalRecords,
      averageCgpa,
      averageAttendance,
      averageBacklogs,
      totalRecords,
      previewCount: previewRows.length,
      filters,
    },
    tables: [
      {
        title: "Filtered Student Results",
        rows: previewRows,
      },
    ],
    insights: lastQuery
      ? `This report uses the latest filtered student result set for "${lastQuery}".`
      : "This report uses the latest filtered student result set from the current conversation.",
    entityType: "student",
    filtered: Boolean(filters.department),
    filters,
    totalRecords,
    previewCount: previewRows.length,
    validation,
    contextData: consistentRows,
    data: {
      type: "student-filter-report",
      entity: "student",
      filtered: Boolean(filters.department),
      filters,
      totalRecords,
      previewCount: previewRows.length,
      rows: previewRows,
      sample: previewRows,
      validation,
    },
  };
};

const hasOwnProperty = (value, key) =>
  Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);

const buildStudentParsedQuery = (parsedQuery = null, defaultFilters = {}) => {
  const baseQuery =
    parsedQuery && typeof parsedQuery === "object" ? parsedQuery : {};
  const baseFilters =
    baseQuery.filters && typeof baseQuery.filters === "object"
      ? { ...baseQuery.filters }
      : {};

  Object.entries(defaultFilters).forEach(([key, value]) => {
    if (!hasOwnProperty(baseFilters, key)) {
      baseFilters[key] = value;
    }
  });

  return {
    ...baseQuery,
    entity: "student",
    filters: baseFilters,
  };
};

const getStudentDepartmentScopeLabel = (routeContext = null) =>
  routeContext?.selectedDepartment?.code ||
  routeContext?.selectedDepartment?.name ||
  null;

const getStudentBacklogScopeLabel = (parsedFilters = {}) => {
  const currentBacklogs = parsedFilters?.currentBacklogs;
  const backlogAlias = parsedFilters?.backlogs;
  const backlogFilter =
    currentBacklogs !== undefined ? currentBacklogs : backlogAlias;

  if (backlogFilter === undefined) {
    return null;
  }

  if (backlogFilter === 0 || backlogFilter === false) {
    return "without backlogs";
  }

  if (
    backlogFilter === true ||
    (backlogFilter &&
      typeof backlogFilter === "object" &&
      (backlogFilter.$gt !== undefined ||
        backlogFilter.$gte !== undefined ||
        backlogFilter.gt !== undefined ||
        backlogFilter.gte !== undefined))
  ) {
    return "with pending backlogs";
  }

  return "matching the backlog filter";
};

const buildStudentScopeSuffix = (routeContext = null, parsedFilters = {}) => {
  const scopeParts = [
    getStudentDepartmentScopeLabel(routeContext),
    getYearScopeLabel(routeContext?.yearContext),
  ].filter(Boolean);
  const backlogLabel = getStudentBacklogScopeLabel(parsedFilters);
  const scope = scopeParts.length ? ` in ${scopeParts.join(", ")}` : "";
  const backlogSuffix = backlogLabel ? ` ${backlogLabel}` : "";
  return `${scope}${backlogSuffix}`;
};

const buildStudentTitle = (baseTitle = "Students", routeContext = null) => {
  const titleScopeParts = [
    getStudentDepartmentScopeLabel(routeContext),
    routeContext?.yearContext?.batchYear !== null &&
    routeContext?.yearContext?.batchYear !== undefined
      ? `Batch ${routeContext.yearContext.batchYear}`
      : routeContext?.yearContext?.academicYear
        ? `Academic Year ${routeContext.yearContext.academicYear}`
        : routeContext?.yearContext?.year !== null &&
            routeContext?.yearContext?.year !== undefined
          ? `Year ${routeContext.yearContext.year}`
          : null,
  ].filter(Boolean);

  return titleScopeParts.length
    ? `${baseTitle} - ${titleScopeParts.join(" - ")}`
    : baseTitle;
};

const buildStudentRelaxationPrompt = (routeContext = null, parsedFilters = {}) => {
  const relaxable = [];

  if (getStudentDepartmentScopeLabel(routeContext) || parsedFilters.department) {
    relaxable.push("department");
  }

  if (routeContext?.yearContext?.hasYear) {
    relaxable.push(
      routeContext.yearContext.batchYear !== null ? "batch year" : "year"
    );
  }

  if (
    hasOwnProperty(parsedFilters, "backlogs") ||
    hasOwnProperty(parsedFilters, "currentBacklogs")
  ) {
    relaxable.push("backlog");
  }

  if (
    hasOwnProperty(parsedFilters, "attendance") ||
    hasOwnProperty(parsedFilters, "academicRecords.avgAttendance")
  ) {
    relaxable.push("attendance");
  }

  if (hasOwnProperty(parsedFilters, "cgpa")) {
    relaxable.push("CGPA");
  }

  if (!relaxable.length) {
    return "";
  }

  return ` Tell me which filter to relax: ${[...new Set(relaxable)].join(", ")}.`;
};

const buildStudentNoResultsReply = (
  baseReply = "I could not find any student records.",
  routeContext = null,
  parsedFilters = {}
) => `${baseReply}${buildStudentRelaxationPrompt(routeContext, parsedFilters)}`;

const resolveStudentRouteContext = async (
  message = "",
  parsedQuery = null,
  defaultFilters = {}
) =>
  buildEntityQuery(message, "student", {
    parsedFilters: buildStudentParsedQuery(parsedQuery, defaultFilters).filters,
  });

const buildDynamicStudentDataResponse = async (
  message = "",
  liveFacts = {},
  parsedQuery = null
) => {
  if (!shouldUseStudentCollectionQuery(message)) {
    return null;
  }

  const sourceDatabase = liveFacts.sourceDatabase || "mongodb";
  const queryType = detectDataQueryType(message);
  const routeContext = await resolveStudentRouteContext(message, parsedQuery);
  const parsedFilters = routeContext?.parsedFilters || {};
  const scopeSuffix = buildStudentScopeSuffix(routeContext, parsedFilters);
  const studentSelect =
    "name rollNumber batchYear cgpa currentBacklogs academicRecords.avgAttendance department";
  const baseQuery = () =>
    Student.find(routeContext?.query || { _id: null })
      .select(studentSelect)
      .populate("department", "name code");

  if (!routeContext) {
    return null;
  }

  if (routeContext.unsupportedYearFilter) {
    return {
      reply:
        "Year-wise filter is not available for general student details. Ask by batch year, for example \"2024 batch students\".",
      title: buildStudentTitle("Students", routeContext),
      count: 0,
      rows: [],
      responseType: "text",
      provider: "database",
      sourceDatabase,
      usedLiveData: true,
      extraData: [],
      smartProcessed: true,
      queryType,
    };
  }

  if (queryType === "top") {
    const requestedTopLimit =
      Number(parsedQuery?.limit) > 0
        ? Number(parsedQuery.limit)
        : getTopLimit(message, null);
    let queryBuilder = baseQuery().sort({ cgpa: -1, name: 1 });
    if (parsedQuery?.sort?.field) {
      const sortFieldMap = {
        cgpa: "cgpa",
        attendance: "academicRecords.avgAttendance",
        backlogs: "currentBacklogs",
        name: "name",
      };
      const mappedField = sortFieldMap[parsedQuery.sort.field] || parsedQuery.sort.field;
      queryBuilder = queryBuilder.sort({
        [mappedField]: parsedQuery.sort.order === "asc" ? 1 : -1,
        name: 1,
      });
    }
    if (requestedTopLimit) {
      queryBuilder = queryBuilder.limit(requestedTopLimit);
    }

    const topStudents = await queryBuilder.lean();

    if (!topStudents.length) {
      return {
        reply: buildStudentNoResultsReply(
          scopeSuffix
            ? `I could not find any student records${scopeSuffix}.`
            : "I could not find any student records.",
          routeContext,
          parsedFilters
        ),
        title: buildStudentTitle("Top Performers", routeContext),
        count: 0,
        rows: [],
        responseType: "top_performers",
        provider: "database",
        sourceDatabase,
        usedLiveData: true,
        extraData: [],
        smartProcessed: true,
        queryType,
      };
    }

    const formatted = formatTopStudents(topStudents);

    return {
      reply: `I found ${formatted.length} top performer ${pluralize(formatted.length, "record")}${scopeSuffix}.`,
      title: buildStudentTitle("Top Performers", routeContext),
      count: formatted.length,
      rows: formatted,
      summary: {
        count: formatted.length,
        department: getStudentDepartmentScopeLabel(routeContext),
        yearScope: getYearScopeLabel(routeContext.yearContext),
        queryType,
      },
      responseType: "top_performers",
      provider: "database",
      sourceDatabase,
      usedLiveData: true,
      extraData: formatted,
      contextData: formatted,
      smartProcessed: true,
      queryType,
    };
  }

  if (queryType === "low") {
    const lowStudents = await baseQuery()
      .sort({ cgpa: 1, name: 1 })
      .lean();

    if (!lowStudents.length) {
      return {
        reply: buildStudentNoResultsReply(
          scopeSuffix
            ? `I could not find any student records${scopeSuffix}.`
            : "I could not find any student records.",
          routeContext,
          parsedFilters
        ),
        title: buildStudentTitle("Low Performers", routeContext),
        count: 0,
        rows: [],
        responseType: "table",
        provider: "database",
        sourceDatabase,
        usedLiveData: true,
        extraData: [],
        smartProcessed: true,
        queryType,
      };
    }

    const formatted = formatStudentResponse(lowStudents);

    return {
      reply: `I found ${formatted.length} low performer ${pluralize(formatted.length, "record")}${scopeSuffix}.`,
      title: buildStudentTitle("Low Performers", routeContext),
      count: formatted.length,
      rows: formatted,
      summary: {
        count: formatted.length,
        department: getStudentDepartmentScopeLabel(routeContext),
        yearScope: getYearScopeLabel(routeContext.yearContext),
        queryType,
      },
      responseType: "table",
      provider: "database",
      sourceDatabase,
      usedLiveData: true,
      extraData: formatted,
      contextData: formatted,
      smartProcessed: true,
      queryType,
    };
  }

  const generalStudents = await baseQuery().sort({ name: 1 }).lean();

  if (!generalStudents.length) {
    return {
      reply: buildStudentNoResultsReply(
        scopeSuffix
          ? `I could not find any student records${scopeSuffix}.`
          : "I could not find any student records.",
        routeContext,
        parsedFilters
      ),
      title: buildStudentTitle("Students", routeContext),
      count: 0,
      rows: [],
      responseType: "data",
      provider: "database",
      sourceDatabase,
      usedLiveData: true,
      extraData: [],
      smartProcessed: true,
      queryType,
    };
  }

  const totalCount = generalStudents.length;
  const contextData = formatStudentRows(generalStudents);
  const formattedRows = contextData;

  return {
    reply: `I found ${totalCount} ${pluralize(totalCount, "student")}${scopeSuffix}.`,
    title: buildStudentTitle("Students", routeContext),
    count: totalCount,
    rows: formattedRows,
    summary: {
      count: totalCount,
      department: getStudentDepartmentScopeLabel(routeContext),
      yearScope: getYearScopeLabel(routeContext.yearContext),
      queryType,
    },
    responseType: "data",
    provider: "database",
    sourceDatabase,
    usedLiveData: true,
    extraData: formattedRows,
    contextData,
    smartProcessed: true,
    queryType,
  };
};

const buildBacklogListResponse = async (message = "", parsedQuery = null) => {
  const routeContext = await resolveStudentRouteContext(message, parsedQuery, {
    backlogs: true,
  });
  const parsedFilters = routeContext?.parsedFilters || {};
  const scopeSuffix = buildStudentScopeSuffix(routeContext, parsedFilters);

  if (!routeContext) {
    return null;
  }

  if (routeContext.unsupportedYearFilter) {
    return {
      reply:
        "Year-wise filter is not available for this backlog query. Ask by batch year, for example \"2024 batch students with backlog\".",
      title: buildStudentTitle("Students With Backlogs", routeContext),
      count: 0,
      rows: [],
      responseType: "text",
      extraData: [],
      contextData: [],
      smartProcessed: true,
      queryType: "backlog",
    };
  }

  const students = await Student.find(routeContext.query)
    .select("name rollNumber batchYear cgpa currentBacklogs department academicRecords.avgAttendance")
    .populate("department", "name code")
    .sort({ currentBacklogs: -1, cgpa: 1, name: 1 })
    .lean();

  const latestFailedSubjects = await Marks.find({
    student: { $in: students.map((student) => student._id) },
    result: "FAIL",
  })
    .populate("subject", "name code")
    .sort({ academicYear: -1, semester: -1, updatedAt: -1 })
    .lean();

  const subjectByStudent = new Map();
  for (const item of latestFailedSubjects) {
    const key = String(item.student);
    if (!subjectByStudent.has(key)) {
      subjectByStudent.set(key, item.subject?.code || item.subject?.name || null);
    }
  }

  const contextRows = students.map((student) => ({
    ...mapStudentRow(student),
    backlogCount: student.currentBacklogs || 0,
    subject: subjectByStudent.get(String(student._id)) || "N/A",
  }));
  const rows = contextRows;
  const totalCount = contextRows.length;
  const titleBase =
    getStudentBacklogScopeLabel(parsedFilters) === "without backlogs"
      ? "Students Without Backlogs"
      : "Students With Backlogs";

  return {
    reply: totalCount
      ? `I found ${totalCount} ${pluralize(totalCount, "student")}${scopeSuffix}.`
      : buildStudentNoResultsReply(
          scopeSuffix
            ? `I could not find any students${scopeSuffix}.`
            : "I could not find any students.",
          routeContext,
          parsedFilters
        ),
    title: buildStudentTitle(titleBase, routeContext),
    count: totalCount,
    rows,
    responseType: rows.length ? "table" : "text",
    summary: {
      count: totalCount,
      department: getStudentDepartmentScopeLabel(routeContext),
      yearScope: getYearScopeLabel(routeContext.yearContext),
    },
    extraData: rows,
    contextData: contextRows,
    smartProcessed: true,
    queryType: "backlog",
  };
};

const buildTopPackageResponse = async (message = "", accessScope = null) => {
  const limit = getRequestedTopLimit(message);
  const department =
    accessScope?.role === "hod" && accessScope?.department
      ? accessScope.department
      : await extractDepartment(message);
  const studentMatch = department?._id
    ? { isActive: true, department: department._id }
    : { isActive: true };
  const students = await Student.find(studentMatch).select("_id").lean();
  const studentIds = students.map((student) => student._id);
  let query = Placement.find(
    department?._id ? { student: { $in: studentIds } } : {}
  )
    .populate({
      path: "student",
      populate: {
        path: "department",
        select: "name code",
      },
    })
    .sort({ package: -1, placementDate: -1, updatedAt: -1 });

  if (limit) {
    query = query.limit(limit);
  }

  const placements = await query.lean();

  const rows = placements.map((placement) => ({
    name: placement.student?.name || "N/A",
    rollNumber: placement.student?.rollNumber || "N/A",
    department: placement.student?.department?.name || null,
    departmentCode: placement.student?.department?.code || null,
    company: placement.company || null,
    role: placement.role || null,
    package: placement.package ?? null,
    academicYear: placement.academicYear || null,
    placementType: placement.placementType || null,
  }));
  const departmentLabel = department?.code || department?.name || null;

  return {
    reply: rows.length
      ? `I found ${rows.length} placement ${pluralize(rows.length, "record")} sorted by highest package${departmentLabel ? ` in ${departmentLabel}` : ""}.`
      : departmentLabel
        ? `I could not find placement records for top package students in ${departmentLabel}.`
        : "I could not find placement records for top package students.",
    title: departmentLabel ? `Top Package Students - ${departmentLabel}` : "Top Package Students",
    rows,
    responseType: rows.length ? "table" : "text",
    contextData: rows,
  };
};

const buildBacklogCountResponse = async (message = "", parsedQuery = null) => {
  const routeContext = await resolveStudentRouteContext(message, parsedQuery, {
    backlogs: true,
  });
  const parsedFilters = routeContext?.parsedFilters || {};
  const total = routeContext ? await Student.countDocuments(routeContext.query) : 0;
  const scopeSuffix = buildStudentScopeSuffix(routeContext, parsedFilters);
  const label =
    getStudentBacklogScopeLabel(parsedFilters) || "matching the backlog filter";

  return {
    reply:
      total > 0
        ? `Total students${scopeSuffix}: ${total}`
        : buildStudentNoResultsReply(
            scopeSuffix
              ? `I could not find any students${scopeSuffix}.`
              : "I could not find any students.",
            routeContext,
            parsedFilters
          ),
    title:
      label === "without backlogs"
        ? "Students Without Backlogs Count"
        : "Backlog Count",
    rows: [],
    summary: {
      count: total,
      department: getStudentDepartmentScopeLabel(routeContext),
      yearScope: getYearScopeLabel(routeContext?.yearContext),
    },
    value: total,
    responseType: "count",
  };
};

const humanizeCollectionName = (value = "records") => {
  const normalized = String(value || "records")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (normalized === "researchpapers" || normalized === "research paper" || normalized === "research papers") {
    return "research papers";
  }

  if (normalized === "facultyachievements" || normalized === "faculty achievement" || normalized === "faculty achievements") {
    return "faculty achievements";
  }

  if (normalized === "naaccriterias" || normalized === "naac criteria") {
    return "naac criteria";
  }

  if (normalized === "nbacriterias" || normalized === "nba criteria") {
    return "nba criteria";
  }

  return normalized;
};

const toTitleCase = (value = "") =>
  String(value || "").replace(/\b[a-z]/g, (match) => match.toUpperCase());

const buildCountPayload = ({
  success = true,
  reply = "I could not process that count request.",
  title = "Count",
  entity = null,
  total = 0,
  filters = {},
  selectedDepartment = null,
  sourceDatabase = null,
  usedLiveData = true,
} = {}) => {
  const departmentLabel = selectedDepartment?.code || selectedDepartment?.name || null;
  const highlightItems = [
    {
      label: "Count",
      value: String(total),
    },
    ...(departmentLabel
      ? [
          {
            label: "Department",
            value: departmentLabel,
          },
        ]
      : []),
  ];

  return {
    success,
    message: reply,
    reply,
    type: "count",
    title,
    entity,
    total,
    count: total,
    value: total,
    filters,
    selectedDepartment,
    data: {
      total,
      filters,
      selectedDepartment,
    },
    responseType: "count",
    provider: "database",
    sourceDatabase,
    usedLiveData,
    presentation: {
      variant: "answer_card",
    },
    answerCard: {
      headline: `${title}: ${total}`,
      summary: reply,
      highlights: highlightItems,
      table: [],
      chart: null,
      tableTitle: title,
    },
    meta: {
      count: total,
      returned: 0,
      source: "database",
      entity,
      queryType: "count",
      contextUsed: false,
      responseType: "count",
      sourceDatabase,
      usedLiveData,
    },
  };
};

const getDatabaseKnowledgeCountDetails = (liveFacts = {}) => {
  const firstMatch = liveFacts.databaseKnowledge?.results?.[0];
  const result = firstMatch?.result;

  if (!result || result.operation !== "count") {
    return null;
  }

  const collectionKey = firstMatch?.query?.collection || "records";
  const collectionName = humanizeCollectionName(collectionKey);
  const count = Number.isFinite(Number(result.count))
    ? Number(result.count)
    : 0;

  return {
    collectionKey,
    collectionName,
    collectionTitle: toTitleCase(collectionName),
    count,
    filters: firstMatch?.query?.filters || {},
    reply: `I found ${count} matching ${pluralize(count, "record")} in ${collectionName}.`,
  };
};

const buildDatabaseKnowledgeCountPayload = (liveFacts = {}) => {
  const details = getDatabaseKnowledgeCountDetails(liveFacts);
  if (!details) {
    return null;
  }

  return buildCountPayload({
    reply: details.reply,
    title: `${details.collectionTitle} Count`,
    entity: details.collectionKey,
    total: details.count,
    filters: details.filters,
    selectedDepartment: extractDepartmentContext(liveFacts),
    sourceDatabase: liveFacts.sourceDatabase || "mongodb",
    usedLiveData: true,
  });
};

const buildDatabaseKnowledgeCountResponse = (liveFacts = {}) => {
  const details = getDatabaseKnowledgeCountDetails(liveFacts);
  if (!details) {
    return null;
  }

  return {
    reply: details.reply,
    title: `${details.collectionTitle} Count`,
    summary: {
      count: details.count,
    },
    value: details.count,
    responseType: "text",
    provider: "database",
    sourceDatabase: liveFacts.sourceDatabase || "mongodb",
    usedLiveData: true,
  };
};

const buildAccessDeniedPayload = ({
  accessScope = null,
  sourceDatabase = null,
  message = null,
  reason = "out_of_scope",
} = {}) =>
  formatUnifiedResponse({
    type: "chat",
    data: {
      success: false,
      reply: message || buildAccessDeniedMessage(accessScope, reason),
      title: "Access Restricted",
      provider: "database",
      sourceDatabase,
      usedLiveData: false,
      meta: {
        accessDenied: true,
        reason,
      },
    },
  });

const buildDatabaseKnowledgeResponse = (liveFacts = {}) => {
  const firstMatch = liveFacts.databaseKnowledge?.results?.[0];
  const collectionName = humanizeCollectionName(firstMatch?.query?.collection || "records");
  const result = firstMatch?.result;

  if (!result) {
    return null;
  }

  if (result.operation === "count") {
    return buildDatabaseKnowledgeCountResponse(liveFacts);
  }

  if (result.operation === "findOne" && result.document) {
    return {
      reply: `I found a matching record in ${collectionName}.`,
      title: collectionName,
      rows: [result.document],
      responseType: "table",
      provider: "database",
      sourceDatabase: liveFacts.sourceDatabase || "mongodb",
      usedLiveData: true,
      extraData: {
        type: "databaseKnowledge",
        rows: [result.document],
      },
    };
  }

  if (result.operation === "findMany" && Array.isArray(result.documents) && result.documents.length) {
    const rows = result.documents;
    return {
      reply: `I found ${result.documents.length} matching ${pluralize(result.documents.length, "record")} in ${collectionName}.`,
      title: collectionName,
      rows,
      responseType: "table",
      provider: "database",
      sourceDatabase: liveFacts.sourceDatabase || "mongodb",
      usedLiveData: true,
      contextData: result.documents,
      extraData: {
        type: "databaseKnowledge",
        rows,
        contextData: result.documents,
      },
    };
  }

  return null;
};

const getPreferredAdminParameterEntity = (message = "", plannedEntity = null) => {
  if (plannedEntity) {
    return plannedEntity;
  }

  return extractQueryParameters(message)?.entity || null;
};

const shouldPreferDatabaseKnowledgeData = ({
  message = "",
  plannedEntity = null,
  liveFacts = {},
} = {}) => {
  const preferredEntity = getPreferredAdminParameterEntity(message, plannedEntity);
  const collectionName = liveFacts.databaseKnowledge?.results?.[0]?.query?.collection || null;

  if (ADMIN_DATABASE_PARAMETER_ENTITIES.has(preferredEntity)) {
    return true;
  }

  if (ADMIN_DATABASE_COLLECTIONS.has(collectionName)) {
    return /\b(document|accreditation|naac|nba|achievement|award|certification|grant|patent|publication|research paper|research papers)\b/i.test(
      message
    );
  }

  return false;
};

const shouldPreferAnalyticsBeforeEntityData = (message = "") =>
  /\b(achievement|achievements|award|awards|certification|certifications|recognition|grant|patent)\b/i.test(
    message
  ) ||
  (/\b(event|events|workshop|seminar|hackathon|conference)\b/i.test(message) &&
    /\b(participation|participations|participants|winner|winners|attended|attendance marked)\b/i.test(
      message
    ));

const buildRawDatabaseResponse = (liveFacts = {}) => {
  const rawKnowledge = liveFacts.rawDatabaseKnowledge;
  const firstMatch = rawKnowledge?.results?.[0];

  if (
    !firstMatch?.documents?.length &&
    rawKnowledge?.collectionsSearched?.length === 1 &&
    rawKnowledge?.emptyCollections?.includes(rawKnowledge.collectionsSearched[0])
  ) {
    const collectionName = humanizeCollectionName(rawKnowledge.collectionsSearched[0]);
    return {
      reply: `I checked ${collectionName}, and it is currently empty.`,
      title: collectionName,
      responseType: "text",
      provider: "database",
      sourceDatabase: rawKnowledge.databaseName || liveFacts.sourceDatabase || "mongodb",
      usedLiveData: true,
    };
  }

  if (!firstMatch?.documents?.length) {
    return null;
  }

  const rows = firstMatch.documents;
  const collectionName = humanizeCollectionName(firstMatch.collection);

  return {
    reply: `I found ${firstMatch.documents.length} matching ${pluralize(firstMatch.documents.length, "record")} in ${collectionName}.`,
    title: collectionName,
    rows,
    responseType: "table",
    provider: "database",
    sourceDatabase: rawKnowledge.databaseName || liveFacts.sourceDatabase || "mongodb",
    usedLiveData: true,
    contextData: firstMatch.documents,
    extraData: {
      type: "rawDatabaseKnowledge",
      rows,
      contextData: firstMatch.documents,
    },
  };
};

const buildFactDataResponse = (message, liveFacts = {}) => {
  const sourceDatabase = liveFacts.sourceDatabase || "mongodb";
  const databaseCountResponse =
    isCountQuery(message) ? buildDatabaseKnowledgeCountResponse(liveFacts) : null;
  const databaseResponse = buildDatabaseKnowledgeResponse(liveFacts);

  if (databaseCountResponse) {
    return databaseCountResponse;
  }

  if (databaseResponse && shouldPreferDatabaseKnowledgeData({ message, liveFacts })) {
    return databaseResponse;
  }

  if (liveFacts.student) {
    const row = mapStudentRow(liveFacts.student);
    return {
      reply: `${row.name} (${row.rollNumber}) has a CGPA of ${row.cgpa ?? "N/A"}, average attendance of ${row.averageAttendance ?? "N/A"}%, and ${row.currentBacklogs} current ${pluralize(row.currentBacklogs, "backlog")}.`,
      title: `${row.name} Snapshot`,
      rows: [row],
      summary: {
        student: row.name,
        rollNumber: row.rollNumber,
        department: row.departmentCode || row.department || null,
      },
      responseType: "table",
      provider: "database",
      sourceDatabase,
      usedLiveData: true,
      extraData: {
        type: "student",
        rows: [row],
      },
    };
  }

  if (liveFacts.faculty) {
    const row = mapFacultyRow(liveFacts.faculty);
    return {
      reply: `${row.name} works as ${row.designation || "faculty"}${row.departmentCode ? ` in ${row.departmentCode}` : ""}.`,
      title: `${row.name} Snapshot`,
      rows: [row],
      responseType: "table",
      provider: "database",
      sourceDatabase,
      usedLiveData: true,
      extraData: {
        type: "faculty",
        rows: [row],
      },
    };
  }

  if (liveFacts.subject) {
    const row = mapSubjectRow(liveFacts.subject);
    return {
      reply: `${row.name} (${row.code}) is a ${row.type || "subject"} in semester ${row.semester ?? "N/A"}.`,
      title: `${row.name} Snapshot`,
      rows: [row],
      responseType: "table",
      provider: "database",
      sourceDatabase,
      usedLiveData: true,
      extraData: {
        type: "subject",
        rows: [row],
      },
    };
  }

  if (liveFacts.user) {
    const row = mapUserRow(liveFacts.user);
    return {
      reply: `${row.name} has the role ${row.role || "N/A"} and the account is ${row.isActive ? "active" : "inactive"}.`,
      title: `${row.name} Snapshot`,
      rows: [row],
      responseType: "table",
      provider: "database",
      sourceDatabase,
      usedLiveData: true,
      extraData: {
        type: "user",
        rows: [row],
      },
    };
  }

  if (liveFacts.departmentComparison?.summary?.length) {
    const rows = liveFacts.departmentComparison.summary;
    return {
      reply: `I compared ${rows.length} departments using live institutional data.`,
      title: "Department Comparison",
      rows,
      responseType: "table",
      provider: "database",
      sourceDatabase,
      usedLiveData: true,
      extraData: {
        type: "department-comparison",
        rows,
      },
    };
  }

  if (liveFacts.department) {
    const row = mapDepartmentRow(liveFacts.department);
    return {
      reply: `${row.name} (${row.code}) has an average CGPA of ${row.averageCGPA ?? "N/A"}, average attendance of ${row.averageAttendance ?? "N/A"}%, and placement percentage of ${row.placementPercentage ?? "N/A"}%.`,
      title: `${row.name} Snapshot`,
      rows: [row],
      responseType: "table",
      provider: "database",
      sourceDatabase,
      usedLiveData: true,
      extraData: {
        type: "department",
        rows: [row],
      },
    };
  }

  const collectionMappings = [
    ["departmentRanking", "Department Ranking"],
    ["placementOverview", "Placement Overview"],
    ["attendanceOverview", "Attendance Overview"],
    ["cgpaOverview", "CGPA Overview"],
    ["researchOverview", "Research Overview"],
    ["achievementOverview", "Faculty Achievement Overview"],
    ["marksOverview", "Marks Overview"],
    ["backlogOverview", "Backlog Overview"],
    ["documentOverview", "Document Overview"],
    ["naacOverview", "NAAC Overview"],
    ["nbaOverview", "NBA Overview"],
    ["eventOverview", "Event Overview"],
  ];

  for (const [key, title] of collectionMappings) {
    if (Array.isArray(liveFacts[key]) && liveFacts[key].length) {
      const rows = liveFacts[key];
      return {
        reply: `I found ${rows.length} ${title.toLowerCase()} ${pluralize(rows.length, "record")}.`,
        title,
        rows,
        responseType: "table",
        provider: "database",
        sourceDatabase,
        usedLiveData: true,
        extraData: {
          type: key,
          rows,
        },
      };
    }
  }

  const objectOverviewMappings = [
    ["researchOverview", "byType", "Research Overview"],
    ["achievementOverview", "byType", "Faculty Achievement Overview"],
    ["documentOverview", "byStatus", "Document Overview"],
    ["naacOverview", "byStatus", "NAAC Overview"],
    ["nbaOverview", "byStatus", "NBA Overview"],
    ["eventOverview", "byType", "Event Overview"],
  ];

  for (const [key, childKey, title] of objectOverviewMappings) {
    const rows = liveFacts[key]?.[childKey];
    if (Array.isArray(rows) && rows.length) {
      return {
        reply: `I found ${rows.length} ${title.toLowerCase()} ${pluralize(rows.length, "record")}.`,
        title,
        rows,
        responseType: "table",
        provider: "database",
        sourceDatabase,
        usedLiveData: true,
        extraData: {
          type: key,
          rows,
          summary: liveFacts[key],
        },
      };
    }
  }

  if (databaseResponse) {
    return databaseResponse;
  }

  const rawDatabaseResponse = buildRawDatabaseResponse(liveFacts);
  if (rawDatabaseResponse) {
    return rawDatabaseResponse;
  }

  if (/\b(overall|overview|dashboard|institution|institutional)\b/i.test(message) && liveFacts.overview) {
    const row = mapOverviewRow(liveFacts.overview);
    return {
      reply: `The current institutional overview shows ${row.activeStudents ?? "N/A"} active students, average CGPA of ${row.averageCGPA ?? "N/A"}, and average attendance of ${row.averageAttendance ?? "N/A"}%.`,
      title: "Institution Overview",
      rows: [row],
      responseType: "table",
      provider: "database",
      sourceDatabase,
      usedLiveData: true,
      extraData: {
        type: "overview",
        rows: [row],
      },
    };
  }

  return null;
};

const normalizeAnalyticsResponse = (analyticsResult, message, liveFacts = {}) => {
  const rows =
    analyticsResult.data?.type === "students" && Array.isArray(analyticsResult.data.rows)
      ? normalizeRowsForMessage(analyticsResult.data.rows, message)
      : analyticsResult.data?.rows || [];

  return {
    reply: analyticsResult.reply,
    title: analyticsResult.title || "Analytics Result",
    rows,
    summary: analyticsResult.data?.summary || {},
    value: analyticsResult.value ?? analyticsResult.data?.summary?.count ?? null,
    responseType: analyticsResult.type || (rows.length ? "table" : "text"),
    provider: "database",
    sourceDatabase: liveFacts.sourceDatabase || "mongodb",
    usedLiveData: true,
    extraData: analyticsResult.data || null,
    contextData: Array.isArray(analyticsResult.data?.contextData)
      ? analyticsResult.data.contextData
      : rows,
  };
};

const resolveCoreStudentDataResponse = async (req, message) => {
  const session = getSession(req);
  const activeIntent = detectCoreIntent(message) || session?.pendingIntent || null;

  if (!activeIntent) {
    return null;
  }

  let matchedStudent = null;

  if (session?.pendingIntent && session?.candidateStudents?.length) {
    const selectedCandidate = selectStudentFromCandidates(
      message,
      session.candidateStudents
    );

    if (selectedCandidate?._id) {
      matchedStudent = await Student.findById(selectedCandidate._id)
        .populate("department", "name code")
        .lean();
    }

    if (!matchedStudent) {
      const rollMatch = message.match(ROLL_NUMBER_PATTERN);
      if (rollMatch) {
        matchedStudent = await Student.findOne({
          rollNumber: rollMatch[1].toUpperCase(),
        })
          .populate("department", "name code")
          .lean();
      }
    }

    if (!matchedStudent) {
      const candidateRows = session.candidateStudents.map(mapCandidateRow);
      return {
        reply: formatCandidatePrompt(activeIntent, candidateRows),
        title: "Select Student",
        rows: candidateRows,
        responseType: "table",
        provider: "database",
        sourceDatabase: null,
        usedLiveData: true,
        extraData: {
          type: "students",
          rows: candidateRows,
        },
        skipHistory: true,
      };
    }
  } else {
    const candidates = await findCandidateStudents(message);

    if (!candidates.length) {
      clearPendingSession(req);
      clearLatestContext(req);
      return {
        reply: `I could not identify the student for this ${activeIntent} query. Please send the student's name or roll number.`,
        provider: "database",
        sourceDatabase: null,
        usedLiveData: true,
        skipHistory: true,
      };
    }

    if (candidates.length > 1) {
      const candidateRows = candidates.map(mapCandidateRow);
      updateSession(req, {
        pendingIntent: activeIntent,
        candidateStudents: candidateRows,
        lastIntent: activeIntent,
        lastContextType: "student",
      });

      return {
        reply: formatCandidatePrompt(activeIntent, candidateRows),
        title: "Select Student",
        rows: candidateRows,
        responseType: "table",
        provider: "database",
        sourceDatabase: null,
        usedLiveData: true,
        extraData: {
          type: "students",
          rows: candidateRows,
        },
        skipHistory: true,
      };
    }

    [matchedStudent] = candidates;
  }

  const reply = await resolveCoreStudentQuery({
    intent: activeIntent,
    student: matchedStudent,
  });
  const row = mapStudentRow(matchedStudent);

  updateSession(req, {
    pendingIntent: null,
    candidateStudents: null,
    lastStudent: sanitizeStudent(matchedStudent),
    lastDepartment: sanitizeDepartment(matchedStudent.department),
    lastIntent: activeIntent,
    lastContextType: "student",
  });

  updateLatestContext(req, {
    lastIntent: activeIntent,
    lastQuery: message,
    lastResult: [row],
  });

  return {
    reply,
    title: `${matchedStudent.name} Snapshot`,
    rows: [row],
    summary: {
      student: matchedStudent.name,
      rollNumber: matchedStudent.rollNumber,
    },
    responseType: "table",
    provider: "database",
    sourceDatabase: "mongodb",
    usedLiveData: true,
    extraData: {
      type: "student-query",
      rows: [row],
    },
    skipHistory: true,
  };
};

const resolveDataResponse = async (req, message, liveFacts, options = {}) => {
  const parsedQuery = options.parsedQuery || null;
  const accessScope = options.accessScope || null;
  const session = getSession(req);
  const plannedEntity = options.plannedEntity || parsedQuery?.entity || null;

  if (isPlacementDomainQuery(message, parsedQuery)) {
    return buildPlacementDataResponse({
      message,
      parsedQuery,
      accessScope,
    });
  }

  const entity = detectEntity(message) || plannedEntity || null;
  const Model = getModel(entity);
  const databaseKnowledgeResponse = buildDatabaseKnowledgeResponse(liveFacts);
  const shouldPreferAnalyticsFirst = shouldPreferAnalyticsBeforeEntityData(message);

  if (isSubjectQuery(message)) {
    return {
      ...await getSubjectFailureAnalysis(message, accessScope),
      provider: "database",
      sourceDatabase: liveFacts.sourceDatabase || "mongodb",
      usedLiveData: true,
    };
  }

  const institutionalAnalyticsResponse = accessScope?.canUseInstitutionAnalytics
    ? await runInstitutionalAnalyticsEngine({
        message,
        liveFacts,
      })
    : null;
  if (institutionalAnalyticsResponse) {
    return institutionalAnalyticsResponse;
  }

  if (shouldPreferAnalyticsFirst) {
    const analyticsFirstResult = await handleAnalyticsQuery(message, accessScope);
    if (analyticsFirstResult) {
      return normalizeAnalyticsResponse(analyticsFirstResult, message, liveFacts);
    }
  }

  if (
    databaseKnowledgeResponse &&
    shouldPreferDatabaseKnowledgeData({
      message,
      plannedEntity,
      liveFacts,
    })
  ) {
    return databaseKnowledgeResponse;
  }

  if (entity && !Model && databaseKnowledgeResponse) {
    return databaseKnowledgeResponse;
  }

  if (entity && !Model) {
    return {
      success: false,
      type: "data",
      entity: null,
      reply: "Entity not recognized.",
      responseType: "text",
      provider: "database",
      sourceDatabase: liveFacts.sourceDatabase || "mongodb",
      usedLiveData: true,
    };
  }

  if (entity && entity !== "student") {
    const entityDataResponse = await resolveEntityDataQuery({
      message,
      liveFacts,
      entity,
      parsedQuery,
    });
    if (entityDataResponse) {
      return {
        ...entityDataResponse,
        provider: "database",
        sourceDatabase: liveFacts.sourceDatabase || "mongodb",
        usedLiveData: true,
      };
    }

    const analyticsResult = await handleAnalyticsQuery(message, accessScope);
    if (analyticsResult) {
      return normalizeAnalyticsResponse(analyticsResult, message, liveFacts);
    }

    if (databaseKnowledgeResponse) {
      return databaseKnowledgeResponse;
    }

    if (TOP_PACKAGE_PATTERN.test(message)) {
      return {
        ...await buildTopPackageResponse(message, accessScope),
        provider: "database",
        sourceDatabase: liveFacts.sourceDatabase || "mongodb",
        usedLiveData: true,
      };
    }

    return {
      success: true,
      type: "data",
      entity,
      totalRecords: 0,
      returnedRecords: 0,
      filters: {},
      rows: [],
      contextData: [],
      reply: `No ${entity} records found for given criteria.`,
      responseType: "text",
      provider: "database",
      sourceDatabase: liveFacts.sourceDatabase || "mongodb",
      usedLiveData: true,
    };
  }

  const dynamicStudentResponse = await buildDynamicStudentDataResponse(
    message,
    liveFacts,
    parsedQuery
  );
  if (dynamicStudentResponse) {
    return dynamicStudentResponse;
  }

  if (
    /\b(backlog|backlogs|arrear|arrears)\b/i.test(message) &&
    /\bstudents?\b/i.test(message)
  ) {
    return {
      ...await buildBacklogListResponse(message, parsedQuery),
      provider: "database",
      sourceDatabase: liveFacts.sourceDatabase || "mongodb",
      usedLiveData: true,
    };
  }

  if (
    shouldUseCoreStudentRecordRouting({
      message,
      session,
      entity,
    })
  ) {
    const studentResponse = await resolveCoreStudentDataResponse(req, message);
    if (studentResponse) {
      return studentResponse;
    }
  }

  if (detectCoreIntent(message) === "backlog" && isCountQuery(message)) {
    return {
      ...await buildBacklogCountResponse(message, parsedQuery),
      provider: "database",
      sourceDatabase: liveFacts.sourceDatabase || "mongodb",
      usedLiveData: true,
    };
  }

  const analyticsResult = await handleAnalyticsQuery(message, accessScope);
  if (analyticsResult) {
    return normalizeAnalyticsResponse(analyticsResult, message, liveFacts);
  }

  if (isListQuery(message) && detectCoreIntent(message) === "backlog") {
    return {
      ...await buildBacklogListResponse(message, parsedQuery),
      provider: "database",
      sourceDatabase: liveFacts.sourceDatabase || "mongodb",
      usedLiveData: true,
    };
  }

  if (TOP_PACKAGE_PATTERN.test(message)) {
    return {
      ...await buildTopPackageResponse(message, accessScope),
      provider: "database",
      sourceDatabase: liveFacts.sourceDatabase || "mongodb",
      usedLiveData: true,
    };
  }

  const entityDataResponse = await resolveEntityDataQuery({
    message,
    liveFacts,
    entity,
    parsedQuery,
  });
  if (entityDataResponse) {
    return {
      ...entityDataResponse,
      provider: "database",
      sourceDatabase: liveFacts.sourceDatabase || "mongodb",
      usedLiveData: true,
    };
  }

  if (entity && Model) {
    return {
      success: true,
      type: "data",
      entity,
      totalRecords: 0,
      returnedRecords: 0,
      filters: {},
      rows: [],
      contextData: [],
      reply: `No ${entity} records found for given criteria.`,
      responseType: "text",
      provider: "database",
      sourceDatabase: liveFacts.sourceDatabase || "mongodb",
      usedLiveData: true,
    };
  }

  return buildFactDataResponse(message, liveFacts);
};

const resolveContextualReportResponse = async (
  req,
  message,
  liveFacts,
  accessScope = null
) => {
  const contextState = getStoredContext(req);
  const filters = extractFilters(message);
  const useContext = isContextQuery(message) && !filters.department;

  if (
    !useContext ||
    !contextState?.lastData?.length ||
    (accessScope?.scopeKey &&
      contextState?.accessScopeKey &&
      !scopeMatchesMetadata(
        { accessScopeKey: contextState.accessScopeKey },
        accessScope
      ))
  ) {
    return null;
  }

  const report = generateDynamicReport(
    contextState.entityType || "generic",
    contextState.lastData,
    {
      queryType: contextState.queryType || "context",
      contextUsed: true,
    }
  );

  if (!report) {
    return null;
  }

  return {
    reply: report.reportText,
    title: report.title?.replace(/^#\s*/, "") || "Context Report",
    entity: report.entityType || report.data?.entity || contextState.entityType || null,
    filtered: false,
    contextUsed: true,
    rows: report.data?.rows || [],
    summary: report.summary || {},
    tables: report.tables || [],
    sections: report.sections || [],
    insights: report.insights || null,
    chart: report.chart || null,
    responseType: "report",
    provider: "report",
    sourceDatabase: liveFacts.sourceDatabase || "mongodb",
    usedLiveData: true,
    extraData: report.data || null,
  };
};

const resolveReportResponse = async (req, message, liveFacts, options = {}) => {
  const report = await resolveStructuredReport(req, message, options);

  return {
    reply: report.reportText,
    title: report.title?.replace(/^#\s*/, "") || "IQAC Report",
    entity: report.entityType || report.data?.entity || null,
    filtered: Boolean(report.filtered || report.data?.filtered),
    contextUsed: Boolean(report.contextUsed || report.data?.contextUsed),
    rows: report.data?.rows || [],
    summary: report.summary || {},
    tables: report.tables || [],
    sections: report.sections || [],
    insights: report.insights || null,
    chart: report.chart || report.data?.chart || null,
    responseType: "report",
    provider: "report",
    sourceDatabase: liveFacts.sourceDatabase || "mongodb",
    usedLiveData: true,
    extraData: report.data || null,
    contextData: report.contextData || null,
    filters: report.filters || report.data?.filters || null,
    totalRecords:
      report.totalRecords ||
      report.data?.totalRecords ||
      report.summary?.totalRecords ||
      0,
    previewCount:
      report.previewCount ||
      report.data?.previewCount ||
      report.data?.rows?.length ||
      0,
    validation: report.validation || report.data?.validation || null,
  };
};

const normalizeExportFormat = (value = "") => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "pdf") return "pdf";
  if (["doc", "docx", "document", "word"].includes(normalized)) return "docx";
  return normalized;
};

const isStructuredReportPayload = (value = null) =>
  Boolean(value) &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  typeof value.title === "string" &&
  value.summary &&
  typeof value.summary === "object" &&
  !Array.isArray(value.summary) &&
  value.charts &&
  Array.isArray(value.charts) &&
  Array.isArray(value.table);

const resolveStoredFormattedReport = (req, message = "", accessScope = null) => {
  const contextState = getStoredContext(req);
  const payload = contextState?.lastPayload;

  if (!isStructuredReportPayload(payload)) {
    return null;
  }

  const normalizedIncoming = String(message || "").trim().toLowerCase();
  const normalizedStored = String(contextState?.lastQuery || "").trim().toLowerCase();

  if (
    normalizedIncoming &&
    normalizedStored &&
    normalizedIncoming !== normalizedStored
  ) {
    return null;
  }

  if (
    accessScope?.scopeKey &&
    contextState?.accessScopeKey &&
    !scopeMatchesMetadata({ accessScopeKey: contextState.accessScopeKey }, accessScope)
  ) {
    return null;
  }

  return payload;
};

const isLightweightDataQuery = (intent, message = "", session = null) => {
  if (intent !== "data" || session?.pendingIntent) {
    return false;
  }

  const normalized = String(message).toLowerCase();
  if (normalized.includes("analysis") || normalized.includes("report")) {
    return false;
  }

  return (
    Boolean(detectEntity(message)) ||
    shouldUseStudentCollectionQuery(message) ||
    (/\b(backlog|backlogs|arrear|arrears)\b/i.test(message) &&
      /\bstudents?\b/i.test(message)) ||
    (detectCoreIntent(message) === "backlog" && isCountQuery(message)) ||
    TOP_PACKAGE_PATTERN.test(message)
  );
};

const resolveStructuredReport = async (req, message = "", options = {}) => {
  const latestContext = getLatestContext(req);
  const contextState = getStoredContext(req);
  const parsedQuery = options.parsedQuery || null;
  const filters = options.plannedFilters || extractFilters(message);
  const plannedSort = options.plannedSort || parsedQuery?.sort || null;
  const plannedLimit = options.plannedLimit || parsedQuery?.limit || null;
  const hasRankedReportIntent = Boolean(plannedSort || plannedLimit);
  const useContext = isContextQuery(message) && !filters.department;
  const resolvedReportEntity =
    options.plannedEntity || detectEntity(message) || parsedQuery?.entity || null;
  const explicitNonStudentEntity = Boolean(
    resolvedReportEntity && resolvedReportEntity !== "student"
  );

  if (isPlacementDomainQuery(message, parsedQuery)) {
    const placementReport = await buildPlacementReportDomainResponse({
      message,
      parsedQuery,
      accessScope: options.accessScope || null,
    });

    if (placementReport) {
      return placementReport;
    }
  }

  if (useContext && contextState?.lastData?.length) {
    const contextReport = generateDynamicReport(
      contextState.entityType || "generic",
      contextState.lastData,
      {
        queryType: contextState.queryType || "context",
        contextUsed: true,
      }
    );

    if (contextReport) {
      return contextReport;
    }
  }
  const universalReport = await buildUniversalReport(message, {
    filters,
    entityType: resolvedReportEntity,
    sort: plannedSort,
    limit: plannedLimit,
  });

  if (explicitNonStudentEntity && universalReport) {
    return universalReport;
  }

  if (
    !hasRankedReportIntent &&
    !filters.department &&
    hasStudentReportRows(latestContext?.lastResult)
  ) {
    return buildFilteredRowsReport({
      rows: latestContext.lastResult,
      lastQuery: latestContext.lastQuery,
    });
  }

  if (universalReport) {
    return universalReport;
  }

  return buildChatbotReport(message);
};

const withDetectedIntent = (payload = {}, intent = "chat") => ({
  ...payload,
  intent,
  message: payload.message || payload.reply || "Processing request...",
});

const sendLoggedResponse = (
  res,
  {
    payload = {},
    detectedIntent = "chat",
    startedAt = Date.now(),
    status = 200,
  } = {}
) => {
  const responseTime = Date.now() - startedAt;
  const accessScope = res.locals?.chatbotAccessScope || null;
  const finalPayload = withDetectedIntent(
    decoratePayloadWithAccessScope(
      {
      ...payload,
      meta: {
        ...(payload.meta || {}),
        responseTime,
      },
      },
      accessScope
    ),
    detectedIntent
  );

  console.log({
    intent: finalPayload.intent,
    queryType: finalPayload.meta?.queryType || finalPayload.queryType || null,
    responseTime,
  });

  return res.status(status).json(finalPayload);
};

const getChatbotResponse = async (req, res) => {
  const requestStartedAt = Date.now();

  try {
    const rawMessage = req.body?.message?.trim();
    if (!rawMessage) {
      return sendLoggedResponse(res, {
        status: 400,
        detectedIntent: "chat",
        startedAt: requestStartedAt,
        payload: formatUnifiedResponse({
          type: "fallback",
          data: {
            success: false,
            reply: "Message required",
            title: "Jorvis Update",
            provider: "fallback",
          },
        }),
      });
    }

    const accessScope = await resolveChatbotAccessScope(req.user);
    res.locals.chatbotAccessScope = accessScope;

    const sourceDatabase = mongoose.connection?.db?.databaseName || null;

    if (shouldBuildSchemaAwareQueryPlan({ message: rawMessage, payload: req.body || {} })) {
      const queryPlan = buildSchemaAwareQueryPlan(rawMessage);

      console.log({
        intent: queryPlan.intent,
        queryType: "query_plan",
        responseTime: Date.now() - requestStartedAt,
      });

      return res.status(200).json(queryPlan);
    }

    if (shouldBuildReportExecutionPlan({ message: rawMessage, payload: req.body || {} })) {
      const reportPlan = buildReportExecutionPlan(rawMessage);

      console.log({
        type: reportPlan.type,
        queryType: "report_plan",
        responseTime: Date.now() - requestStartedAt,
      });

      return res.status(200).json(reportPlan);
    }

    if (shouldBuildQueryRoutingDecision({ message: rawMessage, payload: req.body || {} })) {
      const routingDecision = buildQueryRoutingDecision(rawMessage);

      console.log({
        route: routingDecision.route,
        queryType: "query_routing",
        responseTime: Date.now() - requestStartedAt,
      });

      return res.status(200).json(routingDecision);
    }

    if (shouldExtractQueryParameters({ message: rawMessage, payload: req.body || {} })) {
      const queryParameters = extractQueryParameters(rawMessage);

      console.log({
        intent: "query_parameters",
        queryType: "query_parameters",
        responseTime: Date.now() - requestStartedAt,
      });

      return res.status(200).json(queryParameters);
    }

    if (detectRecommendationIntent(rawMessage)) {
      const recommendationRequest = await resolveRecommendationRequest(
        req,
        rawMessage,
        accessScope
      );
      const recommendationPayload = buildRecommendationPayload(
        recommendationRequest.studentData
      );

      recordConversationState(req, {
        message: rawMessage,
        intent: "recommendation",
        liveFacts: recommendationRequest.studentContext
          ? { student: recommendationRequest.studentContext }
          : {},
        keepExistingRows: true,
        accessScope,
      });

      console.log({
        intent: recommendationPayload.intent,
        queryType: "recommendation",
        responseTime: Date.now() - requestStartedAt,
      });

      return res.status(200).json(
        decoratePayloadWithAccessScope(recommendationPayload, accessScope)
      );
    }

    const strictParsedQuery = extractQueryParameters(rawMessage);
    const strictScopeDecision = await validateAndApplyRoleScope({
      message: rawMessage,
      parsedQuery: strictParsedQuery,
      entity: strictParsedQuery?.entity || null,
      intent: isCountQuery(rawMessage) ? "count" : "data",
      accessScope,
    });

    console.log("Chatbot RBAC:", strictScopeDecision.audit || {
      role: accessScope.role,
      scopeKey: accessScope.scopeKey,
    });

    if (strictScopeDecision.accessDenied) {
      return sendLoggedResponse(res, {
        detectedIntent: "chat",
        startedAt: requestStartedAt,
        payload: buildAccessDeniedPayload({
          accessScope,
          sourceDatabase,
          message: strictScopeDecision.message,
          reason: strictScopeDecision.reason,
        }),
      });
    }

    const strictResponse = await resolveStrictEntityQuery({
      message: rawMessage,
      liveFacts: {
        sourceDatabase,
      },
      parsedQuery: strictScopeDecision.parsedQuery,
    });

    if (strictResponse) {
      if (strictResponse.type === "count") {
        recordConversationState(req, {
          message: rawMessage,
          intent: "count",
          liveFacts: {
            sourceDatabase,
          },
          keepExistingRows: true,
          accessScope,
        });

        return sendLoggedResponse(res, {
          detectedIntent: "count",
          startedAt: requestStartedAt,
          payload: {
            ...buildCountPayload({
              success: strictResponse.success,
              reply: strictResponse.reply || strictResponse.message,
              title: `${String(strictResponse.entity || "record")
                .charAt(0)
                .toUpperCase()}${String(strictResponse.entity || "record").slice(1)} Count`,
              entity: strictResponse.entity,
              total: strictResponse.total,
              filters: strictResponse.filters || {},
              selectedDepartment: strictResponse.selectedDepartment || null,
              sourceDatabase,
              usedLiveData: true,
            }),
            applied_filters: strictResponse.applied_filters || [],
            filters_applied: strictResponse.filters_applied || [],
            provider: strictResponse.provider || "database",
            debug: strictResponse.debug || null,
            meta: {
              ...(strictResponse.meta || {}),
              count: strictResponse.total,
              returned: 0,
              source: "database",
              entity: strictResponse.entity,
              queryType: "count",
              contextUsed: false,
              responseType: "count",
              sourceDatabase,
              usedLiveData: true,
              ...(Array.isArray(strictResponse.applied_filters)
                ? { applied_filters: strictResponse.applied_filters }
                : {}),
              ...(strictResponse.debug ? { debug: strictResponse.debug } : {}),
            },
          },
        });
      }

      const limitedStrictResponse = applyDataLimitPolicy({
        message: rawMessage,
        response: strictResponse,
        requestQuery: req.query || {},
      });

      if (!limitedStrictResponse.skipHistory) {
        recordConversationState(req, {
          message: rawMessage,
          intent: "data",
          liveFacts: {
            sourceDatabase,
          },
          rows:
            limitedStrictResponse.contextData ||
            limitedStrictResponse.rows ||
            [],
          accessScope,
        });
      }

      const formattedStrictPayload = formatUnifiedResponse({
        type: "data",
        data: limitedStrictResponse,
      });

      rememberContextState(req, {
        message: rawMessage,
        payload: formattedStrictPayload,
        rawData:
          limitedStrictResponse.contextData ||
          limitedStrictResponse.rows ||
          limitedStrictResponse.extraData ||
          null,
        entityType:
          limitedStrictResponse.entity || formattedStrictPayload.entity || null,
        queryType: limitedStrictResponse.queryType || "data",
        accessScope,
      });

      return sendLoggedResponse(res, {
        detectedIntent: "data",
        startedAt: requestStartedAt,
        payload: formattedStrictPayload,
      });
    }

    const session = getSession(req);
    const effectiveMessage = buildContextAwareMessage({
      message: rawMessage,
      session,
    });
    const queryPlan = await buildQueryPlan({
      message: effectiveMessage,
      session,
    });
    const scopedQueryDecision = await validateAndApplyRoleScope({
      message: effectiveMessage,
      parsedQuery: queryPlan.parsedQuery,
      entity: queryPlan.entity,
      intent: queryPlan.executionIntent,
      accessScope,
    });
    console.log("Chatbot RBAC:", scopedQueryDecision.audit || {
      role: accessScope.role,
      scopeKey: accessScope.scopeKey,
    });
    if (scopedQueryDecision.accessDenied) {
      return sendLoggedResponse(res, {
        detectedIntent: "chat",
        startedAt: requestStartedAt,
        payload: buildAccessDeniedPayload({
          accessScope,
          sourceDatabase,
          message: scopedQueryDecision.message,
          reason: scopedQueryDecision.reason,
        }),
      });
    }

    queryPlan.parsedQuery = scopedQueryDecision.parsedQuery || queryPlan.parsedQuery;
    queryPlan.filters = queryPlan.parsedQuery?.filters || queryPlan.filters || {};
    console.log("Query Plan:", {
      source: queryPlan.source,
      planner: queryPlan.planner,
      confidence: queryPlan.confidence,
      intent: queryPlan.intent,
      entity: queryPlan.entity,
      hasFilters: Boolean(Object.keys(queryPlan.filters || {}).length),
    });
    const resolvedIntent = queryPlan.intent;
    const detectedIntent = queryPlan.executionIntent;
    const countEntity = queryPlan.entity || detectCountEntity(effectiveMessage) || null;
    const coreIntent = detectCoreIntent(effectiveMessage);
    let liveFacts = {
      sourceDatabase: mongoose.connection?.db?.databaseName || null,
    };
    let hasLiveFacts = false;
    const ensureLiveFacts = async () => {
      if (!hasLiveFacts) {
        liveFacts = await buildLiveDataContext(effectiveMessage, accessScope);
        hasLiveFacts = true;
      }

      return liveFacts;
    };
    const shouldHandleExplicitCount =
      !session?.pendingIntent &&
      resolvedIntent === "count" &&
      isCountQuery(effectiveMessage) &&
      !isSubjectQuery(effectiveMessage);

    if (shouldHandleExplicitCount && countEntity) {
      if (isPlacementDomainQuery(effectiveMessage, queryPlan.parsedQuery)) {
        const placementCountResponse = await buildPlacementCountResponse({
          message: effectiveMessage,
          parsedQuery: queryPlan.parsedQuery,
          accessScope,
        });

        if (placementCountResponse) {
          if (placementCountResponse.accessDenied) {
            return sendLoggedResponse(res, {
              detectedIntent: "chat",
              startedAt: requestStartedAt,
              payload: buildAccessDeniedPayload({
                accessScope,
                sourceDatabase,
                message: placementCountResponse.message,
                reason: "out_of_scope",
              }),
            });
          }

          recordConversationState(req, {
            message: effectiveMessage,
            intent: "count",
            liveFacts: {
              sourceDatabase,
            },
            keepExistingRows: true,
            accessScope,
          });

          return sendLoggedResponse(res, {
            detectedIntent: "count",
            startedAt: requestStartedAt,
            payload: buildCountPayload({
              success: placementCountResponse.success,
              reply: placementCountResponse.message,
              title: placementCountResponse.title || "Placement Count",
              entity: placementCountResponse.entity,
              total: placementCountResponse.total,
              filters: placementCountResponse.filters || {},
              selectedDepartment: placementCountResponse.selectedDepartment || null,
              sourceDatabase,
              usedLiveData: true,
            }),
          });
        }
      }

      const countResponse = await resolveCountQuery(effectiveMessage, {
        entity: queryPlan.entity,
        parsedQuery: queryPlan.parsedQuery,
      });

      if (countResponse) {
        const sourceDatabase = mongoose.connection?.db?.databaseName || null;

        if (countResponse.unavailableYearFilter) {
          recordConversationState(req, {
            message: effectiveMessage,
            intent: "data",
            liveFacts: {
              sourceDatabase,
            },
            keepExistingRows: true,
            accessScope,
          });

          return sendLoggedResponse(res, {
            detectedIntent: "data",
            startedAt: requestStartedAt,
            payload: formatUnifiedResponse({
              type: "chat",
              data: {
                reply: countResponse.message,
                provider: "database",
                sourceDatabase,
                usedLiveData: true,
              },
            }),
          });
        }

        recordConversationState(req, {
          message: effectiveMessage,
          intent: "count",
          liveFacts: {
            sourceDatabase,
          },
          keepExistingRows: true,
          accessScope,
        });

        return sendLoggedResponse(res, {
          detectedIntent: "count",
          startedAt: requestStartedAt,
          payload: buildCountPayload({
            success: countResponse.success,
            reply: countResponse.message,
            title: `${String(countResponse.entity || "record")
              .charAt(0)
              .toUpperCase()}${String(countResponse.entity || "record").slice(1)} Count`,
            entity: countResponse.entity,
            total: countResponse.total,
            filters: countResponse.filters || {},
            selectedDepartment: countResponse.selectedDepartment || null,
            sourceDatabase,
            usedLiveData: true,
          }),
        });
      }
    }

    if (shouldHandleExplicitCount) {
      await ensureLiveFacts();
      const databaseKnowledgeCountPayload =
        buildDatabaseKnowledgeCountPayload(liveFacts);

      if (databaseKnowledgeCountPayload) {
        recordConversationState(req, {
          message: effectiveMessage,
          intent: "count",
          liveFacts,
          keepExistingRows: true,
          accessScope,
        });

        return sendLoggedResponse(res, {
          detectedIntent: "count",
          startedAt: requestStartedAt,
          payload: databaseKnowledgeCountPayload,
        });
      }
    }

    if (detectedIntent === "insight") {
      const storedContext = getStoredContext(req);
      let insight = null;
      let contextData = null;
      const canUseStoredContext =
        !accessScope?.scopeKey ||
        !storedContext?.accessScopeKey ||
        scopeMatchesMetadata(
          { accessScopeKey: storedContext.accessScopeKey },
          accessScope
        );

      if (
        isContextQuery(effectiveMessage) &&
        storedContext?.lastData?.length &&
        canUseStoredContext
      ) {
        insight = await buildDynamicInsight({
          message: effectiveMessage,
          entity: storedContext.entityType || "generic",
          data: storedContext.lastData,
          queryType: storedContext.queryType || "context",
          contextUsed: true,
        });
      }

      if (!insight) {
        contextData = await buildLiveDataContext(effectiveMessage, accessScope);
        insight = await buildUniversalInsightResponse({
          message: effectiveMessage,
          contextData,
        });
      }

      recordConversationState(req, {
        message: effectiveMessage,
        intent: "insight",
        liveFacts: contextData || {
          sourceDatabase: mongoose.connection?.db?.databaseName || null,
        },
        keepExistingRows: true,
        accessScope,
      });

      const formattedPayload = formatUnifiedResponse({
        type: "insight",
        data: {
          ...insight,
          provider: insight.meta?.provider || insight.provider || "ai",
          sourceDatabase:
            contextData?.sourceDatabase ||
            storedContext?.lastPayload?.sourceDatabase ||
            mongoose.connection?.db?.databaseName ||
            null,
          usedLiveData: true,
          extraData: insight.extraData || null,
        },
      });

      rememberContextState(req, {
        message: effectiveMessage,
        payload: formattedPayload,
        rawData:
          (isContextQuery(effectiveMessage) &&
          storedContext?.lastData?.length &&
          canUseStoredContext)
            ? storedContext.lastData
            : insight.extraData?.rows || insight.extraData?.sample || insight.chart?.data || null,
        entityType: insight.entity || storedContext?.entityType || null,
        queryType: "insight",
        preserveExistingData: Boolean(storedContext?.lastData?.length),
        accessScope,
      });

      return sendLoggedResponse(res, {
        detectedIntent,
        startedAt: requestStartedAt,
        payload: formattedPayload,
      });
    }

    if (!isLightweightDataQuery(detectedIntent, effectiveMessage, session)) {
      await ensureLiveFacts();
    }

    const deterministicReply = getDeterministicReply(effectiveMessage, liveFacts);
    if (deterministicReply) {
      const response = formatUnifiedResponse({
        type: "chat",
        data: {
          reply: deterministicReply,
          provider: "deterministic",
          sourceDatabase: liveFacts.sourceDatabase || null,
          usedLiveData: Boolean(liveFacts.overview),
        },
      });

      recordConversationState(req, {
        message: effectiveMessage,
        intent: "chat",
        liveFacts,
        keepExistingRows: true,
        accessScope,
      });

      return sendLoggedResponse(res, {
        detectedIntent,
        startedAt: requestStartedAt,
        payload: response,
      });
    }

    if (detectedIntent === "data" || session?.pendingIntent) {
      let dataResponse = await resolveDataResponse(
        req,
        effectiveMessage,
        liveFacts,
        {
          plannedEntity: queryPlan.entity,
          parsedQuery: queryPlan.parsedQuery,
          accessScope,
        }
      );

      if (!dataResponse && !hasLiveFacts) {
        await ensureLiveFacts();
        dataResponse = await resolveDataResponse(
          req,
          effectiveMessage,
          liveFacts,
          {
            plannedEntity: queryPlan.entity,
            parsedQuery: queryPlan.parsedQuery,
            accessScope,
          }
        );
      }

      if (dataResponse) {
        const enhancedDataResponse = enhanceStudentDataResponse(
          dataResponse,
          effectiveMessage
        );
        const limitedDataResponse = applyDataLimitPolicy({
          message: effectiveMessage,
          response: enhancedDataResponse,
          requestQuery: req.query || {},
        });

        if (!limitedDataResponse.skipHistory) {
          recordConversationState(req, {
            message: effectiveMessage,
            intent: "data",
            liveFacts,
            rows: limitedDataResponse.contextData || limitedDataResponse.rows || [],
            accessScope,
          });
        }

        const formattedPayload = formatUnifiedResponse({
          type: "data",
          data: limitedDataResponse,
        });

        rememberContextState(req, {
          message: effectiveMessage,
          payload: formattedPayload,
          rawData:
            limitedDataResponse.contextData ||
            limitedDataResponse.rows ||
            limitedDataResponse.extraData ||
            null,
          entityType: limitedDataResponse.entity || formattedPayload.entity || null,
          queryType: limitedDataResponse.queryType || "data",
          accessScope,
        });

        return sendLoggedResponse(res, {
          detectedIntent,
          startedAt: requestStartedAt,
          payload: formattedPayload,
        });
      }
    }

    if (detectedIntent === "report") {
      await ensureLiveFacts();
      const reportResponse =
        (await resolveContextualReportResponse(req, effectiveMessage, liveFacts, accessScope)) ||
        (await resolveReportResponse(
          req,
          effectiveMessage,
          liveFacts,
          {
            plannedEntity: queryPlan.entity,
            plannedFilters: queryPlan.filters,
            plannedSort: queryPlan.sort,
            plannedLimit: queryPlan.limit,
            parsedQuery: queryPlan.parsedQuery,
            accessScope,
          }
        ));

      recordConversationState(req, {
        message: effectiveMessage,
        intent: "report",
        liveFacts,
        rows: reportResponse.contextData || reportResponse.rows || [],
        accessScope,
      });

      const formattedPayload = formatReportResponse(reportResponse);

      rememberContextState(req, {
        message: effectiveMessage,
        payload: formattedPayload,
        rawData: reportResponse.contextUsed
          ? null
          : reportResponse.contextData ||
            reportResponse.extraData?.contextData ||
            reportResponse.extraData?.rows ||
            reportResponse.extraData?.sample ||
            reportResponse.rows ||
            null,
        entityType: reportResponse.entity || formattedPayload.entity || null,
        queryType: "report",
        preserveExistingData: Boolean(reportResponse.contextUsed),
        accessScope,
      });

      console.log({
        intent: formattedPayload.type,
        queryType: "report",
        responseTime: Date.now() - requestStartedAt,
      });

      return res.status(200).json(
        decoratePayloadWithAccessScope(formattedPayload, accessScope)
      );
    }

    await ensureLiveFacts();
    const geminiResult = await getGeminiResponse({
      message: effectiveMessage,
      liveFacts,
    });

    if (geminiResult.success) {
      recordConversationState(req, {
        message: effectiveMessage,
        intent: "chat",
        liveFacts,
        keepExistingRows: true,
        accessScope,
      });

      return sendLoggedResponse(res, {
        detectedIntent,
        startedAt: requestStartedAt,
        payload: formatUnifiedResponse({
          type: "chat",
          data: {
            reply: geminiResult.reply,
            provider: geminiResult.meta?.provider || "gemini",
            model: geminiResult.meta?.model || null,
            sourceDatabase:
              geminiResult.meta?.sourceDatabase || liveFacts.sourceDatabase || null,
            usedLiveData: Boolean(geminiResult.meta?.usedLiveData),
            meta: geminiResult.meta || null,
          },
        }),
      });
    }

    const fallbackDataResponse = buildFactDataResponse(effectiveMessage, liveFacts);
    if (fallbackDataResponse) {
      const limitedFallbackDataResponse = applyDataLimitPolicy({
        message: effectiveMessage,
        response: fallbackDataResponse,
        requestQuery: req.query || {},
      });

      recordConversationState(req, {
        message: effectiveMessage,
        intent: "data",
        liveFacts,
        rows: limitedFallbackDataResponse.contextData || limitedFallbackDataResponse.rows || [],
        accessScope,
      });

      const formattedPayload = formatUnifiedResponse({
        type: "data",
        data: {
          ...limitedFallbackDataResponse,
          meta: geminiResult.meta || null,
        },
      });

      rememberContextState(req, {
        message: effectiveMessage,
        payload: formattedPayload,
        rawData:
          limitedFallbackDataResponse.contextData ||
          limitedFallbackDataResponse.rows ||
          limitedFallbackDataResponse.extraData ||
          null,
        entityType: formattedPayload.entity || null,
        queryType: limitedFallbackDataResponse.queryType || "data",
        accessScope,
      });

      return sendLoggedResponse(res, {
        detectedIntent,
        startedAt: requestStartedAt,
        payload: formattedPayload,
      });
    }

    recordConversationState(req, {
      message: effectiveMessage,
      intent: "fallback",
      liveFacts,
      keepExistingRows: true,
      accessScope,
    });

    return sendLoggedResponse(res, {
      detectedIntent,
      startedAt: requestStartedAt,
      payload: formatUnifiedResponse({
        type: "fallback",
        data: {
          success: false,
          reply: geminiResult.message || "I could not process that request right now.",
          provider: "fallback",
          sourceDatabase: liveFacts.sourceDatabase || null,
          usedLiveData: Boolean(
            liveFacts.student || liveFacts.department || liveFacts.overview
          ),
          meta: geminiResult.meta || null,
        },
      }),
    });
  } catch (error) {
    console.error("Chatbot error:", error);
    return sendLoggedResponse(res, {
      status: 500,
      detectedIntent: "chat",
      startedAt: requestStartedAt,
      payload: formatUnifiedResponse({
        type: "fallback",
        data: {
          success: false,
          reply: error.message || "Server error",
          title: "Jorvis Error",
          provider: "fallback",
          meta: {
            error: error.message || "Server error",
          },
        },
      }),
    });
  }
};

const exportInsightReport = async (req, res) => {
  try {
    const accessScope = await resolveChatbotAccessScope(req.user);
    const contextState = getStoredContext(req);
    const insights =
      req.body?.insights && typeof req.body.insights === "object"
        ? req.body.insights
        : null;
    const chart =
      req.body?.chart && typeof req.body.chart === "object" ? req.body.chart : null;
    const title = String(req.body?.title || insights?.title || "Insight Report").trim();
    const summaryText = String(
      req.body?.summaryText || insights?.description || ""
    ).trim();
    const rawMessage = String(req.body?.message || title || "insight-report").trim();

    if (!insights) {
      return res.status(400).json({
        success: false,
        error: "Insights payload is required",
      });
    }

    const insightScopeMetadata = insights?.meta || null;
    const contextScopeMetadata = contextState?.accessScopeKey
      ? { accessScopeKey: contextState.accessScopeKey }
      : null;
    if (
      !scopeMatchesMetadata(insightScopeMetadata, accessScope) &&
      !scopeMatchesMetadata(contextScopeMetadata, accessScope)
    ) {
      return res.status(403).json({
        success: false,
        error: buildAccessDeniedMessage(accessScope),
      });
    }

    await exportInsightAsPdf({
      res,
      insights,
      chart,
      reportTitle: title,
      fileBaseName: buildFileBaseName(rawMessage),
      summaryText,
    });
  } catch (error) {
    console.error("Insight export error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Server error",
    });
  }
};

const exportChatReport = async (req, res) => {
  try {
    const accessScope = await resolveChatbotAccessScope(req.user);
    const message = req.body?.message?.trim();
    const format = normalizeExportFormat(req.body?.format || "");
    const structuredReportCandidate =
      req.body?.reportData && typeof req.body.reportData === "object"
        ? req.body.reportData
        : null;
    const structuredReportPayload = isStructuredReportPayload(
      structuredReportCandidate
    )
      ? structuredReportCandidate
      : null;

    if (!message) {
      return res.status(400).json({ success: false, error: "Message required" });
    }

    if (!["pdf", "docx"].includes(format)) {
      return res.status(400).json({
        success: false,
        error: "Format must be pdf, docx, or document",
      });
    }

    let report = null;
    let reportText = "";
    let reportData =
      (structuredReportPayload &&
      scopeMatchesMetadata(structuredReportPayload.meta || null, accessScope)
        ? structuredReportPayload
        : null) || resolveStoredFormattedReport(req, message, accessScope);

    if (!reportData) {
      const liveFacts = {
        sourceDatabase: mongoose.connection?.db?.databaseName || null,
      };
      const session = getSession(req);
      const effectiveMessage = buildContextAwareMessage({
        message,
        session,
      });
      const queryPlan = await buildQueryPlan({
        message: effectiveMessage,
        session,
      });
      const scopedReportDecision = await validateAndApplyRoleScope({
        message: effectiveMessage,
        parsedQuery: queryPlan.parsedQuery,
        entity: queryPlan.entity,
        intent: "report",
        accessScope,
      });

      console.log("Chatbot Export RBAC:", scopedReportDecision.audit || {
        role: accessScope.role,
        scopeKey: accessScope.scopeKey,
      });

      if (scopedReportDecision.accessDenied) {
        return res.status(403).json({
          success: false,
          error:
            scopedReportDecision.message || buildAccessDeniedMessage(accessScope),
        });
      }

      queryPlan.parsedQuery =
        scopedReportDecision.parsedQuery || queryPlan.parsedQuery;
      queryPlan.filters = queryPlan.parsedQuery?.filters || queryPlan.filters || {};
      const reportResponse =
        (await resolveContextualReportResponse(req, message, liveFacts, accessScope)) ||
        (await resolveReportResponse(req, effectiveMessage, liveFacts, {
          accessScope,
          plannedEntity: queryPlan.entity,
          plannedFilters: queryPlan.filters,
          parsedQuery: queryPlan.parsedQuery,
          plannedSort: queryPlan.parsedQuery?.sort || queryPlan.sort || null,
          plannedLimit:
            queryPlan.parsedQuery?.limit ?? queryPlan.limit ?? null,
        }));

      reportData = formatReportResponse(reportResponse);
      reportText = reportResponse.reply || "";
      report = reportResponse;
    }

    if (!reportText && reportData) {
      reportText = "";
    }

    const fileBaseName = buildFileBaseName(message || reportData?.title || "report");
    const reportTitle =
      reportData?.title ||
      report?.title?.replace(/^#\s*/, "") ||
      "IQAC Chatbot Report";

    if (format === "pdf") {
      await exportReportAsPdf({
        res,
        reportText,
        reportData,
        fileBaseName,
        reportTitle,
      });
      return;
    }

    await exportReportAsDocx({
      res,
      reportText,
      reportData,
      fileBaseName,
      reportTitle,
    });
  } catch (error) {
    console.error("Chat export error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Server error",
    });
  }
};

module.exports = {
  chat: getChatbotResponse,
  getChatbotResponse,
  exportChatReport,
  exportInsightReport,
};
