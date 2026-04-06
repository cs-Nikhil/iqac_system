const normalizeObjectId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  if (value.id) return value.id.toString();

  const stringValue = value.toString?.();
  return stringValue && stringValue !== "[object Object]" ? stringValue : null;
};

const buildStudentFilter = (query = {}, user = null) => {
  const {
    department,
    batchYear,
    semester,
    isAtRisk,
    performanceCategory,
    search,
  } = query;

  const filter = { isActive: true };
  const userDepartmentId = normalizeObjectId(user?.department);

  if (user?.role === "hod" || user?.role === "faculty") {
    filter.department = userDepartmentId;
  } else if (department) {
    filter.department = department;
  }

  if (batchYear) filter.batchYear = parseInt(batchYear, 10);
  if (semester) filter.currentSemester = parseInt(semester, 10);

  if (performanceCategory) {
    filter.performanceCategory = performanceCategory;
  } else if (isAtRisk === "true") {
    filter.performanceCategory = "At Risk";
  } else if (isAtRisk === "false") {
    filter.performanceCategory = { $ne: "At Risk" };
  }

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { rollNumber: { $regex: search, $options: "i" } },
    ];
  }

  return filter;
};

const buildAtRiskStudentFilter = (query = {}, user = null) => ({
  ...buildStudentFilter(query, user),
  performanceCategory: "At Risk",
});

const AT_RISK_STUDENT_SORT = {
  performanceScore: 1,
  currentBacklogs: -1,
  cgpa: 1,
};

module.exports = {
  normalizeObjectId,
  buildStudentFilter,
  buildAtRiskStudentFilter,
  AT_RISK_STUDENT_SORT,
};
