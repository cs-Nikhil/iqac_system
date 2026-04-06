const roundTo = (value, digits = 2) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Number(numericValue.toFixed(digits));
};

const toInteger = (value, fallback = 0) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(numericValue));
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeText = (value, fallback = "") => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
};

const getTitle = (reportResponse = {}, fallback = "Report") =>
  normalizeText(reportResponse.title, fallback).replace(/^#\s*/, "");

const getDisplayRows = (reportResponse = {}) => {
  const candidates = [
    reportResponse.rows,
    reportResponse.data?.rows,
    reportResponse.extraData?.rows,
    reportResponse.extraData?.sample,
    ...(Array.isArray(reportResponse.tables)
      ? reportResponse.tables.map((table) => table?.rows)
      : []),
  ];

  const rows = candidates.find((value) => Array.isArray(value));
  return Array.isArray(rows) ? rows : [];
};

const getAnalysisRows = (reportResponse = {}) => {
  const candidates = [
    reportResponse.contextData,
    reportResponse.extraData?.contextData,
    reportResponse.extraData?.fullRows,
    reportResponse.data?.contextData,
    reportResponse.rows,
    reportResponse.data?.rows,
    reportResponse.extraData?.rows,
    reportResponse.extraData?.sample,
    ...(Array.isArray(reportResponse.tables)
      ? reportResponse.tables.map((table) => table?.rows)
      : []),
  ];

  const rows = candidates.find((value) => Array.isArray(value));
  return Array.isArray(rows) ? rows : [];
};

const inferEntityFromRows = (rows = [], fallback = null) => {
  if (fallback) {
    return fallback;
  }

  const sampleRow = rows.find((row) => isPlainObject(row));
  if (!sampleRow) {
    return "student";
  }

  if (
    "applicationStatus" in sampleRow &&
    ("company" in sampleRow || "role" in sampleRow)
  ) {
    return "placement_application";
  }

  if (
    "deadline" in sampleRow &&
    "status" in sampleRow &&
    ("applications" in sampleRow || "eligibleStudents" in sampleRow)
  ) {
    return "placement_drive";
  }

  if (
    "cgpa" in sampleRow ||
    "rollNo" in sampleRow ||
    "rollNumber" in sampleRow ||
    "averageAttendance" in sampleRow ||
    "currentBacklogs" in sampleRow
  ) {
    return "student";
  }

  if ("designation" in sampleRow || "experience" in sampleRow) {
    return "faculty";
  }

  if ("package" in sampleRow || "company" in sampleRow) {
    return "placement";
  }

  if ("avgCGPA" in sampleRow || "placementPercentage" in sampleRow) {
    return "department";
  }

  if ("citations" in sampleRow || "impactFactor" in sampleRow || "journal" in sampleRow) {
    return "research";
  }

  if ("points" in sampleRow || "achievementTitle" in sampleRow || "level" in sampleRow) {
    return "achievement";
  }

  if ("documentType" in sampleRow || "criteria" in sampleRow) {
    return "document";
  }

  if ("complianceLevel" in sampleRow) {
    return "naac";
  }

  if ("complianceScore" in sampleRow) {
    return "nba";
  }

  if ("participants" in sampleRow || "startDate" in sampleRow || "eventType" in sampleRow) {
    return "event";
  }

  return "student";
};

const normalizeDepartmentName = (value) => {
  if (typeof value === "string") {
    return value.trim() || "Unknown";
  }

  if (isPlainObject(value)) {
    return value.name || value.code || "Unknown";
  }

  return "Unknown";
};

const toSnakeCase = (value = "") =>
  String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .replace(/__+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

const toCamelCase = (value = "") => {
  const normalized = toSnakeCase(value);
  return normalized.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
};

const humanizeLabel = (value = "") =>
  String(value)
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

const normalizeStatusLabel = (value, fallback = "Unknown") => {
  const text = normalizeText(value, fallback);
  return text
    .split(/\s+/)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(" ");
};

const toPositiveInteger = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return Math.trunc(numericValue);
};

const getRequestedLimit = (reportResponse = {}) =>
  toPositiveInteger(
    reportResponse.meta?.requestedLimit ??
      reportResponse.limit ??
      reportResponse.data?.limit ??
      null
  );

const getSortDescriptor = (reportResponse = {}) => {
  const candidate =
    reportResponse.meta?.sort ||
    reportResponse.sort ||
    reportResponse.data?.sort ||
    null;

  return isPlainObject(candidate) ? candidate : null;
};

const getReportScope = (reportResponse = {}, displayRows = [], analysisRows = []) => {
  const candidate =
    reportResponse.meta?.scope ||
    reportResponse.reportScope ||
    reportResponse.data?.reportScope ||
    null;

  if (candidate === "ranked_subset" || candidate === "full_preview") {
    return candidate;
  }

  if (analysisRows.length > displayRows.length) {
    return "full_preview";
  }

  return getRequestedLimit(reportResponse) ? "ranked_subset" : "full_preview";
};

const compact = (items = []) => items.filter(Boolean);

const sumNumeric = (rows = [], selector) =>
  rows.reduce((sum, row) => sum + Number(selector(row) || 0), 0);

const averageNumeric = (rows = [], selector) =>
  rows.length ? roundTo(sumNumeric(rows, selector) / rows.length) : 0;

const medianNumeric = (values = []) => {
  const normalized = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  if (!normalized.length) {
    return 0;
  }

  const midpoint = Math.floor(normalized.length / 2);
  if (normalized.length % 2 === 0) {
    return roundTo((normalized[midpoint - 1] + normalized[midpoint]) / 2);
  }

  return roundTo(normalized[midpoint]);
};

const buildCountRows = (
  rows = [],
  getLabel,
  { labelKey = "label", valueKey = "value", limit = null } = {}
) => {
  const counts = rows.reduce((map, row) => {
    const label = normalizeText(getLabel(row), "Unknown");
    map.set(label, (map.get(label) || 0) + 1);
    return map;
  }, new Map());

  const mappedRows = [...counts.entries()]
    .map(([label, value]) => ({
      [labelKey]: label,
      [valueKey]: value,
    }))
    .sort(
      (left, right) =>
        Number(right[valueKey] || 0) - Number(left[valueKey] || 0) ||
        String(left[labelKey]).localeCompare(String(right[labelKey]))
    );

  return limit ? mappedRows.slice(0, limit) : mappedRows;
};

const buildAverageRows = (
  rows = [],
  getLabel,
  getValue,
  { labelKey = "label", valueKey = "value", limit = null } = {}
) => {
  const grouped = rows.reduce((map, row) => {
    const label = normalizeText(getLabel(row), "Unknown");
    const numericValue = Number(getValue(row));
    if (!Number.isFinite(numericValue)) {
      return map;
    }

    const current = map.get(label) || { total: 0, count: 0 };
    current.total += numericValue;
    current.count += 1;
    map.set(label, current);
    return map;
  }, new Map());

  const mappedRows = [...grouped.entries()]
    .map(([label, value]) => ({
      [labelKey]: label,
      [valueKey]: value.count ? roundTo(value.total / value.count) : 0,
    }))
    .sort(
      (left, right) =>
        Number(right[valueKey] || 0) - Number(left[valueKey] || 0) ||
        String(left[labelKey]).localeCompare(String(right[labelKey]))
    );

  return limit ? mappedRows.slice(0, limit) : mappedRows;
};

const buildSumRows = (
  rows = [],
  getLabel,
  getValue,
  { labelKey = "label", valueKey = "value", limit = null } = {}
) => {
  const grouped = rows.reduce((map, row) => {
    const label = normalizeText(getLabel(row), "Unknown");
    const numericValue = Number(getValue(row));
    if (!Number.isFinite(numericValue)) {
      return map;
    }

    map.set(label, (map.get(label) || 0) + numericValue);
    return map;
  }, new Map());

  const mappedRows = [...grouped.entries()]
    .map(([label, value]) => ({
      [labelKey]: label,
      [valueKey]: roundTo(value),
    }))
    .sort(
      (left, right) =>
        Number(right[valueKey] || 0) - Number(left[valueKey] || 0) ||
        String(left[labelKey]).localeCompare(String(right[labelKey]))
    );

  return limit ? mappedRows.slice(0, limit) : mappedRows;
};

const createChart = ({
  id,
  type,
  title,
  subtitle = "",
  data = [],
  xKey = "label",
  yKey = "value",
  nameKey = "name",
  valueKey = "value",
  format = "number",
}) => {
  if (!Array.isArray(data) || !data.length) {
    return null;
  }

  return {
    id,
    type,
    title,
    ...(subtitle ? { subtitle } : {}),
    data,
    xKey,
    yKey,
    nameKey,
    valueKey,
    format,
  };
};

const buildReportMeta = ({
  entity,
  reportResponse,
  displayTable = [],
  exportTable = [],
  analysisRows = [],
}) => {
  const scope = getReportScope(reportResponse, displayTable, analysisRows);
  const requestedLimit = getRequestedLimit(reportResponse);
  const sortDescriptor = getSortDescriptor(reportResponse);

  return {
    entity,
    scope,
    requestedLimit,
    sort: sortDescriptor,
    totalRows: analysisRows.length,
    displayRows: displayTable.length,
    exportRows: exportTable.length,
  };
};

const pluralize = (value, singular, plural = `${singular}s`) =>
  Number(value) === 1 ? singular : plural;

const buildReportSummaryText = (meta = {}, entityLabel = "records") => {
  const displayLabel = pluralize(meta.displayRows, entityLabel);
  const exportLabel = pluralize(meta.exportRows, entityLabel);
  const scopeText =
    meta.scope === "ranked_subset"
      ? `Showing ${meta.displayRows} ranked ${displayLabel} here. Export includes the same ${meta.exportRows} ${exportLabel}.`
      : meta.displayRows < meta.exportRows
        ? `Previewing ${meta.displayRows} ${displayLabel} here. Export includes all ${meta.exportRows} ${exportLabel}.`
        : `Showing all ${meta.displayRows} ${displayLabel} here and in export.`;
  const sortText =
    meta.scope === "ranked_subset" && meta.sort?.field
      ? ` Ranked by ${humanizeLabel(meta.sort.field)} (${meta.sort.order === "asc" ? "ascending" : "descending"}).`
      : "";

  return `${scopeText}${sortText}`.trim();
};

const buildTables = (title, displayTable = []) =>
  displayTable.length
    ? [
        {
          title,
          rows: displayTable,
        },
      ]
    : [];

const buildResponsePayload = ({
  reportResponse,
  entity,
  title,
  summary,
  charts,
  displayTable,
  exportTable,
  tableTitle,
  entityLabel,
}) => {
  const meta = buildReportMeta({
    entity,
    reportResponse,
    displayTable,
    exportTable,
    analysisRows: exportTable,
  });

  return {
    type: "report",
    entity,
    title,
    summary,
    charts: charts.filter(Boolean),
    table: displayTable,
    exportTable,
    tables: buildTables(tableTitle, displayTable),
    summaryText: buildReportSummaryText(meta, entityLabel),
    meta,
  };
};

const normalizeStudentRow = (row = {}) => {
  const name = normalizeText(row.name, "Unknown");
  const rollNo = normalizeText(row.rollNo || row.rollNumber, "");
  const department = normalizeDepartmentName(row.department);
  const cgpa = roundTo(row.cgpa);
  const attendance = roundTo(
    row.attendance ?? row.averageAttendance ?? row.avgAttendance
  );
  const backlogs = toInteger(row.backlogs ?? row.currentBacklogs);
  const category =
    cgpa > 8 ? "Excellent" : cgpa >= 7 ? "Good" : cgpa >= 6 ? "Average" : "At Risk";

  return {
    name,
    rollNo,
    department,
    cgpa,
    attendance,
    category,
    backlogs,
  };
};

const formatStudentReport = (
  reportResponse = {},
  displayRows = [],
  analysisRows = []
) => {
  const displayTable = (displayRows.length ? displayRows : analysisRows).map(normalizeStudentRow);
  const analysisTable = (analysisRows.length ? analysisRows : displayRows).map(
    normalizeStudentRow
  );

  const categoryChartRows = buildCountRows(
    analysisTable,
    (row) => row.category,
    { labelKey: "category", valueKey: "students" }
  );
  const avgCgpaByDepartment = buildAverageRows(
    analysisTable,
    (row) => row.department,
    (row) => row.cgpa,
    { labelKey: "department", valueKey: "avgCgpa" }
  );
  const backlogByDepartment = buildAverageRows(
    analysisTable,
    (row) => row.department,
    (row) => row.backlogs,
    { labelKey: "department", valueKey: "avgBacklogs" }
  );

  return buildResponsePayload({
    reportResponse,
    entity: "student",
    title: getTitle(reportResponse, "Student Report"),
    summary: {
      total_students: analysisTable.length,
      avg_cgpa: averageNumeric(analysisTable, (row) => row.cgpa),
      avg_attendance: averageNumeric(analysisTable, (row) => row.attendance),
      avg_backlogs: averageNumeric(analysisTable, (row) => row.backlogs),
      at_risk_count: categoryChartRows.find((row) => row.category === "At Risk")?.students || 0,
      excellent_count:
        categoryChartRows.find((row) => row.category === "Excellent")?.students || 0,
    },
    charts: compact([
      createChart({
        id: "student-performance-distribution",
        type: "pie",
        title: "Performance Distribution",
        subtitle: "Students by CGPA category",
        data: categoryChartRows,
        nameKey: "category",
        valueKey: "students",
        format: "integer",
      }),
      createChart({
        id: "student-cgpa-by-department",
        type: "bar",
        title: "Average CGPA by Department",
        subtitle: "Department-wise CGPA trend",
        data: avgCgpaByDepartment,
        xKey: "department",
        yKey: "avgCgpa",
        format: "decimal",
      }),
      createChart({
        id: "student-backlog-by-department",
        type: "horizontalBar",
        title: "Average Backlogs by Department",
        subtitle: "Backlog burden across departments",
        data: backlogByDepartment,
        xKey: "department",
        yKey: "avgBacklogs",
        format: "decimal",
      }),
    ]),
    displayTable,
    exportTable: analysisTable,
    tableTitle: "Student Details",
    entityLabel: "student row",
  });
};

const normalizeFacultyRow = (row = {}) => ({
  name: normalizeText(row.name, "Unknown"),
  department: normalizeDepartmentName(row.department),
  experience: roundTo(row.experience),
  publications: toInteger(row.publications),
  designation: normalizeText(row.designation, ""),
  specialization: normalizeText(row.specialization, ""),
});

const formatFacultyReport = (
  reportResponse = {},
  displayRows = [],
  analysisRows = []
) => {
  const displayTable = (displayRows.length ? displayRows : analysisRows).map(normalizeFacultyRow);
  const analysisTable = (analysisRows.length ? analysisRows : displayRows).map(
    normalizeFacultyRow
  );
  const facultyByDepartment = buildCountRows(
    analysisTable,
    (row) => row.department,
    { labelKey: "department", valueKey: "facultyCount" }
  );
  const experienceByDepartment = buildAverageRows(
    analysisTable,
    (row) => row.department,
    (row) => row.experience,
    { labelKey: "department", valueKey: "avgExperience" }
  );
  const publicationsByDepartment = buildSumRows(
    analysisTable,
    (row) => row.department,
    (row) => row.publications,
    { labelKey: "department", valueKey: "publications" }
  );

  return buildResponsePayload({
    reportResponse,
    entity: "faculty",
    title: getTitle(reportResponse, "Faculty Report"),
    summary: {
      total_faculty: analysisTable.length,
      avg_experience: averageNumeric(analysisTable, (row) => row.experience),
      total_publications: sumNumeric(analysisTable, (row) => row.publications),
      senior_faculty_count: analysisTable.filter((row) => row.experience >= 15).length,
    },
    charts: compact([
      createChart({
        id: "faculty-by-department",
        type: "horizontalBar",
        title: "Faculty Strength by Department",
        subtitle: "Total faculty members per department",
        data: facultyByDepartment,
        xKey: "department",
        yKey: "facultyCount",
        format: "integer",
      }),
      createChart({
        id: "faculty-experience-by-department",
        type: "bar",
        title: "Average Experience by Department",
        subtitle: "Department-wise experience profile",
        data: experienceByDepartment,
        xKey: "department",
        yKey: "avgExperience",
        format: "decimal",
      }),
      createChart({
        id: "faculty-publications-by-department",
        type: "bar",
        title: "Publications by Department",
        subtitle: "Department contribution to research output",
        data: publicationsByDepartment,
        xKey: "department",
        yKey: "publications",
        format: "integer",
      }),
    ]),
    displayTable,
    exportTable: analysisTable,
    tableTitle: "Faculty Details",
    entityLabel: "faculty row",
  });
};

const normalizePlacementRow = (row = {}) => ({
  studentName: normalizeText(row.studentName || row.student, "Unknown"),
  rollNumber: normalizeText(row.rollNumber, ""),
  company: normalizeText(row.company, "Unknown"),
  role: normalizeText(row.role, ""),
  package: roundTo(row.package),
  placementType: normalizeText(row.placementType, ""),
  academicYear: normalizeText(row.academicYear, ""),
  department: normalizeDepartmentName(row.department),
});

const getPackageBand = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "Unknown";
  }

  if (numericValue < 5) return "Below 5 LPA";
  if (numericValue < 10) return "5 - 10 LPA";
  if (numericValue < 15) return "10 - 15 LPA";
  return "15+ LPA";
};

