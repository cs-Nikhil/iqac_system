const path = require('path');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Marks = require('../models/Marks');
const Attendance = require('../models/Attendance');
const Achievement = require('../models/Achievement');
const Document = require('../models/Document');
const Placement = require('../models/Placement');
const PlacementDrive = require('../models/PlacementDrive');
const PlacementApplication = require('../models/PlacementApplication');
const StudentFeedback = require('../models/StudentFeedback');
const StudentSemesterPerformance = require('../models/StudentSemesterPerformance');
const StudentSemesterAttendance = require('../models/StudentSemesterAttendance');
const { Participation } = require('../models/Event');
const { Event } = require('../models/Event');

const toUploadPath = (filePath) => {
  if (!filePath) {
    return '';
  }

  const relativePath = path.relative(path.join(__dirname, '..'), filePath);
  return `/${relativePath.split(path.sep).join('/')}`;
};

const buildStoredFile = (file, fallbackPath = '') => {
  if (file) {
    return {
      originalName: file.originalname,
      filename: file.filename,
      path: toUploadPath(file.path),
      size: file.size,
      mimeType: file.mimetype,
      uploadedAt: new Date(),
    };
  }

  if (fallbackPath) {
    return {
      originalName: fallbackPath.split('/').pop(),
      filename: fallbackPath.split('/').pop(),
      path: fallbackPath,
      uploadedAt: new Date(),
    };
  }

  return null;
};

const getStudentForUser = async (user) => {
  let student = await Student.findOne({ user: user._id })
    .populate('department', 'name code')
    .populate('user', 'name email role');

  if (!student) {
    student = await Student.findOne({ email: user.email })
      .populate('department', 'name code')
      .populate('user', 'name email role');

    if (student && !student.user) {
      student.user = user._id;
      await student.save();
      await student.populate('user', 'name email role');
    }
  }

  if (!student) {
    const error = new Error('Student profile not found for the authenticated account.');
    error.statusCode = 404;
    throw error;
  }

  return student;
};

const ACTIVE_STUDENT_STATUS = 'active';
const GRADUATED_STUDENT_STATUS = 'graduated';
const COURSE_DURATION_YEARS = 4;

const getAcademicStartYear = (referenceDate = new Date()) => {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  return month >= 6 ? year : year - 1;
};

const resolveStudentStatus = (student, referenceDate = new Date()) => {
  if (student?.status === ACTIVE_STUDENT_STATUS || student?.status === GRADUATED_STUDENT_STATUS) {
    return student.status;
  }

  const batchYear = parseInt(student?.batchYear, 10);
  if (Number.isFinite(batchYear) && batchYear <= getAcademicStartYear(referenceDate) - COURSE_DURATION_YEARS) {
    return GRADUATED_STUDENT_STATUS;
  }

  return ACTIVE_STUDENT_STATUS;
};

const syncStudentStatus = async (student) => {
  const resolvedStatus = resolveStudentStatus(student);

  if (!student.status) {
    student.status = resolvedStatus;
    await student.save();
  }

  return resolvedStatus;
};

const ensureStudentCanMutate = async (student) => {
  const resolvedStatus = await syncStudentStatus(student);

  if (resolvedStatus === GRADUATED_STUDENT_STATUS) {
    const error = new Error('Graduated student profiles are read-only.');
    error.statusCode = 403;
    throw error;
  }

  return resolvedStatus;
};

const getOverallRating = (ratings = {}) => {
  const values = [
    Number(ratings.teachingQuality),
    Number(ratings.courseDifficulty),
    Number(ratings.infrastructureQuality),
  ].filter((value) => Number.isFinite(value));

  if (!values.length) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
};

const MAX_SEMESTER = 8;
const PASSING_TOTAL_MARKS = 40;
const PASSING_EXTERNAL_MARKS = 24;

const toNumber = (value, fallback = 0) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const roundTo = (value, digits = 2) => Number(toNumber(value).toFixed(digits));

const clampSemester = (value, fallback = 1) => {
  const normalized = Math.trunc(toNumber(value, fallback));
  return Math.min(MAX_SEMESTER, Math.max(1, normalized));
};

