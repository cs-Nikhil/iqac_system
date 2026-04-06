const {
  generateGeminiInsight,
} = require("./geminiService");

const roundTo = (value, digits = 2) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Number(numericValue.toFixed(digits));
};

const unique = (values = []) => [...new Set(values.filter(Boolean))];

const buildSummary = (rows = [], filtersApplied = []) => {
  const total = rows.length;
  const cgpaValues = rows
    .map((row) => Number(row.cgpa))
    .filter((value) => Number.isFinite(value));
  const attendanceValues = rows
    .map((row) => Number(row.averageAttendance))
    .filter((value) => Number.isFinite(value));
  const backlogCount = rows.filter((row) => Number(row.currentBacklogs || 0) > 0).length;
  const lowCgpaCount = rows.filter((row) => Number(row.cgpa || 0) < 6).length;
  const lowAttendanceCount = rows.filter((row) => Number(row.averageAttendance || 0) < 75).length;
  const criticalRiskCount = rows.filter((row) =>
    Number(row.cgpa || 0) < 5 ||
    Number(row.averageAttendance || 0) < 60 ||
    Number(row.currentBacklogs || 0) > 1
  ).length;

  return {
    total,
    filtersApplied,
    averageCGPA: cgpaValues.length
      ? roundTo(cgpaValues.reduce((sum, value) => sum + value, 0) / cgpaValues.length)
      : null,
    averageAttendance: attendanceValues.length
      ? roundTo(
          attendanceValues.reduce((sum, value) => sum + value, 0) / attendanceValues.length
        )
      : null,
    studentsWithBacklogs: backlogCount,
    lowCgpaCount,
    lowAttendanceCount,
    criticalRiskCount,
  };
};

const buildDeterministicInsight = (summary = {}, selectedDepartment = null) => {
  const scope = selectedDepartment?.code || selectedDepartment?.name || "the selected cohort";
  const insights = [];
  const recommendations = [];

  if (summary.total === 0) {
    return {
      title: "Student Analytics Insight",
      description: `No student records matched the requested filters for ${scope}.`,
      insights: [
        `No records matched the current filters for ${scope}.`,
      ],
      recommendations: [
        "Broaden the filter range or remove one condition to inspect a larger cohort.",
      ],
    };
  }

  insights.push(
    `${summary.total} students matched the current filter set for ${scope}.`
  );

  if (summary.averageCGPA !== null) {
    insights.push(
      `The filtered cohort has an average CGPA of ${summary.averageCGPA}.`
    );
  }

  if (summary.averageAttendance !== null) {
    insights.push(
      `Average attendance across the cohort is ${summary.averageAttendance}%.`
    );
  }

  if (summary.lowCgpaCount > 0) {
    insights.push(
      `${summary.lowCgpaCount} students are below the CGPA risk threshold of 6.`
    );
    recommendations.push(
      `Start remedial classes for the ${summary.lowCgpaCount} students below CGPA 6, prioritizing the most critical cases first.`
    );
  }

  if (summary.lowAttendanceCount > 0) {
    insights.push(
      `${summary.lowAttendanceCount} students are below the 75% attendance threshold.`
    );
    recommendations.push(
      `Enable weekly attendance tracking and mentor escalation for the ${summary.lowAttendanceCount} students below 75% attendance.`
    );
  }

  if (summary.studentsWithBacklogs > 0) {
    insights.push(
      `${summary.studentsWithBacklogs} students currently carry active backlogs.`
    );
    recommendations.push(
      `Run subject-wise mentoring and backlog clearance plans for the ${summary.studentsWithBacklogs} students with active backlogs.`
    );
  }

  if (summary.criticalRiskCount > 0) {
    recommendations.push(
      `Review the ${summary.criticalRiskCount} critical-risk students in the mentor council and assign intervention ownership this week.`
    );
  }

  if (!recommendations.length) {
    recommendations.push(
      "Maintain the current academic monitoring cycle and continue monthly performance reviews for this cohort."
    );
  }

  return {
    title: "Student Analytics Insight",
    description: `The filtered student cohort highlights focused academic risk signals for ${scope}.`,
    insights: unique(insights).slice(0, 4),
    recommendations: unique(recommendations).slice(0, 4),
  };
};

const buildFallbackStructuredInsight = (fallback = {}) => ({
  title: fallback.title || "Student Analytics Insight",
  problem: Array.isArray(fallback.insights) ? fallback.insights.slice(0, 4) : [],
  impact: fallback.description || "",
  suggestions: Array.isArray(fallback.recommendations)
    ? fallback.recommendations.slice(0, 4)
    : [],
});

const buildInstitutionalInsights = async ({
  message = "",
  rows = [],
  chart = null,
  filtersApplied = [],
  selectedDepartment = null,
} = {}) => {
  const summary = buildSummary(rows, filtersApplied);
  const fallback = buildDeterministicInsight(summary, selectedDepartment);
  const aiResult = await generateGeminiInsight({
    userMessage: message,
    insightType: "student-analytics:filtered-query",
    dataSummary: {
      summary,
      selectedDepartment,
      filtersApplied,
      chartPreview: chart?.data?.labels?.slice(0, 6)?.map((label, index) => ({
        label,
        value: chart?.data?.datasets?.[0]?.data?.[index] ?? null,
      })) || [],
    },
    fallbackReply: fallback.description,
    fallbackStructuredInsight: buildFallbackStructuredInsight(fallback),
  });

  const problemPoints = Array.isArray(aiResult?.insight?.problem)
    ? aiResult.insight.problem
    : [];
  const impactPoint = aiResult?.insight?.impact || aiResult?.reply || "";
  const suggestionPoints = Array.isArray(aiResult?.insight?.suggestions)
    ? aiResult.insight.suggestions
    : [];

  return {
    summary,
    insights: unique([
      ...problemPoints,
      impactPoint,
      ...fallback.insights,
    ]).slice(0, 4),
    recommendations: unique([
      ...suggestionPoints,
      ...fallback.recommendations,
    ]).slice(0, 4),
    provider: aiResult?.meta?.provider || "fallback",
    model: aiResult?.meta?.model || null,
  };
};

module.exports = {
  buildInstitutionalInsights,
};
