const Marks = require('../models/Marks');
const Placement = require('../models/Placement');
const analyticsService = require('./analytics.service');
const staffService = require('./staff.service');

const REPORT_PATTERN = /\b(generate report|export report|report|pdf|docx|document)\b/i;
const LAST_YEARS_PATTERN = /\blast\s+(\d+)\s+years\b/i;

const detectReportRequest = (message = '') => REPORT_PATTERN.test(message);

const detectReportType = (message = '') => {
  const normalized = message.toLowerCase();

  if (normalized.includes('backlog')) return 'backlog';
  if (normalized.includes('placement')) return 'placement';
  if (normalized.includes('department')) return 'department';
  if (normalized.includes('student') || normalized.includes('cgpa') || normalized.includes('performance')) return 'student-performance';
  return 'institutional';
};

const wantsSemesterComparison = (message = '') =>
  /\bsemester(?:-|\s)?wise comparison\b|\bsemester comparison\b/i.test(message);

const getRequestedYearWindow = (message = '') => {
  const match = message.match(LAST_YEARS_PATTERN);
  if (!match) return 1;
  return Math.min(Math.max(parseInt(match[1], 10), 1), 10);
};

const getAvailableAcademicYears = async (limit = 5) => {
  const [marksYears, placementYears] = await Promise.all([
    Marks.distinct('academicYear'),
    Placement.distinct('academicYear'),
  ]);

  const years = [...new Set([...marksYears, ...placementYears])]
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))
    .slice(0, limit);

  return years;
};

const formatValue = (value, suffix = '') => {
  if (value === null || value === undefined || value === '') return 'N/A';
  return `${value}${suffix}`;
};

const buildSection = (heading, lines = []) => ({
  heading,
  lines: lines.filter(Boolean),
});

const stringifyStructuredReport = (report) => {
  const sections = [report.title];

  for (const section of report.sections || []) {
    sections.push(section.heading);
    for (const line of section.lines || []) {
      sections.push(line.startsWith('- ') ? line : `- ${line}`);
    }
  }

  return sections.join('\n\n');
};

const createReportPayload = ({ title, sections, summary = {}, tables = [], insights = '' }) => ({
  title,
  sections,
  summary,
  tables,
  insights,
});

const buildStudentPerformanceReport = async ({ years, includeSemesterComparison }) => {
  const sections = [];
  const rows = [];

  for (const academicYear of years) {
    const report = await staffService.buildStudentPerformanceReport(
      academicYear ? { academicYear } : {}
    );

    rows.push(...report.rows.slice(0, 25).map((item) => ({
      ...item,
      academicYear: academicYear || '',
    })));

    sections.push(buildSection(
      `Student Performance Summary${academicYear ? ` (${academicYear})` : ''}`,
      [
        `Total students: ${report.summary.students}`,
        `At-risk students: ${report.summary.atRiskStudents}`,
        `Average CGPA: ${formatValue(report.summary.avgCgpa)}`,
        `Average attendance: ${formatValue(report.summary.avgAttendance, '%')}`,
        ...report.rows.slice(0, 5).map((student, index) =>
          `Top ${index + 1}: ${student.name} (${student.rollNumber}) - CGPA ${formatValue(student.cgpa)}, attendance ${formatValue(student.avgAttendance, '%')}, backlogs ${formatValue(student.currentBacklogs)}`
        ),
      ]
    ));
  }

  if (includeSemesterComparison) {
    const semesterTrend = await analyticsService.getCGPATrend();
    sections.push(buildSection(
      'Semester-Wise Comparison',
      semesterTrend.map((item) =>
        `Semester ${item._id}: average CGPA ${formatValue(item.avgCGPA)}, average marks ${formatValue(item.avgMarks)}, students ${formatValue(item.studentCount)}`
      )
    ));
  }

  return {
    ...createReportPayload({
      title: '# Student Performance Report',
      sections,
      summary: {
        totalStudents: rows.length,
        averageCgpa: rows.length
          ? Number((rows.reduce((sum, item) => sum + Number(item.cgpa || 0), 0) / rows.length).toFixed(2))
          : 0,
      },
      tables: [
        {
          title: 'Top Performers',
          rows: rows.slice(0, 10),
        },
      ],
      insights: 'Student performance is best understood by combining CGPA, attendance, and backlog signals.',
    }),
    data: {
      type: 'student-performance-report',
      rows,
    },
  };
};

