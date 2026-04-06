const RECOMMENDATION_INTENT_PATTERN =
  /\b(how to improve|improve|suggestions?|advice|help|guidance)\b/i;

const normalizeText = (value = "") => String(value).trim();

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalized = String(value).replace(/%/g, "").trim();
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const unique = (values = []) => [...new Set(values.filter(Boolean))];

const sanitizeStudentData = (value = {}) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const cgpa = toNumber(value.cgpa);
  const attendance = toNumber(
    value.attendance ??
      value.averageAttendance ??
      value.avgAttendance ??
      value.academicRecords?.avgAttendance
  );
  const backlogs = toNumber(value.backlogs ?? value.currentBacklogs);

  if (![cgpa, attendance, backlogs].some((item) => item !== null)) {
    return null;
  }

  return {
    cgpa,
    attendance,
    backlogs,
  };
};

const tryParseEmbeddedJson = (message = "") => {
  const trimmed = normalizeText(message);
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  } catch (error) {
    return null;
  }
};

const extractNumberByPatterns = (message = "", patterns = []) => {
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1] !== undefined) {
      const value = toNumber(match[1]);
      if (value !== null) {
        return value;
      }
    }
  }

  return null;
};

const extractStudentDataFromMessage = (message = "") => {
  const parsedJson = sanitizeStudentData(tryParseEmbeddedJson(message));
  const cgpa = extractNumberByPatterns(message, [
    /\bcgpa\b\s*(?:is|of|=|:|-)?\s*(\d+(?:\.\d+)?)/i,
  ]);
  const attendance = extractNumberByPatterns(message, [
    /\b(?:attendance|average attendance|avg attendance)\b\s*(?:is|of|=|:|-)?\s*(\d+(?:\.\d+)?)\s*%?/i,
  ]);
  const backlogs = extractNumberByPatterns(message, [
    /\b(?:backlogs?|current backlogs?)\b\s*(?:are|is|of|=|:|-)?\s*(\d+)/i,
  ]);

  return sanitizeStudentData({
    ...(parsedJson || {}),
    ...(cgpa !== null ? { cgpa } : {}),
    ...(attendance !== null ? { attendance } : {}),
    ...(backlogs !== null ? { backlogs } : {}),
  });
};

const extractExplicitStudentData = ({ message = "", payload = {} } = {}) => {
  const bodyStudentData = sanitizeStudentData(payload.studentData);
  const bodySelectedStudent = sanitizeStudentData(payload.selectedStudent);
  const messageStudentData = extractStudentDataFromMessage(message);

  return sanitizeStudentData({
    ...(bodyStudentData || {}),
    ...(bodySelectedStudent || {}),
    ...(messageStudentData || {}),
  });
};

const detectRecommendationIntent = (message = "") =>
  RECOMMENDATION_INTENT_PATTERN.test(normalizeText(message));

const buildGeneralRecommendationPayload = () => ({
  intent: "recommendation",
  insights: [
    "Student performance improvement requires consistent academic effort and engagement.",
  ],
  recommendations: [
    "Maintain CGPA above 7 through regular study.",
    "Ensure attendance above 75% for better understanding.",
    "Revise subjects regularly and focus on weak areas.",
    "Seek help from faculty when facing difficulties.",
  ],
});

const buildRecommendationPayload = (studentData = null) => {
  const normalizedData = sanitizeStudentData(studentData);
  if (!normalizedData) {
    return buildGeneralRecommendationPayload();
  }

  const { cgpa, attendance, backlogs } = normalizedData;
  const hasCgpa = cgpa !== null;
  const hasAttendance = attendance !== null;
  const hasBacklogs = backlogs !== null;
  const lowCgpa = hasCgpa && cgpa < 6;
  const lowAttendance = hasAttendance && attendance < 75;
  const backlogIssue = hasBacklogs && backlogs > 0;

  const insights = [];
  const recommendations = [];

  if (lowCgpa) {
    insights.push(
      "The student's CGPA is below the expected academic level, which suggests gaps in subject understanding or weak exam performance across multiple papers."
    );
    recommendations.push(
      "Identify the 2-3 subjects pulling the CGPA down most and follow a weekly recovery plan with problem practice, short revision blocks, and regular faculty doubt-clearing."
    );
  } else if (hasCgpa) {
    insights.push(
      "The current CGPA does not indicate severe academic risk, but further improvement will depend on turning steady study habits into better subject-level performance."
    );
    recommendations.push(
      "Set subject-wise score targets for the next assessment cycle so the student can convert stable performance into a stronger CGPA."
    );
  }

  if (lowAttendance) {
    insights.push(
      "Attendance is below the recommended threshold, so learning continuity may be weak and important classroom explanations are likely being missed."
    );
    recommendations.push(
      "Raise attendance to at least 80% by prioritizing core classes and reviewing every missed topic within 24 hours to avoid concept gaps."
    );
  } else if (hasAttendance) {
    insights.push(
      "Attendance is not currently the main risk signal, so improvement should focus more on how effectively the student uses class time and follow-up revision."
    );
  }

  if (backlogIssue) {
    insights.push(
      "Active backlogs indicate unresolved weaknesses in earlier subjects, and that backlog pressure can also reduce confidence and focus in the current semester."
    );
    recommendations.push(
      "Create a backlog-clearance sequence starting with the subject closest to passing, and allocate fixed weekly revision and mock-test slots until each paper is cleared."
    );
  } else if (hasBacklogs) {
    insights.push(
      "The absence of active backlogs shows the student still has room to improve without the added pressure of pending subjects."
    );
  }

  if (lowCgpa && lowAttendance) {
    insights.push(
      "Low attendance is likely reducing classroom continuity, which is contributing to weaker CGPA outcomes."
    );
    recommendations.push(
      "Ask a faculty mentor to review attendance patterns and weak subjects together so the student follows one realistic monthly improvement plan instead of isolated fixes."
    );
  }

  if (lowCgpa && backlogIssue) {
    insights.push(
      "Pending backlogs suggest earlier concept gaps are still affecting current academic performance and holding the CGPA down."
    );
  }

  if (lowAttendance && backlogIssue) {
    insights.push(
      "Irregular attendance may be making it harder for the student to recover from already difficult subjects and clear backlogs efficiently."
    );
  }

  if (!lowCgpa && !lowAttendance && !backlogIssue) {
    recommendations.push(
      "Maintain the current discipline and use periodic self-assessment to push performance higher without creating new academic risks."
    );
  }

  return {
    intent: "recommendation",
    insights: unique(insights).slice(0, 4),
    recommendations: unique(recommendations).slice(0, 4),
  };
};

module.exports = {
  buildRecommendationPayload,
  buildGeneralRecommendationPayload,
  detectRecommendationIntent,
  extractExplicitStudentData,
  sanitizeStudentData,
};