const formatPlacementReport = (
  reportResponse = {},
  displayRows = [],
  analysisRows = []
) => {
  const displayTable = (displayRows.length ? displayRows : analysisRows).map(
    normalizePlacementRow
  );
  const analysisTable = (analysisRows.length ? analysisRows : displayRows).map(
    normalizePlacementRow
  );
  const placementCountsByDepartment = buildCountRows(
    analysisTable,
    (row) => row.department,
    { labelKey: "department", valueKey: "placedStudents" }
  );
  const averagePackageByDepartment = buildAverageRows(
    analysisTable,
    (row) => row.department,
    (row) => row.package,
    { labelKey: "department", valueKey: "averagePackage" }
  );
  const packageBandDistribution = buildCountRows(
    analysisTable,
    (row) => getPackageBand(row.package),
    { labelKey: "band", valueKey: "students" }
  );
  const recruiterHires = buildCountRows(
    analysisTable,
    (row) => row.company,
    { labelKey: "company", valueKey: "hires", limit: 8 }
  );

  const packages = analysisTable.map((row) => row.package);
  const uniqueRecruiters = new Set(
    analysisTable.map((row) => row.company).filter((value) => value && value !== "Unknown")
  ).size;
  const summary = {
    total_placed_students: analysisTable.length,
    average_package_lpa: averageNumeric(analysisTable, (row) => row.package),
    median_package_lpa: medianNumeric(packages),
    highest_package_lpa: analysisTable.length
      ? Math.max(...analysisTable.map((row) => Number(row.package || 0)))
      : 0,
    unique_recruiters: uniqueRecruiters,
  };

  const totalStudents = Number(reportResponse.summary?.totalStudents);
  const placementPercentage = Number(reportResponse.summary?.placementPercentage);
  if (Number.isFinite(totalStudents) && totalStudents > analysisTable.length) {
    summary.total_students_considered = toInteger(totalStudents);
  }
  if (
    getReportScope(reportResponse, displayTable, analysisTable) === "full_preview" &&
    Number.isFinite(placementPercentage) &&
    placementPercentage > 0
  ) {
    summary.placement_percentage = roundTo(placementPercentage);
  }

  return buildResponsePayload({
    reportResponse,
    entity: "placement",
    title: getTitle(reportResponse, "Placement Report"),
    summary,
    charts: compact([
      createChart({
        id: "placement-by-department",
        type: "horizontalBar",
        title: "Placements by Department",
        subtitle: "Placed students across departments",
        data: placementCountsByDepartment,
        xKey: "department",
        yKey: "placedStudents",
        format: "integer",
      }),
      createChart({
        id: "placement-average-package",
        type: "bar",
        title: "Average Package by Department",
        subtitle: "Department-wise compensation trend",
        data: averagePackageByDepartment,
        xKey: "department",
        yKey: "averagePackage",
        format: "decimal",
      }),
      createChart({
        id: "placement-package-band",
        type: "pie",
        title: "Package Band Distribution",
        subtitle: "How offers are spread across package ranges",
        data: packageBandDistribution,
        nameKey: "band",
        valueKey: "students",
        format: "integer",
      }),
      createChart({
        id: "placement-top-recruiters",
        type: "horizontalBar",
        title: "Top Recruiters by Hires",
        subtitle: "Companies with the most placements",
        data: recruiterHires,
        xKey: "company",
        yKey: "hires",
        format: "integer",
      }),
    ]),
    displayTable,
    exportTable: analysisTable,
    tableTitle: "Placement Details",
    entityLabel: "placement row",
  });
};