const buildBacklogReport = async ({ years, includeSemesterComparison }) => {
  const sections = [];
  const rows = [];

  for (const academicYear of years) {
    const report = await staffService.buildBacklogReport(
      academicYear ? { academicYear } : {}
    );

    rows.push(...report.rows.slice(0, 25).map((item) => ({
      ...item,
      academicYear: academicYear || '',
    })));

    sections.push(buildSection(
      `Backlog Summary${academicYear ? ` (${academicYear})` : ''}`,
      [
        `Students with backlogs: ${report.summary.students}`,
        `Total backlogs: ${report.summary.totalBacklogs}`,
        `Average backlogs per student: ${formatValue(report.summary.avgBacklogs)}`,
        `Average CGPA: ${formatValue(report.summary.avgCgpa)}`,
        `Average attendance: ${formatValue(report.summary.avgAttendance, '%')}`,
        ...report.rows.slice(0, 5).map((student, index) =>
          `Highest backlog ${index + 1}: ${student.name} (${student.rollNumber}) - ${student.currentBacklogs} backlogs, CGPA ${formatValue(student.cgpa)}`
        ),
      ]
    ));
  }

  if (includeSemesterComparison) {
    const trend = await analyticsService.getBacklogAnalysis();
    sections.push(buildSection(
      'Semester-Wise Comparison',
      trend.map((item) =>
        `${item.deptName} (${item.deptCode}) - backlog percentage ${formatValue(item.backlogPercentage, '%')}, average backlogs ${formatValue(item.avgBacklogs)}`
      )
    ));
  }

  return {
    ...createReportPayload({
      title: '# Backlog Report',
      sections,
      summary: {
        studentsWithBacklogs: rows.length,
        averageBacklogs: rows.length
          ? Number((rows.reduce((sum, item) => sum + Number(item.currentBacklogs || 0), 0) / rows.length).toFixed(2))
          : 0,
      },
      tables: [
        {
          title: 'Backlog Snapshot',
          rows: rows.slice(0, 10),
        },
      ],
      insights: 'Backlog-heavy students should be tracked along with their CGPA and attendance trend.',
    }),
    data: {
      type: 'backlog-report',
      rows,
    },
  };
};

const buildPlacementReport = async ({ years, includeSemesterComparison }) => {
  const sections = [];
  const rows = [];

  for (const academicYear of years) {
    const placementRows = await analyticsService.getPlacementAnalytics(
      academicYear ? { academicYear } : {}
    );

    rows.push(...placementRows.map((item) => ({
      ...item,
      academicYear: academicYear || '',
    })));

    const totalPlaced = placementRows.reduce((sum, item) => sum + (item.placedCount || 0), 0);
    const averagePlacement = placementRows.length
      ? Number((placementRows.reduce((sum, item) => sum + (item.placementPercentage || 0), 0) / placementRows.length).toFixed(2))
      : 0;

    sections.push(buildSection(
      `Placement Summary${academicYear ? ` (${academicYear})` : ''}`,
      [
        `Departments covered: ${placementRows.length}`,
        `Total placed students: ${totalPlaced}`,
        `Average placement percentage: ${formatValue(averagePlacement, '%')}`,
        ...placementRows.slice(0, 5).map((item, index) =>
          `Department ${index + 1}: ${item.deptName} (${item.deptCode}) - placement ${formatValue(item.placementPercentage, '%')}, average package ${formatValue(item.avgPackage, ' LPA')}, highest package ${formatValue(item.maxPackage, ' LPA')}`
        ),
      ]
    ));
  }

  if (includeSemesterComparison) {
    sections.push(buildSection(
      'Semester-Wise Comparison',
      ['Placement data is tracked by academic year, so this report includes year-wise comparison instead of semester-wise placement splits.']
    ));
  }

  return {
    ...createReportPayload({
      title: '# Placement Report',
      sections,
      summary: {
        departmentsCovered: rows.length,
        averagePlacementPercentage: rows.length
          ? Number((rows.reduce((sum, item) => sum + Number(item.placementPercentage || 0), 0) / rows.length).toFixed(2))
          : 0,
      },
      tables: [
        {
          title: 'Department Placement Overview',
          rows: rows.slice(0, 10),
        },
      ],
      insights: 'Placement strength varies department-wise, so placement rate and package trend should be reviewed together.',
    }),
    data: {
      type: 'placement-report',
      rows,
    },
  };
};

