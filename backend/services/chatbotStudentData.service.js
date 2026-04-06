const Department = require("../models/Department");

const TOP_QUERY_PATTERN = /\b(top|best|highest|rank|ranking|top performer|top performers)\b/i;
const LOW_QUERY_PATTERN = /\b(low|least|worst)\b/i;
const BACKLOG_QUERY_PATTERN = /\bbacklog|backlogs|arrear|arrears\b/i;
const ATTENDANCE_QUERY_PATTERN = /\battendance\b/i;
const SIMPLE_STUDENT_QUERY_PATTERN = /\b(student|students|cgpa|performer|performers|rank|ranking)\b/i;
const STUDENT_RANK_CONTEXT_PATTERN = /\b(student|students|cgpa|gpa|performer|performers)\b/i;
const PLACEMENT_RECRUITMENT_PATTERN =
  /\b(recruit|recruited|recruitment|hire|hired|hiring|offer|offered|selected|selection|recruiter|recruiters)\b/i;
const NON_STUDENT_ENTITY_PATTERN = /\b(faculty|faculties|staff|subject|subjects|user|users|research|document|documents|event|events|placement|placements|department|departments)\b/i;
const ADVANCED_STUDENT_QUERY_PATTERN = /\b(attendance|marks|mark|result|results|backlog|backlogs|arrear|arrears|placement|placed|company|package|subject|subjects|faculty|faculties|user|users|below|under|less than|more than|greater than|at risk|recruit|recruited|recruitment|hire|hired|hiring|offer|offered|selected|selection|recruiter|recruiters)\b/i;
const TOP_LIMIT_PATTERN = /\btop\s+(\d+)\b/i;

const normalizeText = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const roundTo = (value, digits = 2) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Number(numericValue.toFixed(digits));
};

const isTopQuery = (message = "") => TOP_QUERY_PATTERN.test(normalizeText(message));

const detectDataQueryType = (message = "") => {
  const normalized = normalizeText(message);

  if (TOP_QUERY_PATTERN.test(normalized)) {
    return "top";
  }

  if (LOW_QUERY_PATTERN.test(normalized)) {
    return "low";
  }

  if (BACKLOG_QUERY_PATTERN.test(normalized)) {
    return "backlog";
  }

  if (ATTENDANCE_QUERY_PATTERN.test(normalized)) {
    return "attendance";
  }

  return "general";
};

const shouldUseStudentCollectionQuery = (message = "") => {
  const normalized = normalizeText(message);
  if (PLACEMENT_RECRUITMENT_PATTERN.test(normalized)) {
    return false;
  }

  if (isTopQuery(normalized)) {
    return (
      STUDENT_RANK_CONTEXT_PATTERN.test(normalized) ||
      !NON_STUDENT_ENTITY_PATTERN.test(normalized)
    );
  }

  return (
    SIMPLE_STUDENT_QUERY_PATTERN.test(normalized) &&
    !ADVANCED_STUDENT_QUERY_PATTERN.test(normalized)
  );
};

const getTopLimit = (message = "", fallback = 10) => {
  const match = String(message).match(TOP_LIMIT_PATTERN);
  if (!match) {
    return fallback;
  }

  return Math.min(Math.max(parseInt(match[1], 10), 1), 50);
};

const matchesDepartment = (normalizedMessage, department = {}) => {
  const code = normalizeText(department.code);
  const name = normalizeText(department.name);

  const codePattern = code ? new RegExp(`\\b${escapeRegex(code)}\\b`, "i") : null;
  const namePattern = name
    ? new RegExp(`\\b${escapeRegex(name).replace(/\s+/g, "\\s+")}\\b`, "i")
    : null;

  return Boolean(
    (codePattern && codePattern.test(normalizedMessage)) ||
      (namePattern && namePattern.test(normalizedMessage))
  );
};

const extractDepartment = async (message = "") => {
  const normalizedMessage = normalizeText(message);
  if (!normalizedMessage) {
    return null;
  }

  const departments = await Department.find({ isActive: true })
    .select("name code")
    .lean();

  const rankedDepartments = [...departments].sort((left, right) => {
    const leftScore = Math.max(left?.name?.length || 0, left?.code?.length || 0);
    const rightScore = Math.max(
      right?.name?.length || 0,
      right?.code?.length || 0
    );
    return rightScore - leftScore;
  });

  return rankedDepartments.find((department) =>
    matchesDepartment(normalizedMessage, department)
  ) || null;
};

const getTopPerformers = (students = [], limit = 10) =>
  students
    .filter((student) => Number.isFinite(Number(student?.cgpa)))
    .sort((left, right) => {
      const cgpaDifference = Number(right.cgpa) - Number(left.cgpa);
      if (cgpaDifference !== 0) {
        return cgpaDifference;
      }

      return String(left.name || "").localeCompare(String(right.name || ""));
    })
    .slice(0, limit);

const extractDepartmentFromData = (students = []) => {
  if (!Array.isArray(students) || !students.length) {
    return null;
  }

  const departmentCodes = [
    ...new Set(
      students
        .map((student) => student.department?.code || student.departmentCode || null)
        .filter(Boolean)
    ),
  ];

  return departmentCodes.length === 1 ? departmentCodes[0] : null;
};

const getAttendanceValue = (student = {}) => {
  const value =
    student.attendance ??
    student.averageAttendance ??
    student.academicRecords?.avgAttendance;

  return Number.isFinite(Number(value)) ? Number(value) : null;
};

const getBacklogValue = (student = {}) => {
  const value =
    student.currentBacklogs ??
    student.backlogCount ??
    student.backlogs ??
    0;

  return Number.isFinite(Number(value)) ? Number(value) : 0;
};