const normalizePlacementDriveRow = (row = {}) => ({
  company: normalizeText(row.company, "Unknown"),
  role: normalizeText(row.role, ""),
  academicYear: normalizeText(row.academicYear, ""),
  package: roundTo(row.package),
  status: normalizeStatusLabel(row.status),
  deadline: normalizeText(row.deadline, ""),
  driveDate: normalizeText(row.driveDate, ""),
  department: normalizeDepartmentName(row.departments?.[0] || row.department),
  minCgpa: roundTo(row.minCgpa),
  maxBacklogs: toInteger(row.maxBacklogs),
  eligibleStudents: toInteger(row.eligibleStudents),
  applications: toInteger(row.applications),
  shortlisted: toInteger(row.shortlisted),
  selected: toInteger(row.selected),
});

const formatPlacementDriveReport = (
  reportResponse = {},
  displayRows = [],
  analysisRows = []
) => {
  const displayTable = (displayRows.length ? displayRows : analysisRows).map(
    normalizePlacementDriveRow
  );
  const analysisTable = (analysisRows.length ? analysisRows : displayRows).map(
    normalizePlacementDriveRow
  );

  const statusCounts = buildCountRows(
    analysisTable,
    (row) => row.status,
    { labelKey: "status", valueKey: "drives" }
  );
  const applicationsByCompany = buildSumRows(
    analysisTable,
    (row) => row.company,
    (row) => row.applications,
    { labelKey: "company", valueKey: "applications", limit: 8 }
  );

  return buildResponsePayload({
    reportResponse,
    entity: "placement_drive",
    title: getTitle(reportResponse, "Placement Drive Report"),
    summary: {
      total_drives: analysisTable.length,
      open_drives: analysisTable.filter((row) => row.status === "Open").length,
      upcoming_drives: analysisTable.filter((row) => row.status === "Upcoming").length,
      closed_drives: analysisTable.filter((row) => row.status === "Closed").length,
      total_applications: sumNumeric(analysisTable, (row) => row.applications),
    },
    charts: compact([
      createChart({
        id: "placement-drive-status",
        type: "pie",
        title: "Drive Status Distribution",
        subtitle: "Open, upcoming, and closed drive mix",
        data: statusCounts,
        nameKey: "status",
        valueKey: "drives",
        format: "integer",
      }),
      createChart({
        id: "placement-drive-applications",
        type: "horizontalBar",
        title: "Applications by Drive",
        subtitle: "Top drives by application volume",
        data: applicationsByCompany,
        xKey: "company",
        yKey: "applications",
        format: "integer",
      }),
    ]),
    displayTable,
    exportTable: analysisTable,
    tableTitle: "Placement Drive Details",
    entityLabel: "drive row",
  });
};

