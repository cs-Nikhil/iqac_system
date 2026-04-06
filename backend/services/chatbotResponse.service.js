const { isTopQuery } = require("./chatbotStudentData.service");
const { getGeminiIntent } = require("./geminiIntent.service");

const REPORT_PATTERN = /\b(report|summary|analysis|pdf|docx|export|generate|download)\b/i;
const INSIGHT_PATTERN = /\b(why|suggest|improve|predict|recommend|analy[sz]e|insight|insights|compare)\b/i;
const COUNT_PATTERN = /\b(total|count|how many|number of)\b/i;
const DATA_PATTERN = /\b(show|list|get|student|students|faculty|faculties|cgpa|department|departments|attendance|marks|result|results|backlog|backlogs|placement|placements|research|document|documents|subject|subjects|event|events|user|users|roll number)\b/i;
const GREETING_PATTERN = /\b(hi|hello|hey|good morning|good afternoon|good evening|greetings)\b/i;
const THANKS_PATTERN = /\b(thanks|thank you|thx)\b/i;
const HELP_PATTERN = /\b(help|what can you do|how can you help)\b/i;
const AMBIGUOUS_QUESTION_PATTERN = /\b(how is|how are|which|weak|weaker|weakest|strong|stronger|strongest|better|worse|best|worst|status|performance)\b/i;
const INTENT_CONFIDENCE_THRESHOLD = 0.6;

const normalizeMessage = (message = "") =>
  String(message).trim().toLowerCase();

