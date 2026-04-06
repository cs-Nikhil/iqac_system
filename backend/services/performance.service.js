const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toNumber = (value, fallback = 0) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const roundTo = (value, digits = 2) => Number(toNumber(value).toFixed(digits));

const PERFORMANCE_CATEGORIES = ['Excellent', 'Good', 'Average', 'At Risk'];

const getBacklogScore = (backlogs = 0) => {
  const normalizedBacklogs = Math.max(0, Math.trunc(toNumber(backlogs)));

  if (normalizedBacklogs === 0) return 20;
  if (normalizedBacklogs === 1) return 15;
  if (normalizedBacklogs === 2) return 10;
  if (normalizedBacklogs === 3) return 5;
  return 0;
};

const getPerformanceCategory = (performanceScore = 0) => {
  if (performanceScore >= 85) return 'Excellent';
  if (performanceScore >= 70) return 'Good';
  if (performanceScore >= 50) return 'Average';
  return 'At Risk';
};

const buildRiskReasons = ({ cgpa, attendance, backlogs, performanceScore, category }) => {
  if (category !== 'At Risk') {
    return [];
  }

  const reasons = [];

  if (cgpa < 6) {
    reasons.push('Low CGPA');
  }

  if (attendance < 75) {
    reasons.push('Low attendance');
  }

  if (backlogs > 0) {
    reasons.push('Active backlogs');
  }

  if (!reasons.length && performanceScore < 50) {
    reasons.push('Low performance score');
  }

  return reasons;
};

/**
 * Calculate a weighted student performance score using CGPA, attendance,
 * and current backlog count. The final score is normalized to 100.
 */
const calculateStudentPerformance = (student = {}) => {
  const cgpa = clamp(toNumber(student.cgpa), 0, 10);
  const attendance = clamp(
    toNumber(student.academicRecords?.avgAttendance ?? student.avgAttendance),
    0,
    100
  );
  const backlogs = Math.max(0, Math.trunc(toNumber(student.currentBacklogs)));

  const cgpaScore = roundTo((cgpa / 10) * 50);
  const attendanceScore = roundTo((attendance / 100) * 30);
  const backlogScore = getBacklogScore(backlogs);
  const performanceScore = roundTo(cgpaScore + attendanceScore + backlogScore);
  const category = getPerformanceCategory(performanceScore);
  const riskReasons = buildRiskReasons({
    cgpa,
    attendance,
    backlogs,
    performanceScore,
    category,
  });

  return {
    cgpaScore,
    attendanceScore,
    backlogScore,
    performanceScore,
    category,
    isAtRisk: category === 'At Risk',
    riskReasons,
  };
};

module.exports = {
  PERFORMANCE_CATEGORIES,
  calculateStudentPerformance,
  getBacklogScore,
  getPerformanceCategory,
};
