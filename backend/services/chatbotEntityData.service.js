const mongoose = require("mongoose");
const Student = require("../models/Student");
const Faculty = require("../models/Faculty");
const Department = require("../models/Department");
const Placement = require("../models/Placement");
const { Event } = require("../models/Event");
const {
  buildDynamicFilter,
  detectOperator,
  extractNumbers,
  extractFilters,
  resolveDepartmentFilter,
} = require("./chatbotFilter.service");
const {
  getYearScopeLabel,
  normalizeEntityKey,
  resolveYearFilterContext,
} = require("./chatbotYearFilter.service");

const LIST_QUERY_PATTERN =
  /\b(all|list|show all|give me all|every|complete|full|entire)\b/i;
const SINGLE_QUERY_PATTERN =
  /\b(roll|roll number|id|details of|detail of|profile of|record of)\b/i;
const ROLL_NUMBER_PATTERN = /\b([A-Za-z]{2,10}\d{2,})\b/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const OBJECT_ID_PATTERN = /\b([a-f0-9]{24})\b/i;
const ANALYTIC_ENTITY_QUERY_PATTERN =
  /\b(compare|comparison|statistics|statistic|summary|analysis|insight|percentage|top|highest|lowest|overview|rank|ranking|at risk)\b/i;
const ENTITY_QUERY_MAX_LIMIT = 100;
const ENTITY_PATTERNS = {
  student: /\bstudent|students\b/i,
  faculty: /\bfaculty|faculties|staff\b/i,
  department: /\bdepartment|departments\b/i,
  placement: /\bplacement|placements\b/i,
  event: /\bevent|events|workshop|seminar|hackathon|conference\b/i,
};

const ENTITY_LABELS = {
  student: { singular: "student", plural: "students" },
  faculty: { singular: "faculty record", plural: "faculty records" },
  department: { singular: "department", plural: "departments" },
  placement: { singular: "placement record", plural: "placement records" },
  event: { singular: "event", plural: "events" },
};

const pluralize = (count, singular, plural = `${singular}s`) =>
  Number(count) === 1 ? singular : plural;

const buildImpossibleQuery = () => ({ _id: null });
const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const FRIENDLY_OPERATOR_KEYS = {
  gt: "$gt",
  gte: "$gte",
  lt: "$lt",
  lte: "$lte",
  eq: "$eq",
  ne: "$ne",
  in: "$in",
  nin: "$nin",
};

const isListQuery = (message = "") => LIST_QUERY_PATTERN.test(String(message));

const isSingleQuery = (message = "") =>
  SINGLE_QUERY_PATTERN.test(String(message)) ||
  ROLL_NUMBER_PATTERN.test(String(message)) ||
  EMAIL_PATTERN.test(String(message)) ||
  OBJECT_ID_PATTERN.test(String(message));

const getDepartmentLabel = (department = null) =>
  department?.code || department?.name || null;

const buildScopeSuffix = (selectedDepartment = null, yearContext = null) => {
  const scopeParts = [];
  const departmentLabel = getDepartmentLabel(selectedDepartment);
  const yearLabel = getYearScopeLabel(yearContext);

  if (departmentLabel) {
    scopeParts.push(departmentLabel);
  }

  if (yearLabel) {
    scopeParts.push(yearLabel);
  }

  return scopeParts.length ? ` in ${scopeParts.join(", ")}` : "";
};

const normalizeDepartmentFilterValue = (value) => {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? normalized.toUpperCase() : null;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  if (typeof value.$eq === "string") {
    return normalizeDepartmentFilterValue(value.$eq);
  }

  if (typeof value.code === "string") {
    return normalizeDepartmentFilterValue(value.code);
  }

  if (typeof value.name === "string") {
    const normalized = value.name.trim();
    return normalized || null;
  }

  return null;
};

const extractParsedDepartmentFilter = (filters = {}) =>
  normalizeDepartmentFilterValue(filters.department) ||
  normalizeDepartmentFilterValue(filters.departmentCode) ||
  normalizeDepartmentFilterValue(filters["department.code"]);

const stripParsedDepartmentFilters = (filters = {}) => {
  if (!isPlainObject(filters)) {
    return {};
  }

  const nextFilters = { ...filters };
  delete nextFilters.department;
  delete nextFilters.departmentCode;
  delete nextFilters["department.code"];
  return nextFilters;
};

