const Department = require("../models/Department");

const buildImpossibleQuery = () => ({ _id: null });

const mergeMongoCondition = (query = {}, field = "", condition = null) => {
  if (!field || !condition) {
    return query;
  }

  if (typeof condition !== "object" || Array.isArray(condition)) {
    query[field] = condition;
    return query;
  }

  if (!query[field] || typeof query[field] !== "object" || Array.isArray(query[field])) {
    query[field] = { ...condition };
    return query;
  }

  query[field] = {
    ...query[field],
    ...condition,
  };
  return query;
};

const buildNumericCondition = (operator = "=", value = null) => {
  if (!Number.isFinite(Number(value))) {
    return null;
  }

  const numericValue = Number(value);

  if (operator === "<") return { $lt: numericValue };
  if (operator === "<=") return { $lte: numericValue };
  if (operator === ">") return { $gt: numericValue };
  if (operator === ">=") return { $gte: numericValue };
  return numericValue;
};

const buildBacklogCondition = (value = null) => {
  if (value === true) {
    return { $gt: 0 };
  }

  if (value === false) {
    return 0;
  }

  return null;
};

const buildStudentMongoQuery = async (filters = []) => {
  const query = {
    isActive: true,
  };
  const filtersApplied = [];
  let selectedDepartment = null;

  for (const filter of Array.isArray(filters) ? filters : []) {
    if (!filter?.field || filter.value === undefined || filter.value === null) {
      continue;
    }

    if (filter.field === "cgpa") {
      const condition = buildNumericCondition(filter.operator, filter.value);
      if (condition !== null) {
        mergeMongoCondition(query, "cgpa", condition);
        filtersApplied.push(filter);
      }
      continue;
    }

    if (filter.field === "attendance") {
      const condition = buildNumericCondition(filter.operator, filter.value);
      if (condition !== null) {
        mergeMongoCondition(query, "academicRecords.avgAttendance", condition);
        filtersApplied.push(filter);
      }
      continue;
    }

    if (filter.field === "backlog" && filter.operator === "=") {
      const condition = buildBacklogCondition(filter.value);
      if (condition !== null) {
        mergeMongoCondition(query, "currentBacklogs", condition);
        filtersApplied.push(filter);
      }
      continue;
    }

    if (filter.field === "department" && filter.operator === "=") {
      const departmentCode = String(filter.value || "").trim().toUpperCase();
      if (!departmentCode) {
        continue;
      }

      const department = await Department.findOne({
        isActive: true,
        code: departmentCode,
      })
        .select("name code")
        .lean();

      filtersApplied.push({
        ...filter,
        value: departmentCode,
      });

      if (!department?._id) {
        return {
          query: buildImpossibleQuery(),
          filtersApplied,
          selectedDepartment: {
            _id: "",
            code: departmentCode,
            name: null,
          },
        };
      }

      query.department = department._id;
      selectedDepartment = {
        _id: String(department._id),
        code: department.code || departmentCode,
        name: department.name || null,
      };
    }
  }

  return {
    query,
    filtersApplied,
    selectedDepartment,
  };
};

module.exports = {
  buildStudentMongoQuery,
};
