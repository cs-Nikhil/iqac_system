const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Faculty = require('../models/Faculty');
const Placement = require('../models/Placement');
const ResearchPaper = require('../models/ResearchPaper');
const { Event, Participation } = require('../models/Event');
const analyticsService = require('./analytics.service');
const { calculateStudentPerformance } = require('./performance.service');
const { resolveYearFilterContext } = require('./chatbotYearFilter.service');
const {
  buildMongoFilter,
  detectOperator,
  extractNumbers,
  filterRowsByConditions,
  parseAdvancedFilters,
  resolveMentionedDepartments,
} = require('./chatbotFilter.service');
const {
  buildAtRiskStudentFilter,
  AT_RISK_STUDENT_SORT,
} = require('../utils/studentFilters');
const {
  buildAccessDeniedMessage,
} = require("./chatbotAccessScope.service");

const TOP_PATTERN = /\btop\s+(\d+)\b/i;
const CGPA_BELOW_PATTERN = /\bcgpa\s+(?:below|under|less than)\s+(\d+(?:\.\d+)?)\b/i;
const ATTENDANCE_BELOW_PATTERN = /\battendance\s+(?:below|under|less than)\s+(\d+(?:\.\d+)?)\b/i;
const BACKLOG_MORE_THAN_PATTERN = /\b(?:more than|above|over)\s+(\d+)\s+backlog/i;
const PASS_PERCENT_PATTERN = /\bpass\s*%|\bpass percentage\b/i;
const PUBLICATIONS_PATTERN = /\bpublication|publications|research papers|papers\b/i;
const COUNT_QUERY_PATTERN = /\b(how many|count|number)\b/i;
const STUDENT_ENTITY_PATTERN = /\bstudents?\b/i;
const FACULTY_ENTITY_PATTERN = /\b(faculty|faculties|staff)\b/i;
const DEPARTMENT_ENTITY_PATTERN = /\bdepartments?\b/i;
const PLACEMENT_ENTITY_PATTERN = /\b(placement|placements|package|packages)\b/i;
const EVENT_ENTITY_PATTERN = /\b(event|events|workshop|seminar|hackathon|conference)\b/i;
const ACHIEVEMENT_PATTERN = /\b(achievement|achievements|award|awards|certification|certifications|recognition|grant|patent|fdp)\b/i;
const PARTICIPATION_PATTERN = /\b(participation|participations|participants|winners?|attended|attendance marked)\b/i;
const ACADEMIC_YEAR_PATTERN = /(20\d{2})\s*-\s*(\d{2,4})/i;
const ACHIEVEMENT_LEVELS = [
  "International",
  "National",
  "State",
  "Institutional",
];
const ACHIEVEMENT_TYPES = [
  "Award",
  "Certification",
  "Recognition",
  "Publication",
  "Grant",
  "Patent",
  "Conference",
  "Workshop",
  "FDP",
];
const EVENT_TYPES = [
  "Technical",
  "Cultural",
  "Sports",
  "Workshop",
  "Seminar",
  "Competition",
  "Hackathon",
  "Conference",
  "Social",
];

const OPERATOR_LABELS = {
  $lt: '<',
  $lte: '<=',
  $gt: '>',
  $gte: '>=',
  $eq: '=',
};

const detectPrimaryEntity = (message = '') => {
  const normalized = message.toLowerCase();

  if (STUDENT_ENTITY_PATTERN.test(normalized)) return 'student';
  if (FACULTY_ENTITY_PATTERN.test(normalized)) return 'faculty';
  if (DEPARTMENT_ENTITY_PATTERN.test(normalized)) return 'department';
  if (PLACEMENT_ENTITY_PATTERN.test(normalized)) return 'placement';
  if (EVENT_ENTITY_PATTERN.test(normalized)) return 'event';
  return null;
};

const hasDynamicNumericComparison = (message = '') =>
  extractNumbers(message).length > 0 && Boolean(detectOperator(message));

const humanizeFieldName = (field = '') =>
  String(field)
    .split('.')
    .pop()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();

const formatConditionSummary = (conditions = [], joiner = '$and') =>
  conditions
    .map((condition) =>
      `${humanizeFieldName(condition.field)} ${OPERATOR_LABELS[condition.operator] || condition.operator} ${condition.value}`
    )
    .join(joiner === '$or' ? ' or ' : ' and ');

