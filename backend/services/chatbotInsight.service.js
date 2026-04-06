const Student = require("../models/Student");
const Department = require("../models/Department");
const Faculty = require("../models/Faculty");
const Placement = require("../models/Placement");
const ResearchPaper = require("../models/ResearchPaper");
const { Event, Participation } = require("../models/Event");
const {
  getAverageCGPAByDept,
  getCGPATrend,
  getDepartmentRanking,
  getPlacementAnalytics,
} = require("./analytics.service");
const { extractDepartmentFromQuery } = require("./chatbotUniversalReport.service");
const { generateGeminiInsight } = require("./geminiService");

const ENTITY_LABELS = {
  student: "Student",
  department: "Department",
  placement: "Placement",
  faculty: "Faculty",
  event: "Event",
  generic: "Institution",
};

const normalizeText = (value = "") => String(value).trim().toLowerCase();

const roundTo = (value, digits = 2) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Number(numericValue.toFixed(digits));
};

const humanizeKey = (value = "value") =>
  String(value)
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (match) => match.toUpperCase());

const detectInsightEntity = (message = "", contextData = {}) => {
  const normalized = normalizeText(message);

  if (/\b(package|placement|placements|offer|offers|hiring|job)\b/.test(normalized)) {
    return "placement";
  }

  if (/\b(publication|publications|research|paper|papers|faculty|faculties|staff)\b/.test(normalized)) {
    return "faculty";
  }

  if (/\b(event|events|seminar|conference|workshop|hackathon|participation|participants)\b/.test(normalized)) {
    return "event";
  }

  if (
    /\b(department|departments)\b/.test(normalized) ||
    contextData.department ||
    contextData.departmentComparison
  ) {
    return "department";
  }

  if (
    /\b(student|students|cgpa|attendance|backlog|performance|at risk)\b/.test(normalized) ||
    contextData.student
  ) {
    return "student";
  }

  if (contextData.primaryEntity && ENTITY_LABELS[contextData.primaryEntity]) {
    return contextData.primaryEntity;
  }

  return "generic";
};

const detectInsightMetric = (message = "", entity = "generic") => {
  const normalized = normalizeText(message);

  if (/\b(attendance|present|absent)\b/.test(normalized)) return "attendance";
  if (/\b(backlog|backlogs|arrear|arrears|failed)\b/.test(normalized)) return "backlog";
  if (/\b(pass percentage|pass rate|pass)\b/.test(normalized)) return "passPercentage";
  if (/\b(package|salary|ctc)\b/.test(normalized)) return "package";
  if (/\b(placement|placements|placed|hiring)\b/.test(normalized)) return "placement";
  if (/\b(publication|publications|research|paper|papers|citation|citations)\b/.test(normalized)) return "publications";
  if (/\b(participation|participants|attended|attendance marked|winner|winners)\b/.test(normalized)) {
    return "participation";
  }
  if (/\b(cgpa|gpa|grade)\b/.test(normalized)) return "cgpa";
  if (/\b(trend|growth|progress)\b/.test(normalized)) return "trend";
  if (/\b(score|performance)\b/.test(normalized)) return "performance";

  if (entity === "student") return "cgpa";
  if (entity === "department") return "performance";
  if (entity === "placement") return "placement";
  if (entity === "faculty") return "publications";
  if (entity === "event") return "participation";
  return "overview";
};

const pickMetricField = (entity = "generic", metric = "overview") => {
  if (entity === "department") {
    if (metric === "attendance") return "avgAttendance";
    if (metric === "placement") return "placementPercentage";
    if (metric === "package") return "placementPercentage";
    if (metric === "publications") return "researchPapers";
    if (metric === "passPercentage") return "passPercentage";
    if (metric === "cgpa") return "averageCGPA";
    return "score";
  }

  if (entity === "placement") {
    if (metric === "package") return "avgPackage";
    return "placementPercentage";
  }

  if (entity === "faculty") {
    if (metric === "attendance") return "averageExperience";
    return "publications";
  }

  if (entity === "event") {
    if (metric === "attendance") return "attendedCount";
    return "participants";
  }

  return "value";
};

