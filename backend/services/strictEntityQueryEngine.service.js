const mongoose = require("mongoose");
const Student = require("../models/Student");
const Faculty = require("../models/Faculty");
const {
  calculateStudentPerformance,
} = require("./performance.service");
const {
  extractFilters,
  resolveDepartmentFilter,
} = require("./chatbotFilter.service");
const {
  isCountQuery,
} = require("./chatbotCount.service");
const {
  isSingleQuery,
  isListQuery,
  buildEntityQuery,
} = require("./chatbotEntityData.service");
const {
  extractQueryParameters,
} = require("./queryParameterExtractor.service");
const {
  getYearScopeLabel,
  resolveYearFilterContext,
} = require("./chatbotYearFilter.service");
const {
  buildInstitutionalChart,
} = require("./institutionalChart.service");
const {
  buildInstitutionalInsights,
} = require("./institutionalInsightEngine.service");

const STUDENT_ALLOWED_FIELDS = new Set([
  "cgpa",
  "attendance",
  "department",
  "batchYear",
  "backlog",
  "performance",
]);
const FACULTY_ALLOWED_FIELDS = new Set([
  "department",
  "experience",
  "specialization",
  "designation",
]);
const FACULTY_DESIGNATIONS = [
  "Associate Professor",
  "Assistant Professor",
  "Professor",
  "Lecturer",
  "Visiting Faculty",
];
const PERFORMANCE_VALUE_MAP = {
  at_risk: "At Risk",
  good: "Good",
  excellent: "Excellent",
};
const SPECIALIZATION_STOP_WORDS =
  "\\b(with|and|or|in|from|department|experience|designation|who|having|has|for)\\b";
const COUNT_WORD_PATTERN = /\b(total|count|how many|number of)\b/i;
const REPORT_WORD_PATTERN = /\b(report|summary|analysis|insight|compare|comparison)\b/i;
const INSIGHT_WORD_PATTERN =
  /\b(why|recommend|suggest|improve|weak|weaker|weakest|strong|stronger|strongest|compare|comparison|analy[sz]e)\b/i;
const STUDENT_EXPLICIT_PATTERN = /\bstudent|students\b/i;
const STUDENT_SIGNAL_PATTERN =
  /\b(cgpa|attendance|backlog|backlogs|at risk|top performers?|low performance|performance)\b/i;
const FACULTY_EXPLICIT_PATTERN =
  /\b(faculty|faculties|professor|professors|lecturer|lecturers)\b/i;
const FACULTY_SIGNAL_PATTERN =
  /\b(experience|specialization|designation|networks|assistant professor|associate professor|visiting faculty)\b/i;
const PLACEMENT_RECRUITMENT_PATTERN =
  /\b(recruit|recruited|recruitment|hire|hired|hiring|offer|offered|selected|selection|recruiter|recruiters|company|companies|placed)\b/i;

const normalizeText = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^\w\s<>=.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const roundTo = (value, digits = 2) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Number(numericValue.toFixed(digits));
};

const serializeValue = (value) => {
  if (value instanceof mongoose.Types.ObjectId) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((result, [key, item]) => {
      result[key] = serializeValue(item);
      return result;
    }, {});
  }

  return value;
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const OPERATOR_LABELS = {
  $gt: ">",
  $gte: ">=",
  $lt: "<",
  $lte: "<=",
  $eq: "=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  eq: "=",
};

const getFirstOperatorEntry = (value = null) => {
  if (!isPlainObject(value)) {
    return null;
  }

  return (
    Object.entries(value).find(([key]) => OPERATOR_LABELS[key]) || null
  );
};

