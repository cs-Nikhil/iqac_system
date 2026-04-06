const Student = require("../models/Student");
const {
  calculateStudentPerformance,
} = require("./performance.service");
const {
  buildInstitutionalChart,
} = require("./institutionalChart.service");
const {
  buildInstitutionalInsights,
} = require("./institutionalInsightEngine.service");
const {
  parseInstitutionalQuery,
  shouldUseInstitutionalQueryParser,
} = require("./institutionalQueryParser.service");
const {
  buildStudentMongoQuery,
} = require("./institutionalQueryBuilder.service");

const normalizeStudentRow = (student = {}) => {
  const performance = calculateStudentPerformance(student);

  return {
    id: String(student._id || ""),
    name: student.name || null,
    rollNumber: student.rollNumber || null,
    department: student.department?.name || null,
    departmentCode: student.department?.code || null,
    cgpa: student.cgpa ?? null,
    averageAttendance: student.academicRecords?.avgAttendance ?? null,
    currentBacklogs: student.currentBacklogs ?? 0,
    performanceScore: performance.performanceScore ?? null,
    performanceCategory: performance.category || student.performanceCategory || null,
  };
};

const formatFilterValue = (filter = {}) => {
  if (typeof filter.value === "boolean") {
    return filter.value ? "true" : "false";
  }

  return String(filter.value);
};

const buildFilterSummary = (filtersApplied = []) => {
  if (!filtersApplied.length) {
    return "all active students";
  }

  return filtersApplied
    .map((filter) => `${filter.field} ${filter.operator} ${formatFilterValue(filter)}`)
    .join(" and ");
};

const shouldUseInstitutionalAnalyticsEngine = (message = "") => {
  const normalized = String(message || "").toLowerCase();

  if (!shouldUseInstitutionalQueryParser(message)) {
    return false;
  }

  return !/\b(report|summary|analysis|insight|compare|comparison|faculty|placement|event|department-wise|subject)\b/.test(
    normalized
  ) && !/\b(top|highest|lowest|best|worst|rank|ranking|at risk)\b/.test(
    normalized
  );
};

const runInstitutionalAnalyticsEngine = async ({
  message = "",
  liveFacts = {},
} = {}) => {
  if (!shouldUseInstitutionalAnalyticsEngine(message)) {
    return null;
  }

  const parsedQuery = await parseInstitutionalQuery(message);
  if (!parsedQuery) {
    return null;
  }

  const {
    query,
    filtersApplied,
    selectedDepartment,
  } = await buildStudentMongoQuery(parsedQuery.filters || []);

  const students = await Student.find(query)
    .select(
      "name rollNumber cgpa currentBacklogs academicRecords.avgAttendance academicRecords.semesterCgpa department performanceCategory"
    )
    .populate("department", "name code")
    .sort({
      cgpa: 1,
      "academicRecords.avgAttendance": 1,
      currentBacklogs: -1,
      name: 1,
    })
    .lean();

  const rows = students.map(normalizeStudentRow);
  const chart = buildInstitutionalChart({
    message,
    students,
    rows,
    filtersApplied,
  });
  const analytics = await buildInstitutionalInsights({
    message,
    rows,
    chart,
    filtersApplied,
    selectedDepartment,
  });
  const total = rows.length;
  const filterSummary = buildFilterSummary(filtersApplied);
  const reply = total
    ? `I found ${total} students matching ${filterSummary}.`
    : `I could not find students matching ${filterSummary}.`;

  return {
    success: true,
    type: "data",
    entity: "student",
    queryType: "institutional-analytics",
    title: "Institutional Student Analytics",
    reply,
    total,
    count: total,
    totalRecords: total,
    returnedRecords: total,
    rows,
    data: rows,
    contextData: rows,
    extraData: rows,
    filters_applied: filtersApplied,
    chart,
    insights: analytics.insights,
    recommendations: analytics.recommendations,
    summary: {
      count: total,
      department: selectedDepartment?.code || selectedDepartment?.name || null,
      filtersApplied: filtersApplied,
      ...analytics.summary,
    },
    responseType: rows.length ? "table" : "text",
    provider: analytics.provider || "database",
    model: analytics.model || null,
    sourceDatabase: liveFacts.sourceDatabase || "mongodb",
    usedLiveData: true,
    smartProcessed: true,
  };
};

module.exports = {
  runInstitutionalAnalyticsEngine,
  shouldUseInstitutionalAnalyticsEngine,
};
