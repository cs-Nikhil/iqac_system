const COLORS = [
  "#1d4ed8",
  "#059669",
  "#dc2626",
  "#d97706",
  "#7c3aed",
  "#0f766e",
  "#9333ea",
  "#475569",
];

const roundTo = (value, digits = 2) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Number(numericValue.toFixed(digits));
};

const detectChartType = (message = "") => {
  const normalized = String(message || "").toLowerCase();

  if (/\b(trend|timeline|over time|semester|yearly|monthly)\b/.test(normalized)) {
    return "line";
  }

  if (/\b(distribution|share|split|breakdown|composition)\b/.test(normalized)) {
    return "pie";
  }

  return "bar";
};

const getMetricConfig = (filtersApplied = []) => {
  const fields = new Set(filtersApplied.map((filter) => filter.field));

  if (fields.has("attendance")) {
    return {
      key: "averageAttendance",
      label: "Attendance %",
    };
  }

  if (fields.has("backlog")) {
    return {
      key: "currentBacklogs",
      label: "Active Backlogs",
    };
  }

  return {
    key: "cgpa",
    label: "CGPA",
  };
};

const buildSemesterTrendChart = (students = []) => {
  const semesterMap = new Map();

  students.forEach((student) => {
    const semesterCgpa = Array.isArray(student?.academicRecords?.semesterCgpa)
      ? student.academicRecords.semesterCgpa
      : [];

    semesterCgpa.forEach((entry) => {
      const semesterKey = `Semester ${entry.semester}`;
      const current = semesterMap.get(semesterKey) || {
        sum: 0,
        count: 0,
        semester: entry.semester,
      };

      current.sum += Number(entry.cgpa || 0);
      current.count += 1;
      semesterMap.set(semesterKey, current);
    });
  });

  const points = [...semesterMap.entries()]
    .sort((left, right) => left[1].semester - right[1].semester)
    .map(([label, value]) => ({
      label,
      value: roundTo(value.sum / Math.max(value.count, 1)),
    }));

  if (!points.length) {
    return null;
  }

  return {
    type: "line",
    data: {
      labels: points.map((point) => point.label),
      datasets: [
        {
          label: "Average CGPA",
          data: points.map((point) => point.value),
          borderColor: COLORS[0],
          backgroundColor: COLORS[0],
          tension: 0.3,
          fill: false,
        },
      ],
    },
  };
};

const buildPieChart = (rows = []) => {
  const departmentCounts = rows.reduce((result, row) => {
    const key = row.departmentCode || row.department || "Unknown";
    result.set(key, (result.get(key) || 0) + 1);
    return result;
  }, new Map());

  const useDepartmentBreakdown = departmentCounts.size > 1;
  const chartPoints = useDepartmentBreakdown
    ? [...departmentCounts.entries()].map(([label, value]) => ({
        label,
        value,
      }))
    : [
        {
          label: "With Backlogs",
          value: rows.filter((row) => Number(row.currentBacklogs || 0) > 0).length,
        },
        {
          label: "Without Backlogs",
          value: rows.filter((row) => Number(row.currentBacklogs || 0) <= 0).length,
        },
      ].filter((point) => point.value > 0);

  if (!chartPoints.length) {
    return null;
  }

  return {
    type: "pie",
    data: {
      labels: chartPoints.map((point) => point.label),
      datasets: [
        {
          label: useDepartmentBreakdown ? "Student Distribution" : "Backlog Distribution",
          data: chartPoints.map((point) => point.value),
          backgroundColor: COLORS.slice(0, chartPoints.length),
        },
      ],
    },
  };
};

const buildBarChart = (rows = [], filtersApplied = []) => {
  const metric = getMetricConfig(filtersApplied);
  const visibleRows = rows.slice(0, 10);

  return {
    type: "bar",
    data: {
      labels: visibleRows.map((row) => row.rollNumber || row.name || "Student"),
      datasets: [
        {
          label: metric.label,
          data: visibleRows.map((row) => roundTo(row[metric.key])),
          backgroundColor: COLORS[0],
          borderColor: COLORS[0],
        },
      ],
    },
  };
};

const buildInstitutionalChart = ({
  message = "",
  students = [],
  rows = [],
  filtersApplied = [],
} = {}) => {
  if (!Array.isArray(rows) || !rows.length) {
    return null;
  }

  const chartType = detectChartType(message);

  if (chartType === "line") {
    return buildSemesterTrendChart(students) || buildBarChart(rows, filtersApplied);
  }

  if (chartType === "pie") {
    return buildPieChart(rows) || buildBarChart(rows, filtersApplied);
  }

  return buildBarChart(rows, filtersApplied);
};

module.exports = {
  buildInstitutionalChart,
  detectChartType,
};