const processStudentData = (students = [], queryType = "general") => {
  if (!Array.isArray(students) || !students.length) {
    return [];
  }

  let result = [...students];

  switch (queryType) {
    case "top":
      result = result
        .filter((student) => Number.isFinite(Number(student?.cgpa)))
        .sort((left, right) => Number(right.cgpa) - Number(left.cgpa));
      break;
    case "low":
      result = result
        .filter((student) => Number.isFinite(Number(student?.cgpa)))
        .sort((left, right) => Number(left.cgpa) - Number(right.cgpa));
      break;
    case "backlog":
      result = result.filter((student) => getBacklogValue(student) > 0);
      break;
    case "attendance":
      result = result.filter((student) => {
        const attendance = getAttendanceValue(student);
        return attendance !== null && attendance < 75;
      });
      break;
    default:
      result = [...result];
  }

  return result;
};

const formatStudentResponse = (students = []) =>
  students.map((student, index) => {
    const attendance = getAttendanceValue(student);
    const backlogs = getBacklogValue(student);

    return {
      rank: index + 1,
      name: student.name || null,
      rollNumber: student.rollNumber || null,
      ...(student.batchYear !== undefined && student.batchYear !== null
        ? { batchYear: Number(student.batchYear) }
        : {}),
      cgpa: roundTo(student.cgpa),
      backlogs,
      currentBacklogs: backlogs,
      ...(attendance !== null ? { attendance: roundTo(attendance) } : {}),
      ...(student.department?.name || student.department
        ? { department: student.department?.name || student.department || null }
        : {}),
      ...(student.department?.code || student.departmentCode
        ? { departmentCode: student.department?.code || student.departmentCode || null }
        : {}),
    };
  });

const isStudentDataRow = (row = {}) =>
  Boolean(
    row &&
    (row.rollNumber ||
      row.cgpa !== undefined ||
      row.currentBacklogs !== undefined ||
      row.backlogCount !== undefined ||
      row.backlogs !== undefined ||
      row.averageAttendance !== undefined ||
      row.attendance !== undefined)
  );

const buildProcessedReply = ({
  queryType,
  count,
  departmentCode,
  originalCount,
}) => {
  const scope = departmentCode ? ` in ${departmentCode}` : "";

  if (count === 0) {
    return `No matching records found${scope}.`;
  }

  if (queryType === "top") {
    return `I found ${count} top performer ${count === 1 ? "record" : "records"}${scope}.`;
  }

  if (queryType === "low") {
    return `I found ${count} low performer ${count === 1 ? "record" : "records"}${scope}.`;
  }

  if (queryType === "backlog") {
    return `I found ${count} ${count === 1 ? "student" : "students"} with backlogs${scope}.`;
  }

  if (queryType === "attendance") {
    return `I found ${count} ${count === 1 ? "student" : "students"} with attendance below 75%${scope}.`;
  }

  const total = originalCount ?? count;
  return `I found ${total} ${total === 1 ? "student" : "students"}${scope}.`;
};

const enhanceStudentDataResponse = (dataResponse = {}, message = "") => {
  if (
    !dataResponse ||
    dataResponse.smartProcessed ||
    !Array.isArray(dataResponse.rows)
  ) {
    return dataResponse;
  }

  if (!dataResponse.rows.length || !dataResponse.rows.some(isStudentDataRow)) {
    return dataResponse;
  }

  const queryType = detectDataQueryType(message);
  const originalRows = dataResponse.rows;
  const processedRows = processStudentData(originalRows, queryType);
  const departmentCode = extractDepartmentFromData(originalRows);

  if (!processedRows.length) {
    return {
      ...dataResponse,
      success: false,
      reply: buildProcessedReply({
        queryType,
        count: 0,
        departmentCode,
        originalCount: originalRows.length,
      }),
      count: 0,
      rows: [],
      responseType: "text",
      queryType,
      summary: {
        ...(dataResponse.summary || {}),
        count: 0,
        queryType,
        department: departmentCode,
      },
      extraData: [],
      smartProcessed: true,
    };
  }

  const formattedRows = formatStudentResponse(processedRows);

  return {
    ...dataResponse,
    reply: buildProcessedReply({
      queryType,
      count: formattedRows.length,
      departmentCode,
      originalCount: originalRows.length,
    }),
    count: formattedRows.length,
    rows: formattedRows,
    responseType: "table",
    queryType,
    summary: {
      ...(dataResponse.summary || {}),
      count: formattedRows.length,
      queryType,
      department: departmentCode,
    },
    extraData: formattedRows,
    smartProcessed: true,
  };
};

const formatStudentRows = (students = []) =>
  students.map((student) => ({
    name: student.name || null,
    rollNumber: student.rollNumber || null,
    department: student.department?.name || null,
    departmentCode: student.department?.code || null,
    ...(student.batchYear !== undefined && student.batchYear !== null
      ? { batchYear: Number(student.batchYear) }
      : {}),
    cgpa: roundTo(student.cgpa),
  }));

const formatTopStudents = (students = []) =>
  students.map((student, index) => ({
    rank: index + 1,
    name: student.name || null,
    cgpa: roundTo(student.cgpa),
    rollNumber: student.rollNumber || null,
    department: student.department?.name || null,
    departmentCode: student.department?.code || null,
    ...(student.batchYear !== undefined && student.batchYear !== null
      ? { batchYear: Number(student.batchYear) }
      : {}),
  }));

module.exports = {
  detectDataQueryType,
  enhanceStudentDataResponse,
  extractDepartment,
  extractDepartmentFromData,
  formatStudentResponse,
  formatStudentRows,
  formatTopStudents,
  getTopLimit,
  getTopPerformers,
  isTopQuery,
  processStudentData,
  shouldUseStudentCollectionQuery,
};