const normalizePlacementApplicationRow = (row = {}) => ({
  studentName: normalizeText(row.studentName || row.student, "Unknown"),
  rollNumber: normalizeText(row.rollNumber, ""),
  department: normalizeDepartmentName(row.department),
  company: normalizeText(row.company, "Unknown"),
  role: normalizeText(row.role, ""),
  academicYear: normalizeText(row.academicYear, ""),
  package: roundTo(row.package),
  applicationStatus: normalizeStatusLabel(row.applicationStatus || row.status),
  appliedAt: normalizeText(row.appliedAt, ""),
  deadline: normalizeText(row.deadline, ""),
});

const formatPlacementApplicationReport = (
  reportResponse = {},
  displayRows = [],
  analysisRows = []
) => {
  const displayTable = (displayRows.length ? displayRows : analysisRows).map(
    normalizePlacementApplicationRow
  );
  const analysisTable = (analysisRows.length ? analysisRows : displayRows).map(
    normalizePlacementApplicationRow
  );

  const statusCounts = buildCountRows(
    analysisTable,
    (row) => row.applicationStatus,
    { labelKey: "status", valueKey: "applications" }
  );
  const companyCounts = buildCountRows(
    analysisTable,
    (row) => row.company,
    { labelKey: "company", valueKey: "applications", limit: 8 }
  );

  return buildResponsePayload({
    reportResponse,
    entity: "placement_application",
    title: getTitle(reportResponse, "Placement Application Report"),
    summary: {
      total_applications: analysisTable.length,
      selected_applications:
        statusCounts.find((row) => row.status === "Selected")?.applications || 0,
      shortlisted_applications:
        statusCounts.find((row) => row.status === "Shortlisted")?.applications || 0,
      rejected_applications:
        statusCounts.find((row) => row.status === "Rejected")?.applications || 0,
    },
    charts: compact([
      createChart({
        id: "placement-application-status",
        type: "pie",
        title: "Application Status Distribution",
        subtitle: "Current placement application stages",
        data: statusCounts,
        nameKey: "status",
        valueKey: "applications",
        format: "integer",
      }),
      createChart({
        id: "placement-application-company",
        type: "horizontalBar",
        title: "Applications by Company",
        subtitle: "Where students have applied most",
        data: companyCounts,
        xKey: "company",
        yKey: "applications",
        format: "integer",
      }),
    ]),
    displayTable,
    exportTable: analysisTable,
    tableTitle: "Placement Application Details",
    entityLabel: "application row",
  });
};

