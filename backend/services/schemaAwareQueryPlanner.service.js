const PLAN_MODE_VALUES = new Set([
  "plan",
  "planner",
  "query_plan",
  "query-plan",
  "execution_plan",
  "execution-plan",
]);

const QUERY_PLAN_REQUEST_PATTERN =
  /\b(query plan|execution plan|query planner|database query plan|structured query)\b/i;
const RECOMMENDATION_INTENT_PATTERN =
  /\b(improve|how to improve|suggestions?|advice|help|guidance)\b/i;
const ANALYZE_INTENT_PATTERN =
  /\b(analy[sz]e|analysis|compare|comparison|trend|distribution|average|avg|summary|overview)\b/i;

const RELATIONSHIPS = {
  students_departments: {
    from: "students",
    to: "departments",
    type: "inner",
    on: "students.departmentId = departments.id",
  },
  faculties_departments: {
    from: "faculties",
    to: "departments",
    type: "inner",
    on: "faculties.departmentId = departments.id",
  },
  students_studentsemesterperformances: {
    from: "students",
    to: "studentsemesterperformances",
    type: "inner",
    on: "students.id = studentsemesterperformances.studentId",
  },
  students_studentsemesterattendances: {
    from: "students",
    to: "studentsemesterattendances",
    type: "inner",
    on: "students.id = studentsemesterattendances.studentId",
  },
  students_marks: {
    from: "students",
    to: "marks",
    type: "inner",
    on: "students.id = marks.studentId",
  },
  marks_subjects: {
    from: "marks",
    to: "subjects",
    type: "inner",
    on: "marks.subjectId = subjects.id",
  },
  students_placements: {
    from: "students",
    to: "placements",
    type: "inner",
    on: "students.id = placements.studentId",
  },
  students_achievements: {
    from: "students",
    to: "achievements",
    type: "inner",
    on: "students.id = achievements.studentId",
  },
  students_participations: {
    from: "students",
    to: "participations",
    type: "inner",
    on: "students.id = participations.studentId",
  },
  participations_events: {
    from: "participations",
    to: "events",
    type: "inner",
    on: "participations.eventId = events.id",
  },
  faculties_researchpapers: {
    from: "faculties",
    to: "researchpapers",
    type: "inner",
    on: "faculties.id = researchpapers.facultyId",
  },
  faculties_facultyachievements: {
    from: "faculties",
    to: "facultyachievements",
    type: "inner",
    on: "faculties.id = facultyachievements.facultyId",
  },
  placements_students: {
    from: "placements",
    to: "students",
    type: "inner",
    on: "placements.studentId = students.id",
  },
  placementapplications_students: {
    from: "placementapplications",
    to: "students",
    type: "inner",
    on: "placementapplications.studentId = students.id",
  },
  placementapplications_placementdrives: {
    from: "placementapplications",
    to: "placementdrives",
    type: "inner",
    on: "placementapplications.driveId = placementdrives.id",
  },
  placementdrives_placementapplications: {
    from: "placementdrives",
    to: "placementapplications",
    type: "inner",
    on: "placementdrives.id = placementapplications.driveId",
  },
};

const normalizeText = (value = "") => String(value || "").trim();
const normalizeLower = (value = "") => normalizeText(value).toLowerCase();

const unique = (values = []) => [...new Set(values.filter(Boolean))];

const toNumber = (value) => {
  const numericValue = Number(String(value || "").replace(/%/g, "").trim());
  return Number.isFinite(numericValue) ? numericValue : null;
};

const addJoin = (joins = [], join = null) => {
  if (!join) {
    return joins;
  }

  if (
    !joins.some(
      (item) =>
        item.from === join.from &&
        item.to === join.to &&
        item.type === join.type &&
        item.on === join.on
    )
  ) {
    joins.push(join);
  }

  return joins;
};

const addFilter = (filters = [], filter = null) => {
  if (!filter) {
    return filters;
  }

  if (
    !filters.some(
      (item) =>
        item.field === filter.field &&
        item.operator === filter.operator &&
        String(item.value) === String(filter.value)
    )
  ) {
    filters.push(filter);
  }

  return filters;
};

const addField = (fields = [], field = null) => {
  if (field && !fields.includes(field)) {
    fields.push(field);
  }

  return fields;
};

