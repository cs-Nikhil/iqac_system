const Student = require("../models/Student");
const Department = require("../models/Department");
const Placement = require("../models/Placement");
const Faculty = require("../models/Faculty");
const ResearchPaper = require("../models/ResearchPaper");
const FacultyAchievement = require("../models/FacultyAchievement");
const Document = require("../models/Document");
const NAACCriteria = require("../models/NAACCriteria");
const NBACriteria = require("../models/NBACriteria");
const { Event, Participation } = require("../models/Event");
const {
  extractFilters,
  filterRowsByConditions,
  parseAdvancedFilters,
  resolveDepartmentFilter,
} = require("./chatbotFilter.service");
const {
  applyYearContextToFilters,
  resolveYearFilterContext,
} = require("./chatbotYearFilter.service");

const ENTITY_PATTERNS = {
  achievement: /\bfaculty achievement|faculty achievements|achievement|achievements|award|awards|certification|grant|patent\b/i,
  document: /\bdocument|documents|evidence|accreditation\b/i,
  naac: /\bnaac\b/i,
  nba: /\bnba\b/i,
  research: /\bresearch papers?|publications?|journals?|citations?\b/i,
  student: /\bstudent|students\b/i,
  department: /\bdepartment|departments\b/i,
  placement: /\bplacement|placements|package|packages\b/i,
  faculty: /\bfaculty|faculties|staff\b/i,
  event: /\bevent|events|workshop|seminar|hackathon|conference\b/i,
};

const REPORT_TYPE_PATTERNS = {
  accreditation: /\baccreditation|naac|nba|criteria|evidence|document\b/i,
  achievement: /\bachievement|award|certification|grant|patent\b/i,
  research: /\bresearch|publication|paper|journal|citation\b/i,
  cgpa: /\bcgpa|gpa\b/i,
  backlog: /\bbacklog|backlogs|arrear|arrears\b/i,
  attendance: /\battendance\b/i,
  placement: /\bplacement|placements|package|packages\b/i,
  performance: /\bperformance\b/i,
};

const PREVIEW_LIMIT = 10;
const MAX_REPORT_LIMIT = 500;
const RANKED_REQUEST_PATTERN =
  /\b(?:top|best|first|highest|lowest|least|worst)\s+\d+\b/i;
const EXPLICIT_LIMIT_PATTERN = /\blimit\s+\d+\b/i;
const ENTITY_TYPE_ALIASES = {
  achievements: "achievement",
  achievement: "achievement",
  facultyachievements: "achievement",
  documents: "document",
  document: "document",
  naac: "naac",
  naaccriterias: "naac",
  nba: "nba",
  nbacriterias: "nba",
  research: "research",
  research_papers: "research",
  researchpapers: "research",
  publication: "research",
  publications: "research",
  students: "student",
  student: "student",
  faculties: "faculty",
  faculty: "faculty",
  staff: "faculty",
  departments: "department",
  department: "department",
  placements: "placement",
  placement: "placement",
  packages: "placement",
  package: "placement",
  events: "event",
  event: "event",
};

const normalizeMessage = (message = "") =>
  String(message).toLowerCase().trim();

const roundTo = (value, digits = 2) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Number(numericValue.toFixed(digits));
};

const toPositiveInteger = (value, fallback = null) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const clampReportLimit = (value, fallback = PREVIEW_LIMIT) =>
  Math.min(toPositiveInteger(value, fallback) || fallback, MAX_REPORT_LIMIT);

const normalizeEntityType = (value = null) => {
  if (!value) {
    return null;
  }

  return ENTITY_TYPE_ALIASES[normalizeMessage(value)] || null;
};

const humanize = (value = "") =>
  String(value)
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());

const normalizeSortOrder = (value = "desc") => {
  if (value === 1 || value === "asc") {
    return "asc";
  }

  if (value === -1 || value === "desc") {
    return "desc";
  }

  const normalized = normalizeMessage(value);
  if (["1", "asc", "ascending"].includes(normalized)) {
    return "asc";
  }

  return "desc";
};

const getRawSortDescriptor = (sort = null) => {
  if (!sort || typeof sort !== "object" || Array.isArray(sort)) {
    return null;
  }

  if (sort.field) {
    return {
      field: String(sort.field),
      order: normalizeSortOrder(sort.order),
    };
  }

  const [field, order] = Object.entries(sort)[0] || [];
  if (!field) {
    return null;
  }

  return {
    field,
    order: normalizeSortOrder(order),
  };
};

const detectExplicitSortField = ({
  entityType = "student",
  message = "",
  reportType = "general",
} = {}) => {
  const normalized = normalizeMessage(message);

  if (/\bname\b|\balphabet/.test(normalized)) {
    if (entityType === "department") return "name";
    if (entityType === "event") return "title";
    return "name";
  }

  if (entityType === "student") {
    if (/\battendance\b/.test(normalized) || reportType === "attendance") {
      return "averageAttendance";
    }

    if (/\bbacklog|backlogs|arrear|arrears\b/.test(normalized) || reportType === "backlog") {
      return "currentBacklogs";
    }

    if (/\bcgpa|gpa|performance\b/.test(normalized) || reportType === "cgpa") {
      return "cgpa";
    }
  }

  if (entityType === "faculty") {
    if (/\bpublication|publications|research|papers?|citations?\b/.test(normalized)) {
      return "publications";
    }

    if (/\bexperience\b/.test(normalized)) {
      return "experience";
    }
  }

  if (entityType === "research") {
    if (/\bcitation|citations\b/.test(normalized)) {
      return "citations";
    }

    if (/\bimpact factor\b/.test(normalized)) {
      return "impactFactor";
    }

    if (/\byear|latest|recent|newest|oldest|earliest\b/.test(normalized)) {
      return "year";
    }
  }

  if (entityType === "achievement") {
    if (/\bpoints?\b/.test(normalized)) {
      return "points";
    }

    if (/\bdate|latest|recent|newest|oldest|earliest\b/.test(normalized)) {
      return "date";
    }
  }

  if (entityType === "document") {
    if (/\bstatus\b/.test(normalized)) {
      return "status";
    }

    if (/\byear|latest|recent|newest|oldest|earliest\b/.test(normalized)) {
      return "academicYear";
    }
  }

  if (entityType === "naac") {
    if (/\bcompliance\b/.test(normalized)) {
      return "complianceLevel";
    }

    if (/\bstatus\b/.test(normalized)) {
      return "status";
    }
  }

  if (entityType === "nba") {
    if (/\bcompliance|score\b/.test(normalized)) {
      return "complianceScore";
    }

    if (/\bstatus\b/.test(normalized)) {
      return "status";
    }
  }

  if (entityType === "placement") {
    if (/\bpackage|salary|ctc\b/.test(normalized)) {
      return "package";
    }
  }

  if (entityType === "department") {
    if (/\bplacement\b/.test(normalized) || reportType === "placement") {
      return "placementPercentage";
    }

    if (/\battendance\b/.test(normalized) || reportType === "attendance") {
      return "avgAttendance";
    }

    if (/\bcgpa|gpa|performance\b/.test(normalized) || reportType === "cgpa") {
      return "avgCGPA";
    }
  }

  if (entityType === "event") {
    if (/\bparticipant|participants|attendance\b/.test(normalized)) {
      return "participants";
    }

    if (/\bdate|latest|newest|recent|oldest|earliest\b/.test(normalized)) {
      return "startDate";
    }
  }

  return null;
};

const normalizePlannerSortField = (field = "", entityType = "student") => {
  const normalized = normalizeMessage(field);
  if (!normalized) {
    return null;
  }

  if (entityType === "student") {
    if (
      ["cgpa", "gpa", "performance", "average_cgpa", "relevance_or_cgpa"].includes(
        normalized
      )
    ) {
      return "cgpa";
    }

    if (normalized === "attendance") {
      return "averageAttendance";
    }

    if (["backlog", "backlogs"].includes(normalized)) {
      return "currentBacklogs";
    }
  }

  if (entityType === "faculty") {
    if (
      ["experience", "relevance_or_experience"].includes(normalized)
    ) {
      return "experience";
    }

    if (
      ["publications", "publication", "citations", "citation", "relevance_or_citations"].includes(
        normalized
      )
    ) {
      return "publications";
    }
  }

  if (entityType === "research") {
    if (["citations", "citation", "relevance_or_citations"].includes(normalized)) {
      return "citations";
    }

    if (["impactfactor", "impact_factor"].includes(normalized)) {
      return "impactFactor";
    }

    if (["year", "relevance_or_date"].includes(normalized)) {
      return "year";
    }
  }

  if (entityType === "achievement") {
    if (["points", "score", "relevance_or_score"].includes(normalized)) {
      return "points";
    }

    if (["date", "relevance_or_date"].includes(normalized)) {
      return "date";
    }
  }

  if (entityType === "document") {
    if (["status", "relevance_or_status"].includes(normalized)) {
      return "status";
    }

    if (["academicyear", "academic_year", "date", "relevance_or_date"].includes(normalized)) {
      return "academicYear";
    }
  }

  if (entityType === "naac") {
    if (["status", "relevance_or_status"].includes(normalized)) {
      return "status";
    }

    if (["compliance", "compliancelevel"].includes(normalized)) {
      return "complianceLevel";
    }
  }

  if (entityType === "nba") {
    if (["status", "relevance_or_status"].includes(normalized)) {
      return "status";
    }

    if (["compliancescore", "compliance_score", "score", "relevance_or_score"].includes(normalized)) {
      return "complianceScore";
    }
  }

  if (entityType === "placement") {
    if (
      ["package", "salary", "ctc", "relevance_or_package"].includes(normalized)
    ) {
      return "package";
    }

    if (["company", "employer", "relevance_or_company"].includes(normalized)) {
      return "company";
    }

    if (["role", "designation", "position"].includes(normalized)) {
      return "role";
    }

    if (["academicyear", "academic_year", "year", "relevance_or_date"].includes(normalized)) {
      return "academicYear";
    }
  }

  if (entityType === "department") {
    if (
      ["avgcgpa", "average_cgpa", "cgpa", "performance", "relevance_or_performance"].includes(
        normalized
      )
    ) {
      return "avgCGPA";
    }

    if (["attendance", "avgattendance"].includes(normalized)) {
      return "avgAttendance";
    }

    if (["placement_rate", "placementpercentage", "placement"].includes(normalized)) {
      return "placementPercentage";
    }
  }

  if (entityType === "event") {
    if (["date", "startdate", "relevance_or_date"].includes(normalized)) {
      return "startDate";
    }

    if (["participants", "attendance"].includes(normalized)) {
      return "participants";
    }
  }

  if (normalized === "name") {
    return entityType === "event" ? "title" : "name";
  }

  return null;
};