const buildChart = ({
  type = "bar",
  title = "",
  metric = "Value",
  data = [],
  xKey = "label",
  yKey = "value",
} = {}) => {
  const normalizedData = Array.isArray(data)
    ? data.filter((item) => item && item[xKey] !== undefined && Number.isFinite(Number(item[yKey])))
    : [];

  if (!normalizedData.length) {
    return null;
  }

  return {
    type: type === "line" ? "line" : "bar",
    title,
    metric,
    xKey,
    yKey,
    data: normalizedData,
  };
};

const buildMetricBars = (record = {}, metrics = []) =>
  metrics
    .map(({ key, label }) => ({
      label,
      value: roundTo(record[key]),
    }))
    .filter((item) => Number.isFinite(Number(item.value)));

const buildGenericChartFromRows = (rows = [], fallbackTitle = "Insight Chart") => {
  if (!Array.isArray(rows) || !rows.length) {
    return null;
  }

  const preferredX = [
    "label",
    "name",
    "code",
    "department",
    "deptCode",
    "deptName",
    "type",
    "title",
    "status",
    "range",
    "semester",
    "academicYear",
  ];
  const preferredY = [
    "value",
    "count",
    "score",
    "averageCGPA",
    "avgCGPA",
    "placementPercentage",
    "averageAttendance",
    "avgAttendance",
    "placedCount",
    "averagePackage",
    "avgPackage",
    "researchPapers",
    "participants",
    "attendedCount",
    "totalBacklogs",
  ];

  const sample = rows[0] || {};
  const xKey =
    preferredX.find((key) => rows.some((row) => typeof row?.[key] === "string" || typeof row?.[key] === "number")) ||
    Object.keys(sample).find((key) => typeof sample[key] === "string" || typeof sample[key] === "number");
  const yKey =
    preferredY.find((key) => rows.some((row) => Number.isFinite(Number(row?.[key])))) ||
    Object.keys(sample).find((key) => Number.isFinite(Number(sample[key])));

  if (!xKey || !yKey) {
    return null;
  }

  return buildChart({
    type: "bar",
    title: fallbackTitle,
    metric: humanizeKey(yKey),
    xKey: "label",
    yKey: "value",
    data: rows
      .slice(0, 8)
      .map((row) => ({
        label: String(row[xKey]),
        value: roundTo(row[yKey]),
      })),
  });
};

const summarizeChart = (chart = null) => {
  if (!chart?.data?.length) {
    return {
      average: null,
      highest: null,
      lowest: null,
    };
  }

  const values = chart.data
    .map((item) => Number(item[chart.yKey]))
    .filter((value) => Number.isFinite(value));

  if (!values.length) {
    return {
      average: null,
      highest: null,
      lowest: null,
    };
  }

  const sorted = [...chart.data].sort(
    (left, right) => Number(right[chart.yKey]) - Number(left[chart.yKey])
  );

  return {
    average: roundTo(values.reduce((sum, value) => sum + value, 0) / values.length),
    highest: sorted[0] || null,
    lowest: sorted[sorted.length - 1] || null,
  };
};

