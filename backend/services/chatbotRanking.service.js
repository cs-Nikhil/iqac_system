const ENTITY_METRIC_PRIORITY = {
  student: ["cgpa", "marks", "attendance"],
  faculty: ["experience", "publications", "rating"],
  placement: ["package", "ctc"],
  department: ["performance", "score"],
};

const detectBestMetric = (entity, availableFields = [], message = "") => {
  const priorities = ENTITY_METRIC_PRIORITY[entity] || [];

  const normalized = message.toLowerCase();

  // 1. Direct mention
  for (const field of availableFields) {
    if (normalized.includes(field.toLowerCase())) {
      return field;
    }
  }

  // 2. Priority fallback
  for (const p of priorities) {
    if (availableFields.includes(p)) {
      return p;
    }
  }

  // 3. fallback
  return availableFields[0] || null;
};

const buildRankingSort = (entity, fields = [], message = "") => {
  const metric = detectBestMetric(entity, fields, message);

  if (!metric) return null;

  return {
    [metric]: -1,
  };
};

module.exports = {
  detectBestMetric,
  buildRankingSort,
};