const detectAnalyticsIntent = async (message = '') => {
  const normalized = message.toLowerCase();
  const primaryEntity = detectPrimaryEntity(message);
  const mentionedDepartments = await resolveMentionedDepartments(message);

  if (/\b(top performers|top students|best students|highest cgpa)\b/.test(normalized)) {
    return 'topPerformers';
  }

  if (/\bat[-\s]?risk\b/.test(normalized) && (primaryEntity === 'student' || STUDENT_ENTITY_PATTERN.test(normalized))) {
    return 'atRiskStudents';
  }

  if (primaryEntity === 'student' && hasDynamicNumericComparison(message)) {
    return 'advancedStudentFilter';
  }

  if (/\bdepartment(?:\s|-)?wise attendance\b|\battendance by department\b/.test(normalized)) {
    return 'departmentWiseAttendance';
  }

  if (/\bwhich subject has highest failures\b|\bsubject\b.*\b(highest failures|most failures)\b|\bhighest failures\b.*\bsubject\b/.test(normalized)) {
    return 'highestFailureSubject';
  }

  if (primaryEntity === 'department' && hasDynamicNumericComparison(message)) {
    return 'advancedDepartmentMetricFilter';
  }

  if (/\bdepartment(?:\s|-)?wise pass percentage\b|\bpass percentage\b.*\bdepartment\b/.test(normalized)) {
    return 'departmentPassPercentage';
  }

  if (
    /\b(compare|comparison)\b.*\bdepartment\b/.test(normalized) ||
    (/\b(compare|comparison)\b/.test(normalized) && mentionedDepartments.length >= 2)
  ) {
    return 'departmentComparison';
  }

  if (/\bdepartment(?:\s|-)?wise statistics\b|\bdepartment statistics\b/.test(normalized)) {
    return 'departmentWiseStatistics';
  }

  if (/\bplacement percentage\b|\bdepartment(?:\s|-)?wise placement\b/.test(normalized)) {
    return 'departmentPlacementPercentage';
  }

  if (ACHIEVEMENT_PATTERN.test(normalized)) {
    return 'facultyAchievements';
  }

  if (EVENT_ENTITY_PATTERN.test(normalized) && PARTICIPATION_PATTERN.test(normalized)) {
    return 'studentParticipationStats';
  }

  if (primaryEntity === 'faculty' && hasDynamicNumericComparison(message)) {
    return 'facultyNumericFilter';
  }

  if (primaryEntity === 'placement' && hasDynamicNumericComparison(message)) {
    return 'placementNumericFilter';
  }

  if (primaryEntity === 'event' && hasDynamicNumericComparison(message)) {
    return 'eventNumericFilter';
  }

  return null;
};

const getTopLimit = (message = '', fallback = null) => {
  const match = message.match(TOP_PATTERN);
  if (!match) return fallback;
  return Math.min(Math.max(parseInt(match[1], 10), 1), 20);
};

const extractThreshold = (message = '', pattern, fallback = null) => {
  const match = message.match(pattern);
  if (!match) return fallback;
  return Number(match[1]);
};

const isCountQuery = (message = '') => COUNT_QUERY_PATTERN.test(message);

const extractAcademicYear = (message = '') => {
  const match = String(message || '').match(ACADEMIC_YEAR_PATTERN);
  if (!match) {
    return null;
  }

  const startYear = match[1];
  const rawEnd = match[2];
  const endYear = rawEnd.length === 4 ? rawEnd.slice(2) : rawEnd;
  return `${startYear}-${endYear}`;
};

const getAcademicYearFilter = (message = '', entity = null) =>
  resolveYearFilterContext({ message, entity }).academicYear || null;

const extractEnumValue = (message = '', values = []) => {
  const normalizedMessage = normalizeText(message);
  return (
    values.find((value) =>
      normalizedMessage.includes(normalizeText(value))
    ) || null
  );
};

const normalizeStudentRow = (student = {}) => {
  const performance = Number.isFinite(Number(student.performanceScore))
    ? {
        performanceScore: Number(student.performanceScore),
        category: student.performanceCategory,
      }
    : calculateStudentPerformance(student);

  return {
    id: String(student._id),
    name: student.name,
    rollNumber: student.rollNumber,
    department: student.department?.name || student.department || null,
    departmentCode: student.department?.code || student.departmentCode || null,
    cgpa: student.cgpa ?? null,
    currentSemester: student.currentSemester ?? null,
    currentBacklogs: student.currentBacklogs ?? 0,
    averageAttendance: student.academicRecords?.avgAttendance ?? student.averageAttendance ?? null,
    performanceScore: performance.performanceScore ?? null,
    performanceCategory: performance.category || student.performanceCategory || null,
  };
};