const buildDepartmentReport = async ({ years, includeSemesterComparison }) => {
  const sections = [];
  const rows = [];

  for (const academicYear of years) {
    const report = await staffService.buildDepartmentReport(
      academicYear ? { academicYear } : {}
    );

    rows.push(...report.rows.map((item) => ({
      ...item,
      academicYear: academicYear || '',
    })));

    sections.push(buildSection(
      `Department Summary${academicYear ? ` (${academicYear})` : ''}`,
      [
        `Total departments: ${report.summary.departments}`,
        `Active departments: ${report.summary.activeDepartments}`,
        `Average score: ${formatValue(report.summary.avgScore)}`,
        `Total documents: ${formatValue(report.summary.totalDocuments)}`,
        ...report.rows.slice(0, 5).map((department, index) =>
          `Department ${index + 1}: ${department.department} (${department.code}) - pass ${formatValue(department.passPercentage, '%')}, attendance ${formatValue(department.avgAttendance, '%')}, placement ${formatValue(department.placementPercentage, '%')}, rank ${formatValue(department.rank)}`
        ),
      ]
    ));
  }

  if (includeSemesterComparison) {
    const semesterTrend = await analyticsService.getCGPATrend();
    sections.push(buildSection(
      'Semester-Wise Comparison',
      semesterTrend.map((item) =>
        `Semester ${item._id}: institution-wide average CGPA ${formatValue(item.avgCGPA)}, average marks ${formatValue(item.avgMarks)}`
      )
    ));
  }

  return {
    ...createReportPayload({
      title: '# Department Report',
      sections,
      summary: {
        totalDepartments: rows.length,
        passPercentage: rows.length
          ? Number((rows.reduce((sum, item) => sum + Number(item.passPercentage || 0), 0) / rows.length).toFixed(2))
          : 0,
        avgCgpa: rows.length
          ? Number((rows.reduce((sum, item) => sum + Number(item.avgCgpa || item.averageCGPA || 0), 0) / rows.length).toFixed(2))
          : 0,
      },
      tables: [
        {
          title: 'Department Performance',
          rows: rows.slice(0, 10),
        },
      ],
      insights: 'Department performance is strongest where pass percentage, attendance, and placement all stay aligned.',
    }),
    data: {
      type: 'department-report',
      rows,
    },
  };
};

const buildInstitutionalReport = async ({ years, includeSemesterComparison }) => {
  const departmentReport = await buildDepartmentReport({ years, includeSemesterComparison });
  const placementReport = await buildPlacementReport({ years, includeSemesterComparison: false });

  return {
    ...createReportPayload({
      title: '# Institutional Report',
      sections: [
        buildSection('Report Scope', [
          `Academic years covered: ${years.join(', ') || 'Current data snapshot'}`,
          includeSemesterComparison ? 'Semester-wise comparison included' : 'Standard summary report',
        ]),
        ...departmentReport.sections,
        ...placementReport.sections,
      ],
      summary: {
        passPercentage: departmentReport.summary?.passPercentage || 0,
        avgCgpa: departmentReport.summary?.avgCgpa || 0,
        averagePlacementPercentage: placementReport.summary?.averagePlacementPercentage || 0,
      },
      tables: [
        ...(departmentReport.tables || []),
        ...(placementReport.tables || []),
      ],
      insights: 'Institutional performance should be reviewed as a combined picture of academic quality and placement outcomes.',
    }),
    data: {
      type: 'institutional-report',
      rows: [
        ...(departmentReport.data?.rows || []),
        ...(placementReport.data?.rows || []),
      ],
    },
  };
};

const buildChatbotReport = async (message = '') => {
  const type = detectReportType(message);
  const includeSemesterComparison = wantsSemesterComparison(message);
  const yearWindow = getRequestedYearWindow(message);
  const years = yearWindow > 1 ? await getAvailableAcademicYears(yearWindow) : [''];

  if (type === 'student-performance') {
    const report = await buildStudentPerformanceReport({ years, includeSemesterComparison });
    return { ...report, reportText: stringifyStructuredReport(report) };
  }

  if (type === 'backlog') {
    const report = await buildBacklogReport({ years, includeSemesterComparison });
    return { ...report, reportText: stringifyStructuredReport(report) };
  }

  if (type === 'placement') {
    const report = await buildPlacementReport({ years, includeSemesterComparison });
    return { ...report, reportText: stringifyStructuredReport(report) };
  }

  if (type === 'department') {
    const report = await buildDepartmentReport({ years, includeSemesterComparison });
    return { ...report, reportText: stringifyStructuredReport(report) };
  }

  const report = await buildInstitutionalReport({ years, includeSemesterComparison });
  return { ...report, reportText: stringifyStructuredReport(report) };
};

module.exports = {
  buildChatbotReport,
  detectReportRequest,
};