const buildDeterministicInsight = ({
  entity = "generic",
  metric = "overview",
  chart = null,
  summaryData = {},
  selectedDepartment = null,
}) => {
  const entityLabel = ENTITY_LABELS[entity] || "Institution";
  const metricLabel = chart?.metric || humanizeKey(metric);
  const chartSummary = summarizeChart(chart);
  const points = [];

  if (chartSummary.highest) {
    points.push(
      `${chartSummary.highest.label} currently leads on ${metricLabel.toLowerCase()} with ${chartSummary.highest[chart.yKey]}.`
    );
  }

  if (chartSummary.lowest && chart?.data?.length > 1) {
    points.push(
      `${chartSummary.lowest.label} is currently lowest on ${metricLabel.toLowerCase()} with ${chartSummary.lowest[chart.yKey]}.`
    );
  }

  if (chartSummary.average !== null) {
    points.push(
      `The visible average for ${metricLabel.toLowerCase()} is ${chartSummary.average}.`
    );
  }

  Object.entries(summaryData)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 2)
    .forEach(([key, value]) => {
      points.push(`${humanizeKey(key)}: ${value}.`);
    });

  const descriptionParts = [
    `${entityLabel} insight generated from live IQAC data.`,
    selectedDepartment?.name
      ? `The current view is filtered to ${selectedDepartment.name} (${selectedDepartment.code || "Department"}).`
      : null,
    chart?.data?.length
      ? `The chart highlights ${metricLabel.toLowerCase()} across ${chart.data.length} visible records.`
      : null,
  ].filter(Boolean);

  return {
    title: selectedDepartment?.name
      ? `${selectedDepartment.name} ${entityLabel} Insight`
      : `${entityLabel} Insight`,
    description: descriptionParts.join(" "),
    points: [...new Set(points)].slice(0, 5),
  };
};

const buildStudentInsightPayload = async ({
  metric,
  contextData = {},
  selectedDepartment = null,
}) => {
  if (contextData.student?.rollNumber) {
    const student = await Student.findOne({
      rollNumber: contextData.student.rollNumber,
    })
      .select("name rollNumber cgpa currentBacklogs academicRecords.semesterCgpa academicRecords.avgAttendance")
      .lean();

    const semesterSeries = student?.academicRecords?.semesterCgpa || [];
    if (semesterSeries.length) {
      return {
        entity: "student",
        metricKey: "cgpa",
        selectedDepartment,
        summaryData: {
          student: student.name || null,
          rollNumber: student.rollNumber || null,
          currentCGPA: roundTo(student.cgpa),
          averageAttendance: roundTo(student.academicRecords?.avgAttendance),
          currentBacklogs: Number(student.currentBacklogs || 0),
        },
        chart: buildChart({
          type: "line",
          title: `${student.name || "Student"} CGPA Trend`,
          metric: "CGPA",
          data: semesterSeries
            .map((item) => ({
              label: `Semester ${item.semester}`,
              value: roundTo(item.cgpa),
            }))
            .sort((left, right) => left.label.localeCompare(right.label)),
        }),
      };
    }
  }

  if (metric === "attendance") {
    const match = {
      isActive: true,
      ...(selectedDepartment?._id ? { department: selectedDepartment._id } : {}),
    };
    const students = await Student.find(match)
      .select("name rollNumber academicRecords.avgAttendance")
      .sort({ "academicRecords.avgAttendance": 1, name: 1 })
      .limit(8)
      .lean();

    return {
      entity: "student",
      metricKey: "attendance",
      selectedDepartment,
      summaryData: {
        totalStudents:
          Number(contextData.department?.totalStudents) ||
          Number(contextData.overview?.activeStudents) ||
          students.length,
        averageAttendance: contextData.department?.averageAttendance ?? contextData.overview?.averageAttendance ?? null,
      },
      chart: buildChart({
        type: "bar",
        title: selectedDepartment?.name
          ? `${selectedDepartment.name} Attendance Watch`
          : "Student Attendance Watch",
        metric: "Attendance",
        data: students.map((student) => ({
          label: student.rollNumber || student.name || "Student",
          value: roundTo(student.academicRecords?.avgAttendance),
        })),
      }),
    };
  }

  if (metric === "backlog") {
    const match = {
      isActive: true,
      currentBacklogs: { $gt: 0 },
      ...(selectedDepartment?._id ? { department: selectedDepartment._id } : {}),
    };
    const students = await Student.find(match)
      .select("name rollNumber currentBacklogs")
      .sort({ currentBacklogs: -1, name: 1 })
      .limit(8)
      .lean();

    return {
      entity: "student",
      metricKey: "backlog",
      selectedDepartment,
      summaryData: {
        totalBacklogs: contextData.backlogOverview?.totalBacklogs ?? null,
        studentsWithBacklogs: contextData.backlogOverview?.studentsWithBacklogs ?? students.length,
      },
      chart: buildChart({
        type: "bar",
        title: selectedDepartment?.name
          ? `${selectedDepartment.name} Backlog Pressure`
          : "Student Backlog Pressure",
        metric: "Backlogs",
        data: students.map((student) => ({
          label: student.rollNumber || student.name || "Student",
          value: Number(student.currentBacklogs || 0),
        })),
      }),
    };
  }

  const trend = await getCGPATrend(
    selectedDepartment?._id ? { departmentId: selectedDepartment._id } : {}
  );

  return {
    entity: "student",
    metricKey: "cgpa",
    selectedDepartment,
    summaryData: {
      totalStudents:
        Number(contextData.department?.totalStudents) ||
        Number(contextData.overview?.activeStudents) ||
        0,
      averageCGPA: contextData.department?.averageCGPA ?? contextData.overview?.averageCGPA ?? null,
      atRiskStudents: contextData.overview?.atRiskStudents ?? null,
    },
    chart: buildChart({
      type: "line",
      title: selectedDepartment?.name
        ? `${selectedDepartment.name} CGPA Trend`
        : "Student CGPA Trend",
      metric: "Average CGPA",
      data: trend.map((item) => ({
        label: `Semester ${item._id}`,
        value: roundTo(item.avgCGPA),
      })),
    }),
  };
};