const getDefaultSortField = (entityType = "student", reportType = "general") => {
  if (entityType === "student") {
    if (reportType === "attendance") return "averageAttendance";
    if (reportType === "backlog") return "currentBacklogs";
    return "cgpa";
  }

  if (entityType === "faculty") {
    return "experience";
  }

  if (entityType === "research") {
    return "citations";
  }

  if (entityType === "achievement") {
    return "points";
  }

  if (entityType === "placement") {
    return "package";
  }

  if (entityType === "document") {
    return "academicYear";
  }

  if (entityType === "naac") {
    return "status";
  }

  if (entityType === "nba") {
    return "complianceScore";
  }

  if (entityType === "department") {
    if (reportType === "attendance") return "avgAttendance";
    if (reportType === "placement") return "placementPercentage";
    return "avgCGPA";
  }

  if (entityType === "event") {
    return "startDate";
  }

  return "name";
};

const getDefaultSortOrder = (field = "name") =>
  ["name", "title", "company", "role"].includes(field) ? "asc" : "desc";

const resolveReportScope = ({ message = "", limit = null } = {}) =>
  toPositiveInteger(limit, null) !== null ||
  RANKED_REQUEST_PATTERN.test(String(message)) ||
  EXPLICIT_LIMIT_PATTERN.test(String(message))
    ? "ranked_subset"
    : "full_preview";

const resolveReportSort = ({
  sort = null,
  entityType = "student",
  message = "",
  reportType = "general",
  reportScope = "full_preview",
} = {}) => {
  const rawSort = getRawSortDescriptor(sort);
  const explicitField = detectExplicitSortField({
    entityType,
    message,
    reportType,
  });
  const plannerField = rawSort
    ? normalizePlannerSortField(rawSort.field, entityType)
    : null;
  const field =
    explicitField ||
    plannerField ||
    (reportScope === "ranked_subset"
      ? getDefaultSortField(entityType, reportType)
      : null);

  if (!field) {
    return null;
  }

  return {
    field,
    order: rawSort?.order || getDefaultSortOrder(field),
  };
};

const getRowLabel = (row = {}) =>
  row.name ||
  row.title ||
  row.student ||
  row.department ||
  row.code ||
  row.rollNumber ||
  row.email ||
  "";

const normalizeComparableValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp) && /\d{4}/.test(value)) {
      return timestamp;
    }

    const numeric = Number(value);
    if (Number.isFinite(numeric) && value.trim() !== "") {
      return numeric;
    }

    return value.toLowerCase();
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
};

const compareValues = (left, right, order = "desc") => {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  let result;
  if (typeof left === "string" || typeof right === "string") {
    result = String(left).localeCompare(String(right), undefined, {
      sensitivity: "base",
      numeric: true,
    });
  } else {
    result = left === right ? 0 : left > right ? 1 : -1;
  }

  return order === "asc" ? result : -result;
};

const sortRowsByDescriptor = (rows = [], sortDescriptor = null) => {
  if (!sortDescriptor?.field) {
    return [...rows];
  }

  return [...rows].sort((left, right) => {
    const primary = compareValues(
      normalizeComparableValue(left?.[sortDescriptor.field]),
      normalizeComparableValue(right?.[sortDescriptor.field]),
      sortDescriptor.order
    );

    if (primary !== 0) {
      return primary;
    }

    return compareValues(
      normalizeComparableValue(getRowLabel(left)),
      normalizeComparableValue(getRowLabel(right)),
      "asc"
    );
  });
};

const buildOrderedPreviewRows = (
  rows = [],
  previewLimit = PREVIEW_LIMIT,
  sortDescriptor = null
) => sortRowsByDescriptor(rows, sortDescriptor).slice(0, previewLimit);

const getRowsIncludedLabel = (reportScope = "full_preview") =>
  reportScope === "ranked_subset" ? "Rows included" : "Preview rows shown";

const getRankingLine = (reportScope = "full_preview", sortDescriptor = null) =>
  reportScope === "ranked_subset" && sortDescriptor?.field
    ? `Ranking: ${humanize(sortDescriptor.field)} (${sortDescriptor.order === "asc" ? "ascending" : "descending"})`
    : null;

const getScopeInsight = (
  reportScope = "full_preview",
  fullPreviewText = "",
  rankedSubsetText = ""
) => (reportScope === "ranked_subset" ? rankedSubsetText : fullPreviewText);

const buildSection = (heading, lines = []) => ({
  heading,
  lines: lines.filter(Boolean),
});

const stringifyStructuredReport = (report) => {
  const sections = [report.title];

  for (const section of report.sections || []) {
    sections.push(section.heading);
    for (const line of section.lines || []) {
      sections.push(line.startsWith("- ") ? line : `- ${line}`);
    }
  }

  return sections.join("\n\n");
};

const normalizeDepartmentCode = (value = null) =>
  value ? String(value).trim().toUpperCase() : null;

const toSelectedDepartment = (department = null) =>
  department
    ? {
        _id: String(department._id || ""),
        name: department.name || null,
        code: normalizeDepartmentCode(department.code || null),
      }
    : null;

const buildDepartmentLabel = (department = null, fallback = "All Departments") =>
  department?.code || department?.name || fallback;

const normalizeFilterValue = (value = null) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return typeof value === "string" ? value.trim() : value;
};

const normalizeReportFilters = (filters = {}) => ({
  department: normalizeDepartmentCode(filters.department),
  departmentId: normalizeFilterValue(filters.departmentId),
  academicYear: normalizeFilterValue(filters.academicYear || filters.academic_year),
  batchYear: normalizeFilterValue(filters.batchYear || filters.batch_year),
  backlogs:
    filters.backlogs !== undefined
      ? filters.backlogs
      : normalizeFilterValue(filters.currentBacklogs),
  semester: normalizeFilterValue(filters.semester),
  year: normalizeFilterValue(filters.year),
  dateRange:
    filters.dateRange && typeof filters.dateRange === "object"
      ? filters.dateRange
      : null,
  status: normalizeFilterValue(filters.status),
  criteria: normalizeFilterValue(filters.criteria),
  accreditationType: normalizeFilterValue(
    filters.accreditationType || filters.accreditation_type
  ),
  level: normalizeFilterValue(filters.level),
  type: normalizeFilterValue(filters.type),
  student: normalizeFilterValue(filters.student),
  studentId: normalizeFilterValue(filters.studentId),
  faculty: normalizeFilterValue(filters.faculty),
  facultyId: normalizeFilterValue(filters.facultyId),
  uploadedBy: normalizeFilterValue(filters.uploadedBy),
  subject: normalizeFilterValue(filters.subject),
});

const createStructuredReport = ({
  title,
  entityType,
  reportType,
  summary = {},
  tables = [],
  sections = [],
  insights = "",
  fullRows = [],
  previewRows = [],
  filtered = false,
  filters = {},
  selectedDepartment = null,
  validation = null,
  appliedConditions = [],
  dataOverrides = {},
  reportScope = "full_preview",
  requestedLimit = PREVIEW_LIMIT,
  sortDescriptor = null,
}) => {
  const normalizedFilters = normalizeReportFilters(filters);
  const totalRecords = fullRows.length;
  const previewCount = previewRows.length;
  const effectiveLimit =
    reportScope === "ranked_subset" ? requestedLimit : null;
  const mergedSummary = {
    ...summary,
    totalRecords,
    previewCount,
    filters: normalizedFilters,
    appliedConditions,
  };
  const report = {
    title,
    sections,
    summary: mergedSummary,
    tables,
    insights,
    data: {
      type: `${entityType}-report`,
      entity: entityType,
      reportType,
      filtered,
      filters: normalizedFilters,
      selectedDepartment: toSelectedDepartment(selectedDepartment),
      totalRecords,
      previewCount,
      reportScope,
      limit: effectiveLimit,
      sort: sortDescriptor,
      rows: previewRows,
      sample: previewRows,
      validation,
      conditions: appliedConditions,
      ...dataOverrides,
    },
  };

  return {
    ...report,
    entityType,
    reportType,
    filtered,
    filters: normalizedFilters,
    totalRecords,
    previewCount,
    validation,
    appliedConditions,
    reportScope,
    limit: effectiveLimit,
    sort: sortDescriptor,
    contextData: fullRows,
    reportText: stringifyStructuredReport(report),
  };
};