const getGradeDetails = (total) => {
  if (total >= 90) return { grade: 'O', gradePoints: 10 };
  if (total >= 80) return { grade: 'A+', gradePoints: 9 };
  if (total >= 70) return { grade: 'A', gradePoints: 8 };
  if (total >= 60) return { grade: 'B+', gradePoints: 7 };
  if (total >= 55) return { grade: 'B', gradePoints: 6 };
  if (total >= 50) return { grade: 'C', gradePoints: 5 };
  if (total >= 45) return { grade: 'D', gradePoints: 4 };
  return { grade: 'F', gradePoints: 0 };
};

const getAttemptTimestamp = (mark = {}) => {
  const rawValue = mark.updatedAt || mark.createdAt || 0;
  const timestamp = new Date(rawValue).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const normalizeMarkRecord = (mark = {}) => {
  const internal = roundTo(mark.internal, 0);
  const external = roundTo(mark.external, 0);
  const total = roundTo(mark.total ?? (internal + external), 0);
  const rawResult = String(mark.result || '').toUpperCase();

  if (rawResult === 'ABSENT') {
    return {
      ...mark,
      internal,
      external,
      total,
      grade: 'AB',
      gradePoints: 0,
      result: 'FAIL',
      evaluationStatus: 'ABSENT',
      status: 'Fail',
      isBacklog: true,
    };
  }

  if (rawResult === 'WITHHELD') {
    return {
      ...mark,
      internal,
      external,
      total,
      grade: mark.grade || '--',
      gradePoints: 0,
      result: 'WITHHELD',
      evaluationStatus: 'WITHHELD',
      status: 'Fail',
      isBacklog: false,
    };
  }

  const passed = total >= PASSING_TOTAL_MARKS && external >= PASSING_EXTERNAL_MARKS;
  const computedGrade = getGradeDetails(total);

  return {
    ...mark,
    internal,
    external,
    total,
    grade: mark.grade || computedGrade.grade,
    gradePoints: toNumber(mark.gradePoints, computedGrade.gradePoints),
    result: passed ? 'PASS' : 'FAIL',
    evaluationStatus: rawResult || (passed ? 'PASS' : 'FAIL'),
    status: passed ? 'Pass' : 'Fail',
    isBacklog: !passed,
  };
};

const getSubjectIdentity = (subject = {}, fallbackId = '') =>
  subject?._id?.toString() || subject?.code || subject?.toString?.() || fallbackId;

const groupLatestMarksBySubject = (marks = []) =>
  marks.reduce((accumulator, mark) => {
    const normalizedMark = normalizeMarkRecord(mark);
    const subjectKey = getSubjectIdentity(normalizedMark.subject, normalizedMark._id?.toString());
    const currentEntry = accumulator[subjectKey];

    if (!currentEntry) {
      accumulator[subjectKey] = {
        subject: normalizedMark.subject,
        latestAttempt: normalizedMark,
        attempts: 1,
      };
      return accumulator;
    }

    currentEntry.attempts += 1;
    if (getAttemptTimestamp(normalizedMark) >= getAttemptTimestamp(currentEntry.latestAttempt)) {
      currentEntry.latestAttempt = normalizedMark;
      currentEntry.subject = normalizedMark.subject;
    }

    return accumulator;
  }, {});

const buildSemesterSubjectsPayload = ({
  student,
  semester,
  marks,
  semesterPerformance,
}) => {
  const marksBySubject = groupLatestMarksBySubject(marks);
  const latestAttempts = Object.values(marksBySubject)
    .map((entry) => entry.latestAttempt)
    .sort((left, right) => {
      const leftCode = left.subject?.code || left.subject?.name || '';
      const rightCode = right.subject?.code || right.subject?.name || '';
      return leftCode.localeCompare(rightCode);
    });

  const subjects = latestAttempts.map((mark) => ({
    _id: mark._id,
    code: mark.subject?.code || 'NA',
    name: mark.subject?.name || 'Unknown Subject',
    internal: mark.internal,
    external: mark.external,
    total: mark.total,
    grade: mark.grade,
    status: mark.status,
    result: mark.result,
    credits: toNumber(mark.subject?.credits, 0),
    type: mark.subject?.type || 'Theory',
    academicYear: mark.academicYear,
  }));

  const totalSubjects = subjects.length;
  const passedSubjects = subjects.filter((subject) => subject.status === 'Pass').length;
  const failedSubjects = totalSubjects - passedSubjects;
  const totalCredits = subjects.reduce((sum, subject) => sum + toNumber(subject.credits), 0);
  const earnedCredits = subjects.reduce(
    (sum, subject) => sum + (subject.status === 'Pass' ? toNumber(subject.credits) : 0),
    0
  );
  const weightedPoints = latestAttempts.reduce(
    (sum, mark) => sum + (toNumber(mark.gradePoints) * toNumber(mark.subject?.credits)),
    0
  );
  const computedSgpa = totalCredits
    ? roundTo(weightedPoints / totalCredits, 2)
    : roundTo(semesterPerformance?.sgpa, 2);
  const averageMarks = totalSubjects
    ? roundTo(subjects.reduce((sum, subject) => sum + toNumber(subject.total), 0) / totalSubjects, 2)
    : 0;
  const passPercentage = totalSubjects
    ? roundTo((passedSubjects / totalSubjects) * 100, 2)
    : 0;
  const performanceLevel = roundTo((computedSgpa / 10) * 100, 0);

  return {
    studentId: student.rollNumber,
    currentSemester: student.currentSemester,
    availableSemesters: Array.from({ length: MAX_SEMESTER }, (_, index) => index + 1),
    semester: {
      sem: semester,
      academicYear:
        semesterPerformance?.academicYear ||
        latestAttempts[0]?.academicYear ||
        student.academicRecords?.latestAcademicYear ||
        '',
      gpa: computedSgpa,
      sgpa: computedSgpa,
      summary: {
        totalSubjects,
        passedSubjects,
        failedSubjects,
        totalCredits,
        earnedCredits,
        passPercentage,
        averageMarks,
        performanceLevel,
      },
      subjects,
    },
  };
};

const getStudentProfile = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    const status = await syncStudentStatus(student);

    res.json({
      success: true,
      data: {
        student: {
          _id: student._id,
          name: student.name,
          email: student.email,
          rollNumber: student.rollNumber,
          department: student.department,
          batchYear: student.batchYear,
          currentSemester: student.currentSemester,
          status,
          cgpa: student.cgpa,
          performanceScore: student.performanceScore,
          performanceCategory: student.performanceCategory,
          currentBacklogs: student.currentBacklogs,
          totalBacklogsCleared: student.totalBacklogsCleared,
          isAtRisk: student.isAtRisk,
          riskReasons: student.riskReasons,
          phone: student.phone,
          address: student.address,
          gender: student.gender,
          accessMode: status === GRADUATED_STUDENT_STATUS ? 'read_only' : 'full_access',
          academicRecords: student.academicRecords,
        },
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateStudentProfile = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    await ensureStudentCanMutate(student);
    const allowedFields = ['name', 'phone', 'address', 'gender'];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        student[field] = req.body[field];
      }
    });

    await student.save();

    if (student.user) {
      student.user.name = student.name;
      await student.user.save();
    }

    await student.populate('department', 'name code');

    res.json({
      success: true,
      data: {
        student,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

const getAcademicProgress = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);

    const [semesterPerformance, marks] = await Promise.all([
      StudentSemesterPerformance.find({ student: student._id }).sort({ semester: 1 }).lean(),
      Marks.find({ student: student._id })
        .populate('subject', 'name code credits type semester')
        .sort({ semester: 1, createdAt: 1 })
        .lean(),
    ]);

    const marksBySemester = marks.reduce((accumulator, mark) => {
      const key = mark.semester;
      const bucket = accumulator[key] || {
        semester: mark.semester,
        academicYear: mark.academicYear,
        subjects: [],
        passCount: 0,
      };

      bucket.subjects.push(mark);
      if (mark.result === 'PASS') {
        bucket.passCount += 1;
      }
      bucket.academicYear = mark.academicYear;
      accumulator[key] = bucket;
      return accumulator;
    }, {});

    const semesterResults = Object.values(marksBySemester)
      .sort((left, right) => left.semester - right.semester)
      .map((item) => ({
        ...item,
        passPercentage: item.subjects.length
          ? Number(((item.passCount / item.subjects.length) * 100).toFixed(2))
          : 0,
      }));

    const passedSubjects = marks.filter((mark) => mark.result === 'PASS').length;
    const passPercentage = marks.length ? Number(((passedSubjects / marks.length) * 100).toFixed(2)) : 0;
    const latestSemester = semesterPerformance[semesterPerformance.length - 1] || null;

    res.json({
      success: true,
      data: {
        student: {
          _id: student._id,
          name: student.name,
          department: student.department,
          rollNumber: student.rollNumber,
          cgpa: student.cgpa,
          currentSemester: student.currentSemester,
        },
        summary: {
          cgpa: student.cgpa,
          passPercentage,
          completedSemesters: semesterPerformance.length,
          totalCredits: latestSemester?.totalCredits || 0,
          earnedCredits: semesterPerformance.reduce((sum, item) => sum + item.earnedCredits, 0),
        },
        semesterPerformance,
        semesterResults,
        marks,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

const getStudentSubjects = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    const semester = clampSemester(req.query.sem, student.currentSemester || 1);

    const [semesterPerformance, semesterMarks] = await Promise.all([
      StudentSemesterPerformance.findOne({ student: student._id, semester }).lean(),
      Marks.find({ student: student._id, semester })
        .populate('subject', 'name code credits type semester')
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean(),
    ]);

    const payload = buildSemesterSubjectsPayload({
      student,
      semester,
      marks: semesterMarks,
      semesterPerformance,
    });

    res.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

const getStudentAttendance = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);

    const [semesterAttendance, subjectAttendance] = await Promise.all([
      StudentSemesterAttendance.find({ student: student._id }).sort({ semester: 1 }).lean(),
      Attendance.find({ student: student._id })
        .populate('subject', 'name code semester type')
        .sort({ semester: 1, createdAt: 1 })
        .lean(),
    ]);

    const subjectWise = subjectAttendance.reduce((accumulator, record) => {
      const subjectId = record.subject?._id?.toString() || record.subject?.toString();
      const bucket = accumulator[subjectId] || {
        subjectId,
        subject: record.subject,
        attendedClasses: 0,
        totalClasses: 0,
        percentage: 0,
        semesters: [],
      };

      bucket.attendedClasses += record.attendedClasses;
      bucket.totalClasses += record.totalClasses;
      bucket.percentage = bucket.totalClasses
        ? Number(((bucket.attendedClasses / bucket.totalClasses) * 100).toFixed(2))
        : 0;
      bucket.semesters.push({
        semester: record.semester,
        academicYear: record.academicYear,
        percentage: record.percentage,
      });
      accumulator[subjectId] = bucket;
      return accumulator;
    }, {});

    const subjectSummary = Object.values(subjectWise)
      .sort((left, right) => right.percentage - left.percentage);

    const warnings = subjectSummary.filter((item) => item.percentage < 75);
    const overallClasses = subjectAttendance.reduce((sum, item) => sum + item.totalClasses, 0);
    const attendedClasses = subjectAttendance.reduce((sum, item) => sum + item.attendedClasses, 0);

    res.json({
      success: true,
      data: {
        overall: {
          percentage: overallClasses
            ? Number(((attendedClasses / overallClasses) * 100).toFixed(2))
            : 0,
          attendedClasses,
          totalClasses: overallClasses,
          warningCount: warnings.length,
        },
        semesterAttendance,
        subjectAttendance: subjectSummary,
        warnings,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

const getStudentBacklogs = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    const allMarks = await Marks.find({
      student: student._id,
    })
      .populate('subject', 'name code credits semester')
      .sort({ semester: 1, createdAt: -1 })
      .lean();

    const marksBySubject = groupLatestMarksBySubject(allMarks);
    const backlogSubjects = Object.values(marksBySubject)
      .filter((entry) => entry.latestAttempt.isBacklog)
      .map((entry) => ({
        subject: entry.subject,
        semester: entry.latestAttempt.semester,
        academicYear: entry.latestAttempt.academicYear,
        total: entry.latestAttempt.total,
        grade: entry.latestAttempt.grade,
        attempts: entry.attempts,
        improvementEligible: true,
      }))
      .sort((left, right) => left.semester - right.semester);

    const currentBacklogs = backlogSubjects.length;

    res.json({
      success: true,
      data: {
        summary: {
          currentBacklogs,
          totalBacklogsCleared: student.totalBacklogsCleared,
          backlogRate: student.currentSemester
            ? Number(((currentBacklogs / student.currentSemester) * 100).toFixed(2))
            : 0,
        },
        backlogs: backlogSubjects,
        backlogHistory: student.backlogHistory || [],
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

const listStudentAchievements = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);

    const [achievements, participations] = await Promise.all([
      Achievement.find({
        type: 'Student',
        recipient: student._id,
        isActive: true,
      })
        .sort({ date: -1, createdAt: -1 })
        .lean(),
      Participation.find({ student: student._id })
        .populate('event', 'title type level startDate endDate location')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        achievements,
        participations,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

const createStudentAchievement = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    await ensureStudentCanMutate(student);
    const { title, description, category, level, date } = req.body;

    const storedFile = buildStoredFile(req.file, req.body.certificateUrl);
    const achievement = await Achievement.create({
      title,
      description,
      category,
      level: level || 'Local',
      date: date ? new Date(date) : new Date(),
      type: 'Student',
      recipient: student._id,
      department: student.department?._id || student.department,
      documents: storedFile?.path ? [storedFile.path] : [],
    });

    res.status(201).json({
      success: true,
      data: achievement,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

const listStudentFeedback = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);

    const [feedback, facultyOptions] = await Promise.all([
      StudentFeedback.find({ student: student._id })
        .populate({
          path: 'faculty',
          select: 'name designation department',
          populate: {
            path: 'department',
            select: 'name code',
          },
        })
        .sort({ createdAt: -1 })
        .lean(),
      Faculty.find({
        department: student.department?._id || student.department,
        isActive: true,
      })
        .select('name designation')
        .sort({ name: 1 })
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        feedback,
        facultyOptions,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

const createStudentFeedback = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    await ensureStudentCanMutate(student);
    const { faculty, courseName, ratings, comments, isAnonymous } = req.body;
    const normalizedRatings = {
      teachingQuality: Number(ratings?.teachingQuality),
      courseDifficulty: Number(ratings?.courseDifficulty),
      infrastructureQuality: Number(ratings?.infrastructureQuality),
    };

    const feedback = await StudentFeedback.create({
      student: student._id,
      faculty: faculty || undefined,
      courseName,
      ratings: normalizedRatings,
      overallRating: getOverallRating(normalizedRatings),
      comments,
      isAnonymous: Boolean(isAnonymous),
      submittedBy: req.user._id,
    });

    await feedback.populate({
      path: 'faculty',
      select: 'name designation department',
      populate: {
        path: 'department',
        select: 'name code',
      },
    });

    res.status(201).json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

const listStudentDocuments = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);

    const documents = await Document.find({
      student: student._id,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        documents,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

const createStudentDocument = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    await ensureStudentCanMutate(student);
    const {
      title,
      description,
      academicYear,
      type = 'Report',
      subCategory,
      tags,
    } = req.body;

    const storedFile = buildStoredFile(req.file, req.body.fileUrl);

    if (!storedFile) {
      return res.status(400).json({
        success: false,
        message: 'A document file or fileUrl is required.',
      });
    }

    const document = await Document.create({
      title,
      description,
      category: 'Student',
      type,
      subCategory,
      academicYear,
      department: student.department?._id || student.department,
      student: student._id,
      uploadedBy: req.user._id,
      accessLevel: 'Restricted',
      status: 'Pending Approval',
      file: storedFile,
      tags: Array.isArray(tags)
        ? tags
        : typeof tags === 'string' && tags.trim()
          ? tags.split(',').map((tag) => tag.trim()).filter(Boolean)
          : [],
    });

    res.status(201).json({
      success: true,
      data: document,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

const getStudentPlacements = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    const studentDepartmentId = student.department?._id || student.department;
    const now = new Date();

    const [drives, applications, departmentPlacements, myPlacements] = await Promise.all([
      PlacementDrive.find({
        isActive: true,
        status: { $ne: 'Closed' },
        deadline: { $gte: now },
        $or: [
          { departments: { $exists: false } },
          { departments: { $size: 0 } },
          { departments: studentDepartmentId },
        ],
      })
        .sort({ deadline: 1 })
        .lean(),
      PlacementApplication.find({ student: student._id })
        .populate('drive')
        .sort({ appliedAt: -1 })
        .lean(),
      Placement.find({})
        .populate({
          path: 'student',
          select: 'department',
        })
        .lean(),
      Placement.find({ student: student._id }).sort({ placementDate: -1 }).lean(),
    ]);

    const eligibleDrives = drives.filter((drive) => (
      student.cgpa >= (drive.minCgpa || 0) &&
      student.currentBacklogs <= (drive.maxBacklogs ?? 0)
    ));

    const departmentPlacementRecords = departmentPlacements.filter((record) => (
      record.student?.department?.toString?.() === studentDepartmentId.toString()
    ));

    const averagePackage = departmentPlacementRecords.length
      ? Number((
        departmentPlacementRecords.reduce((sum, record) => sum + (record.package || 0), 0) /
        departmentPlacementRecords.length
      ).toFixed(2))
      : 0;

    res.json({
      success: true,
      data: {
        stats: {
          totalOpportunities: eligibleDrives.length,
          applications: applications.length,
          departmentPlacements: departmentPlacementRecords.length,
          averagePackage,
          highestPackage: departmentPlacementRecords.reduce((max, record) => Math.max(max, record.package || 0), 0),
        },
        drives: eligibleDrives,
        applications,
        placementHistory: myPlacements,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

const applyToPlacement = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    await ensureStudentCanMutate(student);
    const { driveId, notes } = req.body;

    const drive = await PlacementDrive.findById(driveId);

    if (!drive || !drive.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Placement drive not found.',
      });
    }

    const departmentIds = (drive.departments || []).map((department) => department.toString());
    const studentDepartmentId = (student.department?._id || student.department).toString();

    if (departmentIds.length && !departmentIds.includes(studentDepartmentId)) {
      return res.status(403).json({
        success: false,
        message: 'This placement drive is not open for your department.',
      });
    }

    if (student.cgpa < (drive.minCgpa || 0)) {
      return res.status(400).json({
        success: false,
        message: 'Your CGPA does not meet the eligibility criteria for this drive.',
      });
    }

    if (student.currentBacklogs > (drive.maxBacklogs ?? 0)) {
      return res.status(400).json({
        success: false,
        message: 'Your backlog count exceeds the limit for this drive.',
      });
    }

    if (new Date(drive.deadline) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'The application deadline for this placement drive has passed.',
      });
    }

    const resume = buildStoredFile(req.file, req.body.resumeUrl);

    if (!resume) {
      return res.status(400).json({
        success: false,
        message: 'A resume file or resumeUrl is required to apply.',
      });
    }

    const application = await PlacementApplication.create({
      student: student._id,
      drive: drive._id,
      resume,
      notes,
    });

    await application.populate('drive');

    res.status(201).json({
      success: true,
      data: application,
    });
  } catch (error) {
    const statusCode = error.code === 11000 ? 400 : (error.statusCode || 400);
    const message = error.code === 11000
      ? 'You have already applied for this placement drive.'
      : error.message;

    res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

const getEventStatusLabel = (event, referenceDate = new Date()) => {
  const startDate = new Date(event?.startDate || 0);
  const endDate = new Date(event?.endDate || 0);

  if (endDate < referenceDate) {
    return 'Completed';
  }

  if (startDate <= referenceDate && endDate >= referenceDate) {
    return 'Ongoing';
  }

  return 'Upcoming';
};

const isAttendanceWindowOpen = (event, referenceDate = new Date()) => {
  if (event?.attendanceSession?.isActive === false) {
    return false;
  }

  const opensAt = new Date(event?.attendanceSession?.opensAt || event?.startDate || 0);
  const closesAt = new Date(event?.attendanceSession?.closesAt || event?.endDate || 0);

  return opensAt <= referenceDate && closesAt >= referenceDate;
};

const serializeStudentEvent = (event, registrationsByEventId, referenceDate = new Date()) => {
  const eventId = event._id?.toString();
  const registration = registrationsByEventId.get(eventId) || null;
  const isAllDepartments = event.departmentScope === 'ALL';
  const departmentLabel = isAllDepartments
    ? 'All Departments'
    : event.department?.name || event.department?.code || 'Department';
  const attendanceMarked = Boolean(
    registration?.attended || registration?.attendanceStatus === 'Marked'
  );
  const attendanceWindowOpen = isAttendanceWindowOpen(event, referenceDate);

  return {
    _id: event._id,
    title: event.title,
    description: event.description,
    type: event.type,
    level: event.level,
    startDate: event.startDate,
    endDate: event.endDate,
    location: event.location,
    organizingBody: event.organizingBody,
    department: isAllDepartments ? null : event.department || null,
    departmentScope: event.departmentScope || 'DEPARTMENT',
    departmentLabel,
    status: getEventStatusLabel(event, referenceDate),
    isRegistered: Boolean(registration),
    attendanceSession: {
      isActive: event.attendanceSession?.isActive !== false,
      opensAt: event.attendanceSession?.opensAt || event.startDate,
      closesAt: event.attendanceSession?.closesAt || event.endDate,
      markedCount: event.attendanceSession?.markedCount || 0,
      canMarkNow: attendanceWindowOpen,
    },
    registration: registration
      ? {
        _id: registration._id,
        role: registration.role,
        status: registration.status,
        message: registration.message,
        registeredAt: registration.registeredAt || registration.createdAt,
        attended: attendanceMarked,
        attendanceStatus: registration.attendanceStatus || (attendanceMarked ? 'Marked' : 'Pending'),
        attendanceMarkedAt: registration.attendanceMarkedAt || null,
        canMarkAttendance:
          attendanceWindowOpen &&
          !attendanceMarked &&
          registration.status !== 'Participated',
      }
      : null,
  };
};

const listStudentParticipationHub = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    const status = await syncStudentStatus(student);
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const studentDepartmentId = student.department?._id || student.department;

    const [events, registrations] = await Promise.all([
      Event.find({
        isActive: true,
        endDate: { $gte: today },
        $or: [
          { departmentScope: 'ALL' },
          { departmentScope: 'DEPARTMENT', department: studentDepartmentId },
        ],
      })
        .populate('department', 'name code')
        .sort({ startDate: 1, endDate: 1 })
        .lean(),
      Participation.find({ student: student._id })
        .populate({
          path: 'event',
          populate: {
            path: 'department',
            select: 'name code',
          },
        })
        .sort({ registeredAt: -1, createdAt: -1 })
        .lean(),
    ]);

    const registrationsByEventId = new Map(
      registrations
        .filter((entry) => entry.event?._id)
        .map((entry) => [entry.event._id.toString(), entry])
    );

    const normalizedEvents = events.map((event) =>
      serializeStudentEvent(event, registrationsByEventId, now)
    );
    const ongoingEvents = normalizedEvents.filter((event) => event.status === 'Ongoing');
    const upcomingEvents = normalizedEvents.filter((event) => event.status === 'Upcoming');
    const registeredEvents = normalizedEvents.filter((event) => event.isRegistered);
    const attendanceMarkedCount = registeredEvents.filter(
      (event) => event.registration?.attended
    ).length;

    res.json({
      success: true,
      data: {
        student: {
          _id: student._id,
          name: student.name,
          email: student.email,
          department: student.department,
          status,
        },
        summary: {
          totalRelevantEvents: normalizedEvents.length,
          ongoingCount: ongoingEvents.length,
          upcomingCount: upcomingEvents.length,
          registeredCount: registeredEvents.length,
          attendanceMarkedCount,
          attendancePendingCount: Math.max(registeredEvents.length - attendanceMarkedCount, 0),
          availableToRegister: normalizedEvents.filter((event) => !event.isRegistered).length,
        },
        ongoingEvents,
        upcomingEvents,
        registrations: registrations.map((entry) => ({
          _id: entry._id,
          role: entry.role,
          status: entry.status,
          message: entry.message,
          registeredAt: entry.registeredAt || entry.createdAt,
          event: entry.event
            ? serializeStudentEvent(entry.event, registrationsByEventId, now)
            : null,
        })),
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Unable to load participation events.',
    });
  }
};

module.exports = {
  getStudentProfile,
  updateStudentProfile,
  getAcademicProgress,
  getStudentSubjects,
  getStudentAttendance,
  getStudentBacklogs,
  listStudentAchievements,
  createStudentAchievement,
  listStudentFeedback,
  createStudentFeedback,
  listStudentDocuments,
  createStudentDocument,
  getStudentPlacements,
  applyToPlacement,
  listStudentParticipationHub,
};
