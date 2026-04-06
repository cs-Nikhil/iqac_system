const {
  extractQueryParameters,
} = require("./queryParameterExtractor.service");

const PLAN_MODE_VALUES = new Set([
  "query_routing",
  "query-routing",
  "query_router",
  "query-router",
  "routing",
  "routing_decision",
  "routing-decision",
]);

const QUERY_ROUTING_REQUEST_PATTERN =
  /\b(query routing|route query|query router|routing decision|local or llm|llm or local|should this use llm|should this be handled by llm)\b/i;
const REPORT_REQUEST_PATTERN =
  /\b(?:generate|create|show|build|return|give|prepare)?\s*(?:a\s+|an\s+|the\s+)?report\b/i;
const CONDITION_LANGUAGE_PATTERN =
  /\b(who|with|having|that|which|where|whose)\b/i;
const RANKING_PATTERN =
  /\b(top|highest|lowest|best|ranked|ranking|sort(?:ed)? by|order(?:ed)? by|first)\b/i;
const DOMAIN_SPECIFIC_PATTERN =
  /\b(research papers?|publications?|citations?|impact factor|doi|faculty teaching|teach(?:es|ing)?|taught|dbms|networks|os|operating systems|machine learning|deep learning|ai|nlp|data mining)\b/i;
const AMBIGUITY_PATTERN =
  /\b(compare|comparison|relevant|suitable|focus on|related to|about|analysis|summary|overview)\b/i;
const SIMPLE_ENTITY_FETCH_PATTERN =
  /^(?:show|list|get|fetch|display|give(?: me)?|find)?\s*(?:all\s+)?(?:students?|faculty|faculties|departments?|placements?|research papers?|courses?|events?|achievements?|documents?|users?)\s*$/i;

const normalizeText = (value = "") => String(value || "").trim();
const normalizeLower = (value = "") => normalizeText(value).toLowerCase();
const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const clampConfidence = (value = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(1, numeric));
};

const stripRoutingInstruction = (message = "") => {
  const raw = normalizeText(message);
  const stripped = raw
    .replace(
      /\b(?:please\s+)?(?:classify|decide|determine|return|show|give|build|create|route)\b[^:]{0,120}\b(?:query routing|route query|query router|routing decision|local or llm|llm or local)\b[:\s-]*/i,
      ""
    )
    .replace(
      /\b(?:query routing|route query|query router|routing decision|local or llm|llm or local)\b[:\s-]*/gi,
      ""
    )
    .replace(/^for\s+/i, "")
    .trim();

  return stripped || raw;
};

const countAtomicFilters = (filters = null) => {
  if (!isPlainObject(filters)) {
    return 0;
  }

  return Object.entries(filters).reduce((count, [key, value]) => {
    if ((key === "$and" || key === "$or") && Array.isArray(value)) {
      return count + value.reduce((sum, item) => sum + countAtomicFilters(item), 0);
    }

    return count + 1;
  }, 0);
};

const buildDecision = (route, reason, confidence) => ({
  route,
  reason,
  confidence: clampConfidence(confidence),
});

const shouldBuildQueryRoutingDecision = ({ message = "", payload = {} } = {}) => {
  const mode = normalizeLower(payload.mode || payload.queryMode || payload.queryType);

  if (PLAN_MODE_VALUES.has(mode) || payload.routingOnly === true) {
    return true;
  }

  return QUERY_ROUTING_REQUEST_PATTERN.test(normalizeText(message));
};

const buildQueryRoutingDecision = (message = "") => {
  const normalizedMessage = stripRoutingInstruction(message);
  const queryPlan = extractQueryParameters(normalizedMessage);
  const filterCount = countAtomicFilters(queryPlan.filters);
  const normalized = normalizeLower(normalizedMessage);
  const hasConditionLanguage = CONDITION_LANGUAGE_PATTERN.test(normalized);
  const hasMultipleConditions = filterCount > 1;
  const hasRanking =
    RANKING_PATTERN.test(normalized) ||
    Boolean(queryPlan.sort) ||
    queryPlan.limit !== null;
  const hasReportRequest = REPORT_REQUEST_PATTERN.test(normalized);
  const hasReportWithContext =
    hasReportRequest &&
    (queryPlan.hasFilters || hasConditionLanguage || hasRanking);
  const hasFilters = Boolean(queryPlan.hasFilters);
  const hasDomainSpecificLanguage = DOMAIN_SPECIFIC_PATTERN.test(normalized);
  const isSimpleEntityFetch =
    SIMPLE_ENTITY_FETCH_PATTERN.test(normalized) &&
    !hasFilters &&
    !hasRanking &&
    !hasConditionLanguage &&
    !hasReportRequest;
  const isAmbiguous =
    !isSimpleEntityFetch &&
    !hasFilters &&
    !hasRanking &&
    (AMBIGUITY_PATTERN.test(normalized) || !queryPlan.entity);

  if (hasReportWithContext) {
    return buildDecision(
      "llm",
      "Report request with contextual scope is better handled semantically.",
      0.98
    );
  }

  if (hasMultipleConditions) {
    return buildDecision(
      "llm",
      "Multiple filters were detected in the same query.",
      0.97
    );
  }


  if (hasRanking) {
    return buildDecision(
      "llm",
      "Ranking or top-N language requires richer interpretation.",
      0.95
    );
  }

  if (hasConditionLanguage) {
    return buildDecision(
      "llm",
      "Condition and filter language was detected.",
      0.94
    );
  }

  if (hasFilters) {
    return buildDecision(
      "llm",
      "The query includes filter scope beyond a simple entity fetch.",
      0.92
    );
  }

  if (hasDomainSpecificLanguage) {
    return buildDecision(
      "llm",
      "Domain-specific language suggests semantic understanding is needed.",
      0.9
    );
  }

  if (isSimpleEntityFetch) {
    return buildDecision(
      "local",
      "Simple entity fetch with no filters or ranking detected.",
      0.97
    );
  }

  if (isAmbiguous) {
    return buildDecision(
      "llm",
      "The query may require interpretation beyond direct keyword matching.",
      0.84
    );
  }
  if (/\bwho\b/.test(normalized)) {
    return buildDecision("llm", "Explicit condition detected", 0.99);
  }

  return buildDecision(
    "llm",
    "Defaulting to semantic routing because the query is not a simple fetch.",
    0.8
  );
};

module.exports = {
  buildQueryRoutingDecision,
  shouldBuildQueryRoutingDecision,
};
