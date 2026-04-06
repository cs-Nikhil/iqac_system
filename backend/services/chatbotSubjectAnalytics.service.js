const analyticsService = require("./analytics.service");
const { resolveMentionedDepartments } = require("./chatbotFilter.service");
const { buildAccessDeniedMessage } = require("./chatbotAccessScope.service");
const { resolveYearFilterContext } = require("./chatbotYearFilter.service");

const normalizeText = (value = "") => String(value).trim().toLowerCase();
const ACADEMIC_YEAR_PATTERN = /(20\d{2})\s*-\s*(\d{2,4})/i;
const SEMESTER_PATTERN = /semester\s*(\d{1,2})/i;

const isSubjectQuery = (message = "") => {
  const normalized = normalizeText(message);

  return (
    /\bsubject(?:s)?\b/.test(normalized) &&
    (
      /\b(most|highest|lowest|least)\b/.test(normalized) ||
      /\bpass percentage\b/.test(normalized) ||
      /\bfailure analysis\b/.test(normalized) ||
      /\bsubject(?:-|\s)?wise\b/.test(normalized)
    )
  );
};

const detectSubjectQueryMode = (message = "") => {
  const normalized = normalizeText(message);

  if (
    /\blowest pass percentage\b/.test(normalized) ||
    /\bleast pass percentage\b/.test(normalized) ||
    /\bpass percentage\b/.test(normalized)
  ) {
    return "low_pass";
  }

  return "failures";
};

const formatSubjectAnalysis = (rows = [], mode = "failures") =>
  rows.map((row, index) => ({
    rank: index + 1,
    subject: row.subjectName || row.subject || null,
    subjectCode: row.subjectCode || row.code || null,
    department: row.deptName || row.department || null,
    departmentCode: row.deptCode || row.departmentCode || null,
    semester: row.semester ?? null,
    totalStudents: Number(row.totalStudents || 0),
    failures:
      mode === "low_pass"
        ? Number((row.totalStudents || 0) - (row.passCount || 0))
        : Number(row.failureCount || 0),
    failurePercentage:
      row.failurePercentage !== undefined
        ? Number(Number(row.failurePercentage || 0).toFixed(2))
        : Number(
            row.totalStudents
              ? ((((row.totalStudents || 0) - (row.passCount || 0)) / row.totalStudents) * 100).toFixed(2)
              : 0
          ),
    passPercentage: Number(Number(row.passPercentage || 0).toFixed(2)),
  }));

const extractAcademicYear = (message = "") => {
  const match = String(message || "").match(ACADEMIC_YEAR_PATTERN);
  if (!match) {
    return null;
  }

  const startYear = match[1];
  const rawEnd = match[2];
  const endYear = rawEnd.length === 4 ? rawEnd.slice(2) : rawEnd;
  return `${startYear}-${endYear}`;
};

const extractSemester = (message = "") => {
  const match = String(message || "").match(SEMESTER_PATTERN);
  if (!match) {
    return null;
  }

  const parsedValue = Number(match[1]);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const getSubjectFailureAnalysis = async (message = "", accessScope = null) => {
  if (accessScope?.role === "student") {
    return {
      reply: buildAccessDeniedMessage(accessScope),
      title: "Access Restricted",
      count: 0,
      rows: [],
      summary: {
        denied: true,
        role: accessScope.role,
      },
      responseType: "text",
      provider: "database",
      sourceDatabase: "mongodb",
      usedLiveData: true,
      extraData: [],
      queryType: "subject_analysis",
      entity: "subject",
    };
  }

  const mentionedDepartments = await resolveMentionedDepartments(message);
  if (
    accessScope?.role === "hod" &&
    accessScope?.department &&
    mentionedDepartments.length &&
    mentionedDepartments.some(
      (department) =>
        String(department?._id || "") !== String(accessScope.department?._id || "")
    )
  ) {
    return {
      reply: buildAccessDeniedMessage(accessScope),
      title: "Access Restricted",
      count: 0,
      rows: [],
      summary: {
        denied: true,
        role: accessScope.role,
      },
      responseType: "text",
      provider: "database",
      sourceDatabase: "mongodb",
      usedLiveData: true,
      extraData: [],
      queryType: "subject_analysis",
      entity: "subject",
    };
  }

  const departments =
    accessScope?.role === "hod" && accessScope?.department
      ? [accessScope.department]
      : mentionedDepartments;
  const mode = detectSubjectQueryMode(message);
  const yearContext = resolveYearFilterContext({
    message,
    entity: "subject",
  });
  const filters = {
    ...(departments[0]?._id ? { departmentId: departments[0]._id } : {}),
    ...(accessScope?.role === "faculty" && Array.isArray(accessScope.subjectIds)
      ? { subjectIds: accessScope.subjectIds }
      : {}),
    ...(extractSemester(message) !== null
      ? { semester: extractSemester(message) }
      : {}),
    ...(yearContext.academicYear
      ? { academicYear: yearContext.academicYear }
      : {}),
  };

  const rawRows =
    mode === "low_pass"
      ? await analyticsService.getSubjectWisePassPercentage(filters)
      : await analyticsService.getSubjectFailureAnalysis(filters);

  const formattedRows = formatSubjectAnalysis(rawRows.slice(0, 10), mode);
  const departmentLabel = departments[0]?.code || departments[0]?.name || null;
  const semesterLabel = filters.semester ? ` for semester ${filters.semester}` : "";
  const academicYearLabel = filters.academicYear
    ? ` in ${filters.academicYear}`
    : "";
  const title =
    mode === "low_pass"
      ? "Subjects with Lowest Pass Percentage"
      : "Subjects with Most Failures";
  const reply = formattedRows.length
    ? `${title}${departmentLabel ? ` in ${departmentLabel}` : ""}${semesterLabel}${academicYearLabel}: showing ${formattedRows.length} ranked subject records.`
    : `I could not find subject analytics data${departmentLabel ? ` for ${departmentLabel}` : ""}${semesterLabel}${academicYearLabel}.`;

  return {
    reply,
    title,
    count: formattedRows.length,
    rows: formattedRows,
    summary: {
      count: formattedRows.length,
      department: departmentLabel,
      semester: filters.semester || null,
      academicYear: filters.academicYear || null,
      year: yearContext.rawYear || null,
      mode,
    },
    responseType: "subject_analysis",
    provider: "database",
    sourceDatabase: "mongodb",
    usedLiveData: true,
    extraData: formattedRows,
    queryType: "subject_analysis",
    entity: "subject",
  };
};

module.exports = {
  formatSubjectAnalysis,
  getSubjectFailureAnalysis,
  isSubjectQuery,
};