const normalizeDepartmentRow = (row = {}) => ({
  department: normalizeText(row.department || row.name, "Unknown"),
  code: normalizeText(row.code, ""),
  totalStudents: toInteger(row.totalStudents),
  avgCgpa: roundTo(row.avgCgpa ?? row.avgCGPA ?? row.averageCGPA),
  avgAttendance: roundTo(row.avgAttendance ?? row.averageAttendance),
  placementPercentage: roundTo(row.placementPercentage),
});

const formatDepartmentReport = (
  reportResponse = {},
  displayRows = [],
  analysisRows = []
) => {
  const displayTable = (displayRows.length ? displayRows : analysisRows).map(
    normalizeDepartmentRow
  );
  const analysisTable = (analysisRows.length ? analysisRows : displayRows).map(
    normalizeDepartmentRow
  );

  return buildResponsePayload({
    reportResponse,
    entity: "department",
    title: getTitle(reportResponse, "Department Report"),
    summary: {
      total_departments: analysisTable.length,
      total_students: sumNumeric(analysisTable, (row) => row.totalStudents),
      avg_cgpa: averageNumeric(analysisTable, (row) => row.avgCgpa),
      avg_attendance: averageNumeric(analysisTable, (row) => row.avgAttendance),
      placement_rate: averageNumeric(analysisTable, (row) => row.placementPercentage),
    },
    charts: compact([
      createChart({
        id: "department-cgpa",
        type: "bar",
        title: "Average CGPA by Department",
        subtitle: "Academic performance across departments",
        data: analysisTable.map((row) => ({
          department: row.code || row.department,
          avgCgpa: row.avgCgpa,
        })),
        xKey: "department",
        yKey: "avgCgpa",
        format: "decimal",
      }),
      createChart({
        id: "department-placement-rate",
        type: "bar",
        title: "Placement Percentage by Department",
        subtitle: "Placement performance across departments",
        data: analysisTable.map((row) => ({
          department: row.code || row.department,
          placementPercentage: row.placementPercentage,
        })),
        xKey: "department",
        yKey: "placementPercentage",
        format: "percentage",
      }),
      createChart({
        id: "department-strength",
        type: "horizontalBar",
        title: "Student Strength by Department",
        subtitle: "Total enrolled students per department",
        data: analysisTable.map((row) => ({
          department: row.code || row.department,
          totalStudents: row.totalStudents,
        })),
        xKey: "department",
        yKey: "totalStudents",
        format: "integer",
      }),
    ]),
    displayTable,
    exportTable: analysisTable,
    tableTitle: "Department Details",
    entityLabel: "department row",
  });
};

const normalizeResearchRow = (row = {}) => ({
  title: normalizeText(row.title, "Untitled"),
  faculty: normalizeText(row.faculty, ""),
  department: normalizeDepartmentName(row.department),
  journal: normalizeText(row.journal, ""),
  year: toInteger(row.year, 0),
  citations: toInteger(row.citations),
  impactFactor: roundTo(row.impactFactor),
});

