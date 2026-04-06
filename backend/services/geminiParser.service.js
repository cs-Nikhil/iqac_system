let GoogleGenerativeAI = null;
try {
  ({ GoogleGenerativeAI } = require("@google/generative-ai"));
} catch (error) {
  console.warn("Gemini SDK is not installed.");
}

const PARSER_MODEL =
  process.env.GEMINI_PARSER_MODEL ||
  process.env.GEMINI_MODEL ||
  "gemini-2.5-flash";
const PLACEHOLDER_KEYS = new Set([
  "",
  "your_gemini_api_key_here",
  "replace_with_gemini_api_key",
]);
const ALLOWED_ENTITIES = new Set([
  "student",
  "faculty",
  "department",
  "placement",
  "event",
]);
const ALLOWED_INTENTS = new Set([
  "data",
  "report",
  "insight",
  "count",
  "chat",
]);
const ANALYTICS_FIELDS = new Set([
  "cgpa",
  "attendance",
  "department",
  "backlog",
]);
const ANALYTICS_OPERATORS = new Set(["<", ">", "=", "<=", ">="]);
const ALLOWED_OPERATORS = new Set([
  "$and",
  "$eq",
  "$gt",
  "$gte",
  "$in",
  "$lt",
  "$lte",
  "$ne",
  "$nin",
  "$or",
]);
const MAX_FILTER_DEPTH = 6;

const rawApiKey = (process.env.GEMINI_API_KEY || "").trim();
const hasUsableApiKey = rawApiKey && !PLACEHOLDER_KEYS.has(rawApiKey);

const genAI =
  GoogleGenerativeAI && hasUsableApiKey
    ? new GoogleGenerativeAI(rawApiKey)
    : null;

const isPlainObject = (value) =>
  Boolean(value) &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  !(value instanceof Date);

const extractJsonBlock = (value = "") => {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text;
};

const normalizeEntity = (value = null) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return ALLOWED_ENTITIES.has(normalized) ? normalized : null;
};

const normalizeIntent = (value = null) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return ALLOWED_INTENTS.has(normalized) ? normalized : null;
};

const normalizeDepartmentValue = (value) => {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? normalized.toUpperCase() : null;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  if (typeof value.$eq === "string") {
    return normalizeDepartmentValue(value.$eq);
  }

  if (typeof value.code === "string") {
    return normalizeDepartmentValue(value.code);
  }

  if (typeof value.name === "string") {
    return value.name.trim() || null;
  }

  return null;
};

const sanitizeFilterValue = (value, depth = 0) => {
  if (depth > MAX_FILTER_DEPTH) {
    return undefined;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const sanitizedItems = value
      .map((item) => sanitizeFilterValue(item, depth + 1))
      .filter((item) => item !== undefined);

    return sanitizedItems;
  }

  if (!isPlainObject(value)) {
    return undefined;
  }

  const sanitizedObject = Object.entries(value).reduce((result, [key, item]) => {
    if (!key || key === "__proto__" || key === "constructor" || key === "prototype") {
      return result;
    }

    if (key.startsWith("$") && !ALLOWED_OPERATORS.has(key)) {
      return result;
    }

    const sanitizedItem = sanitizeFilterValue(item, depth + 1);
    if (sanitizedItem !== undefined) {
      result[key] = sanitizedItem;
    }

    return result;
  }, {});

  return Object.keys(sanitizedObject).length ? sanitizedObject : undefined;
};

const normalizeFilters = (value = {}) => {
  const sanitized = sanitizeFilterValue(value);
  if (!isPlainObject(sanitized)) {
    return {};
  }

  const filters = { ...sanitized };
  const explicitDepartment =
    normalizeDepartmentValue(filters.department) ||
    normalizeDepartmentValue(filters.departmentCode) ||
    normalizeDepartmentValue(filters["department.code"]);

  if (explicitDepartment) {
    filters.department = explicitDepartment;
  }

  delete filters.departmentCode;
  delete filters["department.code"];

  return filters;
};

const normalizeAnalyticsField = (value = null) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "academicrecords.avgattendance") {
    return "attendance";
  }

  if (normalized === "currentbacklogs" || normalized === "backlogs") {
    return "backlog";
  }

  return ANALYTICS_FIELDS.has(normalized) ? normalized : null;
};