const stripPlanningInstruction = (message = "") => {
  const raw = normalizeText(message);
  const stripped = raw
    .replace(
      /\b(?:please\s+)?(?:convert|create|generate|build|return|give|show)\b[^:]{0,80}\b(?:query plan|execution plan|query planner|structured query)\b[:\s-]*/i,
      ""
    )
    .replace(/\b(?:query plan|execution plan|query planner|structured query)\b[:\s-]*/gi, "")
    .replace(/^for\s+/i, "")
    .trim();

  return stripped || raw;
};

const shouldBuildSchemaAwareQueryPlan = ({ message = "", payload = {} } = {}) => {
  const mode = normalizeLower(payload.mode || payload.queryMode || payload.queryType);

  if (PLAN_MODE_VALUES.has(mode) || payload.plannerOnly === true) {
    return true;
  }

  return QUERY_PLAN_REQUEST_PATTERN.test(normalizeText(message));
};

const detectIntent = (message = "") => {
  const normalized = normalizeLower(message);

  if (RECOMMENDATION_INTENT_PATTERN.test(normalized)) {
    return "recommendation";
  }

  if (ANALYZE_INTENT_PATTERN.test(normalized)) {
    return "analyze";
  }

  return "fetch";
};

const detectEntity = (message = "") => {
  const normalized = normalizeLower(message);

  if (/\breport|reports|generated\b/.test(normalized)) {
    return "report";
  }

  if (
    /\bfaculty|faculties|professor|teacher|lecturer|research paper|research papers|research|specialization|designation|experience\b/.test(
      normalized
    )
  ) {
    return "faculty";
  }

  if (
    /\bplacement|placements|placed|drive|drives|application|applications|company|package\b/.test(
      normalized
    )
  ) {
    return "placement";
  }

  return "student";
};

const detectPrimaryTable = (entity = "", message = "") => {
  const normalized = normalizeLower(message);

  if (entity === "report") {
    return "reports";
  }

  if (entity === "faculty") {
    return "faculties";
  }

  if (entity === "placement") {
    if (/\bapplication|applications|status\b/.test(normalized)) {
      return "placementapplications";
    }

    if (/\bdrive|drives|drive date|date\b/.test(normalized)) {
      return "placementdrives";
    }

    return "placements";
  }

  return "students";
};

const extractDepartmentFilter = (message = "") => {
  const patterns = [
    /\b(?:department|dept)(?:\s+code)?\s*(?:is|=|:)?\s*([A-Za-z][A-Za-z0-9&\s-]{1,40})/i,
    /\b(?:from|in)\s+([A-Za-z][A-Za-z0-9&\s-]{1,40})\s+department\b/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    const value = normalizeText(match?.[1] || "");
    if (!value) {
      continue;
    }

    if (/^[A-Z]{2,10}$/i.test(value.replace(/\s+/g, ""))) {
      return {
        field: "code",
        operator: "=",
        value: value.toUpperCase().replace(/\s+/g, ""),
      };
    }

    return {
      field: "name",
      operator: "=",
      value,
    };
  }

  return null;
};

const extractComparisonFilter = (message = "", field = "", allowPercent = false) => {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    {
      regex: new RegExp(
        `\\b${escapedField}\\b\\s*(<=|>=|=|<|>)\\s*(\\d+(?:\\.\\d+)?)\\s*${allowPercent ? "%?" : ""}`,
        "i"
      ),
      parse: (match) => ({
        operator: match[1],
        value: toNumber(match[2]),
      }),
    },
    {
      regex: new RegExp(
        `\\b${escapedField}\\b\\s*(?:is\\s+)?(?:less than|below|under)\\s*(\\d+(?:\\.\\d+)?)\\s*${allowPercent ? "%?" : ""}`,
        "i"
      ),
      parse: (match) => ({
        operator: "<",
        value: toNumber(match[1]),
      }),
    },
    {
      regex: new RegExp(
        `\\b${escapedField}\\b\\s*(?:is\\s+)?(?:greater than|more than|above|over)\\s*(\\d+(?:\\.\\d+)?)\\s*${allowPercent ? "%?" : ""}`,
        "i"
      ),
      parse: (match) => ({
        operator: ">",
        value: toNumber(match[1]),
      }),
    },
    {
      regex: new RegExp(
        `\\b${escapedField}\\b\\s*(?:is\\s+)?(?:at least|minimum of|not less than)\\s*(\\d+(?:\\.\\d+)?)\\s*${allowPercent ? "%?" : ""}`,
        "i"
      ),
      parse: (match) => ({
        operator: ">=",
        value: toNumber(match[1]),
      }),
    },
    {
      regex: new RegExp(
        `\\b${escapedField}\\b\\s*(?:is\\s+)?(?:at most|maximum of|not more than)\\s*(\\d+(?:\\.\\d+)?)\\s*${allowPercent ? "%?" : ""}`,
        "i"
      ),
      parse: (match) => ({
        operator: "<=",
        value: toNumber(match[1]),
      }),
    },
    {
      regex: new RegExp(
        `\\b${escapedField}\\b\\s*(?:is|=|:)?\\s*(\\d+(?:\\.\\d+)?)\\s*${allowPercent ? "%?" : ""}`,
        "i"
      ),
      parse: (match) => ({
        operator: "=",
        value: toNumber(match[1]),
      }),
    },
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern.regex);
    if (!match) {
      continue;
    }

    const parsed = pattern.parse(match);
    if (parsed.value === null) {
      continue;
    }

    return {
      field,
      operator: parsed.operator,
      value: parsed.value,
    };
  }

  return null;
};