const buildEmptyReport = (
  entityType,
  reportType = "general",
  { filters = {}, selectedDepartment = null, reason = null } = {}
) =>
  createStructuredReport({
    title: `# ${entityType.charAt(0).toUpperCase()}${entityType.slice(1)} Report`,
    entityType,
    reportType,
    summary: {
      count: 0,
    },
    sections: [
      buildSection("Report Status", [
        reason || "No data available for report.",
      ]),
    ],
    insights: reason || "No live records matched this report request.",
    fullRows: [],
    previewRows: [],
    filtered: Boolean(filters.department),
    filters,
    selectedDepartment,
    validation: {
      valid: true,
      filters,
      totalRecords: 0,
      previewCount: 0,
      departmentCodes: [],
      previewDepartmentCodes: [],
      errors: [],
    },
  });

const detectEntityType = (message = "") => {
  const normalized = normalizeMessage(message);
  const mentionsDocumentDomain =
    /\bdocument|documents|evidence\b/.test(normalized) ||
    (/\baccreditation\b/.test(normalized) &&
      !/\bnaac\b|\bnba\b/.test(normalized));

  if (ENTITY_PATTERNS.achievement.test(normalized)) return "achievement";
  if (mentionsDocumentDomain) return "document";
  if (ENTITY_PATTERNS.naac.test(normalized)) return "naac";
  if (ENTITY_PATTERNS.nba.test(normalized)) return "nba";
  if (ENTITY_PATTERNS.document.test(normalized)) return "document";
  if (ENTITY_PATTERNS.research.test(normalized)) return "research";
  if (ENTITY_PATTERNS.student.test(normalized)) return "student";
  if (ENTITY_PATTERNS.department.test(normalized)) return "department";
  if (ENTITY_PATTERNS.placement.test(normalized)) return "placement";
  if (ENTITY_PATTERNS.faculty.test(normalized)) return "faculty";
  if (ENTITY_PATTERNS.event.test(normalized)) return "event";

  return "student";
};

const detectReportType = (message = "") => {
  const normalized = normalizeMessage(message);

  if (REPORT_TYPE_PATTERNS.accreditation.test(normalized)) return "accreditation";
  if (REPORT_TYPE_PATTERNS.achievement.test(normalized)) return "achievement";
  if (REPORT_TYPE_PATTERNS.research.test(normalized)) return "research";
  if (REPORT_TYPE_PATTERNS.cgpa.test(normalized)) return "cgpa";
  if (REPORT_TYPE_PATTERNS.backlog.test(normalized)) return "backlog";
  if (REPORT_TYPE_PATTERNS.attendance.test(normalized)) return "attendance";
  if (REPORT_TYPE_PATTERNS.placement.test(normalized)) return "placement";
  if (REPORT_TYPE_PATTERNS.performance.test(normalized)) return "performance";

  return "general";
};

const extractDepartmentFromQuery = async (
  message = "",
  filters = extractFilters(message)
) => resolveDepartmentFilter(message, filters);

const shouldUseUniversalReportEngine = (message = "") => {
  const normalized = normalizeMessage(message);

  return (
    Object.values(ENTITY_PATTERNS).some((pattern) => pattern.test(normalized)) ||
    Object.values(REPORT_TYPE_PATTERNS).some((pattern) => pattern.test(normalized))
  );
};

const getStudentAttendance = (student = {}) => {
  const value =
    student.averageAttendance ?? student.academicRecords?.avgAttendance;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
};

const getRowDepartmentCode = (entityType, row = {}) => {
  switch (entityType) {
    case "student":
      return normalizeDepartmentCode(
        row.departmentCode || row.department?.code || row.department
      );
    case "department":
      return normalizeDepartmentCode(
        row.code || row.departmentCode || row.department?.code
      );
    case "placement":
      return normalizeDepartmentCode(
        row.departmentCode || row.student?.department?.code || row.department?.code
      );
    case "faculty":
      return normalizeDepartmentCode(
        row.departmentCode || row.department?.code || row.department
      );
    case "research":
      return normalizeDepartmentCode(
        row.departmentCode ||
          row.department?.code ||
          row.facultyDepartmentCode ||
          row.faculty?.department?.code ||
          row.department
      );
    case "achievement":
      return normalizeDepartmentCode(
        row.departmentCode ||
          row.department?.code ||
          row.facultyDepartmentCode ||
          row.faculty?.department?.code ||
          row.department
      );
    case "document":
      return normalizeDepartmentCode(
        row.departmentCode ||
          row.programCode ||
          row.department?.code ||
          row.program?.code ||
          row.department
      );
    case "nba":
      return normalizeDepartmentCode(
        row.departmentCode || row.programCode || row.program?.code || row.department
      );
    case "event":
      return normalizeDepartmentCode(
        row.departmentCode || row.department?.code || row.department
      );
    default:
      return normalizeDepartmentCode(
        row.departmentCode || row.department?.code || row.code
      );
  }
};

const filterRowsByFilters = (entityType, rows = [], filters = {}) => {
  const departmentCode = normalizeDepartmentCode(filters.department);
  if (!departmentCode) {
    return rows;
  }

  return rows.filter(
    (row) => getRowDepartmentCode(entityType, row) === departmentCode
  );
};

const validateReportDataset = ({
  entityType,
  fullRows = [],
  previewRows = [],
  filters = {},
  reportScope = "full_preview",
  previewLimit = PREVIEW_LIMIT,
} = {}) => {
  const departmentCode = normalizeDepartmentCode(filters.department);
  const fullDepartmentCodes = [
    ...new Set(fullRows.map((row) => getRowDepartmentCode(entityType, row)).filter(Boolean)),
  ];
  const previewDepartmentCodes = [
    ...new Set(
      previewRows.map((row) => getRowDepartmentCode(entityType, row)).filter(Boolean)
    ),
  ];
  const errors = [];

  if (departmentCode) {
    const hasMixedFullRows = fullRows.some(
      (row) => getRowDepartmentCode(entityType, row) !== departmentCode
    );
    const hasMixedPreviewRows = previewRows.some(
      (row) => getRowDepartmentCode(entityType, row) !== departmentCode
    );

    if (hasMixedFullRows) {
      errors.push(
        `Full ${entityType} dataset contains records outside department ${departmentCode}.`
      );
    }

    if (hasMixedPreviewRows) {
      errors.push(
        `Preview ${entityType} dataset contains records outside department ${departmentCode}.`
      );
    }

    if (fullDepartmentCodes.some((code) => code !== departmentCode)) {
      errors.push(
        `Mixed department codes detected in ${entityType} report: ${fullDepartmentCodes.join(", ")}.`
      );
    }
  }

  if (
    reportScope === "full_preview" &&
    fullRows.length > previewLimit &&
    previewRows.length >= fullRows.length
  ) {
    errors.push("Preview dataset should be smaller than the full dataset for large reports.");
  }

  return {
    valid: errors.length === 0,
    filters: {
      department: departmentCode,
    },
    totalRecords: fullRows.length,
    previewCount: previewRows.length,
    departmentCodes: fullDepartmentCodes,
    previewDepartmentCodes,
    errors,
  };
};

const enforceValidatedRows = ({
  entityType,
  fullRows = [],
  previewRows = [],
  filters = {},
  reportScope = "full_preview",
  previewLimit = PREVIEW_LIMIT,
} = {}) => {
  const filteredFullRows = filterRowsByFilters(entityType, fullRows, filters);
  const filteredPreviewRows = filterRowsByFilters(entityType, previewRows, filters);
  const validation = validateReportDataset({
    entityType,
    fullRows: filteredFullRows,
    previewRows: filteredPreviewRows,
    filters,
    reportScope,
    previewLimit,
  });

  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  return {
    fullRows: filteredFullRows,
    previewRows: filteredPreviewRows,
    validation,
  };
};

const applyNumericConditions = (message = "", rows = []) => {
  const sampleRow = Array.isArray(rows)
    ? rows.find((row) => row && typeof row === "object")
    : null;
  const parsed = parseAdvancedFilters(message, {
    sampleData: sampleRow,
  });

  if (!parsed.conditions.length) {
    return {
      rows,
      conditions: [],
    };
  }

  return {
    rows: filterRowsByConditions(rows, parsed.conditions, parsed.joiner),
    conditions: parsed.conditions.map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      value: condition.value,
    })),
  };
};

const resolveScopedRows = ({
  entityType,
  rows = [],
  reportType = "general",
  message = "",
  sort = null,
  limit = null,
  defaultPreviewBuilder = (inputRows, options = {}) =>
    buildOrderedPreviewRows(inputRows, options.previewLimit, options.sortDescriptor),
} = {}) => {
  const reportScope = resolveReportScope({ message, limit });
  const sortDescriptor = resolveReportSort({
    sort,
    entityType,
    message,
    reportType,
    reportScope,
  });

  if (reportScope === "ranked_subset") {
    const requestedLimit = clampReportLimit(limit, PREVIEW_LIMIT);
    const rankedRows = sortRowsByDescriptor(rows, sortDescriptor).slice(0, requestedLimit);

    return {
      fullRows: rankedRows,
      previewRows: rankedRows,
      reportScope,
      requestedLimit,
      sortDescriptor,
    };
  }

  return {
    fullRows: rows,
    previewRows: defaultPreviewBuilder(rows, {
      previewLimit: PREVIEW_LIMIT,
      sortDescriptor,
      reportType,
    }),
    reportScope,
    requestedLimit: PREVIEW_LIMIT,
    sortDescriptor,
  };
};