const buildTopPerformersResponse = async (message, departments) => {
  const limit = getTopLimit(message);
  const match = { isActive: true };
  if (departments[0]) {
    match.department = departments[0]._id;
  }

  let query = Student.find(match)
    .populate('department', 'name code')
    .sort({ performanceScore: -1, cgpa: -1, 'academicRecords.avgAttendance': -1, name: 1 });

  if (limit) {
    query = query.limit(limit);
  }

  const students = await query.lean();

  const rows = students.map(normalizeStudentRow);
  console.log('Total records fetched:', rows.length);
  const titleSuffix = departments[0] ? ` in ${departments[0].code}` : '';
  const reply = rows.length
    ? `I found ${rows.length} top performer record${rows.length === 1 ? '' : 's'}${titleSuffix}. All matching records are included in the table.`
    : `I could not find top performer data${titleSuffix}.`;

  return {
    reply,
    data: {
      type: 'students',
      rows,
    },
  };
};

const buildStudentsBelowCgpaResponse = async (message, departments) => {
  const threshold = extractThreshold(message, CGPA_BELOW_PATTERN, 6);
  const match = {
    isActive: true,
    cgpa: { $lt: threshold },
  };
  if (departments[0]) {
    match.department = departments[0]._id;
  }

  const students = await Student.find(match)
    .populate('department', 'name code')
    .sort({ cgpa: 1, currentBacklogs: -1, name: 1 })
    .lean();

  const rows = students.map(normalizeStudentRow);
  console.log('Total records fetched:', rows.length);
  const reply = rows.length
    ? `I found ${rows.length} student records with CGPA below ${threshold}${departments[0] ? ` in ${departments[0].code}` : ''}. All matching records are included in the table.`
    : `I could not find students with CGPA below ${threshold}${departments[0] ? ` in ${departments[0].code}` : ''}.`;

  return {
    reply,
    data: {
      type: 'students',
      rows,
    },
  };
};

const buildStudentsBelowAttendanceResponse = async (message, departments) => {
  const threshold = extractThreshold(message, ATTENDANCE_BELOW_PATTERN, 75);

  const pipeline = [
    {
      $lookup: {
        from: 'students',
        localField: 'student',
        foreignField: '_id',
        as: 'studentData',
      },
    },
    { $unwind: '$studentData' },
  ];

  if (departments[0]) {
    pipeline.push({
      $match: {
        'studentData.department': departments[0]._id,
      },
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: 'departments',
        localField: 'studentData.department',
        foreignField: '_id',
        as: 'deptData',
      },
    },
    { $unwind: '$deptData' },
    {
      $group: {
        _id: '$studentData._id',
        name: { $first: '$studentData.name' },
        rollNumber: { $first: '$studentData.rollNumber' },
        department: { $first: '$deptData.name' },
        departmentCode: { $first: '$deptData.code' },
        cgpa: { $first: '$studentData.cgpa' },
        currentBacklogs: { $first: '$studentData.currentBacklogs' },
        averageAttendance: { $avg: '$percentage' },
      },
    },
    {
      $addFields: {
        averageAttendance: { $round: ['$averageAttendance', 2] },
      },
    },
    {
      $match: {
        averageAttendance: { $lt: threshold },
      },
    },
    { $sort: { averageAttendance: 1, cgpa: 1 } },
  );

  const rows = await Attendance.aggregate(pipeline);
  console.log('Total records fetched:', rows.length);
  const reply = rows.length
    ? `I found ${rows.length} students with attendance below ${threshold}%${departments[0] ? ` in ${departments[0].code}` : ''}. All matching records are included in the table.`
    : `I could not find students with attendance below ${threshold}%${departments[0] ? ` in ${departments[0].code}` : ''}.`;

  return {
    reply,
    data: {
      type: 'students',
      rows,
    },
  };
};

