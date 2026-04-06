const Student = require("../models/Student");
const {
  extractFilters,
  parseAdvancedFilters,
} = require("./chatbotFilter.service");
const {
  parseAnalyticsFiltersWithGemini,
} = require("./geminiParser.service");
const {
  isCountQuery,
} = require("./chatbotCount.service");

const DB_OPERATOR_TO_SYMBOL = {
  $lt: "<",
  $lte: "<=",
  $gt: ">",
  $gte: ">=",
  $eq: "=",
};

const ANALYTICS_TRIGGER_PATTERN =
  /\bstudents?\b.*\b(cgpa|attendance|backlog|backlogs)\b|\b(cgpa|attendance|backlog|backlogs)\b.*\bstudents?\b/i;

const normalizeField = (value = "") => {
  const normalized = String(value || "").trim();

  if (normalized === "cgpa") {
    return "cgpa";
  }

  if (
    normalized === "academicRecords.avgAttendance" ||
    normalized === "avgAttendance" ||
    normalized === "attendance"
  ) {
    return "attendance";
  }

  if (normalized === "currentBacklogs" || normalized === "backlogs") {
    return "backlog";
  }

  return null;
};

const normalizeDepartmentFilter = (message = "") => {
  const filters = extractFilters(message);
  return filters.department
    ? {
        field: "department",
        operator: "=",
        value: String(filters.department).toUpperCase(),
      }
    : null;
};

const parseBacklogBooleanFilter = (message = "") => {
  const normalized = String(message || "").toLowerCase();
  if (!/\bbacklog|backlogs\b/.test(normalized)) {
    return null;
  }

  if (
    /\b(without|no)\s+backlogs?\b/.test(normalized) ||
    /\bbacklogs?\s*(?:=|is|are)?\s*(false|no|none|zero)\b/.test(normalized)
  ) {
    return {
      field: "backlog",
      operator: "=",
      value: false,
    };
  }

  if (
    /\b(with|has|have)\s+backlogs?\b/.test(normalized) ||
    /\bbacklogs?\s*(?:=|is|are)?\s*(true|yes)\b/.test(normalized)
  ) {
    return {
      field: "backlog",
      operator: "=",
      value: true,
    };
  }

  return null;
};

const dedupeFilters = (filters = []) => {
  const seen = new Set();

  return filters.filter((filter) => {
    const key = `${filter.field}:${filter.operator}:${String(filter.value)}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const mergeFilters = (primary = [], fallback = []) =>
  dedupeFilters([
    ...(Array.isArray(primary) ? primary : []),
    ...(Array.isArray(fallback) ? fallback : []),
  ]);

const parseLocalAnalyticsFilters = (message = "") => {
  const parsed = parseAdvancedFilters(message, {
    model: Student,
    target: "student",
    fieldCatalogs: [
      {
        model: Student,
        target: "student",
        numericFields: ["cgpa", "academicRecords.avgAttendance"],
      },
    ],
  });

  const numericFilters = parsed.conditions
    .map((condition) => {
      const field = normalizeField(condition.dbField || condition.field);
      const operator = DB_OPERATOR_TO_SYMBOL[condition.operator];

      if (!field || !operator) {
        return null;
      }

      return {
        field,
        operator,
        value: condition.value,
      };
    })
    .filter(Boolean);

  return dedupeFilters([
    ...numericFilters,
    normalizeDepartmentFilter(message),
    parseBacklogBooleanFilter(message),
  ].filter(Boolean));
};

const shouldUseInstitutionalQueryParser = (message = "") =>
  ANALYTICS_TRIGGER_PATTERN.test(String(message || "")) ||
  Boolean(normalizeDepartmentFilter(message));

const parseInstitutionalQuery = async (message = "") => {
  const geminiResult = await parseAnalyticsFiltersWithGemini(message);
  const localFilters = parseLocalAnalyticsFilters(message);
  const geminiFilters = Array.isArray(geminiResult?.filters)
    ? mergeFilters(geminiResult.filters, localFilters)
    : [];

  if (geminiFilters.length) {
    return {
      entity: "student",
      intent: isCountQuery(message) ? "count" : "data",
      source: "gemini",
      filters: geminiFilters,
    };
  }

  return {
    entity: "student",
    intent: isCountQuery(message) ? "count" : "data",
    source: "local",
    filters: localFilters,
  };
};

module.exports = {
  parseInstitutionalQuery,
  shouldUseInstitutionalQueryParser,
};
