const Placement = require("../models/Placement");
const PlacementDrive = require("../models/PlacementDrive");
const PlacementApplication = require("../models/PlacementApplication");
const Student = require("../models/Student");
const { resolveMentionedDepartments } = require("./chatbotFilter.service");
const { resolveYearFilterContext } = require("./chatbotYearFilter.service");
const {
  detectPlacementDomain: detectPlacementDomainIntent,
  extractPlacementCompany: extractPlacementCompanyIntent,
  isGenericPlacementApplyQuery,
  isPlacementEligibilityQuery,
  isPlacementReadinessQuery,
  isPlacementRequirementQuery,
} = require("./chatbotPlacementIntent.service");

const COUNT_PATTERN = /\b(total|count|how many|number of)\b/i;
const REPORT_PATTERN = /\b(report|summary|analysis|export|pdf|docx)\b/i;
const PERSONAL_PATTERN = /\b(my|me|mine|own|for me|myself)\b/i;
const DRIVE_PATTERN =
  /\b(placement\s+drive|placement\s+drives|drive|drives|deadline|upcoming drive|open drive|open drives|placement opportunity|placement opportunities|eligible drives?)\b/i;
const ELIGIBILITY_PATTERN =
  /\b(eligible|eligibility|am i eligible|do i qualify|qualification)\b/i;
const RECRUITMENT_PATTERN =
  /\b(recruit|recruited|recruitment|hire|hired|hiring|offer|offered|selected|selection)\b/i;
const RECRUITER_PATTERN =
  /\b(recruiter|recruiters|company wise|company-wise|top companies|top recruiters)\b/i;
const TREND_PATTERN =
  /\b(trend|year wise|year-wise|by year|academic year wise|academic-year wise)\b/i;
const PACKAGE_DISTRIBUTION_PATTERN =
  /\b(package distribution|distribution of package|package band|salary band|ctc band)\b/i;
const PLACEMENT_RATE_PATTERN =
  /\b(placement percentage|placement rate|best placement percentage|best placement rate|department with best placement|department wise placement|department-wise placement)\b/i;
const READINESS_PATTERN =
  /\b(placement readiness|readiness summary|placement summary|placement opportunities|placement status)\b/i;
const OPEN_PATTERN = /\bopen\b/i;
const UPCOMING_PATTERN = /\bupcoming\b/i;
const CLOSED_PATTERN = /\bclosed\b/i;
const LIMITLESS_PREVIEW_ROWS = 10;