const buildStudentsWithMoreThanBacklogsResponse = async (message, departments) => {
  const threshold = extractThreshold(message, BACKLOG_MORE_THAN_PATTERN, 0);
  const match = {
    isActive: true,
    currentBacklogs: { $gt: threshold },
  };
  if (departments[0]) {
    match.department = departments[0]._id;
  }

  const students = await Student.find(match)
    .populate('department', 'name code')
    .sort({ currentBacklogs: -1, cgpa: 1, name: 1 })
    .lean();

  const rows = students.map(normalizeStudentRow);
  console.log('Total records fetched:', rows.length);
  const reply = rows.length
    ? `I found ${rows.length} students with more than ${threshold} backlog${threshold === 1 ? '' : 's'}${departments[0] ? ` in ${departments[0].code}` : ''}. All matching records are included in the table.`
    : `I could not find students with more than ${threshold} backlog${threshold === 1 ? '' : 's'}${departments[0] ? ` in ${departments[0].code}` : ''}.`;

  return {
    reply,
    data: {
      type: 'students',
      rows,
    },
  };
};

const buildAdvancedStudentFilterResponse = async (message, departments) => {
  const parsed = parseAdvancedFilters(message, {
    model: Student,
    target: 'student',
  });
  if (!parsed.conditions.length) {
    return null;
  }
  const studentMatch = {
    isActive: true,
    ...buildMongoFilter(parsed.conditions, {}, parsed.joiner),
  };

  if (departments[0]) {
    studentMatch.department = departments[0]._id;
  }

  const students = await Student.find(studentMatch)
    .populate('department', 'name code')
    .sort({
      cgpa: 1,
      'academicRecords.avgAttendance': 1,
      currentBacklogs: -1,
      name: 1,
    })
    .lean();
  const rows = students.map(normalizeStudentRow);
  console.log('Total records fetched:', rows.length);
  const conditionsSummary = formatConditionSummary(parsed.conditions, parsed.joiner);

  if (isCountQuery(message)) {
    return {
      reply: `Total students matching ${conditionsSummary}${departments[0] ? ` in ${departments[0].code}` : ''}: ${rows.length}`,
      type: 'summary',
      value: rows.length,
      data: {
        type: 'students',
        rows,
        summary: {
          count: rows.length,
        },
      },
    };
  }

  const reply = rows.length
    ? `I found ${rows.length} students matching the filters: ${conditionsSummary}${departments[0] ? ` in ${departments[0].code}` : ''}. All matching records are included in the table.`
    : `I could not find students matching the filters: ${conditionsSummary}${departments[0] ? ` in ${departments[0].code}` : ''}.`;

  return {
    reply,
    data: {
      type: 'students',
      rows,
    },
  };
};

const buildAtRiskStudentsResponse = async (message, departments) => {
  const filter = buildAtRiskStudentFilter({
    department: departments[0]?._id,
  });

  const students = await Student.find(filter)
    .populate('department', 'name code')
    .sort(AT_RISK_STUDENT_SORT)
    .lean();

  const rows = students
    .map(normalizeStudentRow)
    .filter((student) => student.performanceCategory === 'At Risk');
  console.log('Total records fetched:', rows.length);
  const reply = rows.length
    ? `I found ${rows.length} at-risk students${departments[0] ? ` in ${departments[0].code}` : ''}. These records use the same backend at-risk classification as the student analytics APIs.`
    : `I could not find backend-classified at-risk students${departments[0] ? ` in ${departments[0].code}` : ''}.`;

  return {
    reply,
    data: {
      type: 'students',
      rows,
    },
  };
};

const buildDepartmentAttendanceResponse = async (message, departments = []) => {
  const rows = await analyticsService.getAttendanceByDept({
    departmentId: departments[0]?._id,
    ...(getAcademicYearFilter(message, 'department')
      ? { academicYear: getAcademicYearFilter(message, 'department') }
      : {}),
  });
  const title = departments[0]
    ? `Attendance summary for ${departments[0].code}:`
    : 'Department-wise attendance summary:';
  const reply = rows.length
    ? `${title}\n${rows.map((item, index) => `${index + 1}. ${item.deptName} (${item.deptCode}) - average attendance ${item.avgAttendance}%, below-threshold records ${item.belowThreshold}.`).join('\n')}`
    : `I could not find attendance data${departments[0] ? ` for ${departments[0].code}` : ''}.`;

  return {
    reply,
    data: {
      type: 'departments',
      rows,
    },
  };
};