const normalizeAnalyticsOperator = (value = null) => {
  const normalized = String(value || "").trim();
  return ANALYTICS_OPERATORS.has(normalized) ? normalized : null;
};

const normalizeAnalyticsValue = (field = "", value = null) => {
  if (field === "department") {
    const normalized = String(value || "").trim();
    return normalized ? normalized.toUpperCase() : null;
  }

  if (field === "backlog") {
    if (typeof value === "boolean") {
      return value;
    }

    const normalized = String(value || "")
      .trim()
      .toLowerCase();

    if (["true", "yes", "with", "has", "have", "pending", "active"].includes(normalized)) {
      return true;
    }

    if (["false", "no", "without", "none", "zero"].includes(normalized)) {
      return false;
    }

    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeAnalyticsFilter = (filter = {}) => {
  if (!isPlainObject(filter)) {
    return null;
  }

  const field = normalizeAnalyticsField(filter.field);
  const operator = normalizeAnalyticsOperator(filter.operator);
  const value = normalizeAnalyticsValue(field, filter.value);

  if (!field || !operator || value === null) {
    return null;
  }

  if ((field === "department" || field === "backlog") && operator !== "=") {
    return null;
  }

  return {
    field,
    operator,
    value,
  };
};

const parseGeminiJson = (value = "") => {
  const jsonBlock = extractJsonBlock(value);
  if (!jsonBlock) {
    return null;
  }

  try {
    return JSON.parse(jsonBlock);
  } catch (error) {
    return null;
  }
};

const parseWithGemini = async (message = "") => {
  const userMessage = String(message || "").trim();
  if (!userMessage || !genAI) {
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: PARSER_MODEL,
      generationConfig: {
        maxOutputTokens: 256,
        temperature: 0,
      },
    });

    const prompt = `Convert the user query into strict JSON.

Return this shape only:
{
  "entity": "student|faculty|department|placement|event|null",
  "intent": "data|report|count|insight|chat|null",
  "filters": {}
}

Rules:
- Return only valid JSON. No markdown, no commentary.
- Use null when a field is unclear.
- Use Mongo-style filters for numeric comparisons, such as {"cgpa":{"$gt":8}}.
- For department filters, use {"department":"CSE"} or the department name string.
- Infer the most likely numeric field only when the query strongly implies it.
- Supported entities are student, faculty, department, placement, and event.

Query: "${userMessage}"`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const parsed = parseGeminiJson(response.text());

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      entity: normalizeEntity(parsed.entity),
      intent: normalizeIntent(parsed.intent),
      filters: normalizeFilters(parsed.filters),
    };
  } catch (error) {
    console.error("Gemini Parser Error:", error.message);
    return null;
  }
};

const parseAnalyticsFiltersWithGemini = async (message = "") => {
  const userMessage = String(message || "").trim();
  if (!userMessage || !genAI) {
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: PARSER_MODEL,
      generationConfig: {
        maxOutputTokens: 256,
        temperature: 0,
      },
    });

    const prompt = `Convert the student analytics query into strict JSON.

Return only this JSON shape:
{
  "filters": [
    { "field": "cgpa|attendance|department|backlog", "operator": "<|>|=|<=|>=", "value": "" }
  ]
}

Rules:
- Supported fields are only cgpa, attendance, department, and backlog.
- Backlog must use "=" with true or false.
- Department must use "=" with a department code such as CSE, IT, ECE, MECH, or CIVIL.
- Ignore filler words and unsupported conditions.
- Return ONLY valid JSON, with no markdown and no explanation.

Query: "${userMessage}"`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const parsed = parseGeminiJson(response.text());
    const filters = Array.isArray(parsed?.filters)
      ? parsed.filters.map((filter) => normalizeAnalyticsFilter(filter)).filter(Boolean)
      : [];

    return {
      filters,
    };
  } catch (error) {
    console.error("Gemini Analytics Parser Error:", error.message);
    return null;
  }
};

module.exports = {
  parseAnalyticsFiltersWithGemini,
  parseWithGemini,
};