const normalizeOperatorObject = (value = null) => {
  if (!isPlainObject(value)) {
    return value;
  }

  return Object.entries(value).reduce((result, [key, item]) => {
    const normalizedKey = FRIENDLY_OPERATOR_KEYS[key] || key;
    if (!String(normalizedKey).startsWith("$")) {
      return result;
    }

    result[normalizedKey] = item;
    return result;
  }, {});
};

const normalizeFilterOperand = (value = null) => {
  if (!isPlainObject(value)) {
    return value;
  }

  const normalized = normalizeOperatorObject(value);
  return Object.keys(normalized).length ? normalized : value;
};

const normalizeParsedFieldClause = (entity = "", key = "", value = null) => {
  const normalizedEntity = normalizeEntityKey(entity);
  const normalizedValue = normalizeFilterOperand(value);

  switch (key) {
    case "roll_number":
      return {
        rollNumber:
          typeof normalizedValue === "string"
            ? normalizedValue.toUpperCase()
            : normalizedValue,
      };
    case "batch_year":
      return { batchYear: normalizedValue };
    case "academic_year":
      return { academicYear: normalizedValue };
    default:
      break;
  }

  if (normalizedEntity === "student") {
    if (["backlogs", "currentBacklogs"].includes(key)) {
      if (typeof normalizedValue === "boolean") {
        return {
          currentBacklogs: normalizedValue ? { $gt: 0 } : 0,
        };
      }

      return { currentBacklogs: normalizedValue };
    }

    if (["attendance", "averageAttendance", "academicRecords.avgAttendance"].includes(key)) {
      return {
        "academicRecords.avgAttendance": normalizedValue,
      };
    }
  }

  return {
    [key]: normalizedValue,
  };
};

const normalizeParsedFiltersForEntity = (entity = "", filters = {}) => {
  if (!isPlainObject(filters)) {
    return {};
  }

  const fragments = Object.entries(filters).flatMap(([key, value]) => {
    if (value === null || value === undefined) {
      return [];
    }

    if (["$and", "$or"].includes(key) && Array.isArray(value)) {
      const normalizedGroup = value
        .map((item) => normalizeParsedFiltersForEntity(entity, item))
        .filter((item) => isPlainObject(item) && Object.keys(item).length);

      return normalizedGroup.length ? [{ [key]: normalizedGroup }] : [];
    }

    const normalizedClause = normalizeParsedFieldClause(entity, key, value);
    return isPlainObject(normalizedClause) && Object.keys(normalizedClause).length
      ? [normalizedClause]
      : [];
  });

  return mergeMongoQueries(...fragments);
};

const mergeMongoQueries = (...queries) => {
  const fragments = queries.flatMap((query) => {
    if (!isPlainObject(query) || !Object.keys(query).length) {
      return [];
    }

    if (Array.isArray(query.$and) && Object.keys(query).length === 1) {
      return query.$and.filter(
        (item) => isPlainObject(item) && Object.keys(item).length
      );
    }

    return [query];
  });

  if (!fragments.length) {
    return {};
  }

  if (fragments.length === 1) {
    return fragments[0];
  }

  return { $and: fragments };
};

const detectEntity = (message = "") => {
  const normalized = String(message).toLowerCase();

  return (
    Object.entries(ENTITY_PATTERNS).find(([, pattern]) => pattern.test(normalized))?.[0] ||
    null
  );
};

const serializeQueryValue = (value) => {
  if (value instanceof mongoose.Types.ObjectId) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeQueryValue(item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((result, [key, item]) => {
      result[key] = serializeQueryValue(item);
      return result;
    }, {});
  }

  return value;
};

const mapStudentRow = (student = {}) => ({
  name: student.name || null,
  rollNumber: student.rollNumber || null,
  email: student.email || null,
  department: student.department?.name || null,
  departmentCode: student.department?.code || null,
  batchYear: student.batchYear ?? null,
  cgpa: student.cgpa ?? null,
  averageAttendance: student.academicRecords?.avgAttendance ?? null,
  currentBacklogs: student.currentBacklogs ?? 0,
});

const mapFacultyRow = (faculty = {}) => ({
  name: faculty.name || null,
  email: faculty.email || null,
  department: faculty.department?.name || null,
  departmentCode: faculty.department?.code || null,
  designation: faculty.designation || null,
  specialization: faculty.specialization || null,
  qualification: faculty.qualification || null,
  experience: faculty.experience ?? null,
});

