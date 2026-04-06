const staffService = require('../services/staff.service');

const handleError = (res, error, fallbackMessage) => {
  res.status(error.status || 500).json({
    success: false,
    message: error.message || fallbackMessage,
  });
};

const createUser = async (req, res) => {
  try {
    const data = await staffService.createManagedUser(req.body);
    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data,
    });
  } catch (error) {
    handleError(res, error, 'Failed to create user.');
  }
};

const getUsers = async (req, res) => {
  try {
    const data = await staffService.listUsers(req.query);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'Failed to load users.');
  }
};

const getUserById = async (req, res) => {
  try {
    const data = await staffService.getUserProfile(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'Failed to load user.');
  }
};

const updateUser = async (req, res) => {
  try {
    const data = await staffService.updateManagedUser(req.params.id, req.body);
    res.json({ success: true, message: 'User updated successfully.', data });
  } catch (error) {
    handleError(res, error, 'Failed to update user.');
  }
};

const disableUser = async (req, res) => {
  try {
    const data = await staffService.disableManagedUser(req.params.id);
    res.json({ success: true, message: 'User disabled successfully.', data });
  } catch (error) {
    handleError(res, error, 'Failed to disable user.');
  }
};

const getStudents = async (req, res) => {
  try {
    const data = await staffService.listStudents(req.query);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'Failed to load students.');
  }
};

const updateStudent = async (req, res) => {
  try {
    const data = await staffService.updateStudentRecord(req.params.id, req.body);
    res.json({ success: true, message: 'Student record updated successfully.', data });
  } catch (error) {
    handleError(res, error, 'Failed to update student record.');
  }
};

const getFaculty = async (req, res) => {
  try {
    const data = await staffService.listFaculty(req.query);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'Failed to load faculty.');
  }
};

const updateFaculty = async (req, res) => {
  try {
    const data = await staffService.updateFacultyRecord(req.params.id, req.body);
    res.json({ success: true, message: 'Faculty record updated successfully.', data });
  } catch (error) {
    handleError(res, error, 'Failed to update faculty record.');
  }
};

const getDepartments = async (_req, res) => {
  try {
    const data = await staffService.listDepartments();
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'Failed to load departments.');
  }
};

const getDepartmentDetails = async (req, res) => {
  try {
    const data = await staffService.buildDepartmentDetail(req.params.id, req.query);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'Failed to load department details.');
  }
};

const updateDepartment = async (req, res) => {
  try {
    const data = await staffService.updateDepartmentRecord(req.params.id, req.body);
    res.json({ success: true, message: 'Department updated successfully.', data });
  } catch (error) {
    handleError(res, error, 'Failed to update department.');
  }
};

const uploadDocument = async (req, res) => {
  try {
    const data = await staffService.uploadDocument(req.body, req.user, req.file);
    res.status(201).json({ success: true, message: 'Document uploaded successfully.', data });
  } catch (error) {
    handleError(res, error, 'Failed to upload document.');
  }
};

const getDocuments = async (req, res) => {
  try {
    const data = await staffService.listDocuments(req.query);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'Failed to load documents.');
  }
};

const getAnalytics = async (req, res) => {
  try {
    const data = await staffService.getAnalyticsSnapshot(req.query);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'Failed to load analytics.');
  }
};

const getReports = async (_req, res) => {
  try {
    const data = await staffService.listReports();
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'Failed to load reports.');
  }
};

