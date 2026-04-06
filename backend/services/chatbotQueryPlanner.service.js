const {
  isContextQuery,
} = require("./chatbotContext.service");
const {
  detectEntity,
  getModel,
  isListQuery,
  isSingleQuery,
} = require("./chatbotEntityData.service");
const {
  detectEntity: detectCountEntity,
  isCountQuery,
} = require("./chatbotCount.service");
const {
  buildDynamicFilter,
  detectOperator,
  extractFilters,
  extractNumbers,
} = require("./chatbotFilter.service");
const {
  parseWithGemini,
} = require("./geminiParser.service");
const {
  buildQueryRoutingDecision,
} = require("./chatbotQueryRouting.service");
const {
  detectIntent,
} = require("./chatbotResponse.service");
const {
  detectEntityType,
  detectReportType,
} = require("./chatbotUniversalReport.service");
const {
  extractQueryParameters,
} = require("./queryParameterExtractor.service");
const { buildRankingSort } = require("./chatbotRanking.service");
const { computeConfidence } = require("./chatbotConfidence.service");

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasMeaningfulPlanFields = (plan = null) =>
  Boolean(
    plan &&
      (plan.intent ||
        plan.entity ||
        (isPlainObject(plan.filters) && Object.keys(plan.filters).length))
  );

const normalizePlannerArgs = (value = {}) =>
  typeof value === "string"
    ? {
        message: value,
        session: null,
      }
    : value || {};

const normalizeInternalSort = (sort = null) => {
  if (!isPlainObject(sort)) {
    return null;
  }

  const [field, order] =
    Object.entries(sort).find(
      ([key, value]) =>
        Boolean(key) && (value === "asc" || value === "desc")
    ) || [];

  if (!field || !order) {
    return null;
  }

  return {
    field,
    order,
  };
};

const mergePlannerFilters = (...filtersList) =>
  filtersList.reduce((result, filters) => {
    if (!isPlainObject(filters)) {
      return result;
    }

    return Object.entries(filters).reduce((next, [key, value]) => {
      if (value === null || value === undefined) {
        return next;
      }

      if (isPlainObject(value) && !Object.keys(value).length) {
        return next;
      }

      next[key] = value;
      return next;
    }, { ...result });
  }, {});

const ADMIN_SPECIFIC_PARAMETER_ENTITIES = new Set([
  "research_papers",
  "achievements",
  "documents",
  "naac",
  "nba",
]);

const getPlannedEntity = (
  message = "",
  intent = "chat",
  parameterEntity = null
) => {
  if (ADMIN_SPECIFIC_PARAMETER_ENTITIES.has(parameterEntity)) {
    return parameterEntity;
  }

  const directEntity = detectEntity(message) || detectCountEntity(message) || null;
  if (directEntity) {
    return directEntity;
  }

  if (intent === "report") {
    return parameterEntity || detectEntityType(message);
  }

  return parameterEntity || null;
};

const buildLocalPlannerFilters = (message = "", entity = null) => {
  const baseFilters = extractFilters(message);
  const Model = entity ? getModel(entity) : null;
  const hasNumericComparison =
    Boolean(Model) &&
    extractNumbers(message).length > 0 &&
    Boolean(detectOperator(message));
  const numericFilters = hasNumericComparison
    ? buildDynamicFilter(message, {
        model: Model,
        target: entity,
      })
    : {};

  return mergePlannerFilters(baseFilters, numericFilters);
};

const buildExecutionIntent = (intent = "chat", session = null) =>
  session?.pendingIntent
    ? "data"
    : intent === "count"
      ? "data"
      : intent;

const buildParsedQueryPayload = ({
  intent = "chat",
  entity = null,
  filters = {},
  sort = null,
  limit = null,
  yearContext = null,
  placementDomain = null,
} = {}) => ({
  intent,
  entity,
  filters: isPlainObject(filters) ? filters : {},
  sort,
  limit,
  yearContext,
  ...(placementDomain ? { placementDomain } : {}),
});