const normalizeText = (value = "") => String(value || "").trim();
const normalizeLower = (value = "") => normalizeText(value).toLowerCase();
const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const roundTo = (value, digits = 2) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Number(numericValue.toFixed(digits));
};

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const uniqBy = (rows = [], selector = (value) => value) => {
  const seen = new Set();
  return rows.filter((row) => {
    const key = selector(row);
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const toObjectIdString = (value = null) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value._id) return String(value._id);
  if (value.id) return String(value.id);
  return value.toString?.() || null;
};

const getPrimitiveFilterValue = (filters = {}, keys = []) => {
  for (const key of keys) {
    const value = filters?.[key];
    if (value == null || value === "") {
      continue;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }

    if (isPlainObject(value)) {
      if (value.$eq !== undefined) return value.$eq;
      if (value.eq !== undefined) return value.eq;
    }
  }

  return null;
};

const getNumericFilter = (filters = {}, keys = []) => {
  for (const key of keys) {
    const value = filters?.[key];
    if (value == null || value === "") {
      continue;
    }

    if (typeof value === "number") {
      return { operator: "eq", value };
    }

    if (isPlainObject(value)) {
      if (value.$gte !== undefined || value.gte !== undefined) {
        return { operator: "gte", value: Number(value.$gte ?? value.gte) };
      }
      if (value.$gt !== undefined || value.gt !== undefined) {
        return { operator: "gt", value: Number(value.$gt ?? value.gt) };
      }
      if (value.$lte !== undefined || value.lte !== undefined) {
        return { operator: "lte", value: Number(value.$lte ?? value.lte) };
      }
      if (value.$lt !== undefined || value.lt !== undefined) {
        return { operator: "lt", value: Number(value.$lt ?? value.lt) };
      }
      if (value.$eq !== undefined || value.eq !== undefined) {
        return { operator: "eq", value: Number(value.$eq ?? value.eq) };
      }
    }
  }

  return null;
};

const valueMatchesNumericFilter = (value, filter = null) => {
  if (!filter) return true;
  const numericValue = Number(value);
  const expectedValue = Number(filter.value);
  if (!Number.isFinite(numericValue) || !Number.isFinite(expectedValue)) {
    return false;
  }

  switch (filter.operator) {
    case "gt":
      return numericValue > expectedValue;
    case "gte":
      return numericValue >= expectedValue;
    case "lt":
      return numericValue < expectedValue;
    case "lte":
      return numericValue <= expectedValue;
    default:
      return numericValue === expectedValue;
  }
};

const captureValue = (message = "", patterns = []) => {
  for (const pattern of patterns) {
    const match = String(message || "").match(pattern);
    const captured = String(match?.[1] || "")
      .trim()
      .replace(/[.,!?;:]+$/g, "");
    if (captured) {
      return captured;
    }
  }

  return null;
};

const normalizeCompanyCandidate = (value = "") => {
  const normalized = normalizeText(value)
    .replace(/[.,!?;:]+$/g, "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .trim();

  if (!normalized) {
    return null;
  }

  if (
    /^(student|students|placement|placements|company|companies|recruit|recruitment|recruiter|recruiters|detail|details|drive|drives)$/i.test(
      normalized
    )
  ) {
    return null;
  }

  return normalized;
};

const normalizePlacementDomain = (value = "") => {
  const normalized = normalizeLower(value);
  if (["placement_application", "application", "applications"].includes(normalized)) {
    return "placement_application";
  }
  if (["placement_drive", "drive", "drives"].includes(normalized)) {
    return "placement_drive";
  }
  return "placement_record";
};

const hasPlacementCompanyRecruitmentIntent = (message = "", parsedQuery = null) => {
  const normalized = normalizeLower(message);
  if (!normalized) {
    return false;
  }

  if (/\b(recruited|hired|selected|offered|placed)\s+by\b/.test(normalized)) {
    return true;
  }

  if (
    RECRUITMENT_PATTERN.test(normalized) &&
    /\b(student|students|detail|details|list|who|company|companies)\b/.test(normalized)
  ) {
    return true;
  }

  const company = extractPlacementCompany(message, parsedQuery);
  return Boolean(
    company &&
      (RECRUITMENT_PATTERN.test(normalized) ||
        /\b(student|students|detail|details|list|who)\b/.test(normalized))
  );
};

const detectPlacementDomain = (message = "", parsedQuery = null) =>
  detectPlacementDomainIntent(message, parsedQuery);

const isPlacementDomainQuery = (message = "", parsedQuery = null) =>
  Boolean(detectPlacementDomain(message, parsedQuery));

const isPlacementPersonalQuery = (message = "", parsedQuery = null) => {
  if (PERSONAL_PATTERN.test(message)) {
    return true;
  }

  const filters = parsedQuery?.filters || {};
  return Boolean(
    filters.student ||
      filters.studentId ||
      filters.rollNumber ||
      filters.roll_number
  );
};

const isPlacementBenchmarkQuery = (message = "") =>
  RECRUITER_PATTERN.test(message) ||
  TREND_PATTERN.test(message) ||
  PACKAGE_DISTRIBUTION_PATTERN.test(message) ||
  PLACEMENT_RATE_PATTERN.test(message) ||
  READINESS_PATTERN.test(message) ||
  /\b(highest package|average package|top package|placement trend|top offers?)\b/i.test(
    message
  );

const resolveSelectedDepartment = async (
  message = "",
  parsedQuery = null,
  accessScope = null,
  scope = {}
) => {
  if (scope.department) {
    return scope.department;
  }

  const mentionedDepartments = await resolveMentionedDepartments(
    message,
    parsedQuery?.filters || {}
  );
  if (mentionedDepartments.length) {
    return {
      _id: toObjectIdString(mentionedDepartments[0]._id),
      name: mentionedDepartments[0].name || null,
      code: mentionedDepartments[0].code || null,
    };
  }

  if (accessScope?.department && scope.forceOwnDepartment) {
    return {
      _id: toObjectIdString(accessScope.department._id),
      name: accessScope.department.name || null,
      code: accessScope.department.code || null,
    };
  }

  return null;
};

const buildAccessDeniedResponse = (accessScope = {}, message) => ({
  success: false,
  type: "data",
  entity: "placement",
  title: "Placement Access Restricted",
  reply: message,
  rows: [],
  contextData: [],
  totalRecords: 0,
  returnedRecords: 0,
  count: 0,
  responseType: "text",
  provider: "database",
  sourceDatabase: "mongodb",
  usedLiveData: true,
  presentation: {
    variant: "answer_card",
  },
  answerCard: {
    headline: "Placement access restricted.",
    summary: message,
    highlights: [
      {
        label: "Role",
        value: accessScope.role || "unknown",
      },
    ],
    table: [],
    chart: null,
    tableTitle: "Access Control",
  },
});

const resolvePlacementScope = async ({
  message = "",
  parsedQuery = null,
  accessScope = null,
  domain = "placement_record",
} = {}) => {
  const mentionedDepartments = await resolveMentionedDepartments(
    message,
    parsedQuery?.filters || {}
  );
  const requestedDepartments = mentionedDepartments.map((department) =>
    normalizeText(department.code || department.name)
  );
  const ownDepartmentCode = normalizeText(accessScope?.departmentCode);
  const ownDepartment = accessScope?.department
    ? {
        _id: toObjectIdString(accessScope.department._id),
        name: accessScope.department.name || null,
        code: accessScope.department.code || null,
      }
    : null;

  if (!accessScope?.role || ["staff", "iqac_admin"].includes(accessScope.role)) {
    return {
      accessDenied: false,
      department:
        mentionedDepartments[0]
          ? {
              _id: toObjectIdString(mentionedDepartments[0]._id),
              name: mentionedDepartments[0].name || null,
              code: mentionedDepartments[0].code || null,
            }
          : null,
      studentId: null,
      forceOwnDepartment: false,
      benchmarkScope: false,
    };
  }

  if (accessScope.role === "faculty") {
    return {
      accessDenied: true,
      message: "Faculty access is limited to your assigned workspace data.",
    };
  }

  if (accessScope.role === "hod") {
    if (
      requestedDepartments.length &&
      requestedDepartments.some((code) => code !== ownDepartmentCode)
    ) {
      return {
        accessDenied: true,
        message: "HOD access is restricted to your department.",
      };
    }

    return {
      accessDenied: false,
      department: ownDepartment,
      studentId: null,
      forceOwnDepartment: true,
      benchmarkScope: true,
    };
  }

  if (accessScope.role === "student") {
    if (
      requestedDepartments.length &&
      requestedDepartments.some((code) => code !== ownDepartmentCode)
    ) {
      return {
        accessDenied: true,
        message: "You can only access placement information for your own profile or safe benchmarks for your department.",
      };
    }

    if (domain === "placement_application") {
      return {
        accessDenied: false,
        department: ownDepartment,
        studentId: accessScope.studentId,
        forceOwnDepartment: true,
        benchmarkScope: false,
      };
    }

    if (domain === "placement_drive") {
      return {
        accessDenied: false,
        department: ownDepartment,
        studentId: accessScope.studentId,
        forceOwnDepartment: true,
        benchmarkScope: true,
      };
    }

    if (isPlacementPersonalQuery(message, parsedQuery)) {
      return {
        accessDenied: false,
        department: ownDepartment,
        studentId: accessScope.studentId,
        forceOwnDepartment: true,
        benchmarkScope: false,
      };
    }

    if (isPlacementBenchmarkQuery(message)) {
      return {
        accessDenied: false,
        department: ownDepartment,
        studentId: null,
        forceOwnDepartment: true,
        benchmarkScope: true,
      };
    }

    return {
      accessDenied: true,
      message:
        "You can only access your own placement history, your applications, eligible drives, and safe benchmark summaries for your department.",
    };
  }

  return {
    accessDenied: false,
    department: mentionedDepartments[0]
      ? {
          _id: toObjectIdString(mentionedDepartments[0]._id),
          name: mentionedDepartments[0].name || null,
          code: mentionedDepartments[0].code || null,
        }
      : null,
    studentId: null,
    forceOwnDepartment: false,
    benchmarkScope: false,
  };
};

const buildRegex = (value = "") =>
  value ? new RegExp(escapeRegex(String(value).trim()), "i") : null;

const getAcademicYearContext = (message = "", parsedQuery = null) =>
  parsedQuery?.yearContext ||
  resolveYearFilterContext({
    message,
    entity: "placement",
    filters: parsedQuery?.filters || {},
  });

const extractPlacementCompany = (message = "", parsedQuery = null) =>
  extractPlacementCompanyIntent(message, parsedQuery);

const extractPlacementRole = (message = "", parsedQuery = null) =>
  getPrimitiveFilterValue(parsedQuery?.filters || {}, ["role"]) ||
  captureValue(message, [
    /\brole\s*(?:is|=|:)?\s*([A-Za-z][A-Za-z0-9&/+\-.\s]{1,60}?)(?=\s+(?:for|in|from|with|company|drive|year|status|top|highest|lowest)\b|$)/i,
    /\bas\s+([A-Za-z][A-Za-z0-9&/+\-.\s]{1,60}?)(?=\s+(?:at|in|for|with|company|drive)\b|$)/i,
  ]);

const extractPlacementType = (message = "", parsedQuery = null) =>
  getPrimitiveFilterValue(parsedQuery?.filters || {}, ["placementType", "type"]) ||
  captureValue(message, [/\b(on-campus|off-campus|ppo|pool campus)\b/i]);

const extractDriveStatus = (message = "", parsedQuery = null) => {
  const explicitStatus = getPrimitiveFilterValue(parsedQuery?.filters || {}, ["status"]);
  if (explicitStatus) {
    return normalizeText(explicitStatus);
  }

  if (OPEN_PATTERN.test(message)) return "Open";
  if (UPCOMING_PATTERN.test(message)) return "Upcoming";
  if (CLOSED_PATTERN.test(message)) return "Closed";
  return null;
};

const APPLICATION_STATUS_ALIASES = {
  applied: "Applied",
  shortlisted: "Shortlisted",
  "interview scheduled": "Interview Scheduled",
  selected: "Selected",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const extractApplicationStatus = (message = "", parsedQuery = null) => {
  const explicitStatus = getPrimitiveFilterValue(parsedQuery?.filters || {}, [
    "applicationStatus",
    "application_status",
    "status",
  ]);
  const normalizedExplicit = normalizeLower(explicitStatus);
  if (APPLICATION_STATUS_ALIASES[normalizedExplicit]) {
    return APPLICATION_STATUS_ALIASES[normalizedExplicit];
  }

  const matchedAlias = Object.keys(APPLICATION_STATUS_ALIASES).find((alias) =>
    new RegExp(`\\b${escapeRegex(alias)}\\b`, "i").test(message)
  );

  return matchedAlias ? APPLICATION_STATUS_ALIASES[matchedAlias] : null;
};

const extractCgpaFilter = (message = "", parsedQuery = null) =>
  getNumericFilter(parsedQuery?.filters || {}, ["minCgpa", "cgpa"]) ||
  (() => {
    const matchedValue = captureValue(message, [
      /\b(?:min(?:imum)?\s+)?cgpa\s*(?:above|greater than|over|more than)\s*(\d+(?:\.\d+)?)\b/i,
      /\b(?:min(?:imum)?\s+)?cgpa\s*(?:at least|>=|not less than)\s*(\d+(?:\.\d+)?)\b/i,
      /\b(?:min(?:imum)?\s+)?cgpa\s*(?:below|under|less than|<)\s*(\d+(?:\.\d+)?)\b/i,
      /\bcgpa\s*(?:is|=|:)\s*(\d+(?:\.\d+)?)\b/i,
    ]);

    if (!matchedValue) return null;
    if (/\b(?:below|under|less than|<)\b/i.test(message)) {
      return { operator: "lt", value: Number(matchedValue) };
    }
    if (/\b(?:above|greater than|over|more than)\b/i.test(message)) {
      return { operator: "gt", value: Number(matchedValue) };
    }
    return { operator: "gte", value: Number(matchedValue) };
  })();

const extractBacklogFilter = (message = "", parsedQuery = null) =>
  getNumericFilter(parsedQuery?.filters || {}, ["maxBacklogs", "backlogs", "currentBacklogs"]) ||
  (() => {
    const matchedValue = captureValue(message, [
      /\b(?:max(?:imum)?\s+)?backlogs?\s*(?:below|under|less than)\s*(\d+)\b/i,
      /\b(?:max(?:imum)?\s+)?backlogs?\s*(?:at most|<=|up to|within)\s*(\d+)\b/i,
      /\b(?:max(?:imum)?\s+)?backlogs?\s*(?:is|=|:)\s*(\d+)\b/i,
    ]);

    if (!matchedValue) return null;
    if (/\b(?:below|under|less than)\b/i.test(message)) {
      return { operator: "lt", value: Number(matchedValue) };
    }
    return { operator: "lte", value: Number(matchedValue) };
  })();

const extractDeadlineRange = (message = "") => {
  const now = new Date();

  if (/\bdeadline\b.*\bthis month\b|\bthis month\b.*\bdeadline\b/i.test(message)) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { $gte: start, $lt: end };
  }

  if (/\bdeadline\b.*\btoday\b|\btoday\b.*\bdeadline\b/i.test(message)) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { $gte: start, $lt: end };
  }

  return null;
};

const buildPlacementRecordSort = (message = "", parsedQuery = null) => {
  const sortField =
    parsedQuery?.sort?.field ||
    Object.keys(parsedQuery?.sort || {})[0] ||
    (/\b(top|highest|best)\b/i.test(message) ? "package" : "placementDate");
  const sortOrder =
    parsedQuery?.sort?.order ||
    parsedQuery?.sort?.[sortField] ||
    "desc";

  return {
    field: sortField === "relevance_or_package" ? "package" : sortField,
    order: sortOrder === "asc" ? "asc" : "desc",
  };
};

const buildDriveSort = (message = "", parsedQuery = null) => {
  const sortField =
    parsedQuery?.sort?.field ||
    Object.keys(parsedQuery?.sort || {})[0] ||
    (/\b(top|highest|best)\b/i.test(message) ? "package" : "deadline");
  const sortOrder =
    parsedQuery?.sort?.order ||
    parsedQuery?.sort?.[sortField] ||
    (sortField === "deadline" ? "asc" : "desc");

  return {
    field:
      sortField === "relevance_or_package" || sortField === "package"
        ? "package"
        : sortField === "date"
          ? "deadline"
          : sortField,
    order: sortOrder === "asc" ? "asc" : "desc",
  };
};

const buildApplicationSort = (message = "", parsedQuery = null) => {
  const sortField =
    parsedQuery?.sort?.field ||
    Object.keys(parsedQuery?.sort || {})[0] ||
    "appliedAt";
  const sortOrder =
    parsedQuery?.sort?.order ||
    parsedQuery?.sort?.[sortField] ||
    "desc";

  return {
    field: sortField === "date" ? "appliedAt" : sortField,
    order: sortOrder === "asc" ? "asc" : "desc",
  };
};

const applyArraySortAndLimit = (rows = [], sortDescriptor = null, limit = null) => {
  const normalizedSort = sortDescriptor || { field: "createdAt", order: "desc" };
  const sortedRows = [...rows].sort((left, right) => {
    const leftValue = left?.[normalizedSort.field];
    const rightValue = right?.[normalizedSort.field];

    if (leftValue == null && rightValue == null) return 0;
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return normalizedSort.order === "asc"
        ? leftValue - rightValue
        : rightValue - leftValue;
    }

    const leftTime = new Date(leftValue).getTime();
    const rightTime = new Date(rightValue).getTime();
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
      return normalizedSort.order === "asc"
        ? leftTime - rightTime
        : rightTime - leftTime;
    }

    return normalizedSort.order === "asc"
      ? String(leftValue).localeCompare(String(rightValue))
      : String(rightValue).localeCompare(String(leftValue));
  });

  const parsedLimit = Number(limit);
  return Number.isFinite(parsedLimit) && parsedLimit > 0
    ? sortedRows.slice(0, parsedLimit)
    : sortedRows;
};