const getDepartmentReport = async (req, res) => {
  const format = (req.query.format || 'json').toLowerCase();

  ['department', 'year', 'reportType'].forEach((k) => {
    if (req.query[k] === 'All') delete req.query[k];
  });

  try {
    const report = await staffService.buildDepartmentReport(req.query);

    await staffService.logReport({
      type: 'department',
      format,
      generatedBy: req.user._id,
      department: req.query.department,
      filters: req.query,
      recordCount: report.rows.length,
    });

    if (format === 'pdf') {
      await staffService.reportService.generateDepartmentPerformanceReport(res, req.query.department ? { _id: req.query.department } : {});
      return;
    }

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="department-report-${Date.now()}.csv"`);

      const lines = [
        'Department Report',
        `Generated At,${report.generatedAt}`,
        '',
        'Department,Code,Students,Faculty,Pass Percentage,Attendance Percentage,Placement Percentage,Research Papers,Score,Documents',
        ...report.rows.map((row) => [
          row.department,
          row.code,
          row.studentCount,
          row.facultyCount,
          row.passPercentage,
          row.avgAttendance,
          row.placementPercentage,
          row.researchPapers,
          row.score,
          row.documentCount,
        ].map((value) => `"${String(value ?? '')}"`).join(',')),
      ];

      res.send(lines.join('\n'));
      return;
    }

    res.json({ success: true, data: report });
  } catch (error) {
    handleError(res, error, 'Failed to generate department report.');
  }
};

const getStudentPerformanceReport = async (req, res) => {
  const format = (req.query.format || 'json').toLowerCase();

  ['department', 'year', 'reportType'].forEach((k) => {
    if (req.query[k] === 'All') delete req.query[k];
  });

  try {
    const report = await staffService.buildStudentPerformanceReport(req.query);

    await staffService.logReport({
      type: 'student-performance',
      format,
      generatedBy: req.user._id,
      department: req.query.department,
      filters: req.query,
      recordCount: report.rows.length,
    });

    if (format === 'pdf') {
      await staffService.reportService.generateStudentProgressReport(res, req.query.department ? { department: req.query.department } : {});
      return;
    }

    if (format === 'csv') {
      await staffService.reportService.generateStudentProgressCSV(res, req.query.department ? { department: req.query.department } : {});
      return;
    }

    res.json({ success: true, data: report });
  } catch (error) {
    handleError(res, error, 'Failed to generate student performance report.');
  }
};

const getBacklogReport = async (req, res) => {
  const format = (req.query.format || 'json').toLowerCase();

  ['department', 'year', 'reportType'].forEach((k) => {
    if (req.query[k] === 'All') delete req.query[k];
  });

  try {
    const report = await staffService.buildBacklogReport(req.query);

    await staffService.logReport({
      type: 'backlog',
      format,
      generatedBy: req.user._id,
      department: req.query.department,
      filters: req.query,
      recordCount: report.rows.length,
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="backlog-report-${Date.now()}.csv"`);

      const lines = [
        'Backlog Report',
        `Generated At,${report.generatedAt}`,
        '',
        'Student,Roll Number,Department,Semester,CGPA,Attendance,Current Backlogs,Cleared Backlogs,Performance',
        ...report.rows.map((row) => [
          row.name,
          row.rollNumber,
          row.department?.name || row.department?.code || 'N/A',
          row.currentSemester,
          row.cgpa,
          row.avgAttendance,
          row.currentBacklogs,
          row.totalBacklogsCleared,
          row.performanceCategory,
        ].map((value) => `"${String(value ?? '')}"`).join(',')),
      ];

      res.send(lines.join('\n'));
      return;
    }

    res.json({ success: true, data: report });
  } catch (error) {
    handleError(res, error, 'Failed to generate backlog report.');
  }
};

const getFacultyWorkloadReport = async (req, res) => {
  const format = (req.query.format || 'json').toLowerCase();

  ['department', 'year', 'reportType'].forEach((k) => {
    if (req.query[k] === 'All') delete req.query[k];
  });

  try {
    const report = await staffService.buildFacultyWorkloadReport(req.query);

    await staffService.logReport({
      type: 'faculty-workload',
      format,
      generatedBy: req.user._id,
      department: req.query.department,
      filters: req.query,
      recordCount: report.rows.length,
    });

    if (format === 'pdf' || format === 'csv') {
      await staffService.streamFacultyWorkloadReport(res, report, format);
      return;
    }

    res.json({ success: true, data: report });
  } catch (error) {
    handleError(res, error, 'Failed to generate faculty workload report.');
  }
};

module.exports = {
  createUser,
  disableUser,
  getAnalytics,
  getDepartmentReport,
  getDepartmentDetails,
  getDepartments,
  getDocuments,
  getFaculty,
  getBacklogReport,
  getFacultyWorkloadReport,
  getReports,
  getStudentPerformanceReport,
  getStudents,
  getUserById,
  getUsers,
  updateDepartment,
  updateFaculty,
  updateStudent,
  updateUser,
  uploadDocument,
};