const buildStudentPreviewRows = (
  rows = [],
  { reportType = "general", previewLimit = PREVIEW_LIMIT, sortDescriptor = null } = {}
) => {
  if (sortDescriptor?.field) {
    return buildOrderedPreviewRows(rows, previewLimit, sortDescriptor);
  }

  if (reportType === "cgpa") {
    return [...rows]
      .sort((left, right) => right.cgpa - left.cgpa)
      .slice(0, previewLimit);
  }

  if (reportType === "backlog") {
    return rows
      .filter((student) => student.currentBacklogs > 0)
      .sort(
        (left, right) =>
          right.currentBacklogs - left.currentBacklogs || left.cgpa - right.cgpa
      )
      .slice(0, previewLimit);
  }

  if (reportType === "attendance") {
    return rows
      .filter((student) => student.averageAttendance < 75)
      .sort((left, right) => left.averageAttendance - right.averageAttendance)
      .slice(0, previewLimit);
  }

  return [...rows]
    .sort((left, right) => right.cgpa - left.cgpa)
    .slice(0, previewLimit);
};

const generateStudentReport = (
  students = [],
  {
    message = "",
    reportType = "general",
    filters = {},
    selectedDepartment = null,
    sort = null,
    limit = null,
  } = {}
) => {
  if (!students.length) {
    return null;
  }

  const mappedRows = students.map((student) => ({
    name: student.name || null,
    rollNumber: student.rollNumber || null,
    department: student.department?.name || null,
    departmentCode: normalizeDepartmentCode(student.department?.code || null),
    cgpa: roundTo(student.cgpa),
    averageAttendance: roundTo(getStudentAttendance(student)),
    currentBacklogs: Number(student.currentBacklogs || 0),
  }));
  const {
    rows: numericFilteredRows,
    conditions: appliedConditions,
  } = applyNumericConditions(message, mappedRows);

  const scopedRows = resolveScopedRows({
    entityType: "student",
    rows: numericFilteredRows,
    reportType,
    message,
    sort,
    limit,
    defaultPreviewBuilder: (rowsToPreview, options = {}) =>
      buildStudentPreviewRows(rowsToPreview, options),
  });
  const { fullRows, previewRows, validation } = enforceValidatedRows({
    entityType: "student",
    fullRows: scopedRows.fullRows,
    previewRows: scopedRows.previewRows,
    filters,
    reportScope: scopedRows.reportScope,
    previewLimit: scopedRows.requestedLimit,
  });

  if (!fullRows.length) {
    return null;
  }

  const totalStudents = fullRows.length;
  const averageCGPA = roundTo(
    fullRows.reduce((sum, student) => sum + Number(student.cgpa || 0), 0) /
      totalStudents
  );
  const averageAttendance = roundTo(
    fullRows.reduce(
      (sum, student) => sum + Number(student.averageAttendance || 0),
      0
    ) / totalStudents
  );
  const averageBacklogs = roundTo(
    fullRows.reduce((sum, student) => sum + Number(student.currentBacklogs || 0), 0) /
      totalStudents
  );
  const studentsWithBacklogs = fullRows.filter(
    (student) => Number(student.currentBacklogs || 0) > 0
  ).length;
  const topper = [...fullRows].sort((left, right) => right.cgpa - left.cgpa)[0];
  const departmentLabel = buildDepartmentLabel(selectedDepartment, "Students");

  return createStructuredReport({
    title: selectedDepartment
      ? `# ${departmentLabel} Student Report`
      : "# Student Report",
    entityType: "student",
    reportType,
    summary: {
      totalStudents,
      averageCGPA,
      averageAttendance,
      averageBacklogs,
      studentsWithBacklogs,
      topper: topper?.name || null,
    },
    sections: [
      buildSection("Student Summary", [
        `Total students: ${totalStudents}`,
        selectedDepartment ? `Department filter: ${departmentLabel}` : null,
        `Average CGPA: ${averageCGPA}`,
        `Average attendance: ${averageAttendance}%`,
        `Average backlogs: ${averageBacklogs}`,
        `Students with backlogs: ${studentsWithBacklogs}`,
        `${getRowsIncludedLabel(scopedRows.reportScope)}: ${previewRows.length}`,
        getRankingLine(scopedRows.reportScope, scopedRows.sortDescriptor),
        `Top performer: ${topper?.name || "N/A"}`,
      ]),
    ],
    tables: [
      {
        title: "Student Snapshot",
        rows: previewRows,
      },
    ],
    insights: getScopeInsight(
      scopedRows.reportScope,
      reportType === "backlog"
        ? "Backlog-focused reports calculate summary metrics from the full filtered student dataset and preview only the most relevant rows."
        : reportType === "attendance"
          ? "Attendance-focused reports calculate summary metrics from the full filtered student dataset and preview only the lowest-attendance rows."
          : "Student reports calculate summary metrics from the full filtered dataset and return a preview snapshot for quick review.",
      "This student report is scoped to the requested ranked subset, and all summary metrics use only the included ranked rows."
    ),
    fullRows,
    previewRows,
    filtered: Boolean(filters.department),
    filters,
    selectedDepartment,
    validation,
    appliedConditions,
    reportScope: scopedRows.reportScope,
    requestedLimit: scopedRows.requestedLimit,
    sortDescriptor: scopedRows.sortDescriptor,
  });
};

const generateDepartmentReport = (
  {
    departments = [],
    students = [],
    placements = [],
    selectedDepartment = null,
  } = {},
  {
    message = "",
    reportType = "general",
    filters = {},
    sort = null,
    limit = null,
  } = {}
) => {
  if (!departments.length) {
    return null;
  }

  const mappedRows = departments.map((department) => {
    const departmentStudents = students.filter(
      (student) => String(student.department) === String(department._id)
    );
    const departmentPlacements = placements.filter(
      (placement) =>
        String(placement.student?.department || "") === String(department._id)
    );
    const totalStudents = departmentStudents.length;
    const avgCGPA = totalStudents
      ? roundTo(
          departmentStudents.reduce(
            (sum, student) => sum + Number(student.cgpa || 0),
            0
          ) / totalStudents
        )
      : 0;
    const avgAttendance = totalStudents
      ? roundTo(
          departmentStudents.reduce(
            (sum, student) => sum + getStudentAttendance(student),
            0
          ) / totalStudents
        )
      : 0;
    const passPercentage = totalStudents
      ? roundTo(
          (departmentStudents.filter(
            (student) => Number(student.currentBacklogs || 0) === 0
          ).length /
            totalStudents) *
            100
        )
      : 0;
    const placementPercentage = totalStudents
      ? roundTo((departmentPlacements.length / totalStudents) * 100)
      : 0;

    return {
      name: department.name || null,
      code: normalizeDepartmentCode(department.code || null),
      totalStudents,
      avgCGPA,
      avgAttendance,
      passPercentage,
      placementPercentage,
    };
  });

  const sortedRows = [...mappedRows].sort((left, right) => {
    if (reportType === "attendance") {
      return right.avgAttendance - left.avgAttendance;
    }

    if (reportType === "placement") {
      return right.placementPercentage - left.placementPercentage;
    }

    return right.avgCGPA - left.avgCGPA;
  });
  const {
    rows: numericFilteredRows,
    conditions: appliedConditions,
  } = applyNumericConditions(message, sortedRows);

  const scopedRows = resolveScopedRows({
    entityType: "department",
    rows: numericFilteredRows,
    reportType,
    message,
    sort,
    limit,
  });
  const { fullRows, previewRows, validation } = enforceValidatedRows({
    entityType: "department",
    fullRows: scopedRows.fullRows,
    previewRows: scopedRows.previewRows,
    filters,
    reportScope: scopedRows.reportScope,
    previewLimit: scopedRows.requestedLimit,
  });

  if (!fullRows.length) {
    return null;
  }

  const focusedDepartment = fullRows[0] || null;
  const departmentLabel = buildDepartmentLabel(
    selectedDepartment || focusedDepartment,
    "Department"
  );

  return createStructuredReport({
    title: selectedDepartment
      ? `# ${departmentLabel} Performance Report`
      : "# Department Report",
    entityType: "department",
    reportType,
    summary: {
      totalDepartments: fullRows.length,
      highestAverageCGPA: Math.max(...fullRows.map((row) => row.avgCGPA), 0),
      highestPlacementPercentage: Math.max(
        ...fullRows.map((row) => row.placementPercentage),
        0
      ),
    },
    sections: [
      buildSection("Department Summary", [
        `Departments covered: ${fullRows.length}`,
        selectedDepartment ? `Department filter: ${departmentLabel}` : null,
        `Best average CGPA: ${fullRows[0]?.avgCGPA || 0}`,
        `Best placement percentage: ${fullRows[0]?.placementPercentage || 0}%`,
        `${getRowsIncludedLabel(scopedRows.reportScope)}: ${previewRows.length}`,
        getRankingLine(scopedRows.reportScope, scopedRows.sortDescriptor),
      ]),
    ],
    tables: [
      {
        title: "Department Performance",
        rows: previewRows,
      },
    ],
    insights: getScopeInsight(
      scopedRows.reportScope,
      selectedDepartment
        ? `${departmentLabel} report uses only live records tied to that department and validates that no mixed departments are included.`
        : "Department reports aggregate live student, backlog, attendance, and placement signals across the selected scope.",
      "This department report is scoped to the requested ranked subset, and all summary metrics use only the included ranked rows."
    ),
    fullRows,
    previewRows,
    filtered: Boolean(filters.department),
    filters,
    selectedDepartment,
    validation,
    appliedConditions,
    reportScope: scopedRows.reportScope,
    requestedLimit: scopedRows.requestedLimit,
    sortDescriptor: scopedRows.sortDescriptor,
    dataOverrides: {
      record: focusedDepartment,
    },
  });
};