const buildDepartmentInsightPayload = async ({
  message,
  metric,
  selectedDepartment = null,
}) => {
  const [rankingRows, cgpaRows] = await Promise.all([
    getDepartmentRanking(selectedDepartment?._id ? { departmentId: selectedDepartment._id } : {}),
    getAverageCGPAByDept(selectedDepartment?._id ? { departmentId: selectedDepartment._id } : {}),
  ]);

  const cgpaMap = new Map(
    cgpaRows.map((row) => [String(row._id), roundTo(row.averageCGPA)])
  );

  const rows = rankingRows.map((row) => ({
    ...row,
    averageCGPA: cgpaMap.get(String(row.deptId)) || 0,
  }));

  const metricField = pickMetricField("department", metric);

  if (selectedDepartment && rows[0]) {
    const record = rows[0];
    return {
      entity: "department",
      metricKey: metricField,
      selectedDepartment,
      summaryData: {
        department: record.department || selectedDepartment.name,
        departmentCode: record.code || selectedDepartment.code,
        score: roundTo(record.score),
        averageCGPA: roundTo(record.averageCGPA),
        averageAttendance: roundTo(record.avgAttendance),
        passPercentage: roundTo(record.passPercentage),
        placementPercentage: roundTo(record.placementPercentage),
      },
      chart: buildChart({
        type: "bar",
        title: `${selectedDepartment.name} Performance Snapshot`,
        metric: "Department Metrics",
        data: buildMetricBars(record, [
          { key: "score", label: "Performance Score" },
          { key: "averageCGPA", label: "Average CGPA" },
          { key: "passPercentage", label: "Pass Percentage" },
          { key: "avgAttendance", label: "Average Attendance" },
          { key: "placementPercentage", label: "Placement Percentage" },
          { key: "researchPapers", label: "Research Papers" },
        ]),
      }),
    };
  }

  return {
    entity: "department",
    metricKey: metricField,
    selectedDepartment,
    summaryData: {
      totalDepartments: rows.length,
      comparedMetric: humanizeKey(metricField),
    },
    chart: buildChart({
      type: "bar",
      title: "Department Performance Comparison",
      metric: humanizeKey(metricField),
      data: rows.slice(0, 8).map((row) => ({
        label: row.code || row.department,
        value: roundTo(row[metricField]),
      })),
    }),
  };
};