const resolveDriveStatus = (drive = {}, referenceDate = new Date()) => {
  if (String(drive.status || "") === "Closed") {
    return "Closed";
  }

  const deadlineDate = new Date(drive.deadline || 0);
  const driveDateValue = new Date(drive.driveDate || 0);
  if (!Number.isNaN(deadlineDate.getTime()) && deadlineDate < referenceDate) {
    return "Closed";
  }
  if (!Number.isNaN(driveDateValue.getTime()) && driveDateValue > referenceDate) {
    return "Upcoming";
  }
  return "Open";
};

const getEligibleStudentFilter = (drive = {}) => {
  const departmentIds = (drive.departments || []).map((department) =>
    toObjectIdString(department._id || department)
  );
  const filter = {
    isActive: true,
    status: "active",
    cgpa: { $gte: Number(drive.minCgpa || 0) },
    currentBacklogs: { $lte: Number(drive.maxBacklogs ?? 0) },
  };

  if (departmentIds.length) {
    filter.department = { $in: departmentIds };
  }

  return filter;
};

const enrichDrives = async (drives = [], studentProfile = null) => {
  if (!drives.length) {
    return [];
  }

  const driveIds = drives.map((drive) => drive._id);
  const applicationStats = await PlacementApplication.aggregate([
    { $match: { drive: { $in: driveIds } } },
    {
      $group: {
        _id: "$drive",
        applications: { $sum: 1 },
        shortlisted: {
          $sum: {
            $cond: [
              { $in: ["$applicationStatus", ["Shortlisted", "Interview Scheduled", "Selected"]] },
              1,
              0,
            ],
          },
        },
        selected: {
          $sum: {
            $cond: [{ $eq: ["$applicationStatus", "Selected"] }, 1, 0],
          },
        },
      },
    },
  ]);

  const applicationMap = new Map(
    applicationStats.map((entry) => [toObjectIdString(entry._id), entry])
  );
  const eligibleCounts = await Promise.all(
    drives.map((drive) => Student.countDocuments(getEligibleStudentFilter(drive)))
  );

  return drives.map((drive, index) => {
    const applicationSummary = applicationMap.get(toObjectIdString(drive._id)) || {};
    const driveDepartmentIds = (drive.departments || []).map((department) =>
      toObjectIdString(department._id || department)
    );
    const studentDepartmentId = toObjectIdString(
      studentProfile?.department?._id || studentProfile?.department
    );
    const isEligible = studentProfile
      ? (!driveDepartmentIds.length || driveDepartmentIds.includes(studentDepartmentId)) &&
        Number(studentProfile.cgpa || 0) >= Number(drive.minCgpa || 0) &&
        Number(studentProfile.currentBacklogs || 0) <= Number(drive.maxBacklogs ?? 0) &&
        new Date(drive.deadline || 0) >= new Date()
      : null;

    return {
      ...drive,
      status: resolveDriveStatus(drive),
      insights: {
        eligibleStudents: eligibleCounts[index] || 0,
        applications: applicationSummary.applications || 0,
        shortlisted: applicationSummary.shortlisted || 0,
        selected: applicationSummary.selected || 0,
      },
      ...(isEligible !== null ? { isEligible } : {}),
    };
  });
};

const fetchPlacementRecords = async ({
  message = "",
  parsedQuery = null,
  accessScope = null,
  scope = {},
} = {}) => {
  const filters = parsedQuery?.filters || {};
  const yearContext = getAcademicYearContext(message, parsedQuery);
  const selectedDepartment = await resolveSelectedDepartment(
    message,
    parsedQuery,
    accessScope,
    scope
  );
  const companyPattern = buildRegex(extractPlacementCompany(message, parsedQuery));
  const rolePattern = buildRegex(extractPlacementRole(message, parsedQuery));
  const placementTypePattern = buildRegex(extractPlacementType(message, parsedQuery));
  const packageFilter = getNumericFilter(filters, ["package"]);
  const match = {
    ...(yearContext?.academicYear ? { academicYear: yearContext.academicYear } : {}),
    ...(companyPattern ? { company: companyPattern } : {}),
    ...(rolePattern ? { role: rolePattern } : {}),
    ...(placementTypePattern ? { placementType: placementTypePattern } : {}),
    ...(scope.studentId ? { student: scope.studentId } : {}),
  };

  if (selectedDepartment?._id && !scope.studentId) {
    const studentIds = await Student.find({
      isActive: true,
      department: selectedDepartment._id,
    }).distinct("_id");
    match.student = studentIds.length ? { $in: studentIds } : { $in: [] };
  }

  let rows = (
    await Placement.find(match)
      .populate({
        path: "student",
        select: "name rollNumber department batchYear cgpa currentBacklogs",
        populate: {
          path: "department",
          select: "name code",
        },
      })
      .lean()
  ).map((placement) => ({
    studentName: placement.student?.name || null,
    rollNumber: placement.student?.rollNumber || null,
    department: placement.student?.department?.name || null,
    departmentCode: placement.student?.department?.code || null,
    company: placement.company || null,
    role: placement.role || null,
    package: roundTo(placement.package),
    placementType: placement.placementType || null,
    academicYear: placement.academicYear || null,
    placementDate: placement.placementDate || null,
    batchYear: placement.student?.batchYear ?? null,
  }));

  if (packageFilter) {
    rows = rows.filter((row) => valueMatchesNumericFilter(row.package, packageFilter));
  }

  return {
    rows,
    selectedDepartment,
    yearContext,
    sort: buildPlacementRecordSort(message, parsedQuery),
    limit: parsedQuery?.limit ?? null,
  };
};

const fetchPlacementDrives = async ({
  message = "",
  parsedQuery = null,
  accessScope = null,
  scope = {},
} = {}) => {
  const filters = parsedQuery?.filters || {};
  const yearContext = getAcademicYearContext(message, parsedQuery);
  const selectedDepartment = await resolveSelectedDepartment(
    message,
    parsedQuery,
    accessScope,
    scope
  );
  const companyPattern = buildRegex(extractPlacementCompany(message, parsedQuery));
  const rolePattern = buildRegex(extractPlacementRole(message, parsedQuery));
  const status = extractDriveStatus(message, parsedQuery);
  const packageFilter = getNumericFilter(filters, ["package"]);
  const cgpaFilter = extractCgpaFilter(message, parsedQuery);
  const backlogsFilter = extractBacklogFilter(message, parsedQuery);
  const deadlineRange = extractDeadlineRange(message);
  const query = {
    isActive: true,
    ...(yearContext?.academicYear ? { academicYear: yearContext.academicYear } : {}),
    ...(companyPattern ? { company: companyPattern } : {}),
    ...(rolePattern ? { role: rolePattern } : {}),
    ...(status ? { status } : {}),
    ...(selectedDepartment?._id ? { departments: selectedDepartment._id } : {}),
    ...(deadlineRange ? { deadline: deadlineRange } : {}),
  };

  let rows = (
    await enrichDrives(
      await PlacementDrive.find(query)
        .populate("departments", "name code")
        .populate("createdBy", "name email")
        .lean(),
      accessScope?.studentProfile || null
    )
  ).map((drive) => ({
    driveId: toObjectIdString(drive._id),
    company: drive.company || null,
    role: drive.role || null,
    academicYear: drive.academicYear || null,
    package: roundTo(drive.package),
    location: drive.location || null,
    status: resolveDriveStatus(drive),
    deadline: drive.deadline || null,
    driveDate: drive.driveDate || null,
    minCgpa: roundTo(drive.minCgpa),
    maxBacklogs: Number(drive.maxBacklogs ?? 0),
    departments: (drive.departments || []).map((department) => department.name || department.code),
    departmentCodes: (drive.departments || []).map((department) => department.code || null).filter(Boolean),
    eligibleStudents: drive.insights?.eligibleStudents || 0,
    applications: drive.insights?.applications || 0,
    shortlisted: drive.insights?.shortlisted || 0,
    selected: drive.insights?.selected || 0,
    isEligible: drive.isEligible ?? null,
  }));

  if (packageFilter) {
    rows = rows.filter((row) => valueMatchesNumericFilter(row.package, packageFilter));
  }
  if (cgpaFilter) {
    rows = rows.filter((row) => valueMatchesNumericFilter(row.minCgpa, cgpaFilter));
  }
  if (backlogsFilter) {
    rows = rows.filter((row) => valueMatchesNumericFilter(row.maxBacklogs, backlogsFilter));
  }

  return {
    rows,
    selectedDepartment,
    yearContext,
    sort: buildDriveSort(message, parsedQuery),
    limit: parsedQuery?.limit ?? null,
  };
};

