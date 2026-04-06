const {
  extractQueryParameters,
} = require("./queryParameterExtractor.service");

const PLAN_MODE_VALUES = new Set([
  "report_plan",
  "report-plan",
  "reportplanner",
  "report_planner",
  "report-planner",
]);

const REPORT_PLAN_REQUEST_PATTERN =
  /\b(report plan|report planner|report execution plan|structured report plan)\b/i;
const REPORT_REQUEST_PATTERN =
  /\b(?:generate|create|show|build|return|give|prepare)?\s*(?:a\s+|an\s+|the\s+)?report\b/i;

const normalizeText = (value = "") => String(value || "").trim();
const normalizeLower = (value = "") => normalizeText(value).toLowerCase();

const shouldBuildReportExecutionPlan = ({ message = "", payload = {} } = {}) => {
  const mode = normalizeLower(payload.mode || payload.queryMode || payload.queryType);

  if (PLAN_MODE_VALUES.has(mode) || payload.reportPlannerOnly === true) {
    return true;
  }

  return REPORT_PLAN_REQUEST_PATTERN.test(normalizeText(message));
};

const stripPlanningInstruction = (message = "") => {
  const raw = normalizeText(message);
  const stripped = raw
    .replace(
      /\b(?:please\s+)?(?:convert|create|generate|build|return|give|show)\b[^:]{0,80}\b(?:report plan|report planner|report execution plan|structured report plan)\b[:\s-]*/i,
      ""
    )
    .replace(
      /\b(?:report plan|report planner|report execution plan|structured report plan)\b[:\s-]*/gi,
      ""
    )
    .replace(/^for\s+/i, "")
    .trim();

  return stripped || raw;
};

const detectReportType = (message = "") =>
  REPORT_REQUEST_PATTERN.test(normalizeLower(message)) ? "report" : "data";

const getFallbackSortField = (entity = null) => {
  switch (entity) {
    case "research_papers":
      return "relevance_or_citations";
    case "faculty":
      return "relevance_or_experience";
    case "students":
      return "relevance_or_cgpa";
    case "placements":
      return "relevance_or_package";
    case "departments":
      return "relevance_or_performance";
    case "events":
    case "achievements":
      return "relevance_or_date";
    case "documents":
      return "relevance_or_date";
    case "naac":
      return "relevance_or_status";
    case "nba":
      return "relevance_or_score";
    default:
      return "relevance";
  }
};

const buildRankingSort = (message = "", entity = null) => {
  const normalized = normalizeLower(message);

  if (!/\b(?:top|first)\s+\d+\b/.test(normalized)) {
    return null;
  }

  return {
    [getFallbackSortField(entity)]: "desc",
  };
};

const buildReportExecutionPlan = (message = "") => {
  const normalizedMessage = stripPlanningInstruction(message);
  const parameterPlan = extractQueryParameters(normalizedMessage);
  const normalizedSort =
    parameterPlan.sort || buildRankingSort(normalizedMessage, parameterPlan.entity);

  return {
    type: detectReportType(normalizedMessage),
    entity: parameterPlan.entity,
    filters: parameterPlan.filters || {},
    sort: normalizedSort,
    limit: parameterPlan.limit,
  };
};

module.exports = {
  buildReportExecutionPlan,
  shouldBuildReportExecutionPlan,
};