const dedupeFilters = (filters = []) => {
  const seen = new Set();

  return filters.filter((filter) => {
    if (!filter?.field) {
      return false;
    }

    const key = `${filter.field}:${filter.operator}:${String(filter.value)}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const scoreStrictEntity = (message = "") => {
  const normalized = normalizeText(message);
  const studentScore =
    (STUDENT_EXPLICIT_PATTERN.test(normalized) ? 4 : 0) +
    (/\bcgpa\b/.test(normalized) ? 2 : 0) +
    (/\battendance\b/.test(normalized) ? 2 : 0) +
    (/\bbacklog|backlogs\b/.test(normalized) ? 2 : 0) +
    (/\bat risk\b/.test(normalized) ? 3 : 0) +
    (/\btop performers?\b/.test(normalized) ? 3 : 0) +
    (/\blow performance\b/.test(normalized) ? 3 : 0) +
    (STUDENT_SIGNAL_PATTERN.test(normalized) ? 1 : 0);
  const facultyScore =
    (FACULTY_EXPLICIT_PATTERN.test(normalized) ? 4 : 0) +
    (/\bexperience\b/.test(normalized) ? 2 : 0) +
    (/\bspecialization\b/.test(normalized) ? 2 : 0) +
    (/\bdesignation\b/.test(normalized) ? 2 : 0) +
    (/\bnetworks\b/.test(normalized) ? 3 : 0) +
    (FACULTY_SIGNAL_PATTERN.test(normalized) ? 1 : 0);

  return {
    student: studentScore,
    faculty: facultyScore,
  };
};

const detectStrictEntity = (message = "") => {
  const scores = scoreStrictEntity(message);

  if (!scores.student && !scores.faculty) {
    return null;
  }

  if (scores.student === scores.faculty) {
    return null;
  }

  return scores.student > scores.faculty ? "student" : "faculty";
};

const parseNumericComparisons = (message = "", field = "") => {
  const normalized = normalizeText(message);
  const symbolPattern = new RegExp(
    `\\b${field}\\b\\s*(<=|>=|=|<|>)\\s*(-?\\d+(?:\\.\\d+)?)`,
    "gi"
  );
  const wordPattern = new RegExp(
    `\\b${field}\\b\\s+(more than|greater than|above|over|less than|below|under|at least|minimum|at most|maximum)\\s*(-?\\d+(?:\\.\\d+)?)`,
    "gi"
  );
  const operatorMap = {
    "more than": ">",
    "greater than": ">",
    above: ">",
    over: ">",
    "less than": "<",
    below: "<",
    under: "<",
    "at least": ">=",
    minimum: ">=",
    "at most": "<=",
    maximum: "<=",
  };
  const matches = [];

  let match = symbolPattern.exec(normalized);
  while (match) {
    matches.push({
      field,
      operator: match[1],
      value: Number(match[2]),
    });
    match = symbolPattern.exec(normalized);
  }

  match = wordPattern.exec(normalized);
  while (match) {
    const operator = operatorMap[String(match[1]).toLowerCase()];
    if (operator) {
      matches.push({
        field,
        operator,
        value: Number(match[2]),
      });
    }
    match = wordPattern.exec(normalized);
  }

  return matches;
};

const parseStudentBacklogFilter = (message = "") => {
  const normalized = normalizeText(message);

  if (!/\bbacklog|backlogs\b/.test(normalized)) {
    return null;
  }

  if (
    /\bbacklogs?\s*(?:=|is|are)?\s*(true|yes)\b/.test(normalized) ||
    /\bwith\s+backlogs?\b/.test(normalized)
  ) {
    return {
      field: "backlog",
      operator: "=",
      value: true,
    };
  }

  if (
    /\bbacklogs?\s*(?:=|is|are)?\s*(false|no|none|zero)\b/.test(normalized) ||
    /\bwithout\s+backlogs?\b/.test(normalized)
  ) {
    return {
      field: "backlog",
      operator: "=",
      value: false,
    };
  }

  return null;
};

const normalizePerformanceValue = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "at risk" || normalized === "at_risk") {
    return "at_risk";
  }

  if (normalized === "good") {
    return "good";
  }

  if (normalized === "excellent") {
    return "excellent";
  }

  return null;
};

const parseStudentPerformanceFilter = (message = "") => {
  const normalized = normalizeText(message);

  if (/\bat risk\b/.test(normalized)) {
    return {
      field: "performance",
      operator: "=",
      value: "at_risk",
    };
  }

  const explicitPerformanceMatch = normalized.match(
    /\bperformance\s*(?:=|is)?\s*(excellent|good|at risk|at_risk)\b/
  );
  if (explicitPerformanceMatch?.[1]) {
    return {
      field: "performance",
      operator: "=",
      value: normalizePerformanceValue(explicitPerformanceMatch[1]),
    };
  }

  if (/\btop performers?\b/.test(normalized)) {
    return {
      field: "cgpa",
      operator: ">",
      value: 8,
    };
  }

  if (/\blow performance\b/.test(normalized)) {
    return {
      field: "cgpa",
      operator: "<",
      value: 6,
    };
  }

  return null;
};

const parseDepartmentFilter = (message = "") => {
  const filters = extractFilters(message);
  return filters.department
    ? {
        field: "department",
        operator: "=",
        value: String(filters.department).toUpperCase(),
      }
    : null;
};

const parseFacultySpecializationFilter = (message = "") => {
  const normalized = normalizeText(message);

  if (/\bnetworks\b/.test(normalized)) {
    return {
      field: "specialization",
      operator: "=",
      value: "networks",
    };
  }

  const explicitMatch = normalized.match(
    new RegExp(
      `\\b(?:specialization|specialized in|specialisation|specialised in)\\b\\s+(.+?)(?=${SPECIALIZATION_STOP_WORDS}|$)`,
      "i"
    )
  );

  if (!explicitMatch?.[1]) {
    return null;
  }

  const specialization = explicitMatch[1]
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  return specialization
    ? {
        field: "specialization",
        operator: "=",
        value: specialization,
      }
    : null;
};

const parseFacultyDesignationFilter = (message = "") => {
  const normalized = normalizeText(message);
  const designation = FACULTY_DESIGNATIONS.find((item) =>
    normalized.includes(item.toLowerCase())
  );

  return designation
    ? {
        field: "designation",
        operator: "=",
        value: designation,
      }
    : null;
};

const extractPlannerBacklogFilter = (filters = {}) => {
  if (Object.prototype.hasOwnProperty.call(filters, "backlogs")) {
    return filters.backlogs;
  }

  if (Object.prototype.hasOwnProperty.call(filters, "currentBacklogs")) {
    return filters.currentBacklogs;
  }

  return undefined;
};

const convertPlannerFiltersToStrictFilters = (entity = null, filters = {}) => {
  if (!isPlainObject(filters)) {
    return [];
  }

  const converted = [];

  if (filters.department) {
    converted.push({
      field: "department",
      operator: "=",
      value: String(filters.department).toUpperCase(),
    });
  }

  if (entity === "student") {
    if (filters.batchYear !== undefined && filters.batchYear !== null) {
      converted.push({
        field: "batchYear",
        operator: "=",
        value: Number(filters.batchYear),
      });
    }

    const backlogFilter = extractPlannerBacklogFilter(filters);
    if (typeof backlogFilter === "boolean") {
      converted.push({
        field: "backlog",
        operator: "=",
        value: backlogFilter,
      });
    }

    const attendanceFilter =
      filters.attendance ?? filters.averageAttendance ?? filters["academicRecords.avgAttendance"];
    const attendanceOperator = getFirstOperatorEntry(attendanceFilter);
    if (attendanceOperator) {
      converted.push({
        field: "attendance",
        operator: OPERATOR_LABELS[attendanceOperator[0]] || "=",
        value: Number(attendanceOperator[1]),
      });
    }

    const cgpaOperator = getFirstOperatorEntry(filters.cgpa);
    if (cgpaOperator) {
      converted.push({
        field: "cgpa",
        operator: OPERATOR_LABELS[cgpaOperator[0]] || "=",
        value: Number(cgpaOperator[1]),
      });
    }
  }

  if (entity === "faculty") {
    const experienceOperator = getFirstOperatorEntry(filters.experience);
    if (experienceOperator) {
      converted.push({
        field: "experience",
        operator: OPERATOR_LABELS[experienceOperator[0]] || "=",
        value: Number(experienceOperator[1]),
      });
    }

    if (filters.specialization) {
      converted.push({
        field: "specialization",
        operator: "=",
        value: String(filters.specialization).trim().toLowerCase(),
      });
    }

    if (filters.designation) {
      converted.push({
        field: "designation",
        operator: "=",
        value: String(filters.designation).trim(),
      });
    }
  }

  return converted;
};

const extractStrictFilters = (message = "", entity = null) => {
  if (!entity) {
    return [];
  }

  const parameterPlan = extractQueryParameters(message);
  const plannerFilters = convertPlannerFiltersToStrictFilters(
    entity,
    parameterPlan.filters || {}
  );

  if (entity === "student") {
    return dedupeFilters([
      ...plannerFilters,
      ...parseNumericComparisons(message, "cgpa"),
      ...parseNumericComparisons(message, "attendance"),
      parseDepartmentFilter(message),
      parseStudentBacklogFilter(message),
      parseStudentPerformanceFilter(message),
    ].filter(Boolean));
  }

  if (entity === "faculty") {
    return dedupeFilters([
      ...plannerFilters,
      ...parseNumericComparisons(message, "experience"),
      parseDepartmentFilter(message),
      parseFacultySpecializationFilter(message),
      parseFacultyDesignationFilter(message),
    ].filter(Boolean));
  }

  return [];
};

const validateStrictFilters = (entity = null, filters = []) => {
  const allowedFields =
    entity === "student"
      ? STUDENT_ALLOWED_FIELDS
      : entity === "faculty"
        ? FACULTY_ALLOWED_FIELDS
        : new Set();

  return filters.filter((filter) => allowedFields.has(filter.field));
};

const buildNumericQueryFragment = (operator = "=", value = null) => {
  if (!Number.isFinite(Number(value))) {
    return null;
  }

  const numericValue = Number(value);
  if (operator === "<") return { $lt: numericValue };
  if (operator === "<=") return { $lte: numericValue };
  if (operator === ">") return { $gt: numericValue };
  if (operator === ">=") return { $gte: numericValue };
  return numericValue;
};

const buildImpossibleQuery = () => ({ _id: null });

const buildStrictQuery = async (
  entity = null,
  filters = [],
  { baseQuery = null, initialSelectedDepartment = null } = {}
) => {
  const validatedFilters = validateStrictFilters(entity, filters);
  const query = {
    isActive: true,
    ...(isPlainObject(baseQuery) ? baseQuery : {}),
  };
  const appliedFilters = [];
  let selectedDepartment = initialSelectedDepartment || null;

  for (const filter of validatedFilters) {
    if (filter.field === "department" && filter.operator === "=") {
      if (selectedDepartment?._id && query.department) {
        appliedFilters.push({
          ...filter,
          value: selectedDepartment.code || String(filter.value).toUpperCase(),
        });
        continue;
      }

      const selected = await resolveDepartmentFilter(String(filter.value));
      appliedFilters.push({
        ...filter,
        value: String(filter.value).toUpperCase(),
      });

      if (!selected?._id) {
        return {
          query: buildImpossibleQuery(),
          appliedFilters,
          selectedDepartment: {
            _id: "",
            name: null,
            code: String(filter.value).toUpperCase(),
          },
        };
      }

      query.department = selected._id;
      selectedDepartment = {
        _id: String(selected._id),
        name: selected.name || null,
        code: selected.code || String(filter.value).toUpperCase(),
      };
      continue;
    }

    if (entity === "student" && filter.field === "batchYear" && filter.operator === "=") {
      const batchYear = Number(filter.value);
      if (Number.isFinite(batchYear)) {
        query.batchYear = batchYear;
        appliedFilters.push({
          ...filter,
          value: batchYear,
        });
      }
      continue;
    }

    if (entity === "student" && filter.field === "cgpa") {
      if (query.cgpa !== undefined) {
        appliedFilters.push(filter);
        continue;
      }

      const fragment = buildNumericQueryFragment(filter.operator, filter.value);
      if (fragment !== null) {
        query.cgpa = fragment;
        appliedFilters.push(filter);
      }
      continue;
    }

    if (entity === "student" && filter.field === "attendance") {
      if (query["academicRecords.avgAttendance"] !== undefined) {
        appliedFilters.push(filter);
        continue;
      }

      const fragment = buildNumericQueryFragment(filter.operator, filter.value);
      if (fragment !== null) {
        query["academicRecords.avgAttendance"] = fragment;
        appliedFilters.push(filter);
      }
      continue;
    }

    if (entity === "student" && filter.field === "backlog" && filter.operator === "=") {
      if (query.currentBacklogs !== undefined) {
        appliedFilters.push(filter);
        continue;
      }

      query.currentBacklogs = filter.value ? { $gt: 0 } : 0;
      appliedFilters.push(filter);
      continue;
    }

    if (entity === "student" && filter.field === "performance" && filter.operator === "=") {
      const mappedValue = PERFORMANCE_VALUE_MAP[filter.value];
      if (mappedValue) {
        query.performanceCategory = mappedValue;
        appliedFilters.push(filter);
      }
      continue;
    }

    if (entity === "faculty" && filter.field === "experience") {
      if (query.experience !== undefined) {
        appliedFilters.push(filter);
        continue;
      }

      const fragment = buildNumericQueryFragment(filter.operator, filter.value);
      if (fragment !== null) {
        query.experience = fragment;
        appliedFilters.push(filter);
      }
      continue;
    }

    if (entity === "faculty" && filter.field === "specialization" && filter.operator === "=") {
      query.specialization = {
        $regex: String(filter.value).trim(),
        $options: "i",
      };
      appliedFilters.push({
        ...filter,
        value: String(filter.value).trim().toLowerCase(),
      });
      continue;
    }

    if (entity === "faculty" && filter.field === "designation" && filter.operator === "=") {
      query.designation = String(filter.value).trim();
      appliedFilters.push({
        ...filter,
        value: String(filter.value).trim(),
      });
    }
  }

  return {
    query,
    appliedFilters,
    selectedDepartment,
  };
};

const normalizeStudentPerformance = (student = {}) => {
  const category =
    student.performanceCategory || calculateStudentPerformance(student).category;

  if (String(category).toLowerCase() === "at risk") {
    return "at_risk";
  }

  return String(category || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
};

const mapStudentRow = (student = {}) => ({
  id: String(student._id || ""),
  name: student.name || null,
  rollNumber: student.rollNumber || null,
  email: student.email || null,
  department: student.department?.name || null,
  departmentCode: student.department?.code || null,
  batchYear: student.batchYear ?? null,
  cgpa: student.cgpa ?? null,
  attendance: student.academicRecords?.avgAttendance ?? null,
  averageAttendance: student.academicRecords?.avgAttendance ?? null,
  backlog: Number(student.currentBacklogs || 0) > 0,
  currentBacklogs: student.currentBacklogs ?? 0,
  performance: normalizeStudentPerformance(student),
});

const mapFacultyRow = (faculty = {}) => ({
  id: String(faculty._id || ""),
  name: faculty.name || null,
  email: faculty.email || null,
  department: faculty.department?.name || null,
  departmentCode: faculty.department?.code || null,
  designation: faculty.designation || null,
  specialization: faculty.specialization || null,
  experience: faculty.experience ?? null,
});

const buildFacultyChart = (rows = [], appliedFilters = []) => {
  if (!rows.length) {
    return null;
  }

  if (appliedFilters.some((filter) => filter.field === "experience")) {
    return {
      type: "bar",
      data: {
        labels: rows.slice(0, 10).map((row) => row.name || row.email || "Faculty"),
        datasets: [
          {
            label: "Experience",
            data: rows.slice(0, 10).map((row) => roundTo(row.experience)),
            backgroundColor: "#1d4ed8",
            borderColor: "#1d4ed8",
          },
        ],
      },
    };
  }

  const designationCounts = rows.reduce((result, row) => {
    const key = row.designation || "Unknown";
    result.set(key, (result.get(key) || 0) + 1);
    return result;
  }, new Map());

  const chartPoints = [...designationCounts.entries()].slice(0, 6);
  if (!chartPoints.length) {
    return null;
  }

  return {
    type: "pie",
    data: {
      labels: chartPoints.map(([label]) => label),
      datasets: [
        {
          label: "Faculty Distribution",
          data: chartPoints.map(([, value]) => value),
          backgroundColor: [
            "#1d4ed8",
            "#059669",
            "#dc2626",
            "#d97706",
            "#7c3aed",
            "#0f766e",
          ],
        },
      ],
    },
  };
};

const buildFacultyInsights = (rows = [], appliedFilters = [], selectedDepartment = null) => {
  const scope = selectedDepartment?.code || selectedDepartment?.name || "the selected faculty set";
  const experienceValues = rows
    .map((row) => Number(row.experience))
    .filter((value) => Number.isFinite(value));
  const averageExperience = experienceValues.length
    ? roundTo(
        experienceValues.reduce((sum, value) => sum + value, 0) / experienceValues.length
      )
    : null;
  const specializationCount = [
    ...new Set(rows.map((row) => String(row.specialization || "").trim()).filter(Boolean)),
  ].length;

  const insights = [
    `${rows.length} faculty records matched the strict query for ${scope}.`,
  ];
  const recommendations = [];

  if (averageExperience !== null) {
    insights.push(`Average faculty experience in this result set is ${averageExperience} years.`);
  }

  if (specializationCount) {
    insights.push(`The matched faculty set spans ${specializationCount} specialization areas.`);
  }

  if (appliedFilters.some((filter) => filter.field === "specialization")) {
    recommendations.push("Align workload planning and elective scheduling with the filtered specialization group.");
  }

  if (appliedFilters.some((filter) => filter.field === "experience")) {
    recommendations.push("Use the filtered experience band for mentoring allocation and academic leadership assignments.");
  }

  if (appliedFilters.some((filter) => filter.field === "designation")) {
    recommendations.push("Review the designation mix in this cohort before assigning accreditation and committee responsibilities.");
  }

  return {
    insights,
    recommendations: recommendations.length
      ? recommendations
      : ["Review the filtered faculty cohort for department workload balance and subject allocation."],
  };
};

const buildStrictScopeSuffix = (
  selectedDepartment = null,
  yearContext = null,
  appliedFilters = []
) => {
  const scopeParts = [];
  const departmentLabel = selectedDepartment?.code || selectedDepartment?.name || null;
  const yearLabel = getYearScopeLabel(yearContext);

  if (departmentLabel) {
    scopeParts.push(departmentLabel);
  }

  if (yearLabel) {
    scopeParts.push(yearLabel);
  }

  const backlogFilter = appliedFilters.find((filter) => filter.field === "backlog");
  const backlogLabel =
    backlogFilter?.value === true
      ? "with pending backlogs"
      : backlogFilter?.value === false
        ? "without backlogs"
        : null;

  const scope = scopeParts.length ? ` in ${scopeParts.join(", ")}` : "";
  return `${scope}${backlogLabel ? ` ${backlogLabel}` : ""}`;
};

const buildStrictNoMatchReply = (
  entity = "records",
  selectedDepartment = null,
  yearContext = null,
  appliedFilters = []
) => {
  const scopeSuffix = buildStrictScopeSuffix(
    selectedDepartment,
    yearContext,
    appliedFilters
  );
  const suggestions = [];

  if (selectedDepartment) {
    suggestions.push("department");
  }

  if (yearContext?.hasYear) {
    suggestions.push(yearContext.batchYear !== null ? "batch year" : "year");
  }

  if (appliedFilters.some((filter) => filter.field === "backlog")) {
    suggestions.push("backlog");
  }

  const baseReply = `I could not find ${entity}${scopeSuffix}.`;
  if (!suggestions.length) {
    return baseReply;
  }

  return `${baseReply} Tell me which filter to relax: ${suggestions.join(", ")}.`;
};

const shouldUseStrictEntityQueryEngine = (message = "") => {
  const normalized = normalizeText(message);
  if (
    !normalized ||
    REPORT_WORD_PATTERN.test(normalized) ||
    INSIGHT_WORD_PATTERN.test(normalized) ||
    isSingleQuery(message)
  ) {
    return false;
  }

  if (PLACEMENT_RECRUITMENT_PATTERN.test(normalized)) {
    return false;
  }

  const entity = detectStrictEntity(message);
  if (!entity) {
    return false;
  }

  return (
    isListQuery(message) ||
    isCountQuery(message) ||
    COUNT_WORD_PATTERN.test(normalized) ||
    Boolean(parseDepartmentFilter(message)) ||
    STUDENT_SIGNAL_PATTERN.test(normalized) ||
    FACULTY_SIGNAL_PATTERN.test(normalized) ||
    /[<>]=?|=/.test(normalized)
  );
};

const resolveStrictEntityQuery = async ({
  message = "",
  liveFacts = {},
  parsedQuery = null,
} = {}) => {
  if (!shouldUseStrictEntityQueryEngine(message)) {
    return null;
  }

  const detectedEntity = detectStrictEntity(message);
  if (!detectedEntity) {
    return null;
  }

  const parameterPlan = parsedQuery || extractQueryParameters(message);
  if (parameterPlan?.entity === "placements") {
    return null;
  }
  const yearContext = resolveYearFilterContext({
    message,
    entity: detectedEntity,
    filters: parameterPlan.filters || {},
  });
  if (
    yearContext?.hasYear &&
    ((detectedEntity === "student" && yearContext.batchYear === null) ||
      (detectedEntity === "faculty" && yearContext.hasYear))
  ) {
    return null;
  }

  const filtersExtracted = extractStrictFilters(message, detectedEntity);
  const validatedFilters = validateStrictFilters(detectedEntity, filtersExtracted);
  const routeContext = await buildEntityQuery(message, detectedEntity, {
    parsedFilters: parameterPlan.filters || {},
  });

  if (!routeContext || routeContext.unsupportedYearFilter) {
    return null;
  }

  const {
    query,
    appliedFilters,
    selectedDepartment,
  } = await buildStrictQuery(detectedEntity, validatedFilters, {
    baseQuery: routeContext.query,
    initialSelectedDepartment: routeContext.selectedDepartment,
  });

  const debug = {
    detected_entity: detectedEntity,
    filters_extracted: validatedFilters,
    final_query: serializeValue(query),
  };
  console.log("Strict Query Debug:", debug);

  if (isCountQuery(message)) {
    const Model = detectedEntity === "student" ? Student : Faculty;
    const total = await Model.countDocuments(query);

    return {
      success: true,
      type: "count",
      entity: detectedEntity,
      total,
      count: total,
      value: total,
      rows: [],
      data: [],
      applied_filters: appliedFilters,
      filters_applied: appliedFilters,
      debug,
      responseType: "count",
      provider: "database",
      sourceDatabase: liveFacts.sourceDatabase || "mongodb",
      usedLiveData: true,
      message: `Total ${detectedEntity}${total === 1 ? "" : "s"}${buildStrictScopeSuffix(
        selectedDepartment,
        routeContext.yearContext,
        appliedFilters
      )}: ${total}`,
      reply: `Total ${detectedEntity}${total === 1 ? "" : "s"}${buildStrictScopeSuffix(
        selectedDepartment,
        routeContext.yearContext,
        appliedFilters
      )}: ${total}`,
      smartProcessed: true,
      meta: {
        detected_entity: detectedEntity,
      },
    };
  }

  if (detectedEntity === "student") {
    const students = await Student.find(query)
      .select(
        "name rollNumber email department batchYear cgpa academicRecords.avgAttendance currentBacklogs performanceCategory"
      )
      .populate("department", "name code")
      .sort({
        cgpa: 1,
        "academicRecords.avgAttendance": 1,
        currentBacklogs: -1,
        name: 1,
      })
      .lean();
    const rows = students.map(mapStudentRow);
    const chart = buildInstitutionalChart({
      message,
      students,
      rows,
      filtersApplied: appliedFilters,
    });
    const insightData = await buildInstitutionalInsights({
      message,
      rows,
      chart,
      filtersApplied: appliedFilters,
      selectedDepartment,
    });

    return {
      success: true,
      type: "data",
      entity: "student",
      total: rows.length,
      count: rows.length,
      totalRecords: rows.length,
      returnedRecords: rows.length,
      rows,
      data: rows,
      contextData: rows,
      extraData: rows,
      applied_filters: appliedFilters,
      filters_applied: appliedFilters,
      chart,
      insights: insightData.insights,
      recommendations: insightData.recommendations,
      debug,
      title: "Strict Student Query",
      reply: rows.length
        ? `I found ${rows.length} students matching the strict filters${buildStrictScopeSuffix(
            selectedDepartment,
            routeContext.yearContext,
            appliedFilters
          )}.`
        : buildStrictNoMatchReply(
            "students",
            selectedDepartment,
            routeContext.yearContext,
            appliedFilters
          ),
      responseType: rows.length ? "table" : "text",
      provider: insightData.provider || "database",
      model: insightData.model || null,
      sourceDatabase: liveFacts.sourceDatabase || "mongodb",
      usedLiveData: true,
      smartProcessed: true,
      summary: {
        count: rows.length,
        department: selectedDepartment?.code || selectedDepartment?.name || null,
        yearScope: getYearScopeLabel(routeContext.yearContext),
      },
      meta: {
        detected_entity: detectedEntity,
      },
    };
  }

  const faculty = await Faculty.find(query)
    .select("name email department designation specialization qualification experience")
    .populate("department", "name code")
    .sort({ experience: -1, name: 1 })
    .lean();
  const rows = faculty.map(mapFacultyRow);
  const facultyInsights = buildFacultyInsights(rows, appliedFilters, selectedDepartment);

  return {
    success: true,
    type: "data",
    entity: "faculty",
    total: rows.length,
    count: rows.length,
    totalRecords: rows.length,
    returnedRecords: rows.length,
    rows,
    data: rows,
    contextData: rows,
    extraData: rows,
    applied_filters: appliedFilters,
    filters_applied: appliedFilters,
    chart: buildFacultyChart(rows, appliedFilters),
    insights: facultyInsights.insights,
    recommendations: facultyInsights.recommendations,
    debug,
    title: "Strict Faculty Query",
    reply: rows.length
      ? `I found ${rows.length} faculty records matching the strict filters${buildStrictScopeSuffix(
          selectedDepartment,
          routeContext.yearContext,
          appliedFilters
        )}.`
      : buildStrictNoMatchReply(
          "faculty records",
          selectedDepartment,
          routeContext.yearContext,
          appliedFilters
        ),
    responseType: rows.length ? "table" : "text",
    provider: "database",
    sourceDatabase: liveFacts.sourceDatabase || "mongodb",
    usedLiveData: true,
    smartProcessed: true,
    summary: {
      count: rows.length,
      department: selectedDepartment?.code || selectedDepartment?.name || null,
      yearScope: getYearScopeLabel(routeContext.yearContext),
    },
    meta: {
      detected_entity: detectedEntity,
    },
  };
};

module.exports = {
  detectStrictEntity,
  extractStrictFilters,
  resolveStrictEntityQuery,
  shouldUseStrictEntityQueryEngine,
  validateStrictFilters,
};