const isGreetingOnly = (message = "") => {
  const normalized = normalizeMessage(message)
    .replace(/[!?.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return false;
  }

  return (
    GREETING_PATTERN.test(normalized) &&
    !DATA_PATTERN.test(normalized) &&
    !REPORT_PATTERN.test(normalized) &&
    !INSIGHT_PATTERN.test(normalized)
  );
};

const isThanksOnly = (message = "") => {
  const normalized = normalizeMessage(message)
    .replace(/[!?.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return THANKS_PATTERN.test(normalized) && normalized.split(/\s+/).length <= 5;
};

const detectIntentWithConfidence = (message = "") => {
  const normalized = normalizeMessage(message);

  if (isGreetingOnly(normalized) || isThanksOnly(normalized) || HELP_PATTERN.test(normalized)) {
    return { intent: "chat", confidence: 0.98, source: "rule" };
  }

  if (REPORT_PATTERN.test(normalized)) {
    return { intent: "report", confidence: 0.93, source: "rule" };
  }

  if (INSIGHT_PATTERN.test(normalized)) {
    return { intent: "insight", confidence: 0.9, source: "rule" };
  }

  if (COUNT_PATTERN.test(normalized)) {
    return { intent: "count", confidence: 0.9, source: "rule" };
  }

  if (AMBIGUOUS_QUESTION_PATTERN.test(normalized)) {
    return { intent: "insight", confidence: 0.55, source: "rule" };
  }

  if (DATA_PATTERN.test(normalized) || isTopQuery(normalized)) {
    return { intent: "data", confidence: 0.82, source: "rule" };
  }

  return { intent: "unknown", confidence: 0.3, source: "rule" };
};

const normalizeIntentResult = (result = {}) => ({
  ...result,
  intent: result.intent === "unknown" ? "chat" : result.intent,
});

const detectIntent = (message = "") => {
  return normalizeIntentResult(detectIntentWithConfidence(message));
};

const resolveIntent = async (message = "") => {
  const localResult = detectIntent(message);
  const shouldUseGemini = localResult.confidence < INTENT_CONFIDENCE_THRESHOLD;

  if (!shouldUseGemini) {
    return {
      ...localResult,
      source: "Local",
      resolvedBy: "Local",
      geminiUsed: false,
    };
  }

  const geminiIntent = await getGeminiIntent(message);
  if (geminiIntent) {
    return {
      intent: geminiIntent,
      confidence: localResult.confidence,
      localIntent: localResult.intent,
      source: "Gemini",
      resolvedBy: "Gemini",
      geminiUsed: true,
    };
  }

  return {
    ...localResult,
    source: "Gemini",
    resolvedBy: "LocalFallback",
    geminiUsed: false,
  };
};

const buildGreetingReply = (liveFacts = {}) => {
  const activeStudents = liveFacts.overview?.activeStudents;
  const totalDepartments = liveFacts.overview?.totalDepartments;
  const scope = Number.isFinite(activeStudents) && Number.isFinite(totalDepartments)
    ? `I can see ${activeStudents} active students across ${totalDepartments} departments right now.`
    : null;

  return [
    "Hello! I am Jorvis, your IQAC assistant.",
    scope,
    "Ask me about students, departments, placements, reports, or academic analytics.",
  ].filter(Boolean).join(" ");
};

const buildHelpReply = () => (
  "I can help with student records, faculty data, department performance, CGPA, attendance, placements, and report generation."
);

const getDeterministicReply = (message = "", liveFacts = {}) => {
  if (isGreetingOnly(message)) {
    return buildGreetingReply(liveFacts);
  }

  if (isThanksOnly(message)) {
    return "You're welcome. Ask me for any IQAC data or report whenever you need it.";
  }

  if (HELP_PATTERN.test(normalizeMessage(message))) {
    return buildHelpReply();
  }

  return null;
};

const extractTitle = (value = "", fallback = "Jorvis Response") => {
  const title = String(value)
    .split("\n")
    .map((line) => line.trim().replace(/^#\s*/, ""))
    .find(Boolean);

  return title || fallback;
};

const inferContentType = (category, data = {}) => {
  if (data.responseType) {
    return data.responseType;
  }

  if (category === "report" || (Array.isArray(data.tables) && data.tables.length)) {
    return "report";
  }

  if (Array.isArray(data.rows) && data.rows.length) {
    return "table";
  }

  return "text";
};

const pluralize = (count, singular, plural = `${singular}s`) =>
  Number(count) === 1 ? singular : plural;

const normalizeSummaryData = (summary) =>
  summary && typeof summary === "object" && !Array.isArray(summary) ? summary : {};

const humanizeKey = (value = "") =>
  String(value)
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (match) => match.toUpperCase());

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isPrimitiveValue = (value) =>
  ["string", "number", "boolean"].includes(typeof value) || value === null;

const METRIC_LABELS = {
  placementPercentage: "Placement Percentage",
  passPercentage: "Pass Percentage",
  averageCGPA: "Average CGPA",
  avgCGPA: "Average CGPA",
  cgpa: "CGPA",
  averageAttendance: "Average Attendance",
  avgAttendance: "Average Attendance",
  attendance: "Attendance",
  currentBacklogs: "Current Backlogs",
  backlogCount: "Current Backlogs",
  backlogs: "Current Backlogs",
  package: "Package",
  avgPackage: "Average Package",
  maxPackage: "Highest Package",
  citations: "Citations",
  impactFactor: "Impact Factor",
  publications: "Publications",
  participants: "Participants",
  score: "Score",
  placedCount: "Placed Students",
  totalStudents: "Total Students",
  totalFaculty: "Total Faculty",
  totalPapers: "Total Papers",
  count: "Count",
  value: "Value",
};

const formatMetricValue = (value, field = "") => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return value == null || value === "" ? "N/A" : String(value);
  }

  if (
    ["placementPercentage", "passPercentage", "averageAttendance", "avgAttendance", "attendance"].includes(
      field
    )
  ) {
    return `${numericValue.toFixed(2).replace(/\.00$/, "")}%`;
  }

  if (["cgpa", "averageCGPA", "avgCGPA", "avgPackage", "maxPackage", "package", "impactFactor", "score"].includes(field)) {
    return numericValue.toFixed(2).replace(/\.00$/, "");
  }

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(2).replace(/\.00$/, "");
};

const getRowLabel = (row = {}) => {
  if (!isPlainObject(row)) {
    return "Record";
  }

  if (row.deptName || row.deptCode) {
    return row.deptName && row.deptCode
      ? `${row.deptName} (${row.deptCode})`
      : row.deptName || row.deptCode;
  }

  if (row.department && row.code) {
    return `${row.department} (${row.code})`;
  }

  if (row.name && row.rollNumber) {
    return `${row.name} (${row.rollNumber})`;
  }

  if (row.name && row.rollNo) {
    return `${row.name} (${row.rollNo})`;
  }

  if (row.studentName && row.rollNumber) {
    return `${row.studentName} (${row.rollNumber})`;
  }

  if (row.studentName || row.student) {
    return row.studentName || row.student;
  }

  if (row.subjectName || row.subjectCode) {
    return row.subjectName && row.subjectCode
      ? `${row.subjectName} (${row.subjectCode})`
      : row.subjectName || row.subjectCode;
  }

  if (row.title) return row.title;
  if (row.faculty) return row.faculty;
  if (row.company) return row.company;
  if (row.department) return row.department;
  if (row.name) return row.name;

  return "Record";
};

const getShortRowLabel = (row = {}) => {
  if (!isPlainObject(row)) {
    return "Record";
  }

  return (
    row.deptCode ||
    row.code ||
    row.rollNumber ||
    row.rollNo ||
    row.subjectCode ||
    row.studentName ||
    row.name ||
    row.company ||
    row.department ||
    row.title ||
    "Record"
  );
};

const SUMMARY_HIGHLIGHT_EXCLUDE = new Set([
  "queryType",
  "query_type",
  "responseType",
  "response_type",
]);

const getSummaryHighlights = (summaryData = {}) =>
  Object.entries(summaryData || {})
    .filter(
      ([key, value]) =>
        !SUMMARY_HIGHLIGHT_EXCLUDE.has(key) &&
        isPrimitiveValue(value) &&
        value !== null &&
        value !== ""
    )
    .map(([key, value]) => ({
      label: humanizeKey(key),
      value: formatMetricValue(value, key),
    }));

const includesKeyword = (text = "", keywords = []) =>
  keywords.some((keyword) => text.includes(keyword));

const inferMetricField = ({ rows = [], data = {}, title = "", reply = "" }) => {
  const normalizedRows = rows.filter((row) => isPlainObject(row));
  if (!normalizedRows.length) {
    return null;
  }

  const availableFields = new Set();
  normalizedRows.forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      if (Number.isFinite(Number(value))) {
        availableFields.add(key);
      }
    });
  });

  if (!availableFields.size) {
    return null;
  }

  const haystack = `${title} ${reply}`.toLowerCase();
  const preferredFields = [];

  if (data.queryType === "top" || includesKeyword(haystack, ["cgpa"])) {
    preferredFields.push("cgpa", "averageCGPA", "avgCGPA");
  }

  if (data.queryType === "low") {
    preferredFields.push("cgpa", "averageCGPA", "avgCGPA");
  }

  if (data.queryType === "attendance" || includesKeyword(haystack, ["attendance"])) {
    preferredFields.push("averageAttendance", "avgAttendance", "attendance");
  }

  if (data.queryType === "backlog" || includesKeyword(haystack, ["backlog"])) {
    preferredFields.push("backlogCount", "currentBacklogs", "backlogs");
  }

  if (includesKeyword(haystack, ["placement", "package"])) {
    preferredFields.push("placementPercentage", "package", "avgPackage", "maxPackage", "placedCount");
  }

  if (includesKeyword(haystack, ["pass"])) {
    preferredFields.push("passPercentage");
  }

  if (includesKeyword(haystack, ["citation"])) {
    preferredFields.push("citations");
  }

  if (includesKeyword(haystack, ["impact"])) {
    preferredFields.push("impactFactor");
  }

  if (includesKeyword(haystack, ["publication", "research"])) {
    preferredFields.push("publications", "citations");
  }

  if (includesKeyword(haystack, ["participant", "event"])) {
    preferredFields.push("participants");
  }

  preferredFields.push(
    "placementPercentage",
    "passPercentage",
    "cgpa",
    "averageCGPA",
    "avgCGPA",
    "averageAttendance",
    "avgAttendance",
    "attendance",
    "package",
    "avgPackage",
    "maxPackage",
    "currentBacklogs",
    "backlogCount",
    "citations",
    "impactFactor",
    "publications",
    "participants",
    "score",
    "count",
    "value"
  );

  return preferredFields.find((field) => availableFields.has(field)) || [...availableFields][0];
};