const generatePlacementReport = (
  { placements = [], students = [] } = {},
  {
    message = "",
    reportType = "placement",
    filters = {},
    selectedDepartment = null,
    sort = null,
    limit = null,
  } = {}
) => {
  if (!placements.length && !students.length) {
    return null;
  }

  const mappedRows = placements
    .map((placement) => ({
      student: placement.student?.name || null,
      rollNumber: placement.student?.rollNumber || null,
      department: placement.student?.department?.name || null,
      departmentCode: normalizeDepartmentCode(
        placement.student?.department?.code || null
      ),
      company: placement.company || null,
      role: placement.role || null,
      package: roundTo(placement.package),
      placementType: placement.placementType || null,
      academicYear: placement.academicYear || null,
    }))
    .sort((left, right) => right.package - left.package);
  const {
    rows: numericFilteredRows,
    conditions: appliedConditions,
  } = applyNumericConditions(message, mappedRows);

  const scopedRows = resolveScopedRows({
    entityType: "placement",
    rows: numericFilteredRows,
    reportType,
    message,
    sort,
    limit,
  });
  const { fullRows, previewRows, validation } = enforceValidatedRows({
    entityType: "placement",
    fullRows: scopedRows.fullRows,
    previewRows: scopedRows.previewRows,
    filters,
    reportScope: scopedRows.reportScope,
    previewLimit: scopedRows.requestedLimit,
  });

  if (!fullRows.length && !students.length) {
    return null;
  }

  const totalStudents =
    scopedRows.reportScope === "ranked_subset" ? fullRows.length : students.length;
  const placedStudents = fullRows.length;
  const placementPercentage = totalStudents
    ? roundTo((placedStudents / totalStudents) * 100)
    : 0;
  const averagePackage = placedStudents
    ? roundTo(
        fullRows.reduce((sum, placement) => sum + Number(placement.package || 0), 0) /
          placedStudents
      )
    : 0;
  const highestPackage = Math.max(...fullRows.map((row) => row.package || 0), 0);
  const departmentLabel = buildDepartmentLabel(selectedDepartment, "Placement");

  return createStructuredReport({
    title: selectedDepartment
      ? `# ${departmentLabel} Placement Report`
      : "# Placement Report",
    entityType: "placement",
    reportType,
    summary: {
      totalStudents,
      placedStudents,
      placementPercentage,
      averagePackage,
      highestPackage,
    },
    sections: [
      buildSection("Placement Summary", [
        `Total students considered: ${totalStudents}`,
        selectedDepartment ? `Department filter: ${departmentLabel}` : null,
        `Placed students: ${placedStudents}`,
        `Placement percentage: ${placementPercentage}%`,
        `Average package: ${averagePackage} LPA`,
        `Highest package: ${highestPackage} LPA`,
        `${getRowsIncludedLabel(scopedRows.reportScope)}: ${previewRows.length}`,
        getRankingLine(scopedRows.reportScope, scopedRows.sortDescriptor),
      ]),
    ],
    tables: [
      {
        title: "Placement Snapshot",
        rows: previewRows,
      },
    ],
    insights: getScopeInsight(
      scopedRows.reportScope,
      "Placement reports calculate summary metrics from the full filtered placement dataset while returning only a ranked preview.",
      "This placement report is scoped to the requested ranked subset, and all summary metrics use only the included ranked rows."
    ),
    fullRows,
    previewRows,
    filtered: Boolean(filters.department),
    filters,
    selectedDepartment,
    validation,
    appliedConditions,
    reportScope: scopedRows.reportScope,
    requestedLimit: scopedRows.requestedLimit,
    sortDescriptor: scopedRows.sortDescriptor,
  });
};