const mapDepartmentRow = (department = {}) => ({
  name: department.name || null,
  code: department.code || null,
  establishedYear: department.establishedYear ?? null,
  totalSeats: department.totalSeats ?? null,
  isActive: department.isActive ?? null,
});

const mapPlacementRow = (placement = {}) => ({
  student: placement.student?.name || null,
  rollNumber: placement.student?.rollNumber || null,
  department: placement.student?.department?.name || null,
  departmentCode: placement.student?.department?.code || null,
  company: placement.company || null,
  role: placement.role || null,
  package: placement.package ?? null,
  academicYear: placement.academicYear || null,
  placementType: placement.placementType || null,
  placementDate: placement.placementDate || null,
});

const mapEventRow = (event = {}) => ({
  title: event.title || null,
  type: event.type || null,
  level: event.level || null,
  department: event.department?.name || null,
  departmentCode: event.department?.code || null,
  location: event.location || null,
  organizingBody: event.organizingBody || null,
  startDate: event.startDate || null,
  endDate: event.endDate || null,
});

const ENTITY_QUERY_CONFIG = {
  student: {
    model: Student,
    baseQuery: { isActive: true },
    title: "Students",
    listQuery: (match = {}) =>
      Student.find(match)
        .select(
          "name rollNumber email department batchYear cgpa academicRecords.avgAttendance currentBacklogs"
        )
        .populate("department", "name code")
        .sort({ name: 1 }),
    singleQuery: (match = {}) =>
      Student.findOne(match)
        .select(
          "name rollNumber email department batchYear cgpa academicRecords.avgAttendance currentBacklogs"
        )
        .populate("department", "name code"),
    formatRow: mapStudentRow,
  },
  faculty: {
    model: Faculty,
    baseQuery: { isActive: true },
    title: "Faculty",
    listQuery: (match = {}) =>
      Faculty.find(match)
        .select(
          "name email department designation specialization qualification experience"
        )
        .populate("department", "name code")
        .sort({ name: 1 }),
    singleQuery: (match = {}) =>
      Faculty.findOne(match)
        .select(
          "name email department designation specialization qualification experience"
        )
        .populate("department", "name code"),
    formatRow: mapFacultyRow,
  },
  department: {
    model: Department,
    baseQuery: { isActive: true },
    title: "Departments",
    listQuery: (match = {}) =>
      Department.find(match)
        .select("name code establishedYear totalSeats isActive")
        .sort({ name: 1 }),
    singleQuery: (match = {}) =>
      Department.findOne(match)
        .select("name code establishedYear totalSeats isActive"),
    formatRow: mapDepartmentRow,
  },
  placement: {
    model: Placement,
    baseQuery: {},
    title: "Placements",
    listQuery: (match = {}) =>
      Placement.find(match)
        .populate({
          path: "student",
          select: "name rollNumber department",
          populate: {
            path: "department",
            select: "name code",
          },
        })
        .sort({ placementDate: -1, createdAt: -1 }),
    singleQuery: (match = {}) =>
      Placement.findOne(match)
        .populate({
          path: "student",
          select: "name rollNumber department",
          populate: {
            path: "department",
            select: "name code",
          },
        })
        .sort({ placementDate: -1, createdAt: -1 }),
    formatRow: mapPlacementRow,
  },
  event: {
    model: Event,
    baseQuery: { isActive: true },
    title: "Events",
    listQuery: (match = {}) =>
      Event.find(match)
        .select(
          "title type level department location organizingBody startDate endDate isActive"
        )
        .populate("department", "name code")
        .sort({ startDate: -1, createdAt: -1 }),
    singleQuery: (match = {}) =>
      Event.findOne(match)
        .select(
          "title type level department location organizingBody startDate endDate isActive"
        )
        .populate("department", "name code"),
    formatRow: mapEventRow,
  },
};

const getModel = (entity = "") => ENTITY_QUERY_CONFIG[entity]?.model || null;

const buildDepartmentAwareQuery = async (
  entity = "",
  query = {},
  selectedDepartment = null
) => {
  if (!selectedDepartment?._id) {
    return query;
  }

  if (entity === "student" || entity === "faculty" || entity === "event") {
    return {
      ...query,
      department: selectedDepartment._id,
    };
  }

  if (entity === "department") {
    return {
      ...query,
      _id: selectedDepartment._id,
    };
  }

  if (entity === "placement") {
    const studentIds = await Student.find({
      isActive: true,
      department: selectedDepartment._id,
    }).distinct("_id");

    return studentIds.length
      ? {
          ...query,
          student: { $in: studentIds },
        }
      : buildImpossibleQuery();
  }

  return query;
};