const shouldUseComparisonMode = ({ title = "", reply = "" }) =>
  /\b(compare|comparison)\b/i.test(`${title} ${reply}`);

const shouldUseRankingMode = ({ data = {}, entity = null, metricField = null, title = "", reply = "" }) => {
  if (!metricField) {
    return false;
  }

  if (["top", "low", "attendance", "backlog"].includes(data.queryType)) {
    return true;
  }

  if (shouldUseComparisonMode({ title, reply })) {
    return false;
  }

  const haystack = `${title} ${reply}`.toLowerCase();
  if (includesKeyword(haystack, ["best", "highest", "lowest", "worst", "rank", "ranking"])) {
    return true;
  }

  return entity === "department" && ["placementPercentage", "passPercentage", "averageCGPA", "avgCGPA", "averageAttendance", "avgAttendance"].includes(metricField);
};

const buildAnswerChart = ({ rows = [], metricField = null, metricLabel = "", title = "" }) => {
  if (!metricField || rows.length < 2) {
    return null;
  }

  const chartRows = rows
    .filter((row) => Number.isFinite(Number(row?.[metricField])))
    .slice(0, 8)
    .map((row) => ({
      label: getShortRowLabel(row),
      value: Number(row[metricField]),
    }));

  if (!chartRows.length) {
    return null;
  }

  const hasLongLabels = chartRows.some((row) => String(row.label || "").length > 12);

  return {
    type: hasLongLabels ? "horizontalBar" : "bar",
    title: metricLabel ? `${metricLabel} Snapshot` : title || "Supporting Metrics",
    subtitle: title || "Top supporting results",
    data: chartRows,
    xKey: "label",
    yKey: "value",
    format:
      ["placementPercentage", "passPercentage", "averageAttendance", "avgAttendance", "attendance"].includes(
        metricField
      )
        ? "percentage"
        : ["cgpa", "averageCGPA", "avgCGPA", "package", "avgPackage", "maxPackage", "impactFactor", "score"].includes(
              metricField
            )
          ? "decimal"
          : "integer",
  };
};