const buildDepartmentPassPercentageResponse = async (message, departments = []) => {
  const rows = await analyticsService.getPassPercentageByDept({
    departmentId: departments[0]?._id,
    ...(getAcademicYearFilter(message, 'department')
      ? { academicYear: getAcademicYearFilter(message, 'department') }
      : {}),
  });
  const title = departments[0]
    ? `Pass percentage for ${departments[0].code}:`
    : 'Department-wise pass percentage:';
  const reply = rows.length
    ? `${title}\n${rows.map((item, index) => `${index + 1}. ${item.deptName} (${item.deptCode}) - pass percentage ${item.passPercentage}%, average marks ${Number(item.avgMarks || 0).toFixed(2)}.`).join('\n')}`
    : `I could not find pass percentage data${departments[0] ? ` for ${departments[0].code}` : ''}.`;

  return {
    reply,
    data: {
      type: 'departments',
      rows,
    },
  };
};

const buildAdvancedDepartmentMetricFilterResponse = async (message, departments = []) => {
  const rows = await analyticsService.getDepartmentWiseStatistics({
    departmentId: departments[0]?._id,
    ...(getAcademicYearFilter(message, 'department')
      ? { academicYear: getAcademicYearFilter(message, 'department') }
      : {}),
  });
  const parsed = parseAdvancedFilters(message, {
    sampleData: rows[0] || null,
    target: 'departmentMetric',
  });
  if (!parsed.conditions.length) {
    return null;
  }
  const filteredRows = filterRowsByConditions(rows, parsed.conditions, parsed.joiner);
  const summary = formatConditionSummary(parsed.conditions, parsed.joiner);
  const reply = filteredRows.length
    ? `I found ${filteredRows.length} department records matching ${summary}${departments[0] ? ` in ${departments[0].code}` : ''}.`
    : `I could not find department records matching ${summary}${departments[0] ? ` in ${departments[0].code}` : ''}.`;

  return {
    reply,
    data: {
      type: 'departments',
      rows: filteredRows,
      summary: {
        count: filteredRows.length,
      },
    },
  };
};

const buildHighestFailureSubjectResponse = async (message, departments) => {
  const rows = await analyticsService.getSubjectFailureAnalysis({
    departmentId: departments[0]?._id,
    ...(getAcademicYearFilter(message, 'subject')
      ? { academicYear: getAcademicYearFilter(message, 'subject') }
      : {}),
  });

  if (!rows.length) {
    return {
      reply: `I could not find subject failure data${departments[0] ? ` for ${departments[0].code}` : ''}.`,
      data: { type: 'subjects', rows: [] },
    };
  }

  const top = rows[0];
  return {
    reply: `The subject with the highest failures${departments[0] ? ` in ${departments[0].code}` : ''} is ${top.subjectName} (${top.subjectCode}) with ${top.failureCount} failures and a pass percentage of ${top.passPercentage}%.`,
    data: {
      type: 'subjects',
      rows,
    },
  };
};

const buildDepartmentComparisonResponse = async (message, departments) => {
  if (departments.length < 2) {
    return {
      reply: 'Please mention at least two departments to compare, for example: compare CSE and ECE.',
      data: { type: 'departments', rows: [] },
    };
  }

  const stats = await analyticsService.getDepartmentWiseStatistics(
    getAcademicYearFilter(message, 'department')
      ? { academicYear: getAcademicYearFilter(message, 'department') }
      : {}
  );
  const departmentIds = new Set(departments.map((item) => String(item._id)));
  const rows = stats.filter((item) => departmentIds.has(String(item.deptId)));

  const reply = rows.length
    ? `Department comparison:\n${rows.map((item) => `${item.deptName} (${item.deptCode}) - CGPA ${item.averageCGPA}, attendance ${item.averageAttendance}%, pass percentage ${item.passPercentage}%, placement percentage ${item.placementPercentage}%.`).join('\n')}`
    : 'I could not build the requested department comparison.';

  return {
    reply,
    data: {
      type: 'departments',
      rows,
    },
  };
};

