const computeConfidence = (plan = {}) => {
  let score = 0.5;

  if (plan.entity) score += 0.2;
  if (plan.filters && Object.keys(plan.filters).length) score += 0.2;
  if (plan.sort) score += 0.05;
  if (plan.limit) score += 0.05;

  return Math.min(score, 1);
};

module.exports = {
  computeConfidence,
};