const buildDataAnswerCard = ({
  data = {},
  rows = [],
  summaryData = {},
  entity = null,
  title = "",
  reply = "",
  summaryText = "",
  totalRecords = 0,
  returnedRecords = 0,
}) => {
  const normalizedRows = rows.filter((row) => isPlainObject(row));
  const metricField = inferMetricField({
    rows: normalizedRows,
    data,
    title,
    reply,
  });
  const metricLabel = metricField
    ? METRIC_LABELS[metricField] || humanizeKey(metricField)
    : "Key Metric";
  const comparisonMode = shouldUseComparisonMode({ title, reply });
  const rankingMode = shouldUseRankingMode({
    data,
    entity,
    metricField,
    title,
    reply,
  });
  const primaryRow = normalizedRows[0] || null;
  const entityLabel = entity || "record";
  const autoChartEnabled =
    rankingMode ||
    comparisonMode ||
    /\b(placement|percentage|cgpa|attendance|backlog|package|citation|impact|compare|comparison|trend)\b/i.test(
      `${title} ${reply}`
    );

  let headline = title || "Structured Answer";
  if (!normalizedRows.length) {
    headline = `No matching ${pluralize(0, entityLabel)} found.`;
  } else if (comparisonMode) {
    headline = `Compared ${normalizedRows.length} ${pluralize(normalizedRows.length, entityLabel)}.`;
  } else if (rankingMode && primaryRow) {
    const direction =
      data.queryType === "low" ||
      /\b(low|lowest|worst)\b/i.test(`${title} ${reply}`)
        ? "lowest"
        : "highest";
    headline = `${getRowLabel(primaryRow)} has the ${direction} ${metricLabel.toLowerCase()} at ${formatMetricValue(
      primaryRow[metricField],
      metricField
    )}.`;
  } else if (normalizedRows.length === 1 && primaryRow) {
    headline = `${getRowLabel(primaryRow)} matches your query.`;
  } else {
    headline = `Found ${returnedRecords || normalizedRows.length} ${pluralize(
      returnedRecords || normalizedRows.length,
      entityLabel
    )}${totalRecords > (returnedRecords || normalizedRows.length) ? ` out of ${totalRecords}` : ""}.`;
  }

  const highlights = [];

  if (rankingMode && primaryRow && metricField) {
    highlights.push({
      label: metricLabel,
      value: formatMetricValue(primaryRow[metricField], metricField),
    });
  }

  if (primaryRow && rankingMode) {
    highlights.push({
      label: humanizeKey(entityLabel),
      value: getRowLabel(primaryRow),
    });
  }

  if (comparisonMode && metricField && normalizedRows.length) {
    const sortedRows = [...normalizedRows].sort(
      (left, right) => Number(right?.[metricField] || 0) - Number(left?.[metricField] || 0)
    );
    const bestRow = sortedRows[0];
    if (bestRow) {
      highlights.push({
        label: `Best ${metricLabel}`,
        value: `${getRowLabel(bestRow)} · ${formatMetricValue(bestRow[metricField], metricField)}`,
      });
    }
  }

  highlights.push(
    ...getSummaryHighlights(summaryData)
      .filter((item) => !highlights.some((highlight) => highlight.label === item.label))
      .slice(0, 4 - highlights.length)
  );

  if (!highlights.some((item) => item.label === "Rows Shown") && normalizedRows.length) {
    highlights.push({
      label: "Rows Shown",
      value: String(returnedRecords || normalizedRows.length),
    });
  }

  if (
    totalRecords &&
    totalRecords !== (returnedRecords || normalizedRows.length) &&
    !highlights.some((item) => item.label === "Total Records")
  ) {
    highlights.push({
      label: "Total Records",
      value: String(totalRecords),
    });
  }

  return {
    headline,
    summary: summaryText || reply || "Structured answer generated from live data.",
    highlights: highlights.slice(0, 6),
    table: normalizedRows,
    chart:
      data.chart && Array.isArray(data.chart.data) && data.chart.data.length
        ? data.chart
        : autoChartEnabled
          ? buildAnswerChart({
              rows: normalizedRows,
              metricField,
              metricLabel,
              title,
            })
          : null,
    tableTitle: title || `${humanizeKey(entityLabel)} Details`,
  };
};