const buildPlacementInsightPayload = async ({
  metric,
  selectedDepartment = null,
}) => {
  const rows = await getPlacementAnalytics(
    selectedDepartment?._id ? { departmentId: selectedDepartment._id } : {}
  );
  const metricField = pickMetricField("placement", metric);

  if (selectedDepartment && rows[0]) {
    const record = rows[0];
    return {
      entity: "placement",
      metricKey: metricField,
      selectedDepartment,
      summaryData: {
        department: record.deptName || selectedDepartment.name,
        departmentCode: record.deptCode || selectedDepartment.code,
        placedStudents: Number(record.placedCount || 0),
        totalStudents: Number(record.totalStudents || 0),
        placementPercentage: roundTo(record.placementPercentage),
        averagePackage: roundTo(record.avgPackage),
        highestPackage: roundTo(record.maxPackage),
      },
      chart: buildChart({
        type: "bar",
        title: `${selectedDepartment.name} Placement Snapshot`,
        metric: "Placement Metrics",
        data: buildMetricBars(record, [
          { key: "placedCount", label: "Placed Students" },
          { key: "totalStudents", label: "Eligible Students" },
          { key: "placementPercentage", label: "Placement Percentage" },
          { key: "avgPackage", label: "Average Package" },
          { key: "maxPackage", label: "Highest Package" },
        ]),
      }),
    };
  }

  const placedStudents = rows.reduce(
    (sum, row) => sum + Number(row.placedCount || 0),
    0
  );

  return {
    entity: "placement",
    metricKey: metricField,
    selectedDepartment,
    summaryData: {
      totalDepartments: rows.length,
      placedStudents,
      comparedMetric: humanizeKey(metricField),
    },
    chart: buildChart({
      type: "bar",
      title: "Placement Comparison",
      metric: humanizeKey(metricField),
      data: rows.slice(0, 8).map((row) => ({
        label: row.deptCode || row.deptName,
        value: roundTo(row[metricField]),
      })),
    }),
  };
};