const fetchPlacementApplications = async ({
  message = "",
  parsedQuery = null,
  accessScope = null,
  scope = {},
} = {}) => {
  const applicationStatus = extractApplicationStatus(message, parsedQuery);
  const companyPattern = buildRegex(extractPlacementCompany(message, parsedQuery));
  const rolePattern = buildRegex(extractPlacementRole(message, parsedQuery));
  const yearContext = getAcademicYearContext(message, parsedQuery);
  const selectedDepartment = await resolveSelectedDepartment(
    message,
    parsedQuery,
    accessScope,
    scope
  );

  let rows = (
    await PlacementApplication.find({
      ...(scope.studentId ? { student: scope.studentId } : {}),
      ...(applicationStatus ? { applicationStatus } : {}),
    })
      .populate({
        path: "student",
        select: "name rollNumber department batchYear",
        populate: {
          path: "department",
          select: "name code",
        },
      })
      .populate({
        path: "drive",
        populate: {
          path: "departments",
          select: "name code",
        },
      })
      .lean()
  )
    .filter((application) => {
      const drive = application.drive || {};
      const studentDepartmentId = toObjectIdString(
        application.student?.department?._id || application.student?.department
      );
      const driveDepartmentIds = (drive.departments || []).map((department) =>
        toObjectIdString(department._id || department)
      );

      if (selectedDepartment?._id) {
        const selectedDepartmentId = toObjectIdString(selectedDepartment._id);
        const matchesStudentDepartment =
          studentDepartmentId && studentDepartmentId === selectedDepartmentId;
        const matchesDriveDepartment =
          driveDepartmentIds.length && driveDepartmentIds.includes(selectedDepartmentId);
        if (!matchesStudentDepartment && !matchesDriveDepartment) {
          return false;
        }
      }

      if (yearContext?.academicYear && drive.academicYear !== yearContext.academicYear) {
        return false;
      }
      if (companyPattern && !companyPattern.test(String(drive.company || ""))) {
        return false;
      }
      if (rolePattern && !rolePattern.test(String(drive.role || ""))) {
        return false;
      }
      return true;
    })
    .map((application) => ({
      applicationId: toObjectIdString(application._id),
      studentName: application.student?.name || null,
      rollNumber: application.student?.rollNumber || null,
      department: application.student?.department?.name || null,
      departmentCode: application.student?.department?.code || null,
      company: application.drive?.company || null,
      role: application.drive?.role || null,
      academicYear: application.drive?.academicYear || null,
      package: roundTo(application.drive?.package),
      applicationStatus: application.applicationStatus || null,
      appliedAt: application.appliedAt || application.createdAt || null,
      deadline: application.drive?.deadline || null,
      driveId: toObjectIdString(application.drive?._id),
      notes: application.notes || null,
    }));

  return {
    rows,
    selectedDepartment,
    yearContext,
    sort: buildApplicationSort(message, parsedQuery),
    limit: parsedQuery?.limit ?? null,
  };
};

const buildAction = (label, path, state = null) => ({
  label,
  type: "navigate",
  path,
  ...(state ? { state } : {}),
});

const buildSimpleActionCard = ({
  headline,
  summary,
  highlights = [],
  table = [],
  actions = [],
  tableTitle = "Details",
}) => ({
  headline,
  summary,
  highlights,
  table,
  chart: null,
  tableTitle,
  actions,
});

const buildPlacementRoutingAudit = ({
  accessScope = null,
  parsedQuery = null,
  domain = null,
  company = null,
  studentFallbackSkipped = false,
  reason = "routing",
} = {}) => ({
  role: accessScope?.role || null,
  requestedEntity: parsedQuery?.entity || null,
  placementDomain: domain || null,
  company: company || null,
  studentFallbackSkipped,
  reason,
});

const logPlacementRoutingDecision = (details = {}) => {
  console.log("Placement Routing:", buildPlacementRoutingAudit(details));
};

const buildCompanyScopedPlacementTitle = (company = null) =>
  company ? `Students Placed at ${company}` : "Placement Records";

const buildCompanyScopedPlacementReply = ({
  company = null,
  rows = [],
  selectedDepartment = null,
} = {}) => {
  if (!company) {
    return rows.length
      ? `I found ${rows.length} placement ${rows.length === 1 ? "record" : "records"} in the selected scope.`
      : "I could not find placement records for the selected scope.";
  }

  const scopeLabel = selectedDepartment?.code ? ` for ${selectedDepartment.code}` : "";
  if (rows.length) {
    return `I found ${rows.length} student${rows.length === 1 ? "" : "s"} placed at ${company}${scopeLabel} in the selected scope.`;
  }

  return `I could not find students placed at ${company}${scopeLabel} in the selected scope. Try asking for drive details or applications if you meant the recruitment process rather than final placements.`;
};

const findFirstCompanyMatch = async ({
  message = "",
  parsedQuery = null,
  selectedDepartment = null,
} = {}) => {
  const company = extractPlacementCompany(message, parsedQuery);
  if (!company) {
    return null;
  }

  const drives = await PlacementDrive.find({
    isActive: true,
    company: buildRegex(company),
    ...(selectedDepartment?._id ? { departments: selectedDepartment._id } : {}),
  })
    .populate("departments", "name code")
    .sort({ deadline: 1, updatedAt: -1 })
    .lean();

  const activeDrive = drives.find((drive) => resolveDriveStatus(drive) !== "Closed");
  return activeDrive || drives[0] || null;
};

const buildPlacementActionResponse = async ({
  message = "",
  accessScope = null,
  parsedQuery = null,
  scope = {},
} = {}) => {
  if (
    accessScope?.role === "student" &&
    /\b(apply to|apply for|continue application|open selected drive|open my placements?)\b/i.test(
      message
    )
  ) {
    const selectedDrive = await findFirstCompanyMatch({
      message,
      parsedQuery,
      selectedDepartment: scope.department,
    });
    if (!selectedDrive && isGenericPlacementApplyQuery(message, parsedQuery)) {
      return null;
    }
    const needsResume = /\bapply to|apply for\b/i.test(message);
    return {
      success: true,
      type: "data",
      entity: "placement",
      title: selectedDrive ? "Placement Application Handoff" : "Placement Workspace",
      reply: needsResume
        ? "I can guide you to the placement workspace. Keep your resume ready because final application submission happens on the placement page."
        : "I can take you to the student placement workspace so you can continue there.",
      rows: selectedDrive
        ? [
            {
              company: selectedDrive.company,
              role: selectedDrive.role,
              academicYear: selectedDrive.academicYear,
              deadline: selectedDrive.deadline,
              status: resolveDriveStatus(selectedDrive),
            },
          ]
        : [],
      contextData: [],
      totalRecords: selectedDrive ? 1 : 0,
      returnedRecords: selectedDrive ? 1 : 0,
      responseType: "table",
      provider: "database",
      sourceDatabase: "mongodb",
      usedLiveData: true,
      presentation: {
        variant: "answer_card",
      },
      answerCard: {
        headline: selectedDrive
          ? `Continue your ${selectedDrive.company} placement flow from the student placement workspace.`
          : "Open the student placement workspace.",
        summary: needsResume
          ? "Chatbot handoff is ready. Final application steps, including resume submission, continue on the placement page."
          : "Chatbot handoff is ready so you can continue the placement workflow on the existing page.",
        highlights: selectedDrive
          ? [
              { label: "Company", value: selectedDrive.company },
              { label: "Role", value: selectedDrive.role },
              { label: "Status", value: resolveDriveStatus(selectedDrive) },
            ]
          : [],
        table: selectedDrive
          ? [
              {
                company: selectedDrive.company,
                role: selectedDrive.role,
                academicYear: selectedDrive.academicYear,
                deadline: selectedDrive.deadline,
                status: resolveDriveStatus(selectedDrive),
              },
            ]
          : [],
        chart: null,
        tableTitle: selectedDrive ? "Selected Drive" : "Placement Workspace",
        actions: [
          buildAction("Open My Placements", "/student-dashboard/placements", {
            placementChatAction: selectedDrive ? "continue-application" : "open-workspace",
            driveId: toObjectIdString(selectedDrive?._id),
            company: selectedDrive?.company || null,
          }),
        ],
      },
      extraData: {
        type: "placement_action",
      },
    };
  }

  if (
    ["iqac_admin", "staff", "hod"].includes(accessScope?.role) &&
    /\b(create|new|add|edit|update|modify)\b.*\bdrive\b/i.test(message)
  ) {
    const selectedDrive = await findFirstCompanyMatch({
      message,
      selectedDepartment: scope.department,
    });
    const isCreateAction = /\b(create|new|add)\b.*\bdrive\b/i.test(message);
    return {
      success: true,
      type: "data",
      entity: "placement",
      title: isCreateAction ? "Placement Drive Form" : "Placement Drive Handoff",
      reply: isCreateAction
        ? "I can route you to the placement workspace so you can create the drive with the right context."
        : "I can route you to the placement workspace so you can edit the drive there.",
      rows: selectedDrive
        ? [
            {
              company: selectedDrive.company,
              role: selectedDrive.role,
              academicYear: selectedDrive.academicYear,
              status: resolveDriveStatus(selectedDrive),
              deadline: selectedDrive.deadline,
            },
          ]
        : [],
      contextData: [],
      totalRecords: selectedDrive ? 1 : 0,
      returnedRecords: selectedDrive ? 1 : 0,
      responseType: "table",
      provider: "database",
      sourceDatabase: "mongodb",
      usedLiveData: true,
      presentation: {
        variant: "answer_card",
      },
      answerCard: {
        headline: isCreateAction
          ? "Open the placement workspace to create a new drive."
          : selectedDrive
            ? `Open the placement workspace to edit the ${selectedDrive.company} drive.`
            : "Open the placement workspace to manage placement drives.",
        summary: isCreateAction
          ? "The chatbot can prepare the context, but final drive creation continues in the placement workspace."
          : "The chatbot can prepare the context, but final drive editing continues in the placement workspace.",
        highlights: selectedDrive
          ? [
              { label: "Company", value: selectedDrive.company },
              { label: "Role", value: selectedDrive.role },
              { label: "Status", value: resolveDriveStatus(selectedDrive) },
            ]
          : scope.department?.code
            ? [{ label: "Department", value: scope.department.code }]
            : [],
        table: selectedDrive
          ? [
              {
                company: selectedDrive.company,
                role: selectedDrive.role,
                academicYear: selectedDrive.academicYear,
                status: resolveDriveStatus(selectedDrive),
                deadline: selectedDrive.deadline,
              },
            ]
          : [],
        chart: null,
        tableTitle: "Placement Drive",
        actions: [
          buildAction(
            isCreateAction ? "Open Drive Form" : "Open Placement Workspace",
            "/placements",
            {
              placementChatAction: isCreateAction ? "create-drive" : "edit-drive",
              driveId: toObjectIdString(selectedDrive?._id),
              company: selectedDrive?.company || null,
              departmentCode: scope.department?.code || null,
            }
          ),
        ],
      },
      extraData: {
        type: "placement_action",
      },
    };
  }

  return null;
};