const buildCountAnswerCard = ({
  title = "Count",
  reply = "",
  entity = null,
  total = 0,
  filters = {},
  selectedDepartment = null,
}) => {
  const highlights = [
    {
      label: "Count",
      value: formatMetricValue(total, "count"),
    },
  ];

  if (selectedDepartment?.code || selectedDepartment?.name) {
    highlights.push({
      label: "Department",
      value: selectedDepartment.code || selectedDepartment.name,
    });
  }

  Object.entries(filters || {})
    .filter(([, value]) => isPrimitiveValue(value) && value !== null && value !== "")
    .slice(0, 3)
    .forEach(([key, value]) => {
      if (!highlights.some((item) => item.label === humanizeKey(key))) {
        highlights.push({
          label: humanizeKey(key),
          value: String(value),
        });
      }
    });

  return {
    headline: `${title}: ${formatMetricValue(total, "count")}`,
    summary: reply || `Found ${total} matching ${pluralize(total, entity || "record")}.`,
    highlights,
    table: [],
    chart: null,
    tableTitle: title,
  };
};

const inferSemanticType = (category, data = {}) => {
  if (data.type === "insight" || data.type === "insight_fallback") {
    return "insight";
  }

  if (["data", "report", "insight", "chat", "fallback"].includes(category)) {
    return category;
  }

  return "chat";
};

