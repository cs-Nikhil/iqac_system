const ACADEMIC_YEAR_PATTERN = /\b(?:academic\s+year\s*(?:is|=|:)?\s*)?((?:19|20)\d{2})\s*-\s*((?:19|20)?\d{2})\b/i;
const YEAR_PATTERN = /\b((?:19|20)\d{2})\b/;
const BATCH_YEAR_PATTERNS = [
  /\bbatch(?:\s+year)?\s*(?:is|=|:)?\s*((?:19|20)\d{2})\b/i,
  /\b((?:19|20)\d{2})\s+batch\b/i,
  /\badmitted?\s+in\s+((?:19|20)\d{2})\b/i,
  /\badmission\s+year\s*(?:is|=|:)?\s*((?:19|20)\d{2})\b/i,
];
const DEPARTMENT_ACADEMIC_CONTEXT_PATTERN =
  /\b(placement|attendance|cgpa|gpa|backlog|performance|subject|pass percentage|report|analysis|naac|nba|document|documents|accreditation)\b/i;

const normalizeText = (value = "") => String(value || "").trim().toLowerCase();

const normalizeAcademicYear = (value = "") => {
  const match = String(value || "").match(ACADEMIC_YEAR_PATTERN);
  if (!match) {
    return null;
  }

  const startYear = Number(match[1]);
  if (!Number.isFinite(startYear)) {
    return null;
  }

  return `${startYear}-${String(startYear + 1).slice(-2)}`;
};

const buildAcademicYearFromStartYear = (value = null) => {
  const startYear = Number(value);
  if (!Number.isFinite(startYear)) {
    return null;
  }

  return `${startYear}-${String(startYear + 1).slice(-2)}`;
};

const buildCalendarYearDateRange = (value = null) => {
  const year = Number(value);
  if (!Number.isFinite(year)) {
    return null;
  }

  return {
    $gte: new Date(`${year}-01-01T00:00:00.000Z`),
    $lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
  };
};