const extractTextFilter = (message = "", config = {}) => {
  const patterns = Array.isArray(config.patterns) ? config.patterns : [];

  for (const pattern of patterns) {
    const match = message.match(pattern.regex);
    const value = normalizeText(match?.[1] || "");
    if (!value) {
      continue;
    }

    return {
      field: config.field,
      operator: config.operator || "contains",
      value,
    };
  }

  return null;
};

const applyStudentPlan = (message = "", plan = {}) => {
  const normalized = normalizeLower(message);
  const joins = [];
  const filters = [];
  const fields = ["name"];
  const departmentFilter = extractDepartmentFilter(message);
  const cgpaFilter = extractComparisonFilter(message, "cgpa");
  const attendanceFilter = extractComparisonFilter(message, "attendance", true);
  const marksFilter = extractComparisonFilter(message, "marks");
  const semesterFilter = extractComparisonFilter(message, "semester");

  if (cgpaFilter || /\bcgpa|semester performance|performance\b/.test(normalized)) {
    addJoin(joins, RELATIONSHIPS.students_studentsemesterperformances);
    addField(fields, "cgpa");
  }

  if (attendanceFilter || /\battendance\b/.test(normalized)) {
    addJoin(joins, RELATIONSHIPS.students_studentsemesterattendances);
    addField(fields, "attendance");
  }

  if (marksFilter || /\bmarks?|score\b/.test(normalized)) {
    addJoin(joins, RELATIONSHIPS.students_marks);
    addField(fields, "marks");
  }

  if (/\bsubject|subjects\b/.test(normalized)) {
    addJoin(joins, RELATIONSHIPS.students_marks);
    addJoin(joins, RELATIONSHIPS.marks_subjects);
    addField(fields, "subjects.name");
  }

  if (/\bachievement|achievements\b/.test(normalized)) {
    addJoin(joins, RELATIONSHIPS.students_achievements);
    addField(fields, "title");
  }

  if (/\bparticipation|participations|event|events\b/.test(normalized)) {
    addJoin(joins, RELATIONSHIPS.students_participations);
    addJoin(joins, RELATIONSHIPS.participations_events);
    addField(fields, "events.name");
  }

  if (/\bplaced|placement|company|package\b/.test(normalized)) {
    addJoin(joins, RELATIONSHIPS.students_placements);
    addField(fields, "company");
    addField(fields, "package");
  }

  if (departmentFilter) {
    addJoin(joins, RELATIONSHIPS.students_departments);
    addFilter(filters, departmentFilter);
  }

  if (cgpaFilter) {
    addFilter(filters, cgpaFilter);
  } else if (/\bhigh cgpa\b/.test(normalized)) {
    addJoin(joins, RELATIONSHIPS.students_studentsemesterperformances);
    addFilter(filters, { field: "cgpa", operator: ">", value: 8 });
    addField(fields, "cgpa");
  }

  if (attendanceFilter) {
    addFilter(filters, attendanceFilter);
  } else if (/\blow attendance\b/.test(normalized)) {
    addJoin(joins, RELATIONSHIPS.students_studentsemesterattendances);
    addFilter(filters, { field: "attendance", operator: "<", value: 75 });
    addField(fields, "attendance");
  }

  if (marksFilter) {
    addFilter(filters, marksFilter);
    addField(fields, "marks");
  }

  if (semesterFilter) {
    if (joins.some((join) => join.to === "studentsemesterattendances")) {
      addFilter(filters, semesterFilter);
      addField(fields, "semester");
    } else {
      addJoin(joins, RELATIONSHIPS.students_studentsemesterperformances);
      addFilter(filters, semesterFilter);
      addField(fields, "semester");
    }
  }

  return {
    ...plan,
    primary_table: "students",
    joins,
    filters,
    fields_required: unique(fields),
  };
};