const inferEntity = (category, data = {}) => {
  if (data.entity) {
    return data.entity;
  }

  const queryType = String(data.queryType || "").toLowerCase();
  if (["top", "low", "general", "backlog", "attendance", "cgpa", "marks"].includes(queryType)) {
    return "student";
  }

  if (queryType === "placement") {
    return "placement";
  }

  const extraType = String(data.extraData?.type || "").toLowerCase();
  if (extraType.includes("department")) return "department";
  if (extraType.includes("placement")) return "placement";
  if (extraType.includes("faculty")) return "faculty";
  if (extraType.includes("event")) return "event";
  if (extraType.includes("student")) return "student";

  const haystack = `${data.title || ""} ${data.reply || ""}`.toLowerCase();
  if (haystack.includes("department")) return "department";
  if (haystack.includes("placement")) return "placement";
  if (haystack.includes("faculty")) return "faculty";
  if (haystack.includes("event")) return "event";
  if (haystack.includes("student")) return "student";

  if (category === "insight") return "insight";
  if (category === "data") return "student";
  if (category === "report") return "report";
  return null;
};

const getDefaultTitle = ({ category, data = {}, entity }) => {
  const queryType = String(data.queryType || "").toLowerCase();

  if (queryType === "top") return "Top Performing Students";
  if (queryType === "low") return "Low Performing Students";
  if (queryType === "backlog") return "Students With Backlogs";
  if (queryType === "attendance") return "Attendance Watchlist";
  if (queryType === "placement") return "Placement Analysis";
  if (category === "insight") return "AI Insights";

  if (category === "report") {
    if (entity === "department") return "Department Performance Report";
    if (entity === "placement") return "Placement Analysis";
    if (entity === "faculty") return "Faculty Report";
    if (entity === "event") return "Event Participation Report";
    if (entity === "student") return "Student Performance Report";
    return "IQAC Report";
  }

  if (category === "data") {
    if (entity === "department") return "Department Records";
    if (entity === "placement") return "Placement Records";
    if (entity === "faculty") return "Faculty Records";
    if (entity === "event") return "Event Records";
    return "Student Records";
  }

  if (category === "fallback") return "Jorvis Update";
  return "Jorvis Response";
};

const buildSummaryText = ({
  category,
  data = {},
  entity,
  summaryData = {},
  rows = [],
  count = 0,
}) => {
  if (typeof data.summary === "string" && data.summary.trim()) {
    return data.summary.trim();
  }

  if (typeof data.summaryText === "string" && data.summaryText.trim()) {
    return data.summaryText.trim();
  }

  const returnedCount = rows.length;
  const departmentLabel = summaryData.department || null;
  const entityLabel = entity || "record";

  if (category === "data") {
    if (data.queryType === "top") {
      return `Showing top ${count || returnedCount} students based on CGPA${departmentLabel ? ` in ${departmentLabel}` : ""}.`;
    }

    if (data.queryType === "low") {
      return `Showing the lowest ${count || returnedCount} students based on CGPA${departmentLabel ? ` in ${departmentLabel}` : ""}.`;
    }

    if (data.queryType === "backlog") {
      return count
        ? `Showing ${returnedCount} of ${count} students with pending backlogs.`
        : "No students with pending backlogs were found.";
    }

    if (data.queryType === "attendance") {
      return count
        ? `Showing ${returnedCount} students who need attendance attention.`
        : "No attendance exceptions were found.";
    }

    if (count) {
      return `Showing ${returnedCount} of ${count} matching ${pluralize(count, entityLabel)}${departmentLabel ? ` for ${departmentLabel}` : ""}.`;
    }

    return `No matching ${pluralize(0, entityLabel)} were found.`;
  }

  if (category === "report") {
    const tableCount = Array.isArray(data.tables) ? data.tables.length : 0;
    const sectionCount = Array.isArray(data.sections) ? data.sections.length : 0;
    if (tableCount || sectionCount) {
      return `Generated a structured ${entityLabel} report with ${tableCount} ${pluralize(tableCount, "table")} and ${sectionCount} ${pluralize(sectionCount, "section")}.`;
    }

    return `Generated a live ${entityLabel} report for review.`;
  }

  if (category === "insight") {
    return data.success === false
      ? (data.reply || "Insight generation is temporarily unavailable.")
      : "AI-generated analysis based on the latest academic context.";
  }

  if (category === "chat") {
    return data.provider === "deterministic"
      ? "Quick assistant response generated from built-in guidance."
      : "AI-generated assistant response for the current question.";
  }

  return data.reply || "I could not process that request.";
};