const buildListResponse = ({
  title,
  reply,
  rows = [],
  filters = {},
  selectedDepartment = null,
  yearContext = null,
  chart = null,
  answerCard = null,
  entity = "placement",
  queryType = "placement",
  extraType = "placement_records",
} = {}) => ({
  success: true,
  type: "data",
  entity,
  queryType,
  title,
  reply,
  rows,
  contextData: rows,
  totalRecords: rows.length,
  returnedRecords: rows.length,
  count: rows.length,
  filters,
  selectedDepartment,
  summaryData: {
    totalRecords: rows.length,
    ...(selectedDepartment?.code ? { department: selectedDepartment.code } : {}),
    ...(yearContext?.academicYear ? { academicYear: yearContext.academicYear } : {}),
  },
  chart,
  answerCard,
  responseType: rows.length ? "table" : "text",
  provider: "database",
  sourceDatabase: "mongodb",
  usedLiveData: true,
  extraData: {
    type: extraType,
    rows,
  },
});

const buildCountResponse = ({
  title,
  reply,
  total = 0,
  entity = "placement",
  filters = {},
  selectedDepartment = null,
} = {}) => ({
  success: true,
  entity,
  title,
  total,
  count: total,
  message: reply,
  reply,
  filters,
  selectedDepartment,
});

const buildReportResponse = ({
  title,
  entityType = "placement",
  rows = [],
  summary = {},
  tableTitle = "Placement Details",
  filters = {},
  selectedDepartment = null,
  sort = null,
  limit = null,
  reply = "",
} = {}) => {
  const normalizedLimit =
    Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : null;
  const previewRows = normalizedLimit ? rows : rows.slice(0, LIMITLESS_PREVIEW_ROWS);
  return {
    title: `# ${title}`,
    reply,
    entity: entityType,
    entityType,
    summary,
    rows: previewRows,
    tables: [
      {
        title: tableTitle,
        rows: previewRows,
      },
    ],
    extraData: {
      rows: previewRows,
      fullRows: rows,
      contextData: rows,
    },
    contextData: rows,
    filters,
    filtered: Boolean(selectedDepartment?.code || filters.company || filters.academicYear),
    selectedDepartment,
    reportScope: normalizedLimit ? "ranked_subset" : "full_preview",
    limit: normalizedLimit,
    sort,
    totalRecords: rows.length,
    previewCount: previewRows.length,
  };
};

const buildRecruiterResponse = async ({ message = "", parsedQuery = null, accessScope = null, scope = {} } = {}) => {
  const recordData = await fetchPlacementRecords({ message, parsedQuery, accessScope, scope });
  const groupedRows = recordData.rows.reduce((map, row) => {
    const key = normalizeText(row.company, "Unknown");
    const current = map.get(key) || {
      company: row.company || "Unknown",
      hires: 0,
      totalPackage: 0,
      highestPackage: 0,
    };
    current.hires += 1;
    current.totalPackage += Number(row.package || 0);
    current.highestPackage = Math.max(current.highestPackage, Number(row.package || 0));
    map.set(key, current);
    return map;
  }, new Map());

  const rows = [...groupedRows.values()]
    .map((row) => ({
      company: row.company,
      hires: row.hires,
      averagePackage: row.hires ? roundTo(row.totalPackage / row.hires) : 0,
      highestPackage: roundTo(row.highestPackage),
    }))
    .sort((left, right) => right.hires - left.hires || right.averagePackage - left.averagePackage);

  return buildListResponse({
    title: "Top Recruiters",
    reply: rows.length
      ? `I found ${rows.length} recruiters in the selected placement scope.`
      : "I could not find recruiter data for the selected placement scope.",
    rows,
    filters: {
      ...(recordData.selectedDepartment?.code ? { department: recordData.selectedDepartment.code } : {}),
      ...(recordData.yearContext?.academicYear ? { academicYear: recordData.yearContext.academicYear } : {}),
    },
    selectedDepartment: recordData.selectedDepartment,
    yearContext: recordData.yearContext,
    chart: {
      type: "horizontalBar",
      title: "Recruiters by Hires",
      subtitle: "Top companies based on placement count",
      data: rows.slice(0, 8),
      xKey: "company",
      yKey: "hires",
      format: "integer",
    },
    answerCard: buildSimpleActionCard({
      headline: rows[0]
        ? `${rows[0].company} leads the recruiter list with ${rows[0].hires} hires.`
        : "No recruiter data found.",
      summary:
        "This view groups final placement records by company so you can compare recruiter contribution quickly.",
      highlights: rows[0]
        ? [
            { label: "Top Recruiter", value: rows[0].company },
            { label: "Hires", value: String(rows[0].hires) },
            { label: "Average Package", value: String(rows[0].averagePackage) },
          ]
        : [],
      table: rows,
      tableTitle: "Recruiter Breakdown",
    }),
    entity: "placement",
    extraType: "placement_recruiters",
  });
};

const buildTrendResponse = async ({ message = "", parsedQuery = null, accessScope = null, scope = {} } = {}) => {
  const recordData = await fetchPlacementRecords({ message, parsedQuery, accessScope, scope });
  const grouped = recordData.rows.reduce((map, row) => {
    const key = row.academicYear || "Unknown";
    const current = map.get(key) || {
      academicYear: key,
      placements: 0,
      totalPackage: 0,
      highestPackage: 0,
    };
    current.placements += 1;
    current.totalPackage += Number(row.package || 0);
    current.highestPackage = Math.max(current.highestPackage, Number(row.package || 0));
    map.set(key, current);
    return map;
  }, new Map());

  const rows = [...grouped.values()]
    .map((row) => ({
      academicYear: row.academicYear,
      placements: row.placements,
      averagePackage: row.placements ? roundTo(row.totalPackage / row.placements) : 0,
      highestPackage: roundTo(row.highestPackage),
    }))
    .sort((left, right) => String(left.academicYear).localeCompare(String(right.academicYear)));

  return buildListResponse({
    title: "Placement Trend by Academic Year",
    reply: rows.length
      ? "I grouped placement records by academic year."
      : "I could not find placement trend data for the selected scope.",
    rows,
    filters: recordData.selectedDepartment?.code ? { department: recordData.selectedDepartment.code } : {},
    selectedDepartment: recordData.selectedDepartment,
    chart: {
      type: "line",
      title: "Placement Trend",
      subtitle: "Placement count by academic year",
      data: rows,
      xKey: "academicYear",
      yKey: "placements",
      format: "integer",
    },
    answerCard: buildSimpleActionCard({
      headline: rows.length
        ? `Placement trend spans ${rows.length} academic years in the selected scope.`
        : "No placement trend data found.",
      summary: "This view shows how placement volume changes year over year.",
      highlights: rows.length
        ? [
            { label: "Years Covered", value: String(rows.length) },
            { label: "Latest Year", value: rows[rows.length - 1]?.academicYear || "N/A" },
            { label: "Latest Placements", value: String(rows[rows.length - 1]?.placements || 0) },
          ]
        : [],
      table: rows,
      tableTitle: "Placement Trend",
    }),
    entity: "placement",
    extraType: "placement_trend",
  });
};

