const explainQueryPlan = (plan = {}) => {
  return {
    summary: `Fetching ${plan.entity} data`,
    details: {
      entity: plan.entity,
      filters: plan.filters,
      sort: plan.sort,
      limit: plan.limit,
      type: plan.type,
    },
    readable: buildReadableExplanation(plan),
  };
};

const buildReadableExplanation = (plan) => {
  let text = `Showing ${plan.entity}`;

  if (plan.filters && Object.keys(plan.filters).length) {
    text += ` filtered by conditions`;
  }

  if (plan.sort) {
    const field = Object.keys(plan.sort)[0];
    text += ` sorted by ${field}`;
  }

  if (plan.limit) {
    text += ` (top ${plan.limit})`;
  }

  return text;
};

module.exports = {
  explainQueryPlan,
};