const formatResearchReport = (
  reportResponse = {},
  displayRows = [],
  analysisRows = []
) => {
  const displayTable = (displayRows.length ? displayRows : analysisRows).map(normalizeResearchRow);
  const analysisTable = (analysisRows.length ? analysisRows : displayRows).map(
    normalizeResearchRow
  );
  const papersByDepartment = buildCountRows(
    analysisTable,
    (row) => row.department,
    { labelKey: "department", valueKey: "papers" }
  );
  const citationsByDepartment = buildSumRows(
    analysisTable,
    (row) => row.department,
    (row) => row.citations,
    { labelKey: "department", valueKey: "citations" }
  );
  const papersByYear = buildCountRows(
    analysisTable.filter((row) => row.year > 0),
    (row) => String(row.year),
    { labelKey: "year", valueKey: "papers" }
  );

  return buildResponsePayload({
    reportResponse,
    entity: "research",
    title: getTitle(reportResponse, "Research Publication Report"),
    summary: {
      total_research_papers: analysisTable.length,
      total_citations: sumNumeric(analysisTable, (row) => row.citations),
      avg_citations: averageNumeric(analysisTable, (row) => row.citations),
      avg_impact_factor: averageNumeric(analysisTable, (row) => row.impactFactor),
    },
    charts: compact([
      createChart({
        id: "research-by-department",
        type: "horizontalBar",
        title: "Publications by Department",
        subtitle: "Department contribution to research output",
        data: papersByDepartment,
        xKey: "department",
        yKey: "papers",
        format: "integer",
      }),
      createChart({
        id: "research-citations-by-department",
        type: "bar",
        title: "Citations by Department",
        subtitle: "Citation strength across departments",
        data: citationsByDepartment,
        xKey: "department",
        yKey: "citations",
        format: "integer",
      }),
      createChart({
        id: "research-publications-by-year",
        type: "line",
        title: "Publication Trend by Year",
        subtitle: "Year-wise research volume",
        data: papersByYear.sort((left, right) => Number(left.year) - Number(right.year)),
        xKey: "year",
        yKey: "papers",
        format: "integer",
      }),
    ]),
    displayTable,
    exportTable: analysisTable,
    tableTitle: "Research Publication Details",
    entityLabel: "publication row",
  });
};

const normalizeAchievementRow = (row = {}) => ({
  title: normalizeText(row.title || row.achievementTitle, "Untitled"),
  faculty: normalizeText(row.faculty, ""),
  department: normalizeDepartmentName(row.department),
  level: normalizeText(row.level, "Unknown"),
  points: roundTo(row.points),
  date: normalizeText(row.date, ""),
});

const formatAchievementReport = (
  reportResponse = {},
  displayRows = [],
  analysisRows = []
) => {
  const displayTable = (displayRows.length ? displayRows : analysisRows).map(
    normalizeAchievementRow
  );
  const analysisTable = (analysisRows.length ? analysisRows : displayRows).map(
    normalizeAchievementRow
  );
  const achievementByDepartment = buildCountRows(
    analysisTable,
    (row) => row.department,
    { labelKey: "department", valueKey: "achievements" }
  );
  const levelDistribution = buildCountRows(
    analysisTable,
    (row) => row.level,
    { labelKey: "level", valueKey: "achievements" }
  );
  const pointsByLevel = buildAverageRows(
    analysisTable,
    (row) => row.level,
    (row) => row.points,
    { labelKey: "level", valueKey: "avgPoints" }
  );

  return buildResponsePayload({
    reportResponse,
    entity: "achievement",
    title: getTitle(reportResponse, "Faculty Achievement Report"),
    summary: {
      total_achievements: analysisTable.length,
      total_points: sumNumeric(analysisTable, (row) => row.points),
      avg_points: averageNumeric(analysisTable, (row) => row.points),
      unique_faculty: new Set(
        analysisTable.map((row) => row.faculty).filter(Boolean)
      ).size,
    },
    charts: compact([
      createChart({
        id: "achievement-by-department",
        type: "horizontalBar",
        title: "Achievements by Department",
        subtitle: "Department-wise achievement volume",
        data: achievementByDepartment,
        xKey: "department",
        yKey: "achievements",
        format: "integer",
      }),
      createChart({
        id: "achievement-level-distribution",
        type: "pie",
        title: "Achievement Level Distribution",
        subtitle: "Spread across recognition levels",
        data: levelDistribution,
        nameKey: "level",
        valueKey: "achievements",
        format: "integer",
      }),
      createChart({
        id: "achievement-points-by-level",
        type: "bar",
        title: "Average Points by Level",
        subtitle: "Relative impact by achievement level",
        data: pointsByLevel,
        xKey: "level",
        yKey: "avgPoints",
        format: "decimal",
      }),
    ]),
    displayTable,
    exportTable: analysisTable,
    tableTitle: "Achievement Details",
    entityLabel: "achievement row",
  });
};

const normalizeDocumentRow = (row = {}) => ({
  title: normalizeText(row.title, "Untitled"),
  documentType: normalizeText(row.documentType || row.type, "Unknown"),
  status: normalizeStatusLabel(row.status),
  criteria: normalizeText(row.criteria, ""),
  department: normalizeDepartmentName(row.department),
  academicYear: normalizeText(row.academicYear, ""),
});

const formatDocumentReport = (
  reportResponse = {},
  displayRows = [],
  analysisRows = []
) => {
  const displayTable = (displayRows.length ? displayRows : analysisRows).map(normalizeDocumentRow);
  const analysisTable = (analysisRows.length ? analysisRows : displayRows).map(
    normalizeDocumentRow
  );
  const statusDistribution = buildCountRows(
    analysisTable,
    (row) => row.status,
    { labelKey: "status", valueKey: "documents" }
  );
  const criteriaCounts = buildCountRows(
    analysisTable.filter((row) => row.criteria),
    (row) => row.criteria,
    { labelKey: "criteria", valueKey: "documents", limit: 10 }
  );
  const typeCounts = buildCountRows(
    analysisTable,
    (row) => row.documentType,
    { labelKey: "documentType", valueKey: "documents", limit: 10 }
  );

  return buildResponsePayload({
    reportResponse,
    entity: "document",
    title: getTitle(reportResponse, "Document Report"),
    summary: {
      total_documents: analysisTable.length,
      approved_count:
        statusDistribution.find((row) => row.status === "Approved")?.documents || 0,
      pending_count:
        statusDistribution.find((row) => row.status === "Pending")?.documents || 0,
      required_count:
        statusDistribution.find((row) => row.status === "Required")?.documents || 0,
    },
    charts: compact([
      createChart({
        id: "document-status-distribution",
        type: "pie",
        title: "Document Status Distribution",
        subtitle: "Approval readiness of documentation",
        data: statusDistribution,
        nameKey: "status",
        valueKey: "documents",
        format: "integer",
      }),
      createChart({
        id: "document-criteria-coverage",
        type: "bar",
        title: "Documents by Criteria",
        subtitle: "Criteria-wise document coverage",
        data: criteriaCounts,
        xKey: "criteria",
        yKey: "documents",
        format: "integer",
      }),
      createChart({
        id: "document-type-distribution",
        type: "horizontalBar",
        title: "Documents by Type",
        subtitle: "Document-type distribution",
        data: typeCounts,
        xKey: "documentType",
        yKey: "documents",
        format: "integer",
      }),
    ]),
    displayTable,
    exportTable: analysisTable,
    tableTitle: "Document Details",
    entityLabel: "document row",
  });
};