const buildPackageDistributionResponse = async ({ message = "", parsedQuery = null, accessScope = null, scope = {} } = {}) => {
  const recordData = await fetchPlacementRecords({ message, parsedQuery, accessScope, scope });
  const getPackageBand = (value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return "Unknown";
    if (numericValue < 5) return "Below 5 LPA";
    if (numericValue < 10) return "5 - 10 LPA";
    if (numericValue < 15) return "10 - 15 LPA";
    return "15+ LPA";
  };

  const grouped = recordData.rows.reduce((map, row) => {
    const key = getPackageBand(row.package);
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());

  const bandOrder = ["Below 5 LPA", "5 - 10 LPA", "10 - 15 LPA", "15+ LPA", "Unknown"];
  const rows = bandOrder
    .filter((band) => grouped.has(band))
    .map((band) => ({ band, students: grouped.get(band) }));

  return buildListResponse({
    title: "Package Distribution",
    reply: rows.length
      ? "I grouped placements into package bands."
      : "I could not find package distribution data for the selected placement scope.",
    rows,
    filters: {
      ...(recordData.selectedDepartment?.code ? { department: recordData.selectedDepartment.code } : {}),
      ...(recordData.yearContext?.academicYear ? { academicYear: recordData.yearContext.academicYear } : {}),
    },
    selectedDepartment: recordData.selectedDepartment,
    yearContext: recordData.yearContext,
    chart: {
      type: "pie",
      title: "Package Band Distribution",
      subtitle: "How offers are spread across package ranges",
      data: rows,
      nameKey: "band",
      valueKey: "students",
      format: "integer",
    },
    entity: "placement",
    extraType: "placement_package_distribution",
  });
};

const buildDepartmentRateResponse = async ({ message = "", parsedQuery = null, accessScope = null, scope = {} } = {}) => {
  const yearContext = getAcademicYearContext(message, parsedQuery);
  const students = await Student.find({
    isActive: true,
    ...(scope.department?._id ? { department: scope.department._id } : {}),
  })
    .select("_id department")
    .populate("department", "name code")
    .lean();

  const placements = students.length
    ? await Placement.find({
        student: { $in: students.map((student) => student._id) },
        ...(yearContext?.academicYear ? { academicYear: yearContext.academicYear } : {}),
      })
        .populate({
          path: "student",
          select: "department",
          populate: { path: "department", select: "name code" },
        })
        .lean()
    : [];

  const totals = students.reduce((map, student) => {
    const key = toObjectIdString(student.department?._id || student.department);
    const current = map.get(key) || {
      department: student.department?.name || "Unknown",
      departmentCode: student.department?.code || null,
      totalStudents: 0,
      placedCount: 0,
      totalPackage: 0,
      highestPackage: 0,
    };
    current.totalStudents += 1;
    map.set(key, current);
    return map;
  }, new Map());

  placements.forEach((placement) => {
    const key = toObjectIdString(placement.student?.department?._id || placement.student?.department);
    const current = totals.get(key);
    if (!current) return;
    current.placedCount += 1;
    current.totalPackage += Number(placement.package || 0);
    current.highestPackage = Math.max(current.highestPackage, Number(placement.package || 0));
  });

  const rows = [...totals.values()]
    .map((row) => ({
      department: row.department,
      departmentCode: row.departmentCode,
      totalStudents: row.totalStudents,
      placedCount: row.placedCount,
      placementPercentage: row.totalStudents ? roundTo((row.placedCount / row.totalStudents) * 100) : 0,
      averagePackage: row.placedCount ? roundTo(row.totalPackage / row.placedCount) : 0,
      highestPackage: roundTo(row.highestPackage),
    }))
    .sort((left, right) => right.placementPercentage - left.placementPercentage || right.placedCount - left.placedCount);

  const winner = rows[0] || null;
  return buildListResponse({
    title: "Department Placement Percentage",
    reply: winner
      ? `${winner.department} (${winner.departmentCode || "NA"}) has the strongest placement percentage in the selected scope at ${winner.placementPercentage}%.`
      : "I could not calculate department placement percentage for the selected scope.",
    rows,
    filters: {
      ...(yearContext?.academicYear ? { academicYear: yearContext.academicYear } : {}),
      ...(scope.department?.code ? { department: scope.department.code } : {}),
    },
    selectedDepartment: scope.department || null,
    yearContext,
    chart: {
      type: "bar",
      title: "Placement Percentage by Department",
      subtitle: "Department-wise placement performance",
      data: rows.map((row) => ({
        department: row.departmentCode || row.department,
        placementPercentage: row.placementPercentage,
      })),
      xKey: "department",
      yKey: "placementPercentage",
      format: "percentage",
    },
    entity: "department",
    queryType: "placement",
    extraType: "placement_department_rates",
  });
};

const buildStudentReadinessResponse = async ({ accessScope = null, message = "", parsedQuery = null, scope = {} } = {}) => {
  const driveData = await fetchPlacementDrives({ message, parsedQuery, accessScope, scope });
  const applicationData = await fetchPlacementApplications({
    message,
    parsedQuery,
    accessScope,
    scope: {
      ...scope,
      studentId: accessScope.studentId,
    },
  });
  const placementData = await fetchPlacementRecords({
    message,
    parsedQuery,
    accessScope,
    scope: {
      ...scope,
      studentId: accessScope.studentId,
    },
  });

  const eligibleDrives = driveData.rows.filter((row) => row.isEligible !== false);
  const selectedApplications = applicationData.rows.filter((row) => row.applicationStatus === "Selected").length;
  const highestKnownPackage = roundTo(
    Math.max(0, ...placementData.rows.map((row) => Number(row.package || 0)))
  );

  return {
    success: true,
    type: "data",
    entity: "placement",
    title: "Placement Readiness Summary",
    reply: eligibleDrives.length
      ? `You currently have ${eligibleDrives.length} eligible placement ${eligibleDrives.length === 1 ? "drive" : "drives"} in scope.`
      : "I could not find any currently eligible placement drives for your profile.",
    rows: eligibleDrives.slice(0, 8),
    contextData: eligibleDrives,
    totalRecords: eligibleDrives.length,
    returnedRecords: Math.min(eligibleDrives.length, 8),
    count: eligibleDrives.length,
    responseType: eligibleDrives.length ? "table" : "text",
    provider: "database",
    sourceDatabase: "mongodb",
    usedLiveData: true,
    presentation: {
      variant: "answer_card",
    },
    answerCard: {
      headline: eligibleDrives.length
        ? `You have ${eligibleDrives.length} eligible placement ${eligibleDrives.length === 1 ? "drive" : "drives"} right now.`
        : "No eligible placement drives found right now.",
      summary:
        "This summary combines your eligible drives, application pipeline, and personal placement history inside your student placement scope.",
      highlights: [
        { label: "Eligible Drives", value: String(eligibleDrives.length) },
        { label: "Applications", value: String(applicationData.rows.length) },
        { label: "Selected", value: String(selectedApplications) },
        { label: "Placement History", value: String(placementData.rows.length) },
        ...(highestKnownPackage ? [{ label: "Highest Known Package", value: String(highestKnownPackage) }] : []),
      ],
      table: eligibleDrives.slice(0, 8),
      chart: null,
      tableTitle: "Eligible Placement Drives",
      actions: [
        buildAction("Open My Placements", "/student-dashboard/placements", {
          placementChatAction: "open-workspace",
        }),
      ],
    },
    extraData: {
      type: "placement_readiness",
    },
  };
};

const buildDriveProfileMatch = (selectedDrive = {}, accessScope = null) => {
  const driveDepartmentIds = (selectedDrive.departments || []).map((department) =>
    toObjectIdString(department._id || department)
  );
  const studentDepartmentId = toObjectIdString(
    accessScope?.studentProfile?.department?._id || accessScope?.studentProfile?.department
  );
  const withinDepartment =
    !driveDepartmentIds.length || driveDepartmentIds.includes(studentDepartmentId);
  const withinCgpa =
    Number(accessScope?.studentProfile?.cgpa || 0) >= Number(selectedDrive.minCgpa || 0);
  const withinBacklogs =
    Number(accessScope?.studentProfile?.currentBacklogs || 0) <= Number(selectedDrive.maxBacklogs ?? 0);
  const withinDeadline = new Date(selectedDrive.deadline || 0) >= new Date();
  const eligible = withinDepartment && withinCgpa && withinBacklogs && withinDeadline;
  const reasons = [];

  if (!withinDepartment) reasons.push("your department is not in the eligible department list");
  if (!withinCgpa) reasons.push(`your CGPA is below ${selectedDrive.minCgpa}`);
  if (!withinBacklogs) reasons.push(`your backlog count is above ${selectedDrive.maxBacklogs}`);
  if (!withinDeadline) reasons.push("the drive deadline has already passed");

  return {
    eligible,
    reasons,
  };
};

const buildDriveRequirementResponse = async ({
  message = "",
  parsedQuery = null,
  accessScope = null,
  scope = {},
} = {}) => {
  const selectedDrive = await findFirstCompanyMatch({
    message,
    parsedQuery,
    selectedDepartment: scope.department,
  });

  if (!selectedDrive) {
    return buildListResponse({
      title: "Drive Requirements",
      reply: "I could not find an active placement drive matching that company in your allowed department scope.",
      rows: [],
      entity: "placement",
      extraType: "placement_drive_requirements",
    });
  }

  const { eligible, reasons } = buildDriveProfileMatch(selectedDrive, accessScope);
  const departmentCodes = (selectedDrive.departments || [])
    .map((department) => department.code || department.name || null)
    .filter(Boolean);

  return {
    success: true,
    type: "data",
    entity: "placement",
    title: `${selectedDrive.company} Drive Requirements`,
    reply: eligible
      ? `Here are the current ${selectedDrive.company} drive requirements. Based on your profile, you are eligible right now.`
      : `Here are the current ${selectedDrive.company} drive requirements. Based on your profile, you are not eligible yet because ${reasons.join(", ")}.`,
    rows: [
      {
        company: selectedDrive.company,
        role: selectedDrive.role,
        academicYear: selectedDrive.academicYear,
        package: roundTo(selectedDrive.package),
        minCgpa: roundTo(selectedDrive.minCgpa),
        maxBacklogs: Number(selectedDrive.maxBacklogs ?? 0),
        deadline: selectedDrive.deadline,
        status: resolveDriveStatus(selectedDrive),
        departments: departmentCodes.join(", "),
        eligible,
      },
    ],
    contextData: [],
    totalRecords: 1,
    returnedRecords: 1,
    responseType: "table",
    provider: "database",
    sourceDatabase: "mongodb",
    usedLiveData: true,
    presentation: {
      variant: "answer_card",
    },
    answerCard: {
      headline: `${selectedDrive.company} placement drive requirements`,
      summary: eligible
        ? "Your current profile matches the main drive criteria."
        : `Your profile does not currently meet all criteria because ${reasons.join(", ")}.`,
      highlights: [
        { label: "Company", value: selectedDrive.company },
        { label: "Role", value: selectedDrive.role },
        { label: "Min CGPA", value: String(roundTo(selectedDrive.minCgpa)) },
        { label: "Max Backlogs", value: String(Number(selectedDrive.maxBacklogs ?? 0)) },
        ...(departmentCodes.length ? [{ label: "Departments", value: departmentCodes.join(", ") }] : []),
      ],
      table: [
        {
          company: selectedDrive.company,
          role: selectedDrive.role,
          package: roundTo(selectedDrive.package),
          deadline: selectedDrive.deadline,
          status: resolveDriveStatus(selectedDrive),
          eligible,
        },
      ],
      chart: null,
      tableTitle: "Drive Criteria",
      actions: [
        buildAction("Open Selected Drive", "/student-dashboard/placements", {
          placementChatAction: "view-drive",
          driveId: toObjectIdString(selectedDrive._id),
          company: selectedDrive.company,
        }),
      ],
    },
    extraData: {
      type: "placement_drive_requirements",
    },
  };
};

const buildEligibilityResponse = async ({
  message = "",
  parsedQuery = null,
  accessScope = null,
  scope = {},
} = {}) => {
  const selectedDrive = await findFirstCompanyMatch({
    message,
    parsedQuery,
    selectedDepartment: scope.department,
  });

  if (!selectedDrive) {
    return buildStudentReadinessResponse({
      accessScope,
      message,
      scope,
    });
  }

  const { eligible, reasons } = buildDriveProfileMatch(selectedDrive, accessScope);

  return {
    success: true,
    type: "data",
    entity: "placement",
    title: `${selectedDrive.company} Drive Eligibility`,
    reply: eligible
      ? `Yes, you are eligible for the ${selectedDrive.company} drive.`
      : `You are not currently eligible for the ${selectedDrive.company} drive because ${reasons.join(", ")}.`,
    rows: [
      {
        company: selectedDrive.company,
        role: selectedDrive.role,
        academicYear: selectedDrive.academicYear,
        package: roundTo(selectedDrive.package),
        minCgpa: roundTo(selectedDrive.minCgpa),
        maxBacklogs: Number(selectedDrive.maxBacklogs ?? 0),
        deadline: selectedDrive.deadline,
        eligible,
      },
    ],
    contextData: [],
    totalRecords: 1,
    returnedRecords: 1,
    responseType: "table",
    provider: "database",
    sourceDatabase: "mongodb",
    usedLiveData: true,
    presentation: {
      variant: "answer_card",
    },
    answerCard: {
      headline: eligible
        ? `You are eligible for the ${selectedDrive.company} drive.`
        : `You are not eligible for the ${selectedDrive.company} drive yet.`,
      summary: eligible
        ? "Your current department, CGPA, and backlog profile meet the drive criteria."
        : `Eligibility failed because ${reasons.join(", ")}.`,
      highlights: [
        { label: "Company", value: selectedDrive.company },
        { label: "Role", value: selectedDrive.role },
        { label: "Min CGPA", value: String(roundTo(selectedDrive.minCgpa)) },
        { label: "Max Backlogs", value: String(Number(selectedDrive.maxBacklogs ?? 0)) },
      ],
      table: [
        {
          company: selectedDrive.company,
          role: selectedDrive.role,
          package: roundTo(selectedDrive.package),
          deadline: selectedDrive.deadline,
          eligible,
        },
      ],
      chart: null,
      tableTitle: "Eligibility Check",
      actions: [
        buildAction("Open Selected Drive", "/student-dashboard/placements", {
          placementChatAction: "view-drive",
          driveId: toObjectIdString(selectedDrive._id),
          company: selectedDrive.company,
        }),
      ],
    },
    extraData: {
      type: "placement_drive_eligibility",
    },
  };
};

const buildPlacementDataResponse = async ({
  message = "",
  parsedQuery = null,
  accessScope = null,
} = {}) => {
  if (!isPlacementDomainQuery(message, parsedQuery)) {
    return null;
  }

  const domain = detectPlacementDomain(message, parsedQuery);
  const scope = await resolvePlacementScope({
    message,
    parsedQuery,
    accessScope,
    domain,
  });

  if (scope.accessDenied) {
    return buildAccessDeniedResponse(accessScope, scope.message);
  }

  const extractedCompany = extractPlacementCompany(message, parsedQuery);
  if (extractedCompany || hasPlacementCompanyRecruitmentIntent(message, parsedQuery)) {
    logPlacementRoutingDecision({
      accessScope,
      parsedQuery,
      domain,
      company: extractedCompany,
      studentFallbackSkipped: true,
      reason: "company_recruit_query",
    });
  }

  const actionResponse = await buildPlacementActionResponse({
    message,
    accessScope,
    parsedQuery,
    scope,
  });

  if (accessScope?.role === "student" && domain === "placement_drive") {
    if (isGenericPlacementApplyQuery(message, parsedQuery)) {
      return buildStudentReadinessResponse({
        accessScope,
        message,
        parsedQuery,
        scope,
      });
    }

    if (extractedCompany && isPlacementRequirementQuery(message)) {
      return buildDriveRequirementResponse({
        message,
        parsedQuery,
        accessScope,
        scope,
      });
    }

    if (isPlacementEligibilityQuery(message)) {
      return buildEligibilityResponse({ message, parsedQuery, accessScope, scope });
    }

    if (isPlacementReadinessQuery(message)) {
      return buildStudentReadinessResponse({
        accessScope,
        message,
        parsedQuery,
        scope,
      });
    }
  }

  if (actionResponse) {
    return actionResponse;
  }

  if (RECRUITER_PATTERN.test(message)) {
    return buildRecruiterResponse({ message, parsedQuery, accessScope, scope });
  }
  if (TREND_PATTERN.test(message)) {
    return buildTrendResponse({ message, parsedQuery, accessScope, scope });
  }
  if (PACKAGE_DISTRIBUTION_PATTERN.test(message)) {
    return buildPackageDistributionResponse({ message, parsedQuery, accessScope, scope });
  }
  if (PLACEMENT_RATE_PATTERN.test(message)) {
    return buildDepartmentRateResponse({ message, parsedQuery, accessScope, scope });
  }

  if (domain === "placement_drive") {
    const driveData = await fetchPlacementDrives({ message, parsedQuery, accessScope, scope });
    const rows = applyArraySortAndLimit(driveData.rows, driveData.sort, driveData.limit);
    return buildListResponse({
      title: "Placement Drives",
      reply: rows.length
        ? `I found ${rows.length} placement ${rows.length === 1 ? "drive" : "drives"} in the selected scope.`
        : "I could not find placement drives for the selected scope.",
      rows,
      filters: {
        ...(driveData.selectedDepartment?.code ? { department: driveData.selectedDepartment.code } : {}),
        ...(driveData.yearContext?.academicYear ? { academicYear: driveData.yearContext.academicYear } : {}),
      },
      selectedDepartment: driveData.selectedDepartment,
      yearContext: driveData.yearContext,
      chart: rows.length
        ? {
            type: "horizontalBar",
            title: "Drive Applications",
            subtitle: "Placement drives by application volume",
            data: rows.slice(0, 8),
            xKey: "company",
            yKey: "applications",
            format: "integer",
          }
        : null,
      entity: "placement",
      extraType: "placement_drive",
    });
  }

  if (domain === "placement_application") {
    const applicationData = await fetchPlacementApplications({
      message,
      parsedQuery,
      accessScope,
      scope: {
        ...scope,
        studentId: scope.studentId || accessScope?.studentId || null,
      },
    });
    const rows = applyArraySortAndLimit(applicationData.rows, applicationData.sort, applicationData.limit);
    return buildListResponse({
      title: "Placement Applications",
      reply: rows.length
        ? `I found ${rows.length} placement ${rows.length === 1 ? "application" : "applications"} in the selected scope.`
        : "I could not find placement applications for the selected scope.",
      rows,
      filters: {
        ...(applicationData.selectedDepartment?.code ? { department: applicationData.selectedDepartment.code } : {}),
        ...(applicationData.yearContext?.academicYear ? { academicYear: applicationData.yearContext.academicYear } : {}),
      },
      selectedDepartment: applicationData.selectedDepartment,
      yearContext: applicationData.yearContext,
      chart: rows.length
        ? {
            type: "pie",
            title: "Application Status Distribution",
            subtitle: "Placement applications by current status",
            data: uniqBy(
              rows.reduce((result, row) => {
                const current = result.find((item) => item.status === (row.applicationStatus || "Unknown"));
                if (current) {
                  current.applications += 1;
                } else {
                  result.push({ status: row.applicationStatus || "Unknown", applications: 1 });
                }
                return result;
              }, []),
              (row) => row.status
            ),
            nameKey: "status",
            valueKey: "applications",
            format: "integer",
          }
        : null,
      entity: "placement",
      extraType: "placement_application",
    });
  }

  const recordData = await fetchPlacementRecords({ message, parsedQuery, accessScope, scope });
  const rows = applyArraySortAndLimit(recordData.rows, recordData.sort, recordData.limit);
  const company = extractPlacementCompany(message, parsedQuery);
  return buildListResponse({
    title: buildCompanyScopedPlacementTitle(company),
    reply: buildCompanyScopedPlacementReply({
      company,
      rows,
      selectedDepartment: recordData.selectedDepartment,
    }),
    rows,
    filters: {
      ...(recordData.selectedDepartment?.code ? { department: recordData.selectedDepartment.code } : {}),
      ...(company ? { company } : {}),
      ...(recordData.yearContext?.academicYear ? { academicYear: recordData.yearContext.academicYear } : {}),
    },
    selectedDepartment: recordData.selectedDepartment,
    yearContext: recordData.yearContext,
    answerCard: company
      ? buildSimpleActionCard({
          headline: rows.length
            ? `${company} has ${rows.length} placed student${rows.length === 1 ? "" : "s"} in the selected scope.`
            : `No placed students found for ${company} in the selected scope.`,
          summary: rows.length
            ? "This result shows final placement records for the selected company."
            : "If you meant the recruitment process rather than final placements, try asking for drive details or applications.",
          highlights: [
            { label: "Company", value: company },
            { label: "Placed Students", value: String(rows.length) },
            ...(recordData.selectedDepartment?.code
              ? [{ label: "Department", value: recordData.selectedDepartment.code }]
              : []),
            ...(recordData.yearContext?.academicYear
              ? [{ label: "Academic Year", value: recordData.yearContext.academicYear }]
              : []),
          ],
          table: rows,
          tableTitle: "Placed Students",
        })
      : null,
    entity: "placement",
    queryType: "placement",
    extraType: "placement_record",
  });
};

const buildPlacementCountResponse = async ({
  message = "",
  parsedQuery = null,
  accessScope = null,
} = {}) => {
  if (!isPlacementDomainQuery(message, parsedQuery) || !COUNT_PATTERN.test(message)) {
    return null;
  }

  const domain = detectPlacementDomain(message, parsedQuery);
  const scope = await resolvePlacementScope({ message, parsedQuery, accessScope, domain });

  if (scope.accessDenied) {
    return {
      success: false,
      accessDenied: true,
      message: scope.message,
      entity: "placement",
      total: 0,
      filters: {},
    };
  }

  const extractedCompany = extractPlacementCompany(message, parsedQuery);
  if (extractedCompany || hasPlacementCompanyRecruitmentIntent(message, parsedQuery)) {
    logPlacementRoutingDecision({
      accessScope,
      parsedQuery,
      domain,
      company: extractedCompany,
      studentFallbackSkipped: true,
      reason: "company_recruit_count",
    });
  }

  if (RECRUITER_PATTERN.test(message) || /\b(companies|company count)\b/i.test(message)) {
    const recordData = await fetchPlacementRecords({ message, parsedQuery, accessScope, scope });
    const total = new Set(recordData.rows.map((row) => normalizeText(row.company)).filter(Boolean)).size;
    return buildCountResponse({
      title: "Recruiters Count",
      reply: `I found ${total} recruiters in the selected placement scope.`,
      total,
      entity: "placement",
      filters: recordData.selectedDepartment?.code ? { department: recordData.selectedDepartment.code } : {},
      selectedDepartment: recordData.selectedDepartment,
    });
  }

  if (domain === "placement_drive") {
    const driveData = await fetchPlacementDrives({ message, parsedQuery, accessScope, scope });
    return buildCountResponse({
      title: `${OPEN_PATTERN.test(message) ? "Open " : UPCOMING_PATTERN.test(message) ? "Upcoming " : CLOSED_PATTERN.test(message) ? "Closed " : ""}Placement Drives Count`.trim(),
      reply: `I found ${driveData.rows.length} placement ${driveData.rows.length === 1 ? "drive" : "drives"} in the selected scope.`,
      total: driveData.rows.length,
      entity: "placement",
      filters: {
        ...(driveData.selectedDepartment?.code ? { department: driveData.selectedDepartment.code } : {}),
        ...(driveData.yearContext?.academicYear ? { academicYear: driveData.yearContext.academicYear } : {}),
      },
      selectedDepartment: driveData.selectedDepartment,
    });
  }

  if (domain === "placement_application" || /\b(selected|shortlisted|rejected|withdrawn)\b/i.test(message)) {
    const applicationData = await fetchPlacementApplications({
      message,
      parsedQuery,
      accessScope,
      scope: {
        ...scope,
        studentId: scope.studentId || accessScope?.studentId || null,
      },
    });
    return buildCountResponse({
      title: "Placement Applications Count",
      reply: `I found ${applicationData.rows.length} placement ${applicationData.rows.length === 1 ? "application" : "applications"} in the selected scope.`,
      total: applicationData.rows.length,
      entity: "placement",
      filters: {
        ...(applicationData.selectedDepartment?.code ? { department: applicationData.selectedDepartment.code } : {}),
        ...(applicationData.yearContext?.academicYear ? { academicYear: applicationData.yearContext.academicYear } : {}),
      },
      selectedDepartment: applicationData.selectedDepartment,
    });
  }

  const recordData = await fetchPlacementRecords({ message, parsedQuery, accessScope, scope });
  const company = extractPlacementCompany(message, parsedQuery);
  return buildCountResponse({
    title: company ? `Students Placed at ${company} Count` : "Placement Records Count",
    reply: company
      ? `I found ${recordData.rows.length} student${recordData.rows.length === 1 ? "" : "s"} placed at ${company} in the selected scope.`
      : `I found ${recordData.rows.length} placement ${recordData.rows.length === 1 ? "record" : "records"} in the selected scope.`,
    total: recordData.rows.length,
    entity: "placement",
    filters: {
      ...(recordData.selectedDepartment?.code ? { department: recordData.selectedDepartment.code } : {}),
      ...(company ? { company } : {}),
      ...(recordData.yearContext?.academicYear ? { academicYear: recordData.yearContext.academicYear } : {}),
    },
    selectedDepartment: recordData.selectedDepartment,
  });
};

const buildPlacementReportDomainResponse = async ({
  message = "",
  parsedQuery = null,
  accessScope = null,
} = {}) => {
  if (!isPlacementDomainQuery(message, parsedQuery) || !REPORT_PATTERN.test(message)) {
    return null;
  }

  const domain = detectPlacementDomain(message, parsedQuery);
  const scope = await resolvePlacementScope({ message, parsedQuery, accessScope, domain });

  if (scope.accessDenied) {
    return buildReportResponse({
      title: "Placement Access Restricted",
      entityType: "placement",
      rows: [],
      summary: { totalRecords: 0 },
      reply: scope.message,
    });
  }

  const extractedCompany = extractPlacementCompany(message, parsedQuery);
  if (extractedCompany || hasPlacementCompanyRecruitmentIntent(message, parsedQuery)) {
    logPlacementRoutingDecision({
      accessScope,
      parsedQuery,
      domain,
      company: extractedCompany,
      studentFallbackSkipped: true,
      reason: "company_recruit_report",
    });
  }

  if (domain === "placement_drive") {
    const driveData = await fetchPlacementDrives({ message, parsedQuery, accessScope, scope });
    const rows = applyArraySortAndLimit(driveData.rows, driveData.sort, driveData.limit);
    return buildReportResponse({
      title: "Placement Drive Pipeline Report",
      entityType: "placement_drive",
      rows,
      summary: {
        totalDrives: rows.length,
        openDrives: rows.filter((row) => row.status === "Open").length,
        upcomingDrives: rows.filter((row) => row.status === "Upcoming").length,
        closedDrives: rows.filter((row) => row.status === "Closed").length,
        totalApplications: rows.reduce((sum, row) => sum + Number(row.applications || 0), 0),
      },
      tableTitle: "Placement Drives",
      filters: {
        ...(driveData.selectedDepartment?.code ? { department: driveData.selectedDepartment.code } : {}),
        ...(driveData.yearContext?.academicYear ? { academicYear: driveData.yearContext.academicYear } : {}),
      },
      selectedDepartment: driveData.selectedDepartment,
      sort: driveData.sort,
      limit: driveData.limit,
      reply: "Generated a placement drive pipeline report.",
    });
  }

  if (domain === "placement_application") {
    const applicationData = await fetchPlacementApplications({
      message,
      parsedQuery,
      accessScope,
      scope: {
        ...scope,
        studentId: scope.studentId || accessScope?.studentId || null,
      },
    });
    const rows = applyArraySortAndLimit(applicationData.rows, applicationData.sort, applicationData.limit);
    return buildReportResponse({
      title: accessScope?.role === "student" ? "My Placement Application Report" : "Placement Application Report",
      entityType: "placement_application",
      rows,
      summary: {
        totalApplications: rows.length,
        selectedApplications: rows.filter((row) => row.applicationStatus === "Selected").length,
        shortlistedApplications: rows.filter((row) => ["Shortlisted", "Interview Scheduled"].includes(row.applicationStatus)).length,
        rejectedApplications: rows.filter((row) => row.applicationStatus === "Rejected").length,
      },
      tableTitle: "Placement Applications",
      filters: {
        ...(applicationData.selectedDepartment?.code ? { department: applicationData.selectedDepartment.code } : {}),
        ...(applicationData.yearContext?.academicYear ? { academicYear: applicationData.yearContext.academicYear } : {}),
      },
      selectedDepartment: applicationData.selectedDepartment,
      sort: applicationData.sort,
      limit: applicationData.limit,
      reply: "Generated a placement application report.",
    });
  }

  const recordData = await fetchPlacementRecords({ message, parsedQuery, accessScope, scope });
  const rows = applyArraySortAndLimit(recordData.rows, recordData.sort, recordData.limit);
  const company = extractPlacementCompany(message, parsedQuery);
  return buildReportResponse({
    title: company ? `${company} Placement Report` : "Placement Report",
    entityType: "placement",
    rows,
    summary: {
      totalStudents: rows.length,
      placedStudents: rows.length,
      averagePackage: rows.length ? roundTo(rows.reduce((sum, row) => sum + Number(row.package || 0), 0) / rows.length) : 0,
      highestPackage: rows.length ? roundTo(Math.max(...rows.map((row) => Number(row.package || 0)))) : 0,
    },
    tableTitle: "Placement Details",
    filters: {
      ...(recordData.selectedDepartment?.code ? { department: recordData.selectedDepartment.code } : {}),
      ...(company ? { company } : {}),
      ...(recordData.yearContext?.academicYear ? { academicYear: recordData.yearContext.academicYear } : {}),
    },
    selectedDepartment: recordData.selectedDepartment,
    sort: recordData.sort,
    limit: recordData.limit,
    reply: company
      ? `Generated a placement report for ${company}.`
      : "Generated a placement report.",
  });
};

module.exports = {
  detectPlacementDomain,
  isPlacementDomainQuery,
  buildPlacementCountResponse,
  buildPlacementDataResponse,
  buildPlacementReportDomainResponse,
};