const buildDepartmentStatisticsResponse = async (message, departments = []) => {
  const rows = await analyticsService.getDepartmentWiseStatistics({
    departmentId: departments[0]?._id,
    ...(getAcademicYearFilter(message, 'department')
      ? { academicYear: getAcademicYearFilter(message, 'department') }
      : {}),
  });
  const title = departments[0]
    ? `Department statistics for ${departments[0].code}:`
    : 'Department-wise statistics:';
  const reply = rows.length
    ? `${title}\n${rows.map((item) => `${item.deptName} (${item.deptCode}) - average CGPA ${item.averageCGPA}, attendance ${item.averageAttendance}%, pass percentage ${item.passPercentage}%, placement percentage ${item.placementPercentage}%.`).join('\n')}`
    : `I could not find department statistics${departments[0] ? ` for ${departments[0].code}` : ''}.`;

  return {
    reply,
    data: {
      type: 'departments',
      rows,
    },
  };
};

const buildDepartmentPlacementResponse = async (message, departments = []) => {
  const rows = await analyticsService.getPlacementAnalytics({
    departmentId: departments[0]?._id,
    ...(getAcademicYearFilter(message, 'placement')
      ? { academicYear: getAcademicYearFilter(message, 'placement') }
      : {}),
  });
  const title = departments[0]
    ? `Placement summary for ${departments[0].code}:`
    : 'Department-wise placement percentage:';
  const reply = rows.length
    ? `${title}\n${rows.map((item, index) => `${index + 1}. ${item.deptName} (${item.deptCode}) - placement percentage ${item.placementPercentage}%, placed students ${item.placedCount}.`).join('\n')}`
    : `I could not find placement percentage data${departments[0] ? ` for ${departments[0].code}` : ''}.`;

  return {
    reply,
    data: {
      type: 'departments',
      rows,
    },
  };
};

const buildFacultyAchievementsResponse = async (message, departments = []) => {
  const yearContext = resolveYearFilterContext({
    message,
    entity: 'achievement',
  });
  const filters = {
    ...(departments[0]?._id ? { departmentId: departments[0]._id } : {}),
    ...(yearContext.academicYear ? { academicYear: yearContext.academicYear } : {}),
    ...(yearContext.dateRange ? { dateRange: yearContext.dateRange } : {}),
  };
  const level = extractEnumValue(message, ACHIEVEMENT_LEVELS);
  const type = extractEnumValue(message, ACHIEVEMENT_TYPES);

  if (level) {
    filters.level = level;
  }

  if (type) {
    filters.type = type;
  }

  const rows = await analyticsService.getFacultyAchievements(filters);
  const reply = rows.length
    ? `I found ${rows.length} department achievement summaries${departments[0] ? ` for ${departments[0].code}` : ''}.`
    : `I could not find faculty achievement analytics${departments[0] ? ` for ${departments[0].code}` : ''}.`;

  return {
    reply,
    data: {
      type: 'achievements',
      rows,
      summary: {
        count: rows.length,
        department: departments[0]?.code || null,
        level: level || null,
        type: type || null,
        academicYear: filters.academicYear || null,
        year: yearContext.rawYear || null,
      },
    },
  };
};

const buildStudentParticipationStatsResponse = async (message, departments = []) => {
  const yearContext = resolveYearFilterContext({
    message,
    entity: 'event',
  });
  const filters = {
    ...(departments[0]?._id ? { departmentId: departments[0]._id } : {}),
    ...(yearContext.academicYear ? { academicYear: yearContext.academicYear } : {}),
    ...(yearContext.dateRange ? { dateRange: yearContext.dateRange } : {}),
  };
  const eventType = extractEnumValue(message, EVENT_TYPES);
  const level = extractEnumValue(message, ACHIEVEMENT_LEVELS);

  if (eventType) {
    filters.eventType = eventType;
  }

  if (level) {
    filters.level = level;
  }

  const rows = await analyticsService.getStudentParticipationStats(filters);
  const reply = rows.length
    ? `I found ${rows.length} student participation summaries${departments[0] ? ` for ${departments[0].code}` : ''}.`
    : `I could not find student participation analytics${departments[0] ? ` for ${departments[0].code}` : ''}.`;

  return {
    reply,
    data: {
      type: 'events',
      rows,
      summary: {
        count: rows.length,
        department: departments[0]?.code || null,
        eventType: eventType || null,
        level: level || null,
        academicYear: filters.academicYear || null,
        year: yearContext.rawYear || null,
      },
    },
  };
};