const buildYearAwareQuery = (entity = "", yearContext = null) => {
  const normalizedEntity = normalizeEntityKey(entity);

  if (!yearContext?.hasYear || yearContext.unsupported) {
    return {
      query: {},
      supported: !yearContext?.unsupported,
    };
  }

  if (normalizedEntity === "student" && yearContext.batchYear !== null) {
    return {
      query: { batchYear: yearContext.batchYear },
      supported: true,
    };
  }

  if (normalizedEntity === "placement" && yearContext.academicYear) {
    return {
      query: { academicYear: yearContext.academicYear },
      supported: true,
    };
  }

  if (normalizedEntity === "event" && yearContext.dateRange) {
    return {
      query: { startDate: yearContext.dateRange },
      supported: true,
    };
  }

  return {
    query: {},
    supported: false,
  };
};

const buildEntityQuery = async (message = "", entity = "", options = {}) => {
  const config = ENTITY_QUERY_CONFIG[entity];
  if (!config) {
    return null;
  }

  const parsedFilters = isPlainObject(options.parsedFilters)
    ? options.parsedFilters
    : {};
  const rawFilters = {
    ...extractFilters(message),
  };
  const yearContext = resolveYearFilterContext({
    message,
    entity,
    filters: parsedFilters,
  });
  const parsedDepartmentFilter = extractParsedDepartmentFilter(parsedFilters);
  if (!rawFilters.department && parsedDepartmentFilter) {
    rawFilters.department = parsedDepartmentFilter;
  }

  const selectedDepartment = await resolveDepartmentFilter(message, rawFilters);
  const numericFilters = buildDynamicFilter(message, {
    model: config.model,
    target: entity,
  });
  const parsedQueryFilters = normalizeParsedFiltersForEntity(
    entity,
    stripParsedDepartmentFilters(parsedFilters)
  );
  const yearAwareQuery = buildYearAwareQuery(entity, yearContext);
  const hasNumericComparison =
    extractNumbers(message).length > 0 && Boolean(detectOperator(message));
  const hasNumericFilters =
    Object.keys(numericFilters).length > 0 ||
    Object.keys(parsedQueryFilters).length > 0;

  if (yearContext.hasYear && !yearAwareQuery.supported) {
    return {
      query: buildImpossibleQuery(),
      selectedDepartment,
      filters: {
        yearScope: getYearScopeLabel(yearContext),
      },
      hasNumericComparison,
      hasNumericFilters,
      yearContext,
      parsedFilters: parsedQueryFilters,
      unsupportedYearFilter: true,
    };
  }

  let query = mergeMongoQueries(
    config.baseQuery || {},
    numericFilters,
    parsedQueryFilters,
    yearAwareQuery.query
  );

  if (rawFilters.department && !selectedDepartment) {
    query = buildImpossibleQuery();
  } else {
    query = await buildDepartmentAwareQuery(entity, query, selectedDepartment);
  }

  return {
    query,
    selectedDepartment,
    filters: serializeQueryValue(query),
    hasNumericComparison,
    hasNumericFilters,
    yearContext,
    parsedFilters: parsedQueryFilters,
    unsupportedYearFilter: false,
  };
};

const getMessageObjectId = (message = "") => {
  const match = String(message).match(OBJECT_ID_PATTERN);
  return match?.[1] || null;
};

const getMessageEmail = (message = "") => {
  const match = String(message).match(EMAIL_PATTERN);
  return match?.[0]?.toLowerCase() || null;
};

const getMessageRollNumber = (message = "") => {
  const match = String(message).match(ROLL_NUMBER_PATTERN);
  return match?.[1]?.toUpperCase() || null;
};