const buildPrimaryData = ({ category, data = {}, rows = [], summaryData = {} }) => {
  if (category === "report") {
    if (data.extraData && typeof data.extraData === "object" && !Array.isArray(data.extraData)) {
      return data.extraData;
    }

    return {
      rows,
      summary: summaryData,
      tables: Array.isArray(data.tables) ? data.tables : [],
      sections: Array.isArray(data.sections) ? data.sections : [],
      insights: data.insights || null,
    };
  }

  if (category === "insight") {
    if (data.extraData !== undefined) {
      return data.extraData;
    }

    if (data.insights) {
      return data.insights;
    }

    return summaryData;
  }

  if (Array.isArray(data.extraData)) {
    return data.extraData;
  }

  if (Array.isArray(rows) && rows.length) {
    return rows;
  }

  if (data.extraData !== undefined) {
    return data.extraData;
  }

  return [];
};

const buildMetaSource = (category, provider) => {
  if (provider === "gemini" || provider === "ai") return "ai";
  if (provider === "database") return "database";
  if (provider === "report") return "database";
  if (provider === "deterministic") return "ai";
  if (category === "report" || category === "data") return "database";
  if (category === "insight" || category === "chat") return "ai";
  return "fallback";
};

const getDefaultProvider = (category) => {
  if (category === "data") return "database";
  if (category === "report") return "report";
  if (category === "chat") return "gemini";
  return "fallback";
};