const generateFacultyReport = (
  { faculty = [], researchPapers = [] } = {},
  {
    message = "",
    reportType = "general",
    filters = {},
    selectedDepartment = null,
    sort = null,
    limit = null,
  } = {}
) => {
  if (!faculty.length) {
    return null;
  }

  const publicationCountByFaculty = researchPapers.reduce((map, paper) => {
    const key = String(paper.faculty || "");
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());

  const mappedRows = faculty
    .map((member) => ({
      name: member.name || null,
      email: member.email || null,
      department: member.department?.name || null,
      departmentCode: normalizeDepartmentCode(member.department?.code || null),
      designation: member.designation || null,
      experience: roundTo(member.experience),
      publications: publicationCountByFaculty.get(String(member._id)) || 0,
    }))
    .sort(
      (left, right) =>
        right.publications - left.publications || right.experience - left.experience
    );
  const {
    rows: numericFilteredRows,
    conditions: appliedConditions,
  } = applyNumericConditions(message, mappedRows);

  const scopedRows = resolveScopedRows({
    entityType: "faculty",
    rows: numericFilteredRows,
    reportType,
    message,
    sort,
    limit,
  });
  const { fullRows, previewRows, validation } = enforceValidatedRows({
    entityType: "faculty",
    fullRows: scopedRows.fullRows,
    previewRows: scopedRows.previewRows,
    filters,
    reportScope: scopedRows.reportScope,
    previewLimit: scopedRows.requestedLimit,
  });

  if (!fullRows.length) {
    return null;
  }

  const totalPublications = fullRows.reduce(
    (sum, member) => sum + Number(member.publications || 0),
    0
  );
  const averageExperience = roundTo(
    fullRows.reduce((sum, member) => sum + Number(member.experience || 0), 0) /
      fullRows.length
  );
  const departmentLabel = buildDepartmentLabel(selectedDepartment, "Faculty");

  return createStructuredReport({
    title: selectedDepartment
      ? `# ${departmentLabel} Faculty Report`
      : "# Faculty Report",
    entityType: "faculty",
    reportType,
    summary: {
      totalFaculty: fullRows.length,
      totalPublications,
      averageExperience,
    },
    sections: [
      buildSection("Faculty Summary", [
        `Total faculty: ${fullRows.length}`,
        selectedDepartment ? `Department filter: ${departmentLabel}` : null,
        `Total publications: ${totalPublications}`,
        `Average experience: ${averageExperience} years`,
        `${getRowsIncludedLabel(scopedRows.reportScope)}: ${previewRows.length}`,
        getRankingLine(scopedRows.reportScope, scopedRows.sortDescriptor),
      ]),
    ],
    tables: [
      {
        title: "Faculty Snapshot",
        rows: previewRows,
      },
    ],
    insights: getScopeInsight(
      scopedRows.reportScope,
      "Faculty reports calculate experience and publication metrics from the full filtered faculty dataset and return a preview snapshot for review.",
      "This faculty report is scoped to the requested ranked subset, and all summary metrics use only the included ranked rows."
    ),
    fullRows,
    previewRows,
    filtered: Boolean(filters.department),
    filters,
    selectedDepartment,
    validation,
    appliedConditions,
    reportScope: scopedRows.reportScope,
    requestedLimit: scopedRows.requestedLimit,
    sortDescriptor: scopedRows.sortDescriptor,
  });
};

const generateResearchReport = (
  researchPapers = [],
  {
    message = "",
    reportType = "research",
    filters = {},
    selectedDepartment = null,
    sort = null,
    limit = null,
  } = {}
) => {
  if (!researchPapers.length) {
    return null;
  }

  const mappedRows = researchPapers.map((paper) => ({
    title: paper.title || null,
    journal: paper.journal || null,
    year: paper.year ?? null,
    citations: Number(paper.citations || 0),
    publicationType: paper.publicationType || null,
    indexing: paper.indexing || null,
    impactFactor: roundTo(paper.impactFactor),
    faculty: paper.faculty?.name || null,
    department: paper.department?.name || paper.faculty?.department?.name || null,
    departmentCode: normalizeDepartmentCode(
      paper.department?.code || paper.faculty?.department?.code || null
    ),
  }));
  const {
    rows: numericFilteredRows,
    conditions: appliedConditions,
  } = applyNumericConditions(message, mappedRows);

  const scopedRows = resolveScopedRows({
    entityType: "research",
    rows: numericFilteredRows,
    reportType,
    message,
    sort,
    limit,
  });
  const { fullRows, previewRows, validation } = enforceValidatedRows({
    entityType: "research",
    fullRows: scopedRows.fullRows,
    previewRows: scopedRows.previewRows,
    filters,
    reportScope: scopedRows.reportScope,
    previewLimit: scopedRows.requestedLimit,
  });

  if (!fullRows.length) {
    return null;
  }

  const totalCitations = fullRows.reduce(
    (sum, paper) => sum + Number(paper.citations || 0),
    0
  );
  const averageCitations = roundTo(totalCitations / fullRows.length);
  const averageImpactFactor = roundTo(
    fullRows.reduce((sum, paper) => sum + Number(paper.impactFactor || 0), 0) /
      fullRows.length
  );
  const departmentLabel = buildDepartmentLabel(selectedDepartment, "Research");

  return createStructuredReport({
    title: selectedDepartment
      ? `# ${departmentLabel} Research Publication Report`
      : "# Research Publication Report",
    entityType: "research",
    reportType,
    summary: {
      totalResearchPapers: fullRows.length,
      totalCitations,
      averageCitations,
      averageImpactFactor,
    },
    sections: [
      buildSection("Research Summary", [
        `Total publications: ${fullRows.length}`,
        selectedDepartment ? `Department filter: ${departmentLabel}` : null,
        `Total citations: ${totalCitations}`,
        `Average citations: ${averageCitations}`,
        `Average impact factor: ${averageImpactFactor}`,
        `${getRowsIncludedLabel(scopedRows.reportScope)}: ${previewRows.length}`,
        getRankingLine(scopedRows.reportScope, scopedRows.sortDescriptor),
      ]),
    ],
    tables: [
      {
        title: "Research Publications",
        rows: previewRows,
      },
    ],
    insights: getScopeInsight(
      scopedRows.reportScope,
      "Research publication reports summarize the full filtered publication dataset and return a preview table for review.",
      "This research publication report is scoped to the requested ranked subset, and all summary metrics use only the included ranked rows."
    ),
    fullRows,
    previewRows,
    filtered: Boolean(filters.department),
    filters,
    selectedDepartment,
    validation,
    appliedConditions,
    reportScope: scopedRows.reportScope,
    requestedLimit: scopedRows.requestedLimit,
    sortDescriptor: scopedRows.sortDescriptor,
  });
};

const generateAchievementReport = (
  achievements = [],
  {
    message = "",
    reportType = "achievement",
    filters = {},
    selectedDepartment = null,
    sort = null,
    limit = null,
  } = {}
) => {
  if (!achievements.length) {
    return null;
  }

  const mappedRows = achievements.map((achievement) => ({
    title: achievement.title || null,
    type: achievement.type || null,
    level: achievement.level || null,
    category: achievement.category || null,
    points: Number(achievement.points || 0),
    date: achievement.date || null,
    issuingOrganization: achievement.issuingOrganization || null,
    faculty: achievement.faculty?.name || null,
    department: achievement.faculty?.department?.name || null,
    departmentCode: normalizeDepartmentCode(
      achievement.faculty?.department?.code || null
    ),
  }));
  const {
    rows: numericFilteredRows,
    conditions: appliedConditions,
  } = applyNumericConditions(message, mappedRows);

  const scopedRows = resolveScopedRows({
    entityType: "achievement",
    rows: numericFilteredRows,
    reportType,
    message,
    sort,
    limit,
  });
  const { fullRows, previewRows, validation } = enforceValidatedRows({
    entityType: "achievement",
    fullRows: scopedRows.fullRows,
    previewRows: scopedRows.previewRows,
    filters,
    reportScope: scopedRows.reportScope,
    previewLimit: scopedRows.requestedLimit,
  });

  if (!fullRows.length) {
    return null;
  }

  const totalPoints = fullRows.reduce(
    (sum, achievement) => sum + Number(achievement.points || 0),
    0
  );
  const uniqueFacultyCount = new Set(
    fullRows.map((achievement) => achievement.faculty).filter(Boolean)
  ).size;
  const departmentLabel = buildDepartmentLabel(selectedDepartment, "Faculty");

  return createStructuredReport({
    title: selectedDepartment
      ? `# ${departmentLabel} Faculty Achievement Report`
      : "# Faculty Achievement Report",
    entityType: "achievement",
    reportType,
    summary: {
      totalAchievements: fullRows.length,
      totalPoints,
      totalFaculty: uniqueFacultyCount,
    },
    sections: [
      buildSection("Achievement Summary", [
        `Total achievements: ${fullRows.length}`,
        selectedDepartment ? `Department filter: ${departmentLabel}` : null,
        `Total achievement points: ${totalPoints}`,
        `Faculty covered: ${uniqueFacultyCount}`,
        `${getRowsIncludedLabel(scopedRows.reportScope)}: ${previewRows.length}`,
        getRankingLine(scopedRows.reportScope, scopedRows.sortDescriptor),
      ]),
    ],
    tables: [
      {
        title: "Faculty Achievements",
        rows: previewRows,
      },
    ],
    insights: getScopeInsight(
      scopedRows.reportScope,
      "Faculty achievement reports summarize the full filtered dataset across achievement type, level, and points.",
      "This faculty achievement report is scoped to the requested ranked subset, and all summary metrics use only the included ranked rows."
    ),
    fullRows,
    previewRows,
    filtered: Boolean(filters.department),
    filters,
    selectedDepartment,
    validation,
    appliedConditions,
    reportScope: scopedRows.reportScope,
    requestedLimit: scopedRows.requestedLimit,
    sortDescriptor: scopedRows.sortDescriptor,
  });
};

const generateDocumentReport = (
  documents = [],
  {
    message = "",
    reportType = "accreditation",
    filters = {},
    selectedDepartment = null,
    sort = null,
    limit = null,
  } = {}
) => {
  if (!documents.length) {
    return null;
  }

  const mappedRows = documents.map((document) => ({
    title: document.title || null,
    category: document.category || null,
    type: document.type || null,
    accreditationType: document.accreditationType || null,
    criteria: document.criteria || null,
    academicYear: document.academicYear || null,
    status: document.status || null,
    requiredForAccreditation: Boolean(document.isRequiredForAccreditation),
    department: document.department?.name || document.program?.name || null,
    departmentCode: normalizeDepartmentCode(
      document.department?.code || document.program?.code || null
    ),
    programCode: normalizeDepartmentCode(document.program?.code || null),
  }));
  const {
    rows: numericFilteredRows,
    conditions: appliedConditions,
  } = applyNumericConditions(message, mappedRows);

  const scopedRows = resolveScopedRows({
    entityType: "document",
    rows: numericFilteredRows,
    reportType,
    message,
    sort,
    limit,
  });
  const { fullRows, previewRows, validation } = enforceValidatedRows({
    entityType: "document",
    fullRows: scopedRows.fullRows,
    previewRows: scopedRows.previewRows,
    filters,
    reportScope: scopedRows.reportScope,
    previewLimit: scopedRows.requestedLimit,
  });

  if (!fullRows.length) {
    return null;
  }

  const approvedCount = fullRows.filter((document) => document.status === "Approved").length;
  const pendingCount = fullRows.filter((document) =>
    String(document.status || "").toLowerCase().includes("pending")
  ).length;
  const requiredCount = fullRows.filter(
    (document) => document.requiredForAccreditation
  ).length;
  const departmentLabel = buildDepartmentLabel(selectedDepartment, "Document");

  return createStructuredReport({
    title: selectedDepartment
      ? `# ${departmentLabel} Accreditation Document Report`
      : "# Accreditation Document Report",
    entityType: "document",
    reportType,
    summary: {
      totalDocuments: fullRows.length,
      approvedDocuments: approvedCount,
      pendingDocuments: pendingCount,
      requiredForAccreditation: requiredCount,
    },
    sections: [
      buildSection("Document Summary", [
        `Total documents: ${fullRows.length}`,
        selectedDepartment ? `Department filter: ${departmentLabel}` : null,
        `Approved documents: ${approvedCount}`,
        `Pending documents: ${pendingCount}`,
        `Required for accreditation: ${requiredCount}`,
        `${getRowsIncludedLabel(scopedRows.reportScope)}: ${previewRows.length}`,
        getRankingLine(scopedRows.reportScope, scopedRows.sortDescriptor),
      ]),
    ],
    tables: [
      {
        title: "Accreditation Documents",
        rows: previewRows,
      },
    ],
    insights: getScopeInsight(
      scopedRows.reportScope,
      "Accreditation document reports summarize the full filtered document dataset and surface approval and readiness status clearly.",
      "This accreditation document report is scoped to the requested ranked subset, and all summary metrics use only the included ranked rows."
    ),
    fullRows,
    previewRows,
    filtered: Boolean(filters.department),
    filters,
    selectedDepartment,
    validation,
    appliedConditions,
    reportScope: scopedRows.reportScope,
    requestedLimit: scopedRows.requestedLimit,
    sortDescriptor: scopedRows.sortDescriptor,
  });
};

const generateNaacReport = (
  criteriaRows = [],
  {
    message = "",
    reportType = "accreditation",
    filters = {},
    selectedDepartment = null,
    sort = null,
    limit = null,
  } = {}
) => {
  if (!criteriaRows.length) {
    return null;
  }

  const mappedRows = criteriaRows.map((criterion) => ({
    institution: criterion.institution || "Institution",
    academicYear: criterion.academicYear || null,
    criterion: criterion.criterion || null,
    keyIndicator: criterion.keyIndicator || null,
    metric: criterion.metric || null,
    status: criterion.status || null,
    complianceLevel: criterion.complianceLevel || null,
    lastUpdated: criterion.lastUpdated || null,
  }));
  const scopedRows = resolveScopedRows({
    entityType: "naac",
    rows: mappedRows,
    reportType,
    message,
    sort,
    limit,
  });

  const fullRows = scopedRows.fullRows;
  const previewRows = scopedRows.previewRows;

  if (!fullRows.length) {
    return null;
  }

  const completedCount = fullRows.filter((row) => row.status === "Completed").length;
  const compliantCount = fullRows.filter((row) =>
    ["Compliant", "Exemplary"].includes(row.complianceLevel)
  ).length;

  return createStructuredReport({
    title: "# NAAC Readiness Report",
    entityType: "naac",
    reportType,
    summary: {
      totalCriteria: fullRows.length,
      completedCriteria: completedCount,
      compliantCriteria: compliantCount,
    },
    sections: [
      buildSection("NAAC Summary", [
        `Total criteria rows: ${fullRows.length}`,
        `Completed rows: ${completedCount}`,
        `Compliant or exemplary rows: ${compliantCount}`,
        `${getRowsIncludedLabel(scopedRows.reportScope)}: ${previewRows.length}`,
        getRankingLine(scopedRows.reportScope, scopedRows.sortDescriptor),
      ]),
    ],
    tables: [
      {
        title: "NAAC Criteria",
        rows: previewRows,
      },
    ],
    insights: getScopeInsight(
      scopedRows.reportScope,
      "NAAC readiness reports summarize the filtered institutional NAAC criteria set with status and compliance focus.",
      "This NAAC readiness report is scoped to the requested ranked subset, and all summary metrics use only the included ranked rows."
    ),
    fullRows,
    previewRows,
    filtered: false,
    filters,
    selectedDepartment,
    validation: {
      valid: true,
      filters,
      totalRecords: fullRows.length,
      previewCount: previewRows.length,
      departmentCodes: [],
      previewDepartmentCodes: [],
      errors: [],
    },
    reportScope: scopedRows.reportScope,
    requestedLimit: scopedRows.requestedLimit,
    sortDescriptor: scopedRows.sortDescriptor,
  });
};

const generateNbaReport = (
  criteriaRows = [],
  {
    message = "",
    reportType = "accreditation",
    filters = {},
    selectedDepartment = null,
    sort = null,
    limit = null,
  } = {}
) => {
  if (!criteriaRows.length) {
    return null;
  }

  const mappedRows = criteriaRows.map((criterion) => ({
    department: criterion.program?.name || null,
    departmentCode: normalizeDepartmentCode(criterion.program?.code || null),
    academicYear: criterion.academicYear || null,
    criteria: criterion.criteria || null,
    title: criterion.title || null,
    targetValue: roundTo(criterion.targetValue),
    actualValue: roundTo(criterion.actualValue),
    status: criterion.status || null,
    complianceScore: roundTo(criterion.complianceScore),
    lastUpdated: criterion.lastUpdated || null,
  }));
  const {
    rows: numericFilteredRows,
    conditions: appliedConditions,
  } = applyNumericConditions(message, mappedRows);
  const scopedRows = resolveScopedRows({
    entityType: "nba",
    rows: numericFilteredRows,
    reportType,
    message,
    sort,
    limit,
  });
  const { fullRows, previewRows, validation } = enforceValidatedRows({
    entityType: "nba",
    fullRows: scopedRows.fullRows,
    previewRows: scopedRows.previewRows,
    filters,
    reportScope: scopedRows.reportScope,
    previewLimit: scopedRows.requestedLimit,
  });

  if (!fullRows.length) {
    return null;
  }

  const metCriteria = fullRows.filter((row) =>
    ["Met", "Exceeded"].includes(row.status)
  ).length;
  const averageComplianceScore = roundTo(
    fullRows.reduce((sum, row) => sum + Number(row.complianceScore || 0), 0) /
      fullRows.length
  );
  const departmentLabel = buildDepartmentLabel(selectedDepartment, "NBA");

  return createStructuredReport({
    title: selectedDepartment
      ? `# ${departmentLabel} NBA Readiness Report`
      : "# NBA Readiness Report",
    entityType: "nba",
    reportType,
    summary: {
      totalCriteria: fullRows.length,
      metCriteria,
      averageComplianceScore,
    },
    sections: [
      buildSection("NBA Summary", [
        `Total criteria rows: ${fullRows.length}`,
        selectedDepartment ? `Department filter: ${departmentLabel}` : null,
        `Met or exceeded rows: ${metCriteria}`,
        `Average compliance score: ${averageComplianceScore}`,
        `${getRowsIncludedLabel(scopedRows.reportScope)}: ${previewRows.length}`,
        getRankingLine(scopedRows.reportScope, scopedRows.sortDescriptor),
      ]),
    ],
    tables: [
      {
        title: "NBA Criteria",
        rows: previewRows,
      },
    ],
    insights: getScopeInsight(
      scopedRows.reportScope,
      "NBA readiness reports summarize the filtered program criteria set with compliance-score visibility.",
      "This NBA readiness report is scoped to the requested ranked subset, and all summary metrics use only the included ranked rows."
    ),
    fullRows,
    previewRows,
    filtered: Boolean(filters.department),
    filters,
    selectedDepartment,
    validation,
    appliedConditions,
    reportScope: scopedRows.reportScope,
    requestedLimit: scopedRows.requestedLimit,
    sortDescriptor: scopedRows.sortDescriptor,
  });
};

const generateEventReport = (
  { events = [], participations = [] } = {},
  {
    message = "",
    reportType = "general",
    filters = {},
    selectedDepartment = null,
    sort = null,
    limit = null,
  } = {}
) => {
  if (!events.length) {
    return null;
  }

  const participationStats = participations.reduce((map, participation) => {
    const key = String(participation.event || "");
    const current = map.get(key) || {
      participants: 0,
      attendedCount: 0,
    };

    current.participants += 1;
    if (participation.attended || participation.status === "Participated") {
      current.attendedCount += 1;
    }

    map.set(key, current);
    return map;
  }, new Map());

  const mappedRows = events
    .map((event) => {
      const stats = participationStats.get(String(event._id)) || {
        participants: 0,
        attendedCount: 0,
      };

      return {
        title: event.title || null,
        type: event.type || null,
        level: event.level || null,
        department: event.department?.name || null,
        departmentCode: normalizeDepartmentCode(event.department?.code || null),
        participants: stats.participants,
        attendedCount: stats.attendedCount,
        startDate: event.startDate || null,
      };
    })
    .sort((left, right) => right.participants - left.participants);
  const {
    rows: numericFilteredRows,
    conditions: appliedConditions,
  } = applyNumericConditions(message, mappedRows);

  const scopedRows = resolveScopedRows({
    entityType: "event",
    rows: numericFilteredRows,
    reportType,
    message,
    sort,
    limit,
  });
  const { fullRows, previewRows, validation } = enforceValidatedRows({
    entityType: "event",
    fullRows: scopedRows.fullRows,
    previewRows: scopedRows.previewRows,
    filters,
    reportScope: scopedRows.reportScope,
    previewLimit: scopedRows.requestedLimit,
  });

  if (!fullRows.length) {
    return null;
  }

  const totalParticipants = fullRows.reduce(
    (sum, row) => sum + Number(row.participants || 0),
    0
  );
  const totalAttended = fullRows.reduce(
    (sum, row) => sum + Number(row.attendedCount || 0),
    0
  );
  const departmentLabel = buildDepartmentLabel(selectedDepartment, "Event");

  return createStructuredReport({
    title: selectedDepartment
      ? `# ${departmentLabel} Event Report`
      : "# Event Report",
    entityType: "event",
    reportType,
    summary: {
      totalEvents: fullRows.length,
      totalParticipants,
      totalAttended,
    },
    sections: [
      buildSection("Event Summary", [
        `Total events: ${fullRows.length}`,
        selectedDepartment ? `Department filter: ${departmentLabel}` : null,
        `Total participants: ${totalParticipants}`,
        `Attendance marked: ${totalAttended}`,
        `${getRowsIncludedLabel(scopedRows.reportScope)}: ${previewRows.length}`,
        getRankingLine(scopedRows.reportScope, scopedRows.sortDescriptor),
      ]),
    ],
    tables: [
      {
        title: "Event Snapshot",
        rows: previewRows,
      },
    ],
    insights: getScopeInsight(
      scopedRows.reportScope,
      "Event reports calculate attendance and participation from the full filtered event dataset and return only a preview snapshot.",
      "This event report is scoped to the requested ranked subset, and all summary metrics use only the included ranked rows."
    ),
    fullRows,
    previewRows,
    filtered: Boolean(filters.department),
    filters,
    selectedDepartment,
    validation,
    appliedConditions,
    reportScope: scopedRows.reportScope,
    requestedLimit: scopedRows.requestedLimit,
    sortDescriptor: scopedRows.sortDescriptor,
  });
};

const generateDynamicReport = (entityType, data, options = {}) => {
  if (!data) {
    return null;
  }

  const normalizedOptions =
    typeof options === "string" ? { reportType: options } : options;

  switch (entityType) {
    case "student":
      return generateStudentReport(data, normalizedOptions);
    case "department":
      return generateDepartmentReport(data, normalizedOptions);
    case "placement":
      return generatePlacementReport(data, normalizedOptions);
    case "faculty":
      return generateFacultyReport(data, normalizedOptions);
    case "research":
      return generateResearchReport(data, normalizedOptions);
    case "achievement":
      return generateAchievementReport(data, normalizedOptions);
    case "document":
      return generateDocumentReport(data, normalizedOptions);
    case "naac":
      return generateNaacReport(data, normalizedOptions);
    case "nba":
      return generateNbaReport(data, normalizedOptions);
    case "event":
      return generateEventReport(data, normalizedOptions);
    default:
      return null;
  }
};

const buildAcademicYearDateMatch = (academicYear = null) => {
  const value = normalizeFilterValue(academicYear);
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return null;
  }

  const startYear = Number(value.slice(0, 4));
  return {
    $gte: new Date(`${startYear}-07-01T00:00:00.000Z`),
    $lt: new Date(`${startYear + 1}-07-01T00:00:00.000Z`),
  };
};