const applyFacultyPlan = (message = "", plan = {}) => {
  const normalized = normalizeLower(message);
  const joins = [];
  const filters = [];
  const fields = ["name"];
  const departmentFilter = extractDepartmentFilter(message);
  const experienceFilter = extractComparisonFilter(message, "experience");
  const specializationFilter = extractTextFilter(message, {
    field: "specialization",
    operator: "contains",
    patterns: [
      { regex: /\bspecialization\s*(?:is|=|:)?\s*([A-Za-z][A-Za-z0-9&\s-]{1,40})/i },
      { regex: /\bspecialized in\s+([A-Za-z][A-Za-z0-9&\s-]{1,40})/i },
    ],
  });
  const designationFilter = extractTextFilter(message, {
    field: "designation",
    operator: "contains",
    patterns: [
      { regex: /\bdesignation\s*(?:is|=|:)?\s*([A-Za-z][A-Za-z0-9&\s-]{1,40})/i },
      { regex: /\b(?:assistant professor|associate professor|professor|hod|dean|lecturer)\b/i },
    ],
  });
  const domainFilter = extractTextFilter(message, {
    field: "domain",
    operator: "contains",
    patterns: [
      { regex: /\bdomain\s*(?:is|=|:)?\s*([A-Za-z][A-Za-z0-9&\s-]{1,40})/i },
      { regex: /\bresearch papers?\s+in\s+([A-Za-z][A-Za-z0-9&\s-]{1,40})/i },
      { regex: /\bresearch in\s+([A-Za-z][A-Za-z0-9&\s-]{1,40})/i },
    ],
  });

  if (departmentFilter) {
    addJoin(joins, RELATIONSHIPS.faculties_departments);
    addFilter(filters, departmentFilter);
  }

  if (experienceFilter) {
    addFilter(filters, experienceFilter);
    addField(fields, "experience");
  } else if (/\bexperienced faculty|experienced\b/.test(normalized)) {
    addFilter(filters, { field: "experience", operator: ">", value: 10 });
    addField(fields, "experience");
  }

  if (specializationFilter) {
    addFilter(filters, specializationFilter);
    addField(fields, "specialization");
  }

  if (designationFilter) {
    const value =
      designationFilter.value ||
      normalizeText(message.match(/\b(assistant professor|associate professor|professor|hod|dean|lecturer)\b/i)?.[1] || "");
    if (value) {
      addFilter(filters, {
        field: "designation",
        operator: "contains",
        value,
      });
      addField(fields, "designation");
    }
  }

  if (domainFilter || /\bresearch|paper|papers\b/.test(normalized)) {
    addJoin(joins, RELATIONSHIPS.faculties_researchpapers);
    addField(fields, "title");
  }

  if (domainFilter) {
    addFilter(filters, domainFilter);
  }

  if (/\bachievement|achievements\b/.test(normalized)) {
    addJoin(joins, RELATIONSHIPS.faculties_facultyachievements);
    addField(fields, "title");
  }

  return {
    ...plan,
    primary_table: "faculties",
    joins,
    filters,
    fields_required: unique(fields),
  };
};