const formatUnifiedResponse = ({ type, data = {} }) => {
  const semanticType = inferSemanticType(type, data);
  const reply = data.reply || data.message || "I could not process that request.";
  const summaryData = normalizeSummaryData(data.summaryData || data.summary);
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const count =
    data.count !== undefined
      ? Number(data.count)
      : Array.isArray(data.extraData)
        ? data.extraData.length
        : rows.length;
  const totalRecords = Number.isFinite(Number(data.totalRecords))
    ? Number(data.totalRecords)
    : count;
  const returnedRecords = Number.isFinite(Number(data.returnedRecords))
    ? Number(data.returnedRecords)
    : rows.length;
  const entity = inferEntity(semanticType, data);
  const title = data.title || getDefaultTitle({
    category: semanticType,
    data,
    entity,
  }) || extractTitle(reply);
  const summary = buildSummaryText({
    category: semanticType,
    data,
    entity,
    summaryData,
    rows,
    count,
  });
  const provider = data.provider || getDefaultProvider(semanticType);
  const responseType = inferContentType(semanticType, data);
  const primaryData = buildPrimaryData({
    category: semanticType,
    data,
    rows,
    summaryData,
  });
  const answerCard =
    data.answerCard ||
    (semanticType === "count"
      ? buildCountAnswerCard({
          title,
          reply,
          entity,
          total: data.value ?? data.total ?? data.count ?? 0,
          filters: data.filters || {},
          selectedDepartment: data.selectedDepartment || null,
        })
      : semanticType === "data" || semanticType === "table" || semanticType === "top_performers"
        ? buildDataAnswerCard({
            data,
            rows,
            summaryData,
            entity,
            title,
            reply,
            summaryText: summary,
            totalRecords,
            returnedRecords,
          })
        : null);
  const presentation =
    data.presentation ||
    (answerCard && (semanticType === "data" || semanticType === "count")
      ? { variant: "answer_card" }
      : null);
  const paginationMeta = data.pagination
    ? {
        ...data.pagination,
        returned: rows.length,
        total: count,
        hasMore: count > rows.length,
      }
    : count > rows.length
      ? {
          returned: rows.length,
          total: count,
          hasMore: true,
        }
      : null;

  return {
    success: typeof data.success === "boolean" ? data.success : true,
    message: data.message || reply,
    reply,
    type: semanticType,
    title,
    summary,
    data: primaryData,
    entity,
    contextUsed: Boolean(data.contextUsed),
    ...(presentation ? { presentation } : {}),
    ...(answerCard ? { answerCard } : {}),
    meta: {
      ...(data.meta || {}),
      count,
      returned: rows.length,
      totalRecords,
      returnedRecords,
      generatedAt: new Date().toISOString(),
      source: buildMetaSource(semanticType, provider),
      entity,
      queryType: data.queryType || null,
      contextUsed: Boolean(data.contextUsed),
      responseType,
      sourceDatabase: data.sourceDatabase || null,
      usedLiveData: Boolean(data.usedLiveData),
      ...(Array.isArray(data.filters_applied)
        ? { filters_applied: data.filters_applied }
        : {}),
      ...(Array.isArray(data.applied_filters)
        ? { applied_filters: data.applied_filters }
        : {}),
      ...(data.debug ? { debug: data.debug } : {}),
      ...(typeof data.isFull === "boolean" ? { isFull: data.isFull } : {}),
      ...(data.displayMessage ? { displayMessage: data.displayMessage } : {}),
      ...(paginationMeta ? { pagination: paginationMeta } : {}),
    },
    responseType,
    ...(data.count !== undefined ? { count: data.count } : {}),
    ...(data.total !== undefined ? { total: data.total } : {}),
    ...(data.queryType ? { queryType: data.queryType } : {}),
    rows,
    summaryData,
    tables: Array.isArray(data.tables) ? data.tables : [],
    sections: Array.isArray(data.sections) ? data.sections : [],
    insights: data.insights || null,
    recommendations: Array.isArray(data.recommendations)
      ? data.recommendations
      : null,
    chart: data.chart || null,
    ...(Array.isArray(data.filters_applied)
      ? { filters_applied: data.filters_applied }
      : {}),
    ...(Array.isArray(data.applied_filters)
      ? { applied_filters: data.applied_filters }
      : {}),
    ...(data.debug ? { debug: data.debug } : {}),
    ...(data.totalRecords !== undefined ? { totalRecords } : {}),
    ...(data.returnedRecords !== undefined ? { returnedRecords } : {}),
    ...(typeof data.isFull === "boolean" ? { isFull: data.isFull } : {}),
    ...(typeof data.fullRequest === "boolean" ? { fullRequest: data.fullRequest } : {}),
    ...(data.displayMessage ? { displayMessage: data.displayMessage } : {}),
      ...(data.pagination ? { pagination: data.pagination } : {}),
      ...(data.value !== undefined && data.value !== null ? { value: data.value } : {}),
    model: data.model || null,
    provider,
    sourceDatabase: data.sourceDatabase || null,
    usedLiveData: Boolean(data.usedLiveData),
  };
};

module.exports = {
  detectIntent,
  detectIntentWithConfidence,
  formatUnifiedResponse,
  getDeterministicReply,
  isTopQuery,
  resolveIntent,
};