const normalizeNaacRow = (row = {}) => ({
  criterion: normalizeText(row.criterion || row.criteria, "Unknown"),
  title: normalizeText(row.title, "Untitled"),
  status: normalizeStatusLabel(row.status),
  complianceLevel: normalizeText(row.complianceLevel, "Unknown"),
  academicYear: normalizeText(row.academicYear, ""),
});

const formatNaacReport = (
  reportResponse = {},
  displayRows = [],
  analysisRows = []
) => {
  const displayTable = (displayRows.length ? displayRows : analysisRows).map(normalizeNaacRow);
  const analysisTable = (analysisRows.length ? analysisRows : displayRows).map(
    normalizeNaacRow
  );
  const statusDistribution = buildCountRows(
    analysisTable,
    (row) => row.status,
    { labelKey: "status", valueKey: "criteriaRows" }
  );
  const complianceDistribution = buildCountRows(
    analysisTable,
    (row) => row.complianceLevel,
    { labelKey: "complianceLevel", valueKey: "criteriaRows" }
  );
  const criteriaCoverage = buildCountRows(
    analysisTable,
    (row) => row.criterion,
    { labelKey: "criterion", valueKey: "criteriaRows", limit: 10 }
  );

  return buildResponsePayload({
    reportResponse,
    entity: "naac",
    title: getTitle(reportResponse, "NAAC Readiness Report"),
    summary: {
      total_criteria_rows: analysisTable.length,
      completed_count:
        statusDistribution.find((row) => row.status === "Completed")?.criteriaRows || 0,
      compliant_count:
        complianceDistribution.find((row) => row.complianceLevel === "Compliant")
          ?.criteriaRows || 0,
      pending_count:
        statusDistribution.find((row) => row.status === "Pending")?.criteriaRows || 0,
    },
    charts: compact([
      createChart({
        id: "naac-status-distribution",
        type: "pie",
        title: "NAAC Status Distribution",
        subtitle: "Readiness status across criteria rows",
        data: statusDistribution,
        nameKey: "status",
        valueKey: "criteriaRows",
        format: "integer",
      }),
      createChart({
        id: "naac-compliance-level",
        type: "bar",
        title: "NAAC Compliance Levels",
        subtitle: "Distribution of compliance levels",
        data: complianceDistribution,
        xKey: "complianceLevel",
        yKey: "criteriaRows",
        format: "integer",
      }),
      createChart({
        id: "naac-criteria-coverage",
        type: "horizontalBar",
        title: "NAAC Criteria Coverage",
        subtitle: "Rows covered under each criterion",
        data: criteriaCoverage,
        xKey: "criterion",
        yKey: "criteriaRows",
        format: "integer",
      }),
    ]),
    displayTable,
    exportTable: analysisTable,
    tableTitle: "NAAC Criteria Details",
    entityLabel: "criteria row",
  });
};

const normalizeNbaRow = (row = {}) => ({
  criterion: normalizeText(row.criterion || row.criteria, "Unknown"),
  title: normalizeText(row.title, "Untitled"),
  status: normalizeStatusLabel(row.status),
  complianceScore: roundTo(row.complianceScore),
  department: normalizeDepartmentName(row.department),
});

const formatNbaReport = (
  reportResponse = {},
  displayRows = [],
  analysisRows = []
) => {
  const displayTable = (displayRows.length ? displayRows : analysisRows).map(normalizeNbaRow);
  const analysisTable = (analysisRows.length ? analysisRows : displayRows).map(
    normalizeNbaRow
  );
  const statusDistribution = buildCountRows(
    analysisTable,
    (row) => row.status,
    { labelKey: "status", valueKey: "criteriaRows" }
  );
  const scoreByCriterion = buildAverageRows(
    analysisTable,
    (row) => row.criterion,
    (row) => row.complianceScore,
    { labelKey: "criterion", valueKey: "avgComplianceScore", limit: 10 }
  );
  const scoreByDepartment = buildAverageRows(
    analysisTable,
    (row) => row.department,
    (row) => row.complianceScore,
    { labelKey: "department", valueKey: "avgComplianceScore" }
  );

  return buildResponsePayload({
    reportResponse,
    entity: "nba",
    title: getTitle(reportResponse, "NBA Readiness Report"),
    summary: {
      total_criteria_rows: analysisTable.length,
      met_count:
        statusDistribution.find((row) => row.status === "Met")?.criteriaRows || 0,
      pending_count:
        statusDistribution.find((row) => row.status === "Pending")?.criteriaRows || 0,
      avg_compliance_score: averageNumeric(analysisTable, (row) => row.complianceScore),
    },
    charts: compact([
      createChart({
        id: "nba-status-distribution",
        type: "pie",
        title: "NBA Status Distribution",
        subtitle: "Readiness status across NBA criteria",
        data: statusDistribution,
        nameKey: "status",
        valueKey: "criteriaRows",
        format: "integer",
      }),
      createChart({
        id: "nba-score-by-criterion",
        type: "bar",
        title: "Average Compliance Score by Criterion",
        subtitle: "Criterion-wise NBA readiness",
        data: scoreByCriterion,
        xKey: "criterion",
        yKey: "avgComplianceScore",
        format: "decimal",
      }),
      createChart({
        id: "nba-score-by-department",
        type: "horizontalBar",
        title: "Average Compliance Score by Department",
        subtitle: "Department-wise NBA readiness",
        data: scoreByDepartment,
        xKey: "department",
        yKey: "avgComplianceScore",
        format: "decimal",
      }),
    ]),
    displayTable,
    exportTable: analysisTable,
    tableTitle: "NBA Criteria Details",
    entityLabel: "criteria row",
  });
};