const buildFacultyNumericFilterResponse = async (message, departments = []) => {
  const facultyMatch = {
    isActive: true,
    ...(departments[0]?._id ? { department: departments[0]._id } : {}),
  };
  const faculty = await Faculty.find(facultyMatch)
    .populate('department', 'name code')
    .lean();
  const publicationCounts = await ResearchPaper.aggregate([
    {
      $match: {
        faculty: { $in: faculty.map((member) => member._id) },
      },
    },
    {
      $group: {
        _id: '$faculty',
        publications: { $sum: 1 },
      },
    },
  ]);
  const publicationCountByFaculty = publicationCounts.reduce((map, item) => {
    map.set(String(item._id), Number(item.publications || 0));
    return map;
  }, new Map());

  const rows = faculty.map((member) => ({
    name: member.name || null,
    email: member.email || null,
    designation: member.designation || null,
    department: member.department?.name || null,
    departmentCode: member.department?.code || null,
    experience: Number(member.experience || 0),
    publications: publicationCountByFaculty.get(String(member._id)) || 0,
  }));
  const parsed = parseAdvancedFilters(message, {
    fieldCatalogs: [
      {
        model: Faculty,
        target: 'facultyMetric',
      },
      {
        sampleData: rows[0] || null,
        target: 'facultyMetric',
      },
    ],
  });
  if (!parsed.conditions.length) {
    return null;
  }
  const filteredRows = filterRowsByConditions(rows, parsed.conditions, parsed.joiner);
  console.log('Total records fetched:', filteredRows.length);
  const summary = formatConditionSummary(parsed.conditions, parsed.joiner);
  const reply = filteredRows.length
    ? `I found ${filteredRows.length} faculty records matching ${summary}${departments[0] ? ` in ${departments[0].code}` : ''}.`
    : `I could not find faculty records matching ${summary}${departments[0] ? ` in ${departments[0].code}` : ''}.`;

  return {
    reply,
    data: {
      type: 'faculty',
      rows: filteredRows,
      summary: {
        count: filteredRows.length,
      },
    },
  };
};

const buildPlacementNumericFilterResponse = async (message, departments = []) => {
  const studentMatch = {
    isActive: true,
    ...(departments[0]?._id ? { department: departments[0]._id } : {}),
  };
  const students = await Student.find(studentMatch).select('_id').lean();
  const studentIds = students.map((student) => student._id);
  const placements = studentIds.length
    ? await Placement.find({ student: { $in: studentIds } })
      .populate({
        path: 'student',
        populate: {
          path: 'department',
          select: 'name code',
        },
      })
      .lean()
    : [];

  const rows = placements.map((placement) => ({
    company: placement.company || null,
    package: Number(placement.package || 0),
    role: placement.role || null,
    academicYear: placement.academicYear || null,
    placementType: placement.placementType || null,
    student: placement.student?.name || null,
    rollNumber: placement.student?.rollNumber || null,
    department: placement.student?.department?.name || null,
    departmentCode: placement.student?.department?.code || null,
  }));
  const parsed = parseAdvancedFilters(message, {
    model: Placement,
    sampleData: rows[0] || null,
    target: 'placementMetric',
  });
  if (!parsed.conditions.length) {
    return null;
  }
  const filteredRows = filterRowsByConditions(rows, parsed.conditions, parsed.joiner);
  const summary = formatConditionSummary(parsed.conditions, parsed.joiner);

  return {
    reply: filteredRows.length
      ? `I found ${filteredRows.length} placement records matching ${summary}${departments[0] ? ` in ${departments[0].code}` : ''}.`
      : `I could not find placement records matching ${summary}${departments[0] ? ` in ${departments[0].code}` : ''}.`,
    data: {
      type: 'placements',
      rows: filteredRows,
      summary: {
        count: filteredRows.length,
      },
    },
  };
};