const toYearNumber = (value = null) => {
  const parsed = Number(String(value ?? "").match(/\d{4}/)?.[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeEntityKey = (entity = "") => {
  const normalized = normalizeText(entity);

  if (["student", "students"].includes(normalized)) return "student";
  if (["faculty", "faculties"].includes(normalized)) return "faculty";
  if (["department", "departments"].includes(normalized)) return "department";
  if (["placement", "placements"].includes(normalized)) return "placement";
  if (["attendance", "attendances"].includes(normalized)) return "attendance";
  if (["mark", "marks"].includes(normalized)) return "mark";
  if (["subject", "subjects", "course", "courses"].includes(normalized)) return "subject";
  if (["research", "research_papers", "researchpapers", "publication", "publications"].includes(normalized)) {
    return "research";
  }
  if (["achievement", "achievements", "facultyachievement", "facultyachievements"].includes(normalized)) {
    return "achievement";
  }
  if (["document", "documents"].includes(normalized)) return "document";
  if (["naac", "naaccriteria", "naaccriterias"].includes(normalized)) return "naac";
  if (["nba", "nbacriteria", "nbacriterias"].includes(normalized)) return "nba";
  if (["event", "events"].includes(normalized)) return "event";
  if (["participation", "participations"].includes(normalized)) return "participation";
  if (["user", "users"].includes(normalized)) return "user";

  return normalized || null;
};

const getExistingYearContext = (filters = {}) => {
  const academicYear = normalizeAcademicYear(
    filters.academicYear || filters.academic_year
  );
  const batchYear = toYearNumber(filters.batchYear ?? filters.batch_year);
  const year = toYearNumber(filters.year);
  const dateRange =
    filters.dateRange && typeof filters.dateRange === "object" ? filters.dateRange : null;

  if (batchYear !== null) {
    return {
      rawYear: batchYear,
      semantic: "batchYear",
      batchYear,
      academicYear: null,
      year: null,
      dateRange: null,
      unsupported: false,
      explicit: true,
      hasYear: true,
    };
  }

  if (academicYear) {
    return {
      rawYear: toYearNumber(academicYear),
      semantic: "academicYear",
      batchYear: null,
      academicYear,
      year: null,
      dateRange: null,
      unsupported: false,
      explicit: true,
      hasYear: true,
    };
  }

  if (year !== null) {
    return {
      rawYear: year,
      semantic: "year",
      batchYear: null,
      academicYear: null,
      year,
      dateRange: null,
      unsupported: false,
      explicit: true,
      hasYear: true,
    };
  }

  if (dateRange) {
    return {
      rawYear: null,
      semantic: "calendarYear",
      batchYear: null,
      academicYear: null,
      year: null,
      dateRange,
      unsupported: false,
      explicit: true,
      hasYear: true,
    };
  }

  return null;
};

const extractExplicitBatchYear = (message = "") => {
  for (const pattern of BATCH_YEAR_PATTERNS) {
    const year = toYearNumber(String(message || "").match(pattern)?.[1]);
    if (year !== null) {
      return year;
    }
  }

  return null;
};

const extractBareYear = (message = "") => {
  const strippedMessage = String(message || "")
    .replace(ACADEMIC_YEAR_PATTERN, " ")
    .replace(/\bbatch(?:\s+year)?\b/gi, " ")
    .replace(/\badmitted?\s+in\b/gi, " ")
    .replace(/\badmission\s+year\b/gi, " ");
  const year = toYearNumber(strippedMessage.match(YEAR_PATTERN)?.[1]);
  return year;
};

const resolveImplicitYearSemantic = ({ message = "", entity = null } = {}) => {
  const normalizedEntity = normalizeEntityKey(entity);
  const normalizedMessage = normalizeText(message);

  if (normalizedEntity === "student") {
    return "batchYear";
  }

  if (
    ["placement", "attendance", "mark", "document", "naac", "nba", "subject"].includes(
      normalizedEntity
    )
  ) {
    return "academicYear";
  }

  if (normalizedEntity === "department") {
    return DEPARTMENT_ACADEMIC_CONTEXT_PATTERN.test(normalizedMessage)
      ? "academicYear"
      : null;
  }

  if (normalizedEntity === "research") {
    return "year";
  }

  if (["achievement", "event", "participation"].includes(normalizedEntity)) {
    return "calendarYear";
  }

  return null;
};

const resolveYearFilterContext = ({
  message = "",
  entity = null,
  filters = {},
} = {}) => {
  const existing = getExistingYearContext(filters);
  if (existing) {
    return existing;
  }

  const explicitBatchYear = extractExplicitBatchYear(message);
  if (explicitBatchYear !== null) {
    return {
      rawYear: explicitBatchYear,
      semantic: "batchYear",
      batchYear: explicitBatchYear,
      academicYear: null,
      year: null,
      dateRange: null,
      unsupported: false,
      explicit: true,
      hasYear: true,
    };
  }

  const explicitAcademicYear = normalizeAcademicYear(message);
  if (explicitAcademicYear) {
    return {
      rawYear: toYearNumber(explicitAcademicYear),
      semantic: "academicYear",
      batchYear: null,
      academicYear: explicitAcademicYear,
      year: null,
      dateRange: null,
      unsupported: false,
      explicit: true,
      hasYear: true,
    };
  }

  const bareYear = extractBareYear(message);
  if (bareYear === null) {
    return {
      rawYear: null,
      semantic: null,
      batchYear: null,
      academicYear: null,
      year: null,
      dateRange: null,
      unsupported: false,
      explicit: false,
      hasYear: false,
    };
  }

  const semantic = resolveImplicitYearSemantic({ message, entity });
  if (semantic === "batchYear") {
    return {
      rawYear: bareYear,
      semantic,
      batchYear: bareYear,
      academicYear: null,
      year: null,
      dateRange: null,
      unsupported: false,
      explicit: false,
      hasYear: true,
    };
  }

  if (semantic === "academicYear") {
    return {
      rawYear: bareYear,
      semantic,
      batchYear: null,
      academicYear: buildAcademicYearFromStartYear(bareYear),
      year: null,
      dateRange: null,
      unsupported: false,
      explicit: false,
      hasYear: true,
    };
  }

  if (semantic === "year") {
    return {
      rawYear: bareYear,
      semantic,
      batchYear: null,
      academicYear: null,
      year: bareYear,
      dateRange: null,
      unsupported: false,
      explicit: false,
      hasYear: true,
    };
  }

  if (semantic === "calendarYear") {
    return {
      rawYear: bareYear,
      semantic,
      batchYear: null,
      academicYear: null,
      year: bareYear,
      dateRange: buildCalendarYearDateRange(bareYear),
      unsupported: false,
      explicit: false,
      hasYear: true,
    };
  }

  return {
    rawYear: bareYear,
    semantic: null,
    batchYear: null,
    academicYear: null,
    year: null,
    dateRange: null,
    unsupported: true,
    explicit: false,
    hasYear: true,
  };
};

const applyYearContextToFilters = (filters = {}, yearContext = null) => {
  const nextFilters = { ...filters };
  delete nextFilters.academic_year;
  delete nextFilters.batch_year;

  if (!yearContext?.hasYear || yearContext.unsupported) {
    return nextFilters;
  }

  if (yearContext.batchYear !== null) {
    nextFilters.batchYear = yearContext.batchYear;
  }

  if (yearContext.academicYear) {
    nextFilters.academicYear = yearContext.academicYear;
  }

  if (yearContext.year !== null && yearContext.semantic === "year") {
    nextFilters.year = yearContext.year;
  }

  if (yearContext.dateRange) {
    nextFilters.dateRange = yearContext.dateRange;
  }

  return nextFilters;
};

const getYearScopeLabel = (yearContext = null) => {
  if (!yearContext?.hasYear || yearContext.unsupported) {
    return null;
  }

  if (yearContext.batchYear !== null) {
    return `batch ${yearContext.batchYear}`;
  }

  if (yearContext.academicYear) {
    return `academic year ${yearContext.academicYear}`;
  }

  if (yearContext.semantic === "calendarYear" && yearContext.rawYear !== null) {
    return `year ${yearContext.rawYear}`;
  }

  if (yearContext.year !== null) {
    return `year ${yearContext.year}`;
  }

  return null;
};

module.exports = {
  ACADEMIC_YEAR_PATTERN,
  YEAR_PATTERN,
  applyYearContextToFilters,
  buildAcademicYearFromStartYear,
  buildCalendarYearDateRange,
  getYearScopeLabel,
  normalizeAcademicYear,
  normalizeEntityKey,
  resolveYearFilterContext,
  toYearNumber,
};