const buildSingleMatch = async (entity = "", message = "", liveFacts = {}) => {
  const objectId = getMessageObjectId(message);
  if (objectId && mongoose.isValidObjectId(objectId)) {
    return { _id: objectId };
  }

  if (entity === "student") {
    const rollNumber = getMessageRollNumber(message) || liveFacts.student?.rollNumber || null;
    if (rollNumber) {
      return { rollNumber };
    }

    const email = getMessageEmail(message) || liveFacts.student?.email || null;
    if (email) {
      return { email };
    }
  }

  if (entity === "faculty") {
    const email = getMessageEmail(message) || liveFacts.faculty?.email || null;
    if (email) {
      return { email };
    }
  }

  if (entity === "department") {
    const selectedDepartment = await resolveDepartmentFilter(message, extractFilters(message));
    if (selectedDepartment?._id) {
      return { _id: selectedDepartment._id };
    }

    if (liveFacts.department?.code) {
      return { code: String(liveFacts.department.code).toUpperCase() };
    }
  }

  if (entity === "placement") {
    const rollNumber = getMessageRollNumber(message) || liveFacts.student?.rollNumber || null;
    if (rollNumber) {
      const student = await Student.findOne({ rollNumber }).select("_id").lean();
      if (student?._id) {
        return { student: student._id };
      }
    }
  }

  return null;
};

const buildListReply = (
  entity = "",
  totalRecords = 0,
  selectedDepartment = null,
  yearContext = null
) => {
  const labels = ENTITY_LABELS[entity] || {
    singular: entity,
    plural: `${entity}s`,
  };
  const scopeSuffix = buildScopeSuffix(selectedDepartment, yearContext);

  if (!totalRecords) {
    return scopeSuffix
      ? `I could not find any ${labels.plural}${scopeSuffix}.`
      : `I could not find any ${labels.plural}.`;
  }

  return scopeSuffix
    ? `I found ${totalRecords} ${pluralize(totalRecords, labels.singular, labels.plural)}${scopeSuffix}.`
    : `I found ${totalRecords} ${pluralize(totalRecords, labels.singular, labels.plural)}.`;
};

const buildFilterRelaxationPrompt = (
  parsedFilters = {},
  selectedDepartment = null,
  yearContext = null
) => {
  const suggestions = [];

  if (selectedDepartment || parsedFilters.department) {
    suggestions.push("department");
  }

  if (yearContext?.hasYear) {
    suggestions.push(yearContext.batchYear !== null ? "batch year" : "year");
  }

  if (
    Object.prototype.hasOwnProperty.call(parsedFilters, "backlogs") ||
    Object.prototype.hasOwnProperty.call(parsedFilters, "currentBacklogs")
  ) {
    suggestions.push("backlog");
  }

  if (
    Object.prototype.hasOwnProperty.call(parsedFilters, "attendance") ||
    Object.prototype.hasOwnProperty.call(parsedFilters, "academicRecords.avgAttendance")
  ) {
    suggestions.push("attendance");
  }

  if (Object.prototype.hasOwnProperty.call(parsedFilters, "cgpa")) {
    suggestions.push("CGPA");
  }

  if (!suggestions.length) {
    return "";
  }

  return ` Tell me which filter to relax: ${[...new Set(suggestions)].join(", ")}.`;
};

const buildNoResultsReply = (
  entity = "",
  selectedDepartment = null,
  yearContext = null,
  parsedFilters = {}
) => {
  const labels = ENTITY_LABELS[entity] || {
    plural: `${entity}s`,
  };
  const scopeSuffix = buildScopeSuffix(selectedDepartment, yearContext);
  const followUp = buildFilterRelaxationPrompt(
    parsedFilters,
    selectedDepartment,
    yearContext
  );
  const baseReply = scopeSuffix
    ? `I could not find any ${labels.plural}${scopeSuffix}.`
    : `I could not find any ${labels.plural}.`;

  return `${baseReply}${followUp}`;
};

const buildSingleReply = (
  entity = "",
  selectedDepartment = null,
  yearContext = null
) => {
  const labels = ENTITY_LABELS[entity] || {
    singular: entity,
  };
  const scopeSuffix = buildScopeSuffix(selectedDepartment, yearContext);

  return scopeSuffix
    ? `I found the requested ${labels.singular}${scopeSuffix}.`
    : `I found the requested ${labels.singular}.`;
};