const normalizeEventRow = (row = {}) => ({
  title: normalizeText(row.title, "Untitled"),
  type: normalizeText(row.type || row.eventType, "Unknown"),
  department: normalizeDepartmentName(row.department),
  startDate: normalizeText(row.startDate || row.date, ""),
  participants: toInteger(row.participants),
  attended: toInteger(row.attended),
});

const formatEventReport = (
  reportResponse = {},
  displayRows = [],
  analysisRows = []
) => {
  const displayTable = (displayRows.length ? displayRows : analysisRows).map(normalizeEventRow);
  const analysisTable = (analysisRows.length ? analysisRows : displayRows).map(
    normalizeEventRow
  );
  const eventTypeCounts = buildCountRows(
    analysisTable,
    (row) => row.type,
    { labelKey: "type", valueKey: "events" }
  );
  const participantsByType = buildAverageRows(
    analysisTable,
    (row) => row.type,
    (row) => row.participants,
    { labelKey: "type", valueKey: "avgParticipants" }
  );
  const participantsByDepartment = buildSumRows(
    analysisTable,
    (row) => row.department,
    (row) => row.participants,
    { labelKey: "department", valueKey: "participants" }
  );

  return buildResponsePayload({
    reportResponse,
    entity: "event",
    title: getTitle(reportResponse, "Event Participation Report"),
    summary: {
      total_events: analysisTable.length,
      total_participants: sumNumeric(analysisTable, (row) => row.participants),
      total_attended: sumNumeric(analysisTable, (row) => row.attended),
      attendance_rate: analysisTable.length
        ? roundTo(
            (sumNumeric(analysisTable, (row) => row.attended) /
              Math.max(sumNumeric(analysisTable, (row) => row.participants), 1)) *
              100
          )
        : 0,
    },
    charts: compact([
      createChart({
        id: "event-type-distribution",
        type: "pie",
        title: "Event Type Distribution",
        subtitle: "Distribution of event categories",
        data: eventTypeCounts,
        nameKey: "type",
        valueKey: "events",
        format: "integer",
      }),
      createChart({
        id: "event-participants-by-type",
        type: "bar",
        title: "Average Participants by Event Type",
        subtitle: "Participation intensity by event type",
        data: participantsByType,
        xKey: "type",
        yKey: "avgParticipants",
        format: "decimal",
      }),
      createChart({
        id: "event-participants-by-department",
        type: "horizontalBar",
        title: "Participants by Department",
        subtitle: "Department contribution to event participation",
        data: participantsByDepartment,
        xKey: "department",
        yKey: "participants",
        format: "integer",
      }),
    ]),
    displayTable,
    exportTable: analysisTable,
    tableTitle: "Event Details",
    entityLabel: "event row",
  });
};

const GENERIC_SUMMARY_BLOCKLIST = new Set([
  "preview_count",
  "previewcount",
  "filters",
  "applied_conditions",
  "appliedconditions",
  "validation",
  "conditions",
  "selected_department",
  "selecteddepartment",
  "total_records",
  "totalrecords",
]);

const cleanGenericSummary = (summary = {}) =>
  Object.entries(summary).reduce((accumulator, [key, value]) => {
    const normalizedKey = toSnakeCase(key);
    if (GENERIC_SUMMARY_BLOCKLIST.has(normalizedKey)) {
      return accumulator;
    }

    if (value === null || value === undefined || value === "") {
      return accumulator;
    }

    accumulator[normalizedKey] = typeof value === "number" ? roundTo(value) : value;
    return accumulator;
  }, {});

const cleanGenericRow = (row = {}) =>
  Object.entries(row).reduce((accumulator, [key, value]) => {
    if (key === "_id" || key === "__v" || value === undefined) {
      return accumulator;
    }

    accumulator[toCamelCase(key)] = value;
    return accumulator;
  }, {});

const formatGenericReport = (
  reportResponse = {},
  entity = "report",
  displayRows = [],
  analysisRows = []
) => {
  const displayTable = (displayRows.length ? displayRows : analysisRows).map(cleanGenericRow);
  const analysisTable = (analysisRows.length ? analysisRows : displayRows).map(cleanGenericRow);

  return buildResponsePayload({
    reportResponse,
    entity,
    title: getTitle(reportResponse, "Report"),
    summary: cleanGenericSummary(reportResponse.summary),
    charts: [],
    displayTable,
    exportTable: analysisTable,
    tableTitle: "Report Details",
    entityLabel: "record",
  });
};

const formatReportResponse = (reportResponse = {}) => {
  const displayRows = getDisplayRows(reportResponse);
  const analysisRows = getAnalysisRows(reportResponse);
  const entity = inferEntityFromRows(
    displayRows.length ? displayRows : analysisRows,
    reportResponse.entity ||
      reportResponse.entityType ||
      reportResponse.data?.entity ||
      null
  );

  if (entity === "student") {
    return formatStudentReport(reportResponse, displayRows, analysisRows);
  }

  if (entity === "faculty") {
    return formatFacultyReport(reportResponse, displayRows, analysisRows);
  }

  if (entity === "placement") {
    return formatPlacementReport(reportResponse, displayRows, analysisRows);
  }

  if (entity === "placement_drive") {
    return formatPlacementDriveReport(reportResponse, displayRows, analysisRows);
  }

  if (entity === "placement_application") {
    return formatPlacementApplicationReport(reportResponse, displayRows, analysisRows);
  }

  if (entity === "department") {
    return formatDepartmentReport(reportResponse, displayRows, analysisRows);
  }

  if (entity === "research") {
    return formatResearchReport(reportResponse, displayRows, analysisRows);
  }

  if (entity === "achievement") {
    return formatAchievementReport(reportResponse, displayRows, analysisRows);
  }

  if (entity === "document") {
    return formatDocumentReport(reportResponse, displayRows, analysisRows);
  }

  if (entity === "naac") {
    return formatNaacReport(reportResponse, displayRows, analysisRows);
  }

  if (entity === "nba") {
    return formatNbaReport(reportResponse, displayRows, analysisRows);
  }

  if (entity === "event") {
    return formatEventReport(reportResponse, displayRows, analysisRows);
  }

  return formatGenericReport(reportResponse, entity, displayRows, analysisRows);
};

module.exports = {
  formatReportResponse,
};
