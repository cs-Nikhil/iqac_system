const {
  detectEntity,
  getModel,
  buildEntityQuery,
} = require("./chatbotEntityData.service");
const { getYearScopeLabel } = require("./chatbotYearFilter.service");

const COUNT_QUERY_PATTERN = /\b(total|count|how many|number of)\b/i;

const ENTITY_LABELS = {
  student: { singular: "student", plural: "students" },
  faculty: { singular: "faculty member", plural: "faculty members" },
  department: { singular: "department", plural: "departments" },
  placement: { singular: "placement", plural: "placements" },
  event: { singular: "event", plural: "events" },
};

const isCountQuery = (message = "") =>
  COUNT_QUERY_PATTERN.test(String(message));

const toSelectedDepartment = (department = null) =>
  department
    ? {
        _id: String(department._id || ""),
        name: department.name || null,
        code: department.code || null,
      }
    : null;

const buildCountMessage = (
  entity,
  total,
  selectedDepartment = null,
  yearContext = null,
  parsedFilters = {}
) => {
  const labels = ENTITY_LABELS[entity] || {
    singular: entity,
    plural: `${entity}s`,
  };

  const entityLabel = total === 1 ? labels.singular : labels.plural;
  const scopeParts = [];
  const dept = selectedDepartment?.code || selectedDepartment?.name || null;
  const yearLabel = getYearScopeLabel(yearContext);

  if (dept) {
    scopeParts.push(dept);
  }

  if (yearLabel) {
    scopeParts.push(yearLabel);
  }

  const scope = scopeParts.length ? ` in ${scopeParts.join(", ")}` : "";
  const backlogScope =
    entity === "student" &&
    (Object.prototype.hasOwnProperty.call(parsedFilters, "currentBacklogs") ||
      Object.prototype.hasOwnProperty.call(parsedFilters, "backlogs"))
      ? parsedFilters.currentBacklogs === 0 || parsedFilters.backlogs === false
        ? " without backlogs"
        : " with pending backlogs"
      : "";

  return `Total ${entityLabel}${scope}${backlogScope}: ${total}`;
};

const resolveCountQuery = async (message = "", options = {}) => {
  if (!isCountQuery(message)) return null;

  const entity =
    options.entity ||
    options.parsedQuery?.entity ||
    detectEntity(message);

  const Model = getModel(entity);

  if (!entity || !Model) {
    return {
      success: false,
      type: "count",
      entity: null,
      total: 0,
      message: "Entity not recognized",
    };
  }

  // ✅ ALWAYS use planner filters
  const routeContext = await buildEntityQuery(message, entity, {
    parsedFilters: options.parsedQuery?.filters || {},
  });

  if (!routeContext) return null;

  if (routeContext.unsupportedYearFilter) {
    return {
      success: true,
      type: "count",
      entity,
      total: 0,
      value: 0,
      filters: routeContext.filters || {},
      selectedDepartment: toSelectedDepartment(routeContext.selectedDepartment),
      responseType: "count",
      source: "database",
      confidence: 1,
      unavailableYearFilter: true,
      message: `Year-wise filter is not available for ${ENTITY_LABELS[entity]?.plural || entity}.`,
    };
  }

  const query = routeContext.query || {};

  // ✅ Avoid useless DB call
  if (query._id === null) {
    return {
      success: true,
      type: "count",
      entity,
      total: 0,
      value: 0,
      filters: routeContext.filters || {},
      selectedDepartment: toSelectedDepartment(routeContext.selectedDepartment),
      responseType: "count",
      source: "database",
      confidence: 1,
      message: buildCountMessage(
        entity,
        0,
        routeContext.selectedDepartment,
        routeContext.yearContext,
        routeContext.parsedFilters || {}
      ),
    };
  }

  // ✅ COUNT EXECUTION
  const total = await Model.countDocuments(query);

  return {
    success: true,
    type: "count",
    entity,
    total,
    value: total,
    filters: routeContext.filters || {},
    selectedDepartment: toSelectedDepartment(routeContext.selectedDepartment),
    responseType: "count",
    source: "database",
    confidence: 0.95,
    message: buildCountMessage(
      entity,
      total,
      routeContext.selectedDepartment,
      routeContext.yearContext,
      routeContext.parsedFilters || {}
    ),
  };
};

module.exports = {
  detectEntity,
  getModel,
  isCountQuery,
  resolveCountQuery,
};