const buildFacultyInsightPayload = async ({
  metric,
  selectedDepartment = null,
}) => {
  const facultyMatch = {
    isActive: true,
    ...(selectedDepartment?._id ? { department: selectedDepartment._id } : {}),
  };
  const paperMatch = selectedDepartment?._id
    ? { department: selectedDepartment._id }
    : {};

  const [faculty, researchPapers] = await Promise.all([
    Faculty.find(facultyMatch)
      .populate("department", "name code")
      .select("name department experience")
      .lean(),
    ResearchPaper.find(paperMatch).select("faculty department").lean(),
  ]);

  const publicationCountByFaculty = researchPapers.reduce((map, paper) => {
    const key = String(paper.faculty || "");
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());

  if (selectedDepartment) {
    const rows = faculty
      .map((member) => ({
        label: member.name || "Faculty",
        value: publicationCountByFaculty.get(String(member._id)) || 0,
        experience: roundTo(member.experience),
      }))
      .sort((left, right) => right.value - left.value || right.experience - left.experience)
      .slice(0, 8);

    return {
      entity: "faculty",
      metricKey: "publications",
      selectedDepartment,
      summaryData: {
        totalFaculty: faculty.length,
        totalPublications: researchPapers.length,
        averageExperience: faculty.length
          ? roundTo(
              faculty.reduce((sum, member) => sum + Number(member.experience || 0), 0) /
                faculty.length
            )
          : 0,
      },
      chart: buildChart({
        type: "bar",
        title: `${selectedDepartment.name} Faculty Publications`,
        metric: metric === "attendance" ? "Experience" : "Publications",
        data: rows.map((row) => ({
          label: row.label,
          value: metric === "attendance" ? row.experience : row.value,
        })),
      }),
    };
  }

  const departmentMap = faculty.reduce((map, member) => {
    const key = String(member.department?._id || "");
    const current = map.get(key) || {
      label: member.department?.code || member.department?.name || "Department",
      publications: 0,
      facultyCount: 0,
      totalExperience: 0,
    };
    current.publications += publicationCountByFaculty.get(String(member._id)) || 0;
    current.facultyCount += 1;
    current.totalExperience += Number(member.experience || 0);
    map.set(key, current);
    return map;
  }, new Map());

  const metricField = pickMetricField("faculty", metric);
  const rows = [...departmentMap.values()].map((row) => ({
    label: row.label,
    publications: row.publications,
    averageExperience: row.facultyCount
      ? roundTo(row.totalExperience / row.facultyCount)
      : 0,
  }));

  return {
    entity: "faculty",
    metricKey: metricField,
    selectedDepartment,
    summaryData: {
      totalFaculty: faculty.length,
      totalPublications: researchPapers.length,
    },
    chart: buildChart({
      type: "bar",
      title: "Faculty Insight Overview",
      metric: metricField === "averageExperience" ? "Average Experience" : "Publications",
      data: rows
        .slice(0, 8)
        .map((row) => ({
          label: row.label,
          value: roundTo(row[metricField]),
        })),
    }),
  };
};

const buildEventInsightPayload = async ({
  metric,
  selectedDepartment = null,
}) => {
  const eventMatch = {
    isActive: true,
    ...(selectedDepartment?._id
      ? {
          $or: [
            { department: selectedDepartment._id },
            { departmentScope: "ALL" },
          ],
        }
      : {}),
  };
  const events = await Event.find(eventMatch)
    .populate("department", "name code")
    .select("title type department departmentScope")
    .lean();
  const participations = events.length
    ? await Participation.find({
        event: { $in: events.map((event) => event._id) },
      })
        .select("event attended status role")
        .lean()
    : [];

  const statMap = participations.reduce((map, entry) => {
    const key = String(entry.event || "");
    const current = map.get(key) || {
      participants: 0,
      attendedCount: 0,
      winners: 0,
    };
    current.participants += 1;
    if (entry.attended || entry.status === "Participated") {
      current.attendedCount += 1;
    }
    if (["Winner", "Runner-up"].includes(entry.role)) {
      current.winners += 1;
    }
    map.set(key, current);
    return map;
  }, new Map());

  const metricField =
    metric === "attendance"
      ? "attendedCount"
      : metric === "performance"
        ? "winners"
        : pickMetricField("event", metric);
  const rows = events
    .map((event) => {
      const stats = statMap.get(String(event._id)) || {
        participants: 0,
        attendedCount: 0,
        winners: 0,
      };

      return {
        label: event.title || "Event",
        participants: stats.participants,
        attendedCount: stats.attendedCount,
        winners: stats.winners,
      };
    })
    .sort((left, right) => right[metricField] - left[metricField])
    .slice(0, 8);

  return {
    entity: "event",
    metricKey: metricField,
    selectedDepartment,
    summaryData: {
      totalEvents: events.length,
      totalParticipants: participations.length,
      totalAttended: participations.filter(
        (entry) => entry.attended || entry.status === "Participated"
      ).length,
    },
    chart: buildChart({
      type: "bar",
      title: selectedDepartment?.name
        ? `${selectedDepartment.name} Event Participation`
        : "Event Participation Overview",
      metric: humanizeKey(metricField),
      data: rows.map((row) => ({
        label: row.label,
        value: roundTo(row[metricField]),
      })),
    }),
  };
};

const buildGenericInsightPayload = async ({ contextData = {} }) => {
  const candidates = [
    ["departmentRanking", contextData.departmentRanking],
    ["placementOverview", contextData.placementOverview],
    ["attendanceOverview", contextData.attendanceOverview],
    ["cgpaOverview", contextData.cgpaOverview],
    ["researchOverview", contextData.researchOverview?.byType],
    ["marksOverview", contextData.marksOverview?.byGradeRange],
    ["backlogOverview", contextData.backlogOverview?.byDepartment],
    ["eventOverview", contextData.eventOverview?.byType],
  ];

  const [sourceKey, rows] =
    candidates.find(([, value]) => Array.isArray(value) && value.length) || [];

  const chart =
    buildGenericChartFromRows(rows || [], sourceKey ? humanizeKey(sourceKey) : "Institution Overview") ||
    buildChart({
      type: "bar",
      title: "Institution Overview",
      metric: "Value",
      data: Object.entries(contextData.overview || {})
        .filter(([, value]) => Number.isFinite(Number(value)))
        .slice(0, 8)
        .map(([key, value]) => ({
          label: humanizeKey(key),
          value: roundTo(value),
        })),
    });

  return {
    entity: "generic",
    metricKey: "overview",
    selectedDepartment: null,
    summaryData: contextData.overview || {},
    chart,
  };
};

const buildInsightDataset = async ({ message, contextData = {} }) => {
  const entity = detectInsightEntity(message, contextData);
  const metric = detectInsightMetric(message, entity);
  const selectedDepartment = await extractDepartmentFromQuery(message);

  if (entity === "student") {
    return buildStudentInsightPayload({
      metric,
      contextData,
      selectedDepartment,
    });
  }

  if (entity === "department") {
    return buildDepartmentInsightPayload({
      message,
      metric,
      selectedDepartment,
    });
  }

  if (entity === "placement") {
    return buildPlacementInsightPayload({
      metric,
      selectedDepartment,
    });
  }

  if (entity === "faculty") {
    return buildFacultyInsightPayload({
      metric,
      selectedDepartment,
    });
  }

  if (entity === "event") {
    return buildEventInsightPayload({
      metric,
      selectedDepartment,
    });
  }

  return buildGenericInsightPayload({ contextData });
};

const toLegacyFallbackInsight = (insight = {}) => ({
  title: insight.title || "AI Insight",
  problem: Array.isArray(insight.points) ? insight.points.slice(0, 2) : [],
  impact: insight.description || "",
  suggestions: Array.isArray(insight.points) ? insight.points.slice(2) : [],
});

const normalizeAiInsight = (aiResult = {}, fallbackInsight = {}) => {
  const insight = aiResult.insight || {};
  const points = [
    ...(Array.isArray(insight.problem) ? insight.problem : []),
    ...(Array.isArray(insight.suggestions) ? insight.suggestions : []),
  ]
    .filter(Boolean)
    .slice(0, 5);

  return {
    title: insight.title || fallbackInsight.title,
    description: aiResult.reply || insight.impact || fallbackInsight.description,
    points: points.length ? points : fallbackInsight.points,
  };
};

const buildUniversalInsightResponse = async ({
  message,
  contextData = {},
}) => {
  const dataset = await buildInsightDataset({
    message,
    contextData,
  });
  const fallbackInsight = buildDeterministicInsight({
    entity: dataset.entity,
    metric: dataset.metricKey,
    chart: dataset.chart,
    summaryData: dataset.summaryData,
    selectedDepartment: dataset.selectedDepartment,
  });
  const aiSummary = {
    entity: dataset.entity,
    metric: dataset.chart?.metric || humanizeKey(dataset.metricKey),
    summary: dataset.summaryData,
    selectedDepartment: dataset.selectedDepartment
      ? {
          name: dataset.selectedDepartment.name || null,
          code: dataset.selectedDepartment.code || null,
        }
      : null,
    chartPreview: dataset.chart?.data?.slice(0, 6) || [],
  };

  const aiResult = await generateGeminiInsight({
    userMessage: message,
    insightType: `${dataset.entity}:${dataset.metricKey}`,
    dataSummary: aiSummary,
    fallbackReply: fallbackInsight.description,
    fallbackStructuredInsight: toLegacyFallbackInsight(fallbackInsight),
  });

  const insights = normalizeAiInsight(aiResult, fallbackInsight);

  return {
    success: true,
    type: "insight",
    entity: dataset.entity,
    reply: insights.description,
    message: insights.description,
    title: insights.title,
    summaryText: insights.description,
    summaryData: dataset.summaryData,
    insights,
    chart: dataset.chart,
    provider: aiResult.meta?.provider || "fallback",
    model: aiResult.meta?.model || null,
    sourceDatabase: contextData.sourceDatabase || null,
    usedLiveData: true,
    meta: {
      ...(aiResult.meta || {}),
      entity: dataset.entity,
      metric: dataset.metricKey,
    },
    extraData: {
      entity: dataset.entity,
      metric: dataset.metricKey,
      selectedDepartment: dataset.selectedDepartment || null,
      chart: dataset.chart,
    },
  };
};

module.exports = {
  buildUniversalInsightResponse,
  detectInsightEntity,
  detectInsightMetric,
};