const resolveEntityDataQuery = async ({
  message = "",
  liveFacts = {},
  entity: providedEntity = null,
  parsedQuery = null,
} = {}) => {
  const entity = providedEntity || parsedQuery?.entity || detectEntity(message);
  if (!entity) return null;

  const config = ENTITY_QUERY_CONFIG[entity];
  if (!config) return null;

  const routeContext = await buildEntityQuery(message, entity, {
    parsedFilters: parsedQuery?.filters || {},
  });

  if (!routeContext) return null;

  if (routeContext.unsupportedYearFilter) {
    const labels = ENTITY_LABELS[entity] || {
      plural: `${entity}s`,
    };

    return {
      success: true,
      type: "data",
      entity,
      queryMode: "list",
      totalRecords: 0,
      returnedRecords: 0,
      count: 0,
      filters: routeContext.filters,
      rows: [],
      contextData: [],
      title: config.title,
      reply: `Year-wise filter is not available for ${labels.plural}.`,
      responseType: "text",
      provider: "database",
    };
  }

  if (routeContext.hasNumericComparison && !routeContext.hasNumericFilters) {
    return null;
  }

  const listMode = isListQuery(message);
  const singleMode = !listMode && isSingleQuery(message);

  if (!listMode && !singleMode && ANALYTIC_ENTITY_QUERY_PATTERN.test(message)) {
    return null;
  }

  // ================= LIMIT =================
  const requestedLimit =
    parsedQuery?.limit && Number(parsedQuery.limit) > 0
      ? Number(parsedQuery.limit)
      : null;

  const DEFAULT_LIMIT = 100;

  const effectiveLimit =
    requestedLimit !== null ? requestedLimit : DEFAULT_LIMIT;

  // ================= QUERY =================
  let queryBuilder = config.listQuery(routeContext.query);

  // Apply sort from planner
  if (parsedQuery?.sort) {
    queryBuilder = queryBuilder.sort(parsedQuery.sort);
  }

  // Fallback sort for "top N"
  if (requestedLimit && !parsedQuery?.sort) {
    const fallbackSortMap = {
      student: { cgpa: -1 },
      faculty: { experience: -1 },
      placement: { package: -1 },
      department: { name: 1 },
      event: { startDate: -1 },
    };

    queryBuilder = queryBuilder.sort(
      fallbackSortMap[entity] || { _id: -1 }
    );
  }

  // Apply limit
  queryBuilder = queryBuilder.limit(effectiveLimit);

  // ================= SINGLE =================
  if (singleMode) {
    const identifierMatch = await buildSingleMatch(entity, message, liveFacts);

    if (!identifierMatch) {
      return {
        success: true,
        type: "data",
        entity,
        queryMode: "single",
        totalRecords: 0,
        returnedRecords: 0,
        count: 0,
        filters: routeContext.filters,
        rows: [],
        contextData: [],
        title: config.title,
        reply: `No ${entity} records found.`,
        responseType: "text",
        provider: "database",
      };
    }

    const query = { ...routeContext.query, ...identifierMatch };
    const doc = await config.singleQuery(query).lean();

    if (!doc) {
      return {
        success: true,
        type: "data",
        entity,
        queryMode: "single",
        totalRecords: 0,
        returnedRecords: 0,
        count: 0,
        filters: serializeQueryValue(query),
        rows: [],
        contextData: [],
        title: config.title,
        reply: `No ${entity} record found.`,
        responseType: "text",
        provider: "database",
      };
    }

    const row = config.formatRow(doc);

    return {
      success: true,
      type: "data",
      entity,
      queryMode: "single",
      totalRecords: 1,
      returnedRecords: 1,
      count: 1,
      filters: serializeQueryValue(query),
      rows: [row],
      contextData: [row],
      title: config.title,
      reply: buildSingleReply(
        entity,
        routeContext.selectedDepartment,
        routeContext.yearContext
      ),
      responseType: "table",
      provider: "database",
    };
  }

  // ================= LIST =================
  const [docs, totalRecords] = await Promise.all([
    queryBuilder.lean(),
    config.model.countDocuments(routeContext.query),
  ]);

  const rows = docs.map(config.formatRow);

  return {
    success: true,
    type: "data",
    entity,
    queryMode: "list",
    totalRecords,                // ✅ correct total
    returnedRecords: rows.length,
    count: rows.length,
    filters: routeContext.filters,
    rows,
    contextData: rows,
    title: config.title,
    reply: rows.length
      ? buildListReply(
          entity,
          rows.length,
          routeContext.selectedDepartment,
          routeContext.yearContext
        )
      : buildNoResultsReply(
          entity,
          routeContext.selectedDepartment,
          routeContext.yearContext,
          routeContext.parsedFilters
        ),
    responseType: rows.length ? "table" : "text",
    provider: "database",
    maxLimit: ENTITY_QUERY_MAX_LIMIT,
  };
};

module.exports = {
  buildEntityQuery,
  detectEntity,
  getModel,
  isListQuery,
  isSingleQuery,
  resolveEntityDataQuery,
};