const buildEventNumericFilterResponse = async (message, departments = []) => {
  const eventMatch = {
    isActive: true,
    ...(departments[0]?._id ? { department: departments[0]._id } : {}),
  };
  const events = await Event.find(eventMatch)
    .populate('department', 'name code')
    .lean();
  const participations = events.length
    ? await Participation.find({
      event: { $in: events.map((event) => event._id) },
    })
      .select('event attended status')
      .lean()
    : [];
  const participationByEvent = participations.reduce((map, item) => {
    const key = String(item.event || '');
    const current = map.get(key) || { participants: 0, attendedCount: 0 };
    current.participants += 1;
    if (item.attended || item.status === 'Participated') {
      current.attendedCount += 1;
    }
    map.set(key, current);
    return map;
  }, new Map());

  const rows = events.map((event) => {
    const stats = participationByEvent.get(String(event._id)) || {
      participants: 0,
      attendedCount: 0,
    };

    return {
      title: event.title || null,
      type: event.type || null,
      level: event.level || null,
      department: event.department?.name || null,
      departmentCode: event.department?.code || null,
      participants: stats.participants,
      attendedCount: stats.attendedCount,
    };
  });
  const parsed = parseAdvancedFilters(message, {
    sampleData: rows[0] || null,
    target: 'eventMetric',
  });
  if (!parsed.conditions.length) {
    return null;
  }
  const filteredRows = filterRowsByConditions(rows, parsed.conditions, parsed.joiner);
  const summary = formatConditionSummary(parsed.conditions, parsed.joiner);

  return {
    reply: filteredRows.length
      ? `I found ${filteredRows.length} event records matching ${summary}${departments[0] ? ` in ${departments[0].code}` : ''}.`
      : `I could not find event records matching ${summary}${departments[0] ? ` in ${departments[0].code}` : ''}.`,
    data: {
      type: 'events',
      rows: filteredRows,
      summary: {
        count: filteredRows.length,
      },
    },
  };
};

const buildAnalyticsAccessDeniedResponse = (accessScope = {}) => ({
  reply: buildAccessDeniedMessage(accessScope),
  data: {
    type: "access_denied",
    rows: [],
    summary: {
      denied: true,
      role: accessScope.role || null,
    },
  },
});

const handleAnalyticsQuery = async (message = '', accessScope = null) => {
  const intent = await detectAnalyticsIntent(message);
  if (!intent) return null;

  if (accessScope?.role === "student" || accessScope?.role === "faculty") {
    return buildAnalyticsAccessDeniedResponse(accessScope);
  }

  const mentionedDepartments = await resolveMentionedDepartments(message);
  const departments =
    accessScope?.role === "hod" && accessScope?.department
      ? [accessScope.department]
      : mentionedDepartments;

  if (
    accessScope?.role === "hod" &&
    mentionedDepartments.length &&
    mentionedDepartments.some(
      (department) =>
        String(department?._id || "") !== String(accessScope.department?._id || "")
    )
  ) {
    return buildAnalyticsAccessDeniedResponse(accessScope);
  }

  if (accessScope?.role === "hod" && intent === "departmentComparison") {
    return buildAnalyticsAccessDeniedResponse(accessScope);
  }

  if (intent === 'topPerformers') return buildTopPerformersResponse(message, departments);
  if (intent === 'atRiskStudents') return buildAtRiskStudentsResponse(message, departments);
  if (intent === 'advancedStudentFilter') return buildAdvancedStudentFilterResponse(message, departments);
  if (intent === 'departmentWiseAttendance') return buildDepartmentAttendanceResponse(message, departments);
  if (intent === 'highestFailureSubject') return buildHighestFailureSubjectResponse(message, departments);
  if (intent === 'advancedDepartmentMetricFilter') return buildAdvancedDepartmentMetricFilterResponse(message, departments);
  if (intent === 'departmentPassPercentage') return buildDepartmentPassPercentageResponse(message, departments);
  if (intent === 'departmentComparison') return buildDepartmentComparisonResponse(message, departments);
  if (intent === 'departmentWiseStatistics') return buildDepartmentStatisticsResponse(message, departments);
  if (intent === 'departmentPlacementPercentage') return buildDepartmentPlacementResponse(message, departments);
  if (intent === 'facultyAchievements') return buildFacultyAchievementsResponse(message, departments);
  if (intent === 'studentParticipationStats') return buildStudentParticipationStatsResponse(message, departments);
  if (intent === 'facultyNumericFilter') return buildFacultyNumericFilterResponse(message, departments);
  if (intent === 'placementNumericFilter') return buildPlacementNumericFilterResponse(message, departments);
  if (intent === 'eventNumericFilter') return buildEventNumericFilterResponse(message, departments);

  return null;
};

module.exports = {
  detectAnalyticsIntent,
  handleAnalyticsQuery,
};