const fetchEntityReportData = async (entityType, options = {}) => {
  const { selectedDepartment = null, filters = {} } = options;
  const departmentId = selectedDepartment?._id || null;
  const normalizedFilters = normalizeReportFilters(filters);
  const academicYear = normalizedFilters.academicYear;
  const batchYear = normalizedFilters.batchYear;
  const studentId = normalizedFilters.studentId || normalizedFilters.student;
  const facultyId = normalizedFilters.facultyId || normalizedFilters.faculty;
  const uploadedBy = normalizedFilters.uploadedBy;
  const subjectScope = normalizedFilters.subject;
  const semester = normalizedFilters.semester;
  const backlogFilter = normalizedFilters.backlogs;
  const exactYear = normalizedFilters.year;
  const dateRange = normalizedFilters.dateRange;
  const status = normalizedFilters.status;
  const criteria = normalizedFilters.criteria;
  const accreditationType = normalizedFilters.accreditationType;
  const level = normalizedFilters.level;
  const type = normalizedFilters.type;

  switch (entityType) {
    case "student": {
      const match = {
        isActive: true,
        ...(departmentId ? { department: departmentId } : {}),
        ...(studentId ? { _id: studentId } : {}),
        ...(batchYear !== null && batchYear !== undefined
          ? { batchYear: Number(batchYear) }
          : {}),
        ...(backlogFilter === true
          ? { currentBacklogs: { $gt: 0 } }
          : backlogFilter === false
            ? { currentBacklogs: 0 }
            : {}),
        ...(semester ? { currentSemester: Number(semester) } : {}),
      };

      return Student.find(match).populate("department", "name code").lean();
    }
    case "department": {
      const departmentMatch = {
        isActive: true,
        ...(departmentId ? { _id: departmentId } : {}),
      };
      const studentMatch = {
        isActive: true,
        ...(departmentId ? { department: departmentId } : {}),
        ...(studentId ? { _id: studentId } : {}),
        ...(batchYear !== null && batchYear !== undefined
          ? { batchYear: Number(batchYear) }
          : {}),
        ...(backlogFilter === true
          ? { currentBacklogs: { $gt: 0 } }
          : backlogFilter === false
            ? { currentBacklogs: 0 }
            : {}),
      };

      const [departments, students] = await Promise.all([
        Department.find(departmentMatch).lean(),
        Student.find(studentMatch)
          .select("department cgpa currentBacklogs academicRecords.avgAttendance")
          .lean(),
      ]);

      const studentIds = students.map((student) => student._id);
      const placements = studentIds.length
        ? await Placement.find({
            student: { $in: studentIds },
            ...(academicYear ? { academicYear } : {}),
          })
            .populate({
              path: "student",
              select: "department",
            })
            .lean()
        : [];

      return {
        departments,
        students,
        placements,
        selectedDepartment: toSelectedDepartment(selectedDepartment),
      };
    }
    case "placement": {
      const studentMatch = {
        isActive: true,
        ...(departmentId ? { department: departmentId } : {}),
        ...(studentId ? { _id: studentId } : {}),
        ...(batchYear !== null && batchYear !== undefined
          ? { batchYear: Number(batchYear) }
          : {}),
      };
      const students = await Student.find(studentMatch).select("_id").lean();
      const studentIds = students.map((student) => student._id);
      const placements = studentIds.length
        ? await Placement.find({
            student: { $in: studentIds },
            ...(academicYear ? { academicYear } : {}),
          })
            .populate({
              path: "student",
              populate: {
                path: "department",
                select: "name code",
              },
            })
            .lean()
        : [];

      return { placements, students };
    }
    case "faculty": {
      const facultyMatch = {
        isActive: true,
        ...(departmentId ? { department: departmentId } : {}),
        ...(facultyId ? { _id: facultyId } : {}),
      };
      const faculty = await Faculty.find(facultyMatch)
        .populate("department", "name code")
        .lean();
      const facultyIds = faculty.map((member) => member._id);
      const researchPapers = facultyIds.length
        ? await ResearchPaper.find({
            faculty: { $in: facultyIds },
          })
            .select("faculty")
            .lean()
        : [];

      return { faculty, researchPapers };
    }
    case "research": {
      const match = {
        ...(departmentId ? { department: departmentId } : {}),
        ...(facultyId ? { faculty: facultyId } : {}),
        ...(exactYear !== null && exactYear !== undefined
          ? { year: Number(exactYear) }
          : academicYear && /^\d{4}-\d{2}$/.test(academicYear)
            ? { year: Number(academicYear.slice(0, 4)) }
            : {}),
        ...(type ? { publicationType: new RegExp(`^${escapeRegex(type)}$`, "i") } : {}),
      };

      return ResearchPaper.find(match)
        .populate({
          path: "faculty",
          select: "name department",
          populate: { path: "department", select: "name code" },
        })
        .populate("department", "name code")
        .lean();
    }
    case "achievement": {
      const achievementMatch = {
        isActive: true,
        ...(facultyId ? { faculty: facultyId } : {}),
        ...(level ? { level: new RegExp(`^${escapeRegex(level)}$`, "i") } : {}),
        ...(type ? { type: new RegExp(`^${escapeRegex(type)}$`, "i") } : {}),
      };
      const dateMatch = dateRange || buildAcademicYearDateMatch(academicYear);
      if (dateMatch) {
        achievementMatch.date = dateMatch;
      }

      let query = FacultyAchievement.find(achievementMatch).populate({
        path: "faculty",
        select: "name department designation",
        populate: { path: "department", select: "name code" },
      });
      const achievements = await query.lean();

      return departmentId
        ? achievements.filter(
            (achievement) =>
              String(achievement.faculty?.department?._id || "") === String(departmentId)
          )
        : achievements;
    }
    case "document": {
      const documentMatch = {
        ...(academicYear ? { academicYear } : {}),
        ...(uploadedBy ? { uploadedBy } : {}),
        ...(studentId ? { student: studentId } : {}),
        ...(status ? { status: new RegExp(`^${escapeRegex(status)}$`, "i") } : {}),
        ...(accreditationType
          ? {
              accreditationType: new RegExp(
                `^${escapeRegex(accreditationType)}$`,
                "i"
              ),
            }
          : {}),
        ...(type ? { type: new RegExp(`^${escapeRegex(type)}$`, "i") } : {}),
        ...(criteria ? { criteria: new RegExp(escapeRegex(criteria), "i") } : {}),
      };
      if (departmentId) {
        documentMatch.$or = [{ department: departmentId }, { program: departmentId }];
      }

      return Document.find(documentMatch)
        .populate("department", "name code")
        .populate("program", "name code")
        .lean();
    }
    case "naac": {
      const naacMatch = {
        ...(academicYear ? { academicYear } : {}),
        ...(status ? { status: new RegExp(`^${escapeRegex(status)}$`, "i") } : {}),
        ...(criteria ? { criterion: new RegExp(escapeRegex(criteria), "i") } : {}),
      };

      return NAACCriteria.find(naacMatch).lean();
    }
    case "nba": {
      const nbaMatch = {
        ...(departmentId ? { program: departmentId } : {}),
        ...(academicYear ? { academicYear } : {}),
        ...(status ? { status: new RegExp(`^${escapeRegex(status)}$`, "i") } : {}),
        ...(criteria ? { criteria: new RegExp(escapeRegex(criteria), "i") } : {}),
      };

      return NBACriteria.find(nbaMatch).populate("program", "name code").lean();
    }
    case "event": {
      const eventMatch = {
        isActive: true,
        ...(departmentId ? { department: departmentId } : {}),
        ...(dateRange ? { startDate: dateRange } : {}),
      };
      const events = await Event.find(eventMatch)
        .populate("department", "name code")
        .lean();
      const eventIds = events.map((event) => event._id);
      const participations = eventIds.length
        ? await Participation.find({
            event: { $in: eventIds },
          })
            .select("event attended status")
            .lean()
        : [];

      return { events, participations };
    }
    default:
      return null;
  }
};