const applyPlacementPlan = (message = "", plan = {}) => {
  const normalized = normalizeLower(message);
  const primaryTable = detectPrimaryTable("placement", message);
  const joins = [];
  const filters = [];
  const fields = [];
  const departmentFilter = extractDepartmentFilter(message);
  const packageFilter = extractComparisonFilter(message, "package");
  const companyFilter = extractTextFilter(message, {
    field: "company",
    operator: "contains",
    patterns: [
      { regex: /\bcompany\s*(?:is|=|:)?\s*([A-Za-z][A-Za-z0-9&.\s-]{1,50})/i },
      { regex: /\bplaced in\s+([A-Za-z][A-Za-z0-9&.\s-]{1,50})/i },
      { regex: /\bdrive(?:s)?\s+for\s+([A-Za-z][A-Za-z0-9&.\s-]{1,50})/i },
    ],
  });
  const statusMatch = message.match(
    /\bstatus\s*(?:is|=|:)?\s*(applied|shortlisted|selected|rejected|withdrawn|interview scheduled)\b/i
  );
  const driveDateFilter = extractTextFilter(message, {
    field: "date",
    operator: "=",
    patterns: [
      { regex: /\bdate\s*(?:is|=|:)?\s*(\d{4}-\d{2}-\d{2})\b/i },
    ],
  });

  if (primaryTable === "placements") {
    addField(fields, "company");
    addField(fields, "package");

    if (
      /\bstudent|students|department|name\b/.test(normalized) ||
      departmentFilter ||
      /\bplaced\b/.test(normalized)
    ) {
      addJoin(joins, RELATIONSHIPS.placements_students);
      addField(fields, "name");
    }

    if (departmentFilter) {
      addJoin(joins, RELATIONSHIPS.placements_students);
      addJoin(joins, RELATIONSHIPS.students_departments);
      addFilter(filters, departmentFilter);
    }
  }

  if (primaryTable === "placementapplications") {
    addField(fields, "status");
    addJoin(joins, RELATIONSHIPS.placementapplications_students);
    addField(fields, "name");

    if (/\bdrive|company|date\b/.test(normalized) || companyFilter || driveDateFilter) {
      addJoin(joins, RELATIONSHIPS.placementapplications_placementdrives);
      addField(fields, "company");
      addField(fields, "date");
    }

    if (departmentFilter) {
      addJoin(joins, RELATIONSHIPS.students_departments);
      addFilter(filters, departmentFilter);
    }
  }

  if (primaryTable === "placementdrives") {
    addField(fields, "company");
    addField(fields, "date");

    if (/\bapplication|applications|status\b/.test(normalized) || statusMatch) {
      addJoin(joins, RELATIONSHIPS.placementdrives_placementapplications);
      addField(fields, "status");
    }

    if (/\bstudent|students|department|name\b/.test(normalized) || departmentFilter) {
      addJoin(joins, RELATIONSHIPS.placementdrives_placementapplications);
      addJoin(joins, RELATIONSHIPS.placementapplications_students);
      addField(fields, "name");
    }

    if (departmentFilter) {
      addJoin(joins, RELATIONSHIPS.students_departments);
      addFilter(filters, departmentFilter);
    }
  }

  if (packageFilter) {
    addFilter(filters, packageFilter);
  }

  if (companyFilter) {
    addFilter(filters, companyFilter);
  }

  if (statusMatch) {
    addFilter(filters, {
      field: "status",
      operator: "=",
      value: normalizeText(statusMatch[1]),
    });
  }

  if (driveDateFilter) {
    addFilter(filters, driveDateFilter);
  }

  return {
    ...plan,
    primary_table: primaryTable,
    joins,
    filters,
    fields_required: unique(fields),
  };
};

const applyReportPlan = (message = "", plan = {}) => {
  const filters = [];
  const fields = ["type", "generatedAt"];
  const typeMatch = message.match(
    /\b(?:student|faculty|placement|department|backlog|event)\s+reports?\b/i
  );

  if (typeMatch?.[1]) {
    addFilter(filters, {
      field: "type",
      operator: "contains",
      value: normalizeText(typeMatch[1]),
    });
  }

  return {
    ...plan,
    primary_table: "reports",
    joins: [],
    filters,
    fields_required: fields,
  };
};

const buildSchemaAwareQueryPlan = (message = "") => {
  const query = stripPlanningInstruction(message);
  const entity = detectEntity(query);
  const intent = detectIntent(query);
  const basePlan = {
    entity,
    intent,
    primary_table: detectPrimaryTable(entity, query),
    joins: [],
    filters: [],
    fields_required: [],
  };

  if (entity === "faculty") {
    return applyFacultyPlan(query, basePlan);
  }

  if (entity === "placement") {
    return applyPlacementPlan(query, basePlan);
  }

  if (entity === "report") {
    return applyReportPlan(query, basePlan);
  }

  return applyStudentPlan(query, basePlan);
};

module.exports = {
  buildSchemaAwareQueryPlan,
  shouldBuildSchemaAwareQueryPlan,
};