const buildLocalQueryPlan = (options = {}) => {
  const { message = "", session = null } = normalizePlannerArgs(options);
  const localIntent = detectIntent(message);
  const parameterPlan = extractQueryParameters(message);
  const entity = getPlannedEntity(
    message,
    localIntent.intent,
    parameterPlan.entity
  );
  const filters = mergePlannerFilters(
  buildLocalPlannerFilters(message, entity),  // basic filters
  parameterPlan.filters                       // ✅ advanced filters (CRITICAL)
  );
  const routingDecision = buildQueryRoutingDecision(message);
  const normalizedSort = normalizeInternalSort(parameterPlan.sort);

  return {
    planner: "local",
    source: "Local",
    geminiUsed: false,
    confidence: localIntent.confidence ?? 0,
    intent: localIntent.intent || "chat",
    entity,
    filters,
    sort: normalizedSort,
    limit: parameterPlan.limit,
    yearContext: parameterPlan.yearContext || null,
    parsedQuery: buildParsedQueryPayload({
      intent: localIntent.intent || "chat",
      entity,
      filters,
      sort: normalizedSort,
      limit: parameterPlan.limit,
      yearContext: parameterPlan.yearContext || null,
      placementDomain: parameterPlan.placementDomain || null,
    }),
    queryMode: isListQuery(message)
      ? "list"
      : isSingleQuery(message)
        ? "single"
        : null,
    reportType: localIntent.intent === "report" ? detectReportType(message) : null,
    isCount: isCountQuery(message),
    contextQuery: isContextQuery(message) && !filters.department,
    executionIntent: buildExecutionIntent(localIntent.intent || "chat", session),
    routing: routingDecision,
  };
};

const buildGeminiBackedPlan = ({
  message = "",
  session = null,
  localPlan = null,
  geminiPlan = null,
} = {}) => {
  const mergedIntent = geminiPlan.intent || localPlan.intent || "chat";
  const mergedEntity = geminiPlan.entity || localPlan.entity || null;
  const mergedFilters = mergePlannerFilters(localPlan.filters, geminiPlan.filters);
  const mergedSort =
    geminiPlan.sort &&
    typeof geminiPlan.sort === "object" &&
    !Array.isArray(geminiPlan.sort)
      ? {
          field: geminiPlan.sort.field || localPlan.sort?.field || "",
          order: geminiPlan.sort.order || localPlan.sort?.order || "desc",
        }
      : localPlan.sort;
  const mergedLimit =
    Number.isFinite(Number(geminiPlan.limit)) && Number(geminiPlan.limit) > 0
    ? Number(geminiPlan.limit)
    : localPlan.limit;

  return {
    ...localPlan,
    planner: "gemini",
    source: "Gemini",
    geminiUsed: true,
    intent: mergedIntent,
    entity: mergedEntity,
    filters: mergedFilters,
    sort: mergedSort,
    limit: mergedLimit,
    parsedQuery: buildParsedQueryPayload({
      intent: mergedIntent,
      entity: mergedEntity,
      filters: mergedFilters,
      sort: mergedSort,
      limit: mergedLimit,
      yearContext: localPlan.yearContext || null,
      placementDomain:
        geminiPlan.placementDomain || localPlan.parsedQuery?.placementDomain || null,
    }),
    reportType: mergedIntent === "report" ? detectReportType(message) : null,
    isCount: isCountQuery(message) || mergedIntent === "count",
    contextQuery: isContextQuery(message) && !mergedFilters.department,
    executionIntent: buildExecutionIntent(mergedIntent, session),
  };
};

const buildQueryPlan = async ({ message = "", session = null } = {}) => {
  const localPlan = buildLocalQueryPlan({
    message,
    session,
  });

  if (localPlan.routing?.route === "local") {
    return localPlan;
  }

  const geminiPlan = await parseWithGemini(message);
  if (hasMeaningfulPlanFields(geminiPlan)) {
    return buildGeminiBackedPlan({
      message,
      session,
      localPlan,
      geminiPlan,
    });
  }

  const parameterPlan = extractQueryParameters(message);

  return {
    ...localPlan,
    source: "RecoveredFallback",
    planner: "hybrid",
    geminiUsed: false,
    filters: mergePlannerFilters(localPlan.filters, parameterPlan.filters),
    sort: normalizeInternalSort(parameterPlan.sort),
    limit: parameterPlan.limit,
    yearContext: parameterPlan.yearContext || localPlan.yearContext || null,
    parsedQuery: buildParsedQueryPayload({
      intent: localPlan.intent || "chat",
      entity: localPlan.entity,
      filters: mergePlannerFilters(localPlan.filters, parameterPlan.filters),
      sort: normalizeInternalSort(parameterPlan.sort),
      limit: parameterPlan.limit,
      yearContext: parameterPlan.yearContext || localPlan.yearContext || null,
    }),
  };
};

module.exports = {
  buildLocalQueryPlan,
  buildQueryPlan,
};