const buildUniversalReport = async (message = "", options = {}) => {
  if (!shouldUseUniversalReportEngine(message)) {
    return null;
  }

  const entityType =
    normalizeEntityType(options.entityType) || detectEntityType(message);
  const reportType = detectReportType(message);
  const baseFilters = options.filters || extractFilters(message);
  const yearContext = resolveYearFilterContext({
    message,
    entity: entityType,
    filters: baseFilters,
  });
  const extractedFilters = applyYearContextToFilters(baseFilters, yearContext);
  const selectedDepartment = await extractDepartmentFromQuery(
    message,
    extractedFilters
  );
  const filters = normalizeReportFilters({
    ...extractedFilters,
    department: normalizeDepartmentCode(
      selectedDepartment?.code || extractedFilters.department
    ),
    studentId: extractedFilters.studentId || extractedFilters.student || null,
    facultyId: extractedFilters.facultyId || extractedFilters.faculty || null,
    uploadedBy: extractedFilters.uploadedBy || null,
    subject: extractedFilters.subject || null,
  });

  if (extractedFilters.department && !selectedDepartment) {
    return buildEmptyReport(entityType, reportType, {
      filters,
      selectedDepartment: {
        _id: "",
        name: null,
        code: normalizeDepartmentCode(extractedFilters.department),
      },
      reason: `No active department matched the requested filter ${normalizeDepartmentCode(
        extractedFilters.department
      )}.`,
    });
  }

  const data = await fetchEntityReportData(entityType, {
    selectedDepartment,
    filters,
  });
  const report = generateDynamicReport(entityType, data, {
    message,
    reportType,
    filters,
    selectedDepartment,
    sort: options.sort || null,
    limit: options.limit || null,
  });

  if (!report) {
    return buildEmptyReport(entityType, reportType, {
      filters,
      selectedDepartment,
    });
  }

  return {
    ...report,
    entityType,
    reportType,
    filtered: Boolean(filters.department),
    filters,
    selectedDepartment: toSelectedDepartment(selectedDepartment),
  };
};

module.exports = {
  buildUniversalReport,
  detectEntityType,
  detectReportType,
  extractDepartmentFromQuery,
  generateDepartmentReport,
  generateDynamicReport,
  generateEventReport,
  generateFacultyReport,
  generatePlacementReport,
  generateStudentReport,
  validateReportDataset,
};
