const Department = require("../models/Department");

const STRICT_DEPARTMENT_ALIASES = {
  cse: "CSE",
  it: "IT",
  ece: "ECE",
  mech: "MECH",
  mechanical: "MECH",
  civil: "CIVIL",
};

const EXCLUDED_NUMERIC_FIELDS = new Set(["_id", "__v"]);

const normalize = (v = "") => String(v).toLowerCase().trim();

const isPlainObject = (v) =>
  v && typeof v === "object" && !Array.isArray(v);

const extractNumbers = (message = "") => {
  const matches = message.match(/-?\d+(?:\.\d+)?/g);
  return matches ? matches.map(Number) : [];
};

const detectOperator = (text = "") => {
  if (text.includes(">=")) return "$gte";
  if (text.includes("<=")) return "$lte";
  if (text.includes(">")) return "$gt";
  if (text.includes("<")) return "$lt";
  if (text.includes("=")) return "$eq";

  if (/\b(above|greater|higher|over)\b/i.test(text)) return "$gt";
  if (/\b(below|less|lower|under)\b/i.test(text)) return "$lt";
  if (/\b(equal|exact)\b/i.test(text)) return "$eq";

  return null;
};

const splitConditions = (message = "") =>
  message
    .split(/\band\b|\bor\b|,/i)
    .map((s) => s.trim())
    .filter(Boolean);

const detectJoiner = (message = "") =>
  /\bor\b/i.test(message) ? "$or" : "$and";

const collectNumericFields = (obj, prefix = "", result = []) => {
  if (!isPlainObject(obj)) return result;

  Object.entries(obj).forEach(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;

    if (EXCLUDED_NUMERIC_FIELDS.has(path)) return;

    if (typeof v === "number") {
      result.push(path);
    } else if (isPlainObject(v)) {
      collectNumericFields(v, path, result);
    }
  });

  return result;
};

const scoreField = (message, field) => {
  const msg = normalize(message);
  const tokens = field.split(/[\._]/);

  let score = 0;

  tokens.forEach((t) => {
    if (msg.includes(t)) score += 3;
  });

  if (msg.includes(field)) score += 5;

  return score;
};

const detectBestField = (message, sampleData = {}, model = null) => {
  const sample =
    Array.isArray(sampleData) ? sampleData[0] : sampleData;

  let fields = collectNumericFields(sample || {});

  if (model?.schema?.paths) {
    fields = [
      ...fields,
      ...Object.entries(model.schema.paths)
        .filter(([k, v]) => v.instance === "Number")
        .map(([k]) => k),
    ];
  }

  fields = [...new Set(fields)];

  const ranked = fields
    .map((f) => ({
      field: f,
      score: scoreField(message, f),
    }))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.field || null;
};

const parseAdvancedFilters = (message = "", options = {}) => {
  const parts = splitConditions(message);
  const joiner = detectJoiner(message);

  const conditions = parts
    .map((part) => {
      const operator = detectOperator(part);
      const value = extractNumbers(part)[0];

      const field = detectBestField(
        part,
        options.sampleData,
        options.model
      );

      if (!field || !operator || value === undefined) return null;

      return { field, operator, value };
    })
    .filter(Boolean);

  return { conditions, joiner };
};

const buildMongoFilter = (conditions = [], joiner = "$and") => {
  if (!conditions.length) return {};

  const clauses = conditions.map((c) => {
    if (c.operator === "$eq") {
      return { [c.field]: c.value };
    }
    return { [c.field]: { [c.operator]: c.value } };
  });

  return clauses.length === 1
    ? clauses[0]
    : { [joiner]: clauses };
};

const buildDynamicFilter = (message = "", options = {}) => {
  const { conditions, joiner } = parseAdvancedFilters(
    message,
    options
  );

  return buildMongoFilter(conditions, joiner);
};

const escapeRegExp = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildBoundaryPattern = (value = "", caseSensitive = false) =>
  new RegExp(`(^|\\b)${escapeRegExp(String(value).trim())}(?=\\b|$)`, caseSensitive ? "" : "i");

const findPatternIndex = (text = "", pattern) => {
  const match = String(text).match(pattern);
  return typeof match?.index === "number" ? match.index : -1;
};

const ALIASES_BY_CODE = Object.entries(STRICT_DEPARTMENT_ALIASES).reduce(
  (result, [alias, code]) => {
    if (!result[code]) {
      result[code] = [];
    }
    result[code].push(alias);
    return result;
  },
  {}
);

const findDepartmentTermIndex = (
  originalMessage = "",
  normalizedMessage = "",
  term = ""
) => {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) {
    return -1;
  }

  if (normalizedTerm.length <= 2) {
    const exactCodeIndex = findPatternIndex(
      originalMessage,
      buildBoundaryPattern(String(term).toUpperCase(), true)
    );
    if (exactCodeIndex >= 0) {
      return exactCodeIndex;
    }

    return findPatternIndex(
      normalizedMessage,
      new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b(?=\\s+department\\b)`, "i")
    );
  }

  return findPatternIndex(normalizedMessage, buildBoundaryPattern(normalizedTerm));
};

const resolveMentionedDepartments = async (message = "", filters = {}) => {
  const normalizedMessage = normalize(message);
  const filterHints = [
    filters?.department,
    filters?.departmentCode,
    filters?.["department.code"],
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
  const originalSearchText = `${String(message || "")} ${filterHints}`.trim();
  const normalizedSearchText = normalize(originalSearchText);

  const departments = await Department.find({ isActive: true })
    .select("name code")
    .lean();

  return departments
    .map((department) => {
      const terms = [
        department.code,
        department.name,
        ...(ALIASES_BY_CODE[String(department.code || "").toUpperCase()] || []),
      ].filter(Boolean);
      const matchIndexes = terms
        .map((term) =>
          findDepartmentTermIndex(
            originalSearchText,
            normalizedSearchText || normalizedMessage,
            term
          )
        )
        .filter((index) => index >= 0);

      return {
        department,
        index: matchIndexes.length ? Math.min(...matchIndexes) : -1,
      };
    })
    .filter((item) => item.index >= 0)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.department)
    .filter(
      (department, index, array) =>
        array.findIndex((candidate) => String(candidate._id) === String(department._id)) === index
    );
};

const resolveDepartmentFilter = async (message = "", filters = {}) => {
  const matches = await resolveMentionedDepartments(message, filters);
  return matches[0] || null;
};
const extractFilters = (message = "", options = {}) => {
  return buildDynamicFilter(message, options);
};


module.exports = {
  buildDynamicFilter,
  buildMongoFilter,
  detectOperator,
  extractNumbers,
  parseAdvancedFilters,
  resolveMentionedDepartments,
  resolveDepartmentFilter,
  extractFilters,
};
