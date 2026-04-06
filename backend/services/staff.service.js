const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');
const path = require('path');

const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Department = require('../models/Department');
const Document = require('../models/Document');
const Report = require('../models/Report');
const Attendance = require('../models/Attendance');
const Marks = require('../models/Marks');
const ResearchPaper = require('../models/ResearchPaper');
const Subject = require('../models/Subject');
const analyticsService = require('./analytics.service');
const { calculateStudentPerformance } = require('./performance.service');
const reportService = require('./report.service');

const MANAGED_ROLES = ['hod', 'faculty', 'student'];

const buildPagination = (query = {}) => {
  const page = Math.max(parseInt(query.page || 1, 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || 10, 10), 1), 100);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const buildRegex = (value) => new RegExp(value.trim(), 'i');

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
};

const getStatusFromPayload = (payload = {}, fallbackStatus = 'active') => {
  if (typeof payload.isActive === 'boolean') {
    return payload.isActive ? 'active' : 'inactive';
  }

  if (payload.status === 'active' || payload.status === 'inactive') {
    return payload.status;
  }

  return fallbackStatus;
};

const generateDefaultPassword = () => {
  const lower = Math.random().toString(36).slice(-4);
  const upper = Math.random().toString(36).slice(-4).toUpperCase();
  const number = String(Date.now()).slice(-2);
  return `${upper}${lower}${number}!`;
};

const clampSemester = (value) => Math.min(Math.max(parseInt(value || 1, 10), 1), 8);

const getDerivedCurrentSemester = (batchYear, referenceDate = new Date()) => {
  const normalizedBatchYear = parseInt(batchYear, 10);

  if (!normalizedBatchYear) {
    return 1;
  }

  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const academicStartYear = month >= 6 ? year : year - 1;

  if (normalizedBatchYear > academicStartYear) {
    return 1;
  }

  const yearsElapsed = academicStartYear - normalizedBatchYear;
  const semester = yearsElapsed * 2 + (month >= 6 ? 1 : 2);

  return clampSemester(semester);
};

const getAcademicYearLabel = (batchYear, semester) => {
  const normalizedBatchYear = parseInt(batchYear, 10) || new Date().getFullYear();
  const startYear = normalizedBatchYear + Math.floor((clampSemester(semester) - 1) / 2);
  const endYear = String((startYear + 1) % 100).padStart(2, '0');

  return `${startYear}-${endYear}`;
};

const normalizeAcademicYearFilter = (filters = {}) => {
  const rawValue = filters.academicYear || filters.year;

  if (!rawValue) {
    return '';
  }

  const normalizedValue = String(rawValue).trim();

  if (/^\d{4}-\d{2}$/.test(normalizedValue)) {
    return normalizedValue;
  }

  if (/^\d{4}$/.test(normalizedValue)) {
    const startYear = Number(normalizedValue);
    return `${normalizedValue}-${String((startYear + 1) % 100).padStart(2, '0')}`;
  }

  return normalizedValue;
};

const getAcademicYearStartYear = (academicYear) => {
  if (!academicYear) {
    return null;
  }

  const startYear = parseInt(String(academicYear).slice(0, 4), 10);
  return Number.isFinite(startYear) ? startYear : null;
};

const normalizeSemesterCgpaRecords = (payload = {}, batchYear) => {
  const rawRecords = payload.academicRecords?.semesterCgpa || payload.semesterCgpa || [];

  return rawRecords
    .map((record, index) => {
      const semester = clampSemester(record.semester || index + 1);
      const cgpa = Number(record.cgpa);

      if (!Number.isFinite(cgpa)) {
        return null;
      }

      return {
        semester,
        academicYear: record.academicYear || getAcademicYearLabel(batchYear, semester),
        cgpa: Math.max(0, Math.min(cgpa, 10)),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.semester - right.semester);
};

const serializeUser = (user, profile = null) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department,
  status: user.status || (user.isActive ? 'active' : 'inactive'),
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  profile,
});

const findStudentProfile = async (user) => Student.findOne({
  $or: [
    { user: user._id },
    { email: user.email },
  ],
}).populate('department', 'name code');

const findFacultyProfile = async (user) => Faculty.findOne({
  $or: [
    { user: user._id },
    { email: user.email },
  ],
}).populate('department', 'name code');

const getLinkedProfile = async (user) => {
  if (!user) return null;

  if (user.role === 'student') {
    return findStudentProfile(user);
  }

  if (user.role === 'faculty' || user.role === 'hod') {
    return findFacultyProfile(user);
  }

  return null;
};

const syncHodDepartment = async (faculty, previousDepartmentId, nextDepartmentId, isActive) => {
  const previousId = previousDepartmentId ? previousDepartmentId.toString() : null;
  const nextId = nextDepartmentId ? nextDepartmentId.toString() : null;

  if (previousId && previousId !== nextId) {
    await Department.updateOne(
      { _id: previousId, hod: faculty._id },
      { $unset: { hod: 1 } }
    );
  }

  if (!nextId) {
    return;
  }

  if (isActive) {
    await Department.findByIdAndUpdate(nextId, { hod: faculty._id });
    return;
  }

  await Department.updateOne(
    { _id: nextId, hod: faculty._id },
    { $unset: { hod: 1 } }
  );
};

const ensureManagedRole = (role) => {
  if (!MANAGED_ROLES.includes(role)) {
    const error = new Error('Staff can only manage hod, faculty, and student accounts.');
    error.status = 400;
    throw error;
  }
};

const ensureDepartmentExists = async (departmentId) => {
  const department = await Department.findById(departmentId);

  if (!department) {
    const error = new Error('Department not found.');
    error.status = 404;
    throw error;
  }

  return department;
};

const createStudentProfile = async (user, payload) => {
  if (!payload.department) {
    const error = new Error('Department is required for student accounts.');
    error.status = 400;
    throw error;
  }

  if (!payload.rollNumber || !payload.batchYear) {
    const error = new Error('rollNumber and batchYear are required for student accounts.');
    error.status = 400;
    throw error;
  }

  await ensureDepartmentExists(payload.department);

  const derivedSemester = getDerivedCurrentSemester(payload.batchYear);
  const semesterCgpa = normalizeSemesterCgpaRecords(payload, payload.batchYear);
  const latestSemesterRecord = semesterCgpa[semesterCgpa.length - 1];
  const latestCgpa = latestSemesterRecord?.cgpa ?? Number(payload.cgpa || 0);
  const currentSemester = Math.max(
    latestSemesterRecord?.semester || 1,
    payload.currentSemester ? clampSemester(payload.currentSemester) : derivedSemester
  );
  const performance = calculateStudentPerformance({
    cgpa: latestCgpa,
    currentBacklogs: payload.currentBacklogs || 0,
    academicRecords: {
      avgAttendance: payload.academicRecords?.avgAttendance || 0,
    },
  });

  return Student.create({
    user: user._id,
    name: payload.name,
    email: payload.email,
    department: payload.department,
    rollNumber: payload.rollNumber,
    batchYear: payload.batchYear,
    currentSemester,
    gender: payload.gender,
    cgpa: latestCgpa,
    performanceScore: performance.performanceScore,
    performanceCategory: performance.category,
    isAtRisk: performance.isAtRisk,
    riskReasons: performance.riskReasons,
    currentBacklogs: payload.currentBacklogs || 0,
    totalBacklogsCleared: payload.totalBacklogsCleared || 0,
    phone: payload.phone,
    address: payload.address,
    academicRecords: {
      latestSemester: latestSemesterRecord?.semester || currentSemester,
      latestAcademicYear: latestSemesterRecord?.academicYear || payload.academicRecords?.latestAcademicYear || getAcademicYearLabel(payload.batchYear, currentSemester),
      avgMarks: payload.academicRecords?.avgMarks || 0,
      avgAttendance: payload.academicRecords?.avgAttendance || 0,
      creditsEarned: payload.academicRecords?.creditsEarned || 0,
      performanceBand: payload.academicRecords?.performanceBand || performance.category,
      semesterCgpa,
      remarks: payload.academicRecords?.remarks,
    },
    isActive: getStatusFromPayload(payload, 'active') === 'active',
  });
};

const createFacultyProfile = async (user, payload) => {
  if (!payload.department) {
    const error = new Error('Department is required for hod and faculty accounts.');
    error.status = 400;
    throw error;
  }

  await ensureDepartmentExists(payload.department);

  const faculty = await Faculty.create({
    user: user._id,
    name: payload.name,
    email: payload.email,
    department: payload.department,
    designation: payload.designation,
    qualification: payload.qualification,
    experience: payload.experience || 0,
    specialization: payload.specialization,
    phone: payload.phone,
    isActive: getStatusFromPayload(payload, 'active') === 'active',
  });

  if (user.role === 'hod') {
    await syncHodDepartment(faculty, null, payload.department, faculty.isActive);
  }

  return faculty;
};

const syncLinkedProfile = async (user, payload = {}, previousDepartmentId = null) => {
  if (user.role === 'student') {
    let student = await findStudentProfile(user);

    if (!student) {
      if (!payload.rollNumber || !payload.batchYear) {
        const error = new Error('Linked student profile is missing. rollNumber and batchYear are required to recreate it.');
        error.status = 400;
        throw error;
      }

      student = await createStudentProfile(user, {
        ...payload,
        name: user.name,
        email: user.email,
        department: payload.department || user.department,
        status: user.status,
      });
    } else {
      if (payload.department) {
        await ensureDepartmentExists(payload.department);
      }

      const nextDepartment = payload.department || user.department || student.department;

      Object.assign(student, {
        name: user.name,
        email: user.email,
        department: nextDepartment,
        rollNumber: payload.rollNumber || student.rollNumber,
        batchYear: payload.batchYear || student.batchYear,
        currentSemester: payload.currentSemester || student.currentSemester,
        gender: payload.gender || student.gender,
        cgpa: payload.cgpa ?? student.cgpa,
        isAtRisk: payload.isAtRisk ?? student.isAtRisk,
        riskReasons: payload.riskReasons || student.riskReasons,
        currentBacklogs: payload.currentBacklogs ?? student.currentBacklogs,
        totalBacklogsCleared: payload.totalBacklogsCleared ?? student.totalBacklogsCleared,
        phone: payload.phone || student.phone,
        address: payload.address || student.address,
        isActive: user.isActive,
      });

      student.academicRecords = {
        ...student.academicRecords,
        ...(payload.academicRecords || {}),
        latestSemester: payload.currentSemester || student.currentSemester,
      };

      await student.save();
    }

    await student.populate('department', 'name code');
    return student;
  }

  if (user.role === 'faculty' || user.role === 'hod') {
    let faculty = await findFacultyProfile(user);

    if (!faculty) {
      faculty = await createFacultyProfile(user, {
        ...payload,
        name: user.name,
        email: user.email,
        department: payload.department || user.department,
        status: user.status,
      });
    } else {
      if (payload.department) {
        await ensureDepartmentExists(payload.department);
      }

      const nextDepartment = payload.department || user.department || faculty.department;

      Object.assign(faculty, {
        name: user.name,
        email: user.email,
        department: nextDepartment,
        designation: payload.designation || faculty.designation,
        qualification: payload.qualification || faculty.qualification,
        experience: payload.experience ?? faculty.experience,
        specialization: payload.specialization || faculty.specialization,
        phone: payload.phone || faculty.phone,
        isActive: user.isActive,
      });

      await faculty.save();
    }

    await faculty.populate('department', 'name code');

    if (user.role === 'hod') {
      await syncHodDepartment(faculty, previousDepartmentId, faculty.department?._id || faculty.department, user.isActive);
    }

    return faculty;
  }

  return null;
};

const createManagedUser = async (payload) => {
  ensureManagedRole(payload.role);

  const existingUser = await User.findOne({ email: payload.email });
  if (existingUser) {
    const error = new Error('Email already registered.');
    error.status = 400;
    throw error;
  }

  const status = getStatusFromPayload(payload, 'active');
  const password = payload.password || generateDefaultPassword();

  const user = await User.create({
    name: payload.name,
    email: payload.email,
    password,
    role: payload.role,
    department: payload.department || null,
    status,
    isActive: status === 'active',
  });

  try {
    const profile = await syncLinkedProfile(user, payload);
    const populatedUser = await User.findById(user._id).populate('department', 'name code');

    return {
      user: serializeUser(populatedUser, profile),
      defaultPassword: payload.password ? null : password,
    };
  } catch (error) {
    await User.findByIdAndDelete(user._id);
    throw error;
  }
};

const listUsers = async (query = {}) => {
  const filter = {};

  if (query.role) {
    filter.role = query.role;
  }

  if (query.status === 'active' || query.status === 'inactive') {
    filter.status = query.status;
  }

  if (query.department) {
    filter.department = query.department;
  }

  if (query.search && query.search.trim()) {
    const regex = buildRegex(query.search);
    filter.$or = [
      { name: regex },
      { email: regex },
    ];
  }

  const { page, limit, skip } = buildPagination(query);

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .select('-password')
    .populate('department', 'name code')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const enrichedUsers = await Promise.all(users.map(async (user) => serializeUser(user, await getLinkedProfile(user))));

  return {
    users: enrichedUsers,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

const getUserProfile = async (id) => {
  const user = await User.findById(id)
    .select('-password')
    .populate('department', 'name code');

  if (!user) {
    const error = new Error('User not found.');
    error.status = 404;
    throw error;
  }

  return serializeUser(user, await getLinkedProfile(user));
};

const updateManagedUser = async (id, payload = {}) => {
  const user = await User.findById(id).populate('department', 'name code');

  if (!user) {
    const error = new Error('User not found.');
    error.status = 404;
    throw error;
  }

  if (user.role === 'iqac_admin') {
    const error = new Error('Admin accounts cannot be modified from the staff module.');
    error.status = 403;
    throw error;
  }

  if (payload.role && payload.role !== user.role) {
    const error = new Error('Role changes are not supported from the staff update endpoint.');
    error.status = 400;
    throw error;
  }

  const previousDepartmentId = user.department?._id || user.department;

  if (payload.department) {
    await ensureDepartmentExists(payload.department);
  }

  const nextStatus = getStatusFromPayload(payload, user.status || (user.isActive ? 'active' : 'inactive'));

  user.name = payload.name || user.name;
  user.email = payload.email || user.email;
  user.department = payload.department || user.department || null;
  user.status = nextStatus;
  user.isActive = nextStatus === 'active';

  await user.save();

  const profile = await syncLinkedProfile(user, payload, previousDepartmentId);
  await user.populate('department', 'name code');

  return serializeUser(user, profile);
};

const disableManagedUser = async (id) => {
  const user = await User.findById(id).populate('department', 'name code');

  if (!user) {
    const error = new Error('User not found.');
    error.status = 404;
    throw error;
  }

  if (user.role === 'iqac_admin') {
    const error = new Error('Admin accounts cannot be disabled by staff.');
    error.status = 403;
    throw error;
  }

  const previousDepartmentId = user.department?._id || user.department;

  user.status = 'inactive';
  user.isActive = false;
  await user.save();

  const profile = await syncLinkedProfile(user, {}, previousDepartmentId);

  return serializeUser(user, profile);
};

const listStudents = async (query = {}) => {
  const filter = {};

  if (typeof query.isActive === 'string') {
    filter.isActive = query.isActive === 'true';
  }

  if (query.department) {
    filter.department = query.department;
  }

  if (query.batchYear) {
    filter.batchYear = parseInt(query.batchYear, 10);
  }

  if (query.semester) {
    filter.currentSemester = parseInt(query.semester, 10);
  }

  if (query.isAtRisk === 'true') {
    filter.isAtRisk = true;
  }

  if (query.search && query.search.trim()) {
    const regex = buildRegex(query.search);
    filter.$or = [
      { name: regex },
      { rollNumber: regex },
      { email: regex },
    ];
  }

  const { page, limit, skip } = buildPagination(query);
  const total = await Student.countDocuments(filter);
  const students = await Student.find(filter)
    .populate('department', 'name code')
    .populate('user', 'name email role status isActive')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    students,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

const updateStudentRecord = async (id, payload = {}) => {
  const student = await Student.findById(id)
    .populate('department', 'name code')
    .populate('user', 'name email role department status isActive');

  if (!student) {
    const error = new Error('Student record not found.');
    error.status = 404;
    throw error;
  }

  if (payload.department) {
    await ensureDepartmentExists(payload.department);
  }

  const fields = [
    'name',
    'rollNumber',
    'email',
    'department',
    'batchYear',
    'currentSemester',
    'gender',
    'cgpa',
    'isAtRisk',
    'riskReasons',
    'currentBacklogs',
    'totalBacklogsCleared',
    'phone',
    'address',
    'isActive',
  ];

  fields.forEach((field) => {
    if (payload[field] !== undefined) {
      student[field] = payload[field];
    }
  });

  if (payload.academicRecords) {
    student.academicRecords = {
      ...student.academicRecords,
      ...payload.academicRecords,
    };
  }

  await student.save();
  await student.populate('department', 'name code');

  if (student.user) {
    const linkedUser = await User.findById(student.user);
    if (linkedUser) {
      linkedUser.name = student.name;
      linkedUser.email = student.email || linkedUser.email;
      linkedUser.department = student.department?._id || student.department;
      if (payload.isActive !== undefined) {
        linkedUser.isActive = payload.isActive;
        linkedUser.status = payload.isActive ? 'active' : 'inactive';
      }
      await linkedUser.save();
    }
  }

  return student;
};

const listFaculty = async (query = {}) => {
  const filter = {};

  if (typeof query.isActive === 'string') {
    filter.isActive = query.isActive === 'true';
  }

  if (query.department) {
    filter.department = query.department;
  }

  if (query.designation) {
    filter.designation = query.designation;
  }

  if (query.search && query.search.trim()) {
    const regex = buildRegex(query.search);
    filter.$or = [
      { name: regex },
      { email: regex },
      { specialization: regex },
    ];
  }

  const { page, limit, skip } = buildPagination(query);
  const total = await Faculty.countDocuments(filter);
  const faculty = await Faculty.find(filter)
    .populate('department', 'name code')
    .populate('user', 'name email role status isActive')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    faculty,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

const updateFacultyRecord = async (id, payload = {}) => {
  const faculty = await Faculty.findById(id)
    .populate('department', 'name code')
    .populate('user', 'name email role department status isActive');

  if (!faculty) {
    const error = new Error('Faculty record not found.');
    error.status = 404;
    throw error;
  }

  const previousDepartmentId = faculty.department?._id || faculty.department;

  if (payload.department) {
    await ensureDepartmentExists(payload.department);
  }

  const fields = [
    'name',
    'email',
    'department',
    'designation',
    'qualification',
    'experience',
    'specialization',
    'phone',
    'isActive',
  ];

  fields.forEach((field) => {
    if (payload[field] !== undefined) {
      faculty[field] = payload[field];
    }
  });

  await faculty.save();
  await faculty.populate('department', 'name code');

  if (faculty.user) {
    const linkedUser = await User.findById(faculty.user);
    if (linkedUser) {
      linkedUser.name = faculty.name;
      linkedUser.email = faculty.email;
      linkedUser.department = faculty.department?._id || faculty.department;
      if (payload.isActive !== undefined) {
        linkedUser.isActive = payload.isActive;
        linkedUser.status = payload.isActive ? 'active' : 'inactive';
      }
      await linkedUser.save();

      if (linkedUser.role === 'hod') {
        await syncHodDepartment(faculty, previousDepartmentId, faculty.department?._id || faculty.department, linkedUser.isActive);
      }
    }
  }

  return faculty;
};

const listDepartments = async () => {
  const departments = await Department.aggregate([
    {
      $lookup: {
        from: 'students',
        localField: '_id',
        foreignField: 'department',
        as: 'students',
      },
    },
    {
      $lookup: {
        from: 'faculties',
        localField: '_id',
        foreignField: 'department',
        as: 'faculty',
      },
    },
    {
      $project: {
        name: 1,
        code: 1,
        establishedYear: 1,
        totalSeats: 1,
        hod: 1,
        isActive: 1,
        studentCount: { $size: '$students' },
        facultyCount: { $size: '$faculty' },
      },
    },
    { $sort: { name: 1 } },
  ]);

  return Department.populate(departments, {
    path: 'hod',
    select: 'name email designation',
  });
};

const updateDepartmentRecord = async (id, payload = {}) => {
  const department = await Department.findById(id);

  if (!department) {
    const error = new Error('Department not found.');
    error.status = 404;
    throw error;
  }

  ['name', 'code', 'establishedYear', 'totalSeats', 'isActive', 'hod'].forEach((field) => {
    if (payload[field] !== undefined) {
      department[field] = payload[field];
    }
  });

  await department.save();
  await department.populate('hod', 'name email designation');

  return department;
};

const uploadDocument = async (payload = {}, currentUser, file = null) => {
  if (payload.department) {
    await ensureDepartmentExists(payload.department);
  }

  const uploadedFile = file
    ? {
        originalName: file.originalname,
        filename: file.filename,
        path: `/uploads/${path.basename(file.destination)}/${file.filename}`,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date(),
      }
    : payload.file || (
        payload.filePath || payload.fileName
          ? {
              originalName: payload.fileName || `${payload.title || 'document'}.pdf`,
              filename: payload.fileName || `${Date.now()}-${(payload.title || 'document').toLowerCase().replace(/\s+/g, '-')}.pdf`,
              path: payload.filePath || '/uploads/manual-entry',
              mimeType: payload.mimeType || 'application/pdf',
              size: payload.fileSize || 0,
              uploadedAt: new Date(),
            }
          : null
      );

  if (!uploadedFile) {
    const error = new Error('Document file is required.');
    error.status = 400;
    throw error;
  }

  const document = await Document.create({
    title: payload.title,
    description: payload.description,
    category: payload.category,
    type: payload.type,
    accreditationType: payload.accreditationType,
    criteria: payload.criteria,
    department: payload.department || null,
    program: payload.program || null,
    academicYear: payload.academicYear,
    file: uploadedFile,
    version: payload.version || '1.0',
    tags: payload.tags || [],
    accessLevel: payload.accessLevel || 'Internal',
    uploadedBy: currentUser._id,
    status: currentUser.role === 'iqac_admin' ? 'Approved' : 'Pending Approval',
    approvedBy: currentUser.role === 'iqac_admin' ? currentUser._id : undefined,
    approvedAt: currentUser.role === 'iqac_admin' ? new Date() : undefined,
    isRequiredForAccreditation: Boolean(payload.isRequiredForAccreditation),
    expiryDate: payload.expiryDate,
  });

  await document.populate([
    { path: 'department', select: 'name code' },
    { path: 'uploadedBy', select: 'name email role' },
  ]);

  return document;
};

const listDocuments = async (query = {}) => {
  const filter = { isActive: true };

  ['category', 'type', 'status', 'academicYear', 'accessLevel'].forEach((field) => {
    if (query[field]) {
      filter[field] = query[field];
    }
  });

  if (query.department) {
    filter.department = query.department;
  }

  if (query.search && query.search.trim()) {
    const regex = buildRegex(query.search);
    filter.$or = [
      { title: regex },
      { description: regex },
    ];
  }

  const { page, limit, skip } = buildPagination(query);
  const total = await Document.countDocuments(filter);
  const documents = await Document.find(filter)
    .populate('department', 'name code')
    .populate('uploadedBy', 'name email role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    documents,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

const buildDepartmentReport = async (filters = {}) => {
  const departmentFilter = {};
  const academicYear = normalizeAcademicYearFilter(filters);

  if (filters.department) {
    departmentFilter._id = toObjectId(filters.department);
  }

  const documentMatch = { isActive: true };

  if (filters.department) {
    documentMatch.department = toObjectId(filters.department);
  }

  if (academicYear) {
    documentMatch.academicYear = academicYear;
  }

  const [departments, ranking, documentsByDepartment] = await Promise.all([
    Department.find(departmentFilter)
      .populate('hod', 'name email designation')
      .sort({ name: 1 })
      .lean(),
    analyticsService.getDepartmentRanking({
      ...(filters.department ? { departmentId: filters.department } : {}),
      ...(academicYear ? { academicYear } : {}),
    }),
    Document.aggregate([
      { $match: documentMatch },
      { $group: { _id: '$department', count: { $sum: 1 } } },
    ]),
  ]);

  const rankingMap = new Map(ranking.map((item) => [String(item.deptId), item]));
  const documentMap = new Map(documentsByDepartment.map((item) => [String(item._id), item.count]));

  const rows = await Promise.all(departments.map(async (department) => {
    const stats = rankingMap.get(String(department._id)) || {};
    const [studentCount, facultyCount] = await Promise.all([
      Student.countDocuments({ department: department._id, isActive: true }),
      Faculty.countDocuments({ department: department._id, isActive: true }),
    ]);

    return {
      id: department._id,
      department: department.name,
      code: department.code,
      hod: department.hod,
      studentCount,
      facultyCount,
      passPercentage: stats.passPercentage || 0,
      avgAttendance: stats.avgAttendance || 0,
      placementPercentage: stats.placementPercentage || 0,
      researchPapers: stats.researchPapers || 0,
      score: stats.score || 0,
      rank: stats.rank || null,
      documentCount: documentMap.get(String(department._id)) || 0,
      totalSeats: department.totalSeats,
      establishedYear: department.establishedYear,
      isActive: department.isActive,
    };
  }));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      departments: rows.length,
      activeDepartments: rows.filter((row) => row.isActive).length,
      avgScore: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 0,
      totalDocuments: rows.reduce((sum, row) => sum + row.documentCount, 0),
    },
    rows,
  };
};

const buildDepartmentDetail = async (departmentId, filters = {}) => {
  const resolvedDepartmentId = toObjectId(departmentId);

  if (!resolvedDepartmentId) {
    const error = new Error('Department not found.');
    error.status = 404;
    throw error;
  }

  const academicYear = normalizeAcademicYearFilter(filters);
  const semester = filters.semester ? parseInt(filters.semester, 10) : undefined;

  const [
    department,
    ranking,
    studentStats,
    backlogStudentCount,
    trendData,
    backlogSubjects,
  ] = await Promise.all([
    Department.findById(resolvedDepartmentId).lean(),
    analyticsService.getDepartmentRanking({
      ...(academicYear ? { academicYear } : {}),
      ...(Number.isFinite(semester) ? { semester } : {}),
    }),
    Student.aggregate([
      {
        $match: {
          department: resolvedDepartmentId,
          isActive: true,
        },
      },
      {
        $group: {
          _id: '$department',
          totalStudents: { $sum: 1 },
          avgCgpa: { $avg: '$cgpa' },
          totalBacklogs: { $sum: '$currentBacklogs' },
        },
      },
    ]),
    Student.countDocuments({
      department: resolvedDepartmentId,
      isActive: true,
      currentBacklogs: { $gt: 0 },
    }),
    Marks.aggregate([
      {
        $lookup: {
          from: 'students',
          localField: 'student',
          foreignField: '_id',
          as: 'studentData',
        },
      },
      { $unwind: '$studentData' },
      {
        $match: {
          'studentData.department': resolvedDepartmentId,
          ...(academicYear ? { academicYear } : {}),
        },
      },
      {
        $group: {
          _id: {
            semester: '$semester',
            student: '$student',
          },
          avgGradePoints: { $avg: '$gradePoints' },
          totalEntries: { $sum: 1 },
          passEntries: {
            $sum: {
              $cond: [{ $eq: ['$result', 'PASS'] }, 1, 0],
            },
          },
          hasBacklog: {
            $max: {
              $cond: [{ $ne: ['$result', 'PASS'] }, 1, 0],
            },
          },
        },
      },
      {
        $group: {
          _id: '$_id.semester',
          avgCgpa: { $avg: '$avgGradePoints' },
          totalEntries: { $sum: '$totalEntries' },
          passEntries: { $sum: '$passEntries' },
          backlogStudents: { $sum: '$hasBacklog' },
          studentCount: { $sum: 1 },
        },
      },
      {
        $addFields: {
          avgCgpa: { $round: ['$avgCgpa', 2] },
          passPercentage: {
            $round: [
              {
                $multiply: [
                  {
                    $divide: ['$passEntries', { $max: ['$totalEntries', 1] }],
                  },
                  100,
                ],
              },
              2,
            ],
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Marks.aggregate([
      {
        $lookup: {
          from: 'students',
          localField: 'student',
          foreignField: '_id',
          as: 'studentData',
        },
      },
      { $unwind: '$studentData' },
      {
        $match: {
          'studentData.department': resolvedDepartmentId,
          ...(academicYear ? { academicYear } : {}),
          ...(Number.isFinite(semester) ? { semester } : {}),
        },
      },
      {
        $lookup: {
          from: 'subjects',
          localField: 'subject',
          foreignField: '_id',
          as: 'subjectData',
        },
      },
      { $unwind: '$subjectData' },
      {
        $group: {
          _id: '$subject',
          name: { $first: '$subjectData.name' },
          code: { $first: '$subjectData.code' },
          failCount: {
            $sum: {
              $cond: [{ $ne: ['$result', 'PASS'] }, 1, 0],
            },
          },
          totalEntries: { $sum: 1 },
        },
      },
      {
        $addFields: {
          passPercentage: {
            $round: [
              {
                $multiply: [
                  {
                    $divide: [
                      { $subtract: ['$totalEntries', '$failCount'] },
                      { $max: ['$totalEntries', 1] },
                    ],
                  },
                  100,
                ],
              },
              2,
            ],
          },
        },
      },
      { $match: { failCount: { $gt: 0 } } },
      { $sort: { failCount: -1, passPercentage: 1 } },
      { $limit: 3 },
    ]),
  ]);

  if (!department) {
    const error = new Error('Department not found.');
    error.status = 404;
    throw error;
  }

  const rankingEntry = ranking.find((item) => String(item.deptId) === String(resolvedDepartmentId)) || {};
  const summaryStats = studentStats[0] || {};

  const performanceTrend = trendData.map((entry) => ({
    semester: entry._id,
    label: `Sem ${entry._id}`,
    avgCgpa: Number(entry.avgCgpa || 0),
    passPercentage: Number(entry.passPercentage || 0),
    backlogStudents: entry.backlogStudents || 0,
    studentCount: entry.studentCount || 0,
  }));

  const subjectBacklogAnalysis = backlogSubjects.map((subject) => ({
    id: subject._id,
    name: subject.name,
    code: subject.code,
    failCount: subject.failCount || 0,
    totalEntries: subject.totalEntries || 0,
    passPercentage: Number(subject.passPercentage || 0),
    severity:
      (subject.passPercentage || 0) < 70
        ? 'critical'
        : (subject.passPercentage || 0) < 80
          ? 'warning'
          : 'stable',
  }));

  const insights = [];

  if (subjectBacklogAnalysis[0]) {
    insights.push({
      title: 'Subject Risk',
      tone: subjectBacklogAnalysis[0].severity === 'critical' ? 'warning' : 'info',
      text: `${subjectBacklogAnalysis[0].code} has the lowest pass rate at ${subjectBacklogAnalysis[0].passPercentage.toFixed(1)}%.`,
    });
  }

  if (performanceTrend.length > 1) {
    const previous = performanceTrend[performanceTrend.length - 2];
    const current = performanceTrend[performanceTrend.length - 1];
    const backlogDelta = current.backlogStudents - previous.backlogStudents;
    const backlogChange = previous.backlogStudents
      ? Math.round((Math.abs(backlogDelta) / previous.backlogStudents) * 100)
      : Math.abs(backlogDelta) * 100;

    insights.push({
      title: 'Backlog Movement',
      tone: backlogDelta > 0 ? 'warning' : 'success',
      text:
        backlogDelta === 0
          ? `Backlog pressure stayed flat from ${previous.label} to ${current.label}.`
          : `Backlogs ${backlogDelta > 0 ? 'increased' : 'improved'} by ${backlogChange}% from ${previous.label} to ${current.label}.`,
    });

    const cgpaDelta = current.avgCgpa - previous.avgCgpa;
    insights.push({
      title: 'CGPA Trend',
      tone: Math.abs(cgpaDelta) <= 0.12 ? 'info' : cgpaDelta > 0 ? 'success' : 'warning',
      text:
        Math.abs(cgpaDelta) <= 0.12
          ? 'CGPA trend is stable across the latest semester window.'
          : `CGPA ${cgpaDelta > 0 ? 'improved' : 'softened'} by ${Math.abs(cgpaDelta).toFixed(2)} points in the latest semester.`,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      academicYear: academicYear || '',
      semester: Number.isFinite(semester) ? semester : null,
    },
    summary: {
      id: department._id,
      name: department.name,
      code: department.code,
      rank: rankingEntry.rank || null,
      isTopDepartment: rankingEntry.rank === 1,
      totalStudents: summaryStats.totalStudents || 0,
      avgCgpa: Number((summaryStats.avgCgpa || 0).toFixed(2)),
      passPercentage: Number(rankingEntry.passPercentage || 0),
      totalBacklogs: summaryStats.totalBacklogs || 0,
      backlogStudents: backlogStudentCount || 0,
    },
    performanceTrend,
    backlogAnalysis: {
      totalBacklogStudents: backlogStudentCount || 0,
      topSubjects: subjectBacklogAnalysis,
    },
    insights,
  };
};

const buildStudentPerformanceReport = async (filters = {}) => {
  const studentFilter = {};
  const academicYear = normalizeAcademicYearFilter(filters);

  if (filters.department) {
    studentFilter.department = filters.department;
  }

  if (filters.batchYear) {
    studentFilter.batchYear = parseInt(filters.batchYear, 10);
  }

  if (filters.search && filters.search.trim()) {
    const regex = buildRegex(filters.search);
    studentFilter.$or = [
      { name: regex },
      { rollNumber: regex },
    ];
  }

  const students = await Student.find(studentFilter)
    .populate('department', 'name code')
    .sort({ cgpa: -1 })
    .lean();

  const studentIds = students.map((student) => student._id);

  const [marksSummary, attendanceSummary] = await Promise.all([
    Marks.aggregate([
      {
        $match: {
          student: { $in: studentIds },
          ...(academicYear ? { academicYear } : {}),
        },
      },
      {
        $group: {
          _id: '$student',
          avgMarks: { $avg: '$total' },
        },
      },
    ]),
    Attendance.aggregate([
      {
        $match: {
          student: { $in: studentIds },
          ...(academicYear ? { academicYear } : {}),
        },
      },
      {
        $group: {
          _id: '$student',
          avgAttendance: { $avg: '$percentage' },
        },
      },
    ]),
  ]);

  const marksMap = new Map(marksSummary.map((item) => [String(item._id), Math.round(item.avgMarks || 0)]));
  const attendanceMap = new Map(attendanceSummary.map((item) => [String(item._id), Math.round(item.avgAttendance || 0)]));

  const rows = students.map((student) => {
    const derivedPerformance = calculateStudentPerformance(student);

    return {
      id: student._id,
      name: student.name,
      rollNumber: student.rollNumber,
      department: student.department,
      batchYear: student.batchYear,
      currentSemester: student.currentSemester,
      cgpa: student.cgpa,
      performanceScore: Number(student.performanceScore ?? derivedPerformance.performanceScore),
      performanceCategory: student.performanceCategory || derivedPerformance.category,
      avgMarks: marksMap.get(String(student._id)) || student.academicRecords?.avgMarks || 0,
      avgAttendance: attendanceMap.get(String(student._id)) || student.academicRecords?.avgAttendance || 0,
      currentBacklogs: student.currentBacklogs,
      isAtRisk: (student.performanceCategory || derivedPerformance.category) === 'At Risk',
      academicRecords: student.academicRecords || {},
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      students: rows.length,
      atRiskStudents: rows.filter((row) => row.performanceCategory === 'At Risk').length,
      avgCgpa: rows.length ? Number((rows.reduce((sum, row) => sum + (row.cgpa || 0), 0) / rows.length).toFixed(2)) : 0,
      avgAttendance: rows.length ? Math.round(rows.reduce((sum, row) => sum + (row.avgAttendance || 0), 0) / rows.length) : 0,
    },
    rows,
  };
};

const buildBacklogReport = async (filters = {}) => {
  const studentFilter = {
    currentBacklogs: { $gt: 0 },
  };

  if (filters.department) {
    studentFilter.department = filters.department;
  }

  if (filters.batchYear) {
    studentFilter.batchYear = parseInt(filters.batchYear, 10);
  }

  if (filters.semester) {
    studentFilter.currentSemester = parseInt(filters.semester, 10);
  }

  if (filters.search && filters.search.trim()) {
    const regex = buildRegex(filters.search);
    studentFilter.$or = [
      { name: regex },
      { rollNumber: regex },
      { email: regex },
    ];
  }

  const students = await Student.find(studentFilter)
    .populate('department', 'name code')
    .sort({ currentBacklogs: -1, cgpa: 1, updatedAt: -1 })
    .lean();

  const rows = students.map((student) => ({
    id: student._id,
    name: student.name,
    rollNumber: student.rollNumber,
    department: student.department,
    batchYear: student.batchYear,
    currentSemester: student.currentSemester,
    cgpa: student.cgpa || 0,
    avgAttendance: student.academicRecords?.avgAttendance || 0,
    currentBacklogs: student.currentBacklogs || 0,
    totalBacklogsCleared: student.totalBacklogsCleared || 0,
    performanceCategory: student.performanceCategory || 'Average',
    riskReasons: student.riskReasons || [],
    updatedAt: student.updatedAt,
  }));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      students: rows.length,
      totalBacklogs: rows.reduce((sum, row) => sum + row.currentBacklogs, 0),
      avgBacklogs: rows.length ? Number((rows.reduce((sum, row) => sum + row.currentBacklogs, 0) / rows.length).toFixed(2)) : 0,
      avgCgpa: rows.length ? Number((rows.reduce((sum, row) => sum + row.cgpa, 0) / rows.length).toFixed(2)) : 0,
      avgAttendance: rows.length ? Number((rows.reduce((sum, row) => sum + row.avgAttendance, 0) / rows.length).toFixed(2)) : 0,
    },
    rows,
  };
};

const buildFacultyWorkloadReport = async (filters = {}) => {
  const facultyFilter = {};
  const academicYear = normalizeAcademicYearFilter(filters);
  const researchStartYear = getAcademicYearStartYear(academicYear);

  if (filters.department) {
    facultyFilter.department = filters.department;
  }

  if (filters.designation) {
    facultyFilter.designation = filters.designation;
  }

  if (filters.search && filters.search.trim()) {
    const regex = buildRegex(filters.search);
    facultyFilter.name = regex;
  }

  const faculty = await Faculty.find(facultyFilter)
    .populate('department', 'name code')
    .sort({ name: 1 })
    .lean();

  const facultyIds = faculty.map((member) => member._id);

  const [subjectLoad, researchLoad] = await Promise.all([
    Subject.aggregate([
      { $match: { faculty: { $in: facultyIds } } },
      { $group: { _id: '$faculty', subjectsHandled: { $sum: 1 }, totalCredits: { $sum: '$credits' } } },
    ]),
    ResearchPaper.aggregate([
      {
        $match: {
          faculty: { $in: facultyIds },
          ...(researchStartYear ? { year: researchStartYear } : {}),
        },
      },
      { $group: { _id: '$faculty', researchPapers: { $sum: 1 }, citations: { $sum: '$citations' } } },
    ]),
  ]);

  const subjectMap = new Map(subjectLoad.map((item) => [String(item._id), item]));
  const researchMap = new Map(researchLoad.map((item) => [String(item._id), item]));

  const rows = faculty.map((member) => {
    const subjectStats = subjectMap.get(String(member._id)) || {};
    const researchStats = researchMap.get(String(member._id)) || {};
    const workloadScore = (subjectStats.subjectsHandled || 0) * 18 + (researchStats.researchPapers || 0) * 6 + Math.min(member.experience || 0, 12);

    return {
      id: member._id,
      name: member.name,
      email: member.email,
      department: member.department,
      designation: member.designation,
      experience: member.experience || 0,
      specialization: member.specialization,
      subjectsHandled: subjectStats.subjectsHandled || 0,
      totalCredits: subjectStats.totalCredits || 0,
      researchPapers: researchStats.researchPapers || 0,
      citations: researchStats.citations || 0,
      workloadScore,
      isActive: member.isActive,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      faculty: rows.length,
      activeFaculty: rows.filter((row) => row.isActive).length,
      avgSubjectsHandled: rows.length ? Number((rows.reduce((sum, row) => sum + row.subjectsHandled, 0) / rows.length).toFixed(1)) : 0,
      totalResearchPapers: rows.reduce((sum, row) => sum + row.researchPapers, 0),
    },
    rows,
  };
};

const logReport = async ({ type, format, generatedBy, department, filters, recordCount, status = 'generated' }) => Report.create({
  title: `${type.replace(/-/g, ' ')} report`,
  type,
  format,
  generatedBy,
  department: department || null,
  filters: filters || {},
  status,
  metadata: {
    recordCount: recordCount || 0,
    exportedAt: new Date(),
  },
});

const listReports = async () => Report.find()
  .populate('generatedBy', 'name email role')
  .populate('department', 'name code')
  .sort({ createdAt: -1 })
  .limit(12)
  .lean();

const streamFacultyWorkloadReport = async (res, reportData, format) => {
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="Faculty_Workload_Report_${Date.now()}.csv"`);

    const lines = [
      'Faculty Workload Report',
      `Generated At,${reportData.generatedAt}`,
      '',
      'Name,Department,Designation,Subjects Handled,Credits,Research Papers,Citations,Workload Score',
      ...reportData.rows.map((row) => [
        row.name,
        row.department?.name || 'N/A',
        row.designation || 'N/A',
        row.subjectsHandled,
        row.totalCredits,
        row.researchPapers,
        row.citations,
        row.workloadScore,
      ].map((value) => `"${String(value ?? '')}"`).join(',')),
    ];

    res.send(lines.join('\n'));
    return;
  }

  const BLUE_  = '#1e40af';
  const LIGHT_ = '#f8fafc';
  const DARK_  = '#1e293b';
  const GRAY_  = '#64748b';
  const BORDER_= '#e2e8f0';

  const getChartBuf = async (config) => {
    try {
      const url = `https://quickchart.io/chart?width=480&height=220&v=2.8.4&c=${encodeURIComponent(JSON.stringify(config))}`;
      const r = await fetch(url);
      if (!r.ok) return null;
      return Buffer.from(await r.arrayBuffer());
    } catch { return null; }
  };

  const { rows, summary, generatedAt } = reportData;
  const deptNames = [...new Set(rows.map(r => r.department?.code || r.department?.name || 'N/A'))];
  const deptWorkload = deptNames.map(d => rows.filter(r => (r.department?.code || r.department?.name || 'N/A') === d).reduce((s, r) => s + r.workloadScore, 0));
  const deptResearch = deptNames.map(d => rows.filter(r => (r.department?.code || r.department?.name || 'N/A') === d).reduce((s, r) => s + r.researchPapers, 0));

  const [barChart, lineChart] = await Promise.all([
    getChartBuf({
      type: 'bar',
      data: {
        labels: deptNames,
        datasets: [
          { label: 'Total Workload Score', data: deptWorkload, backgroundColor: '#3b82f6' },
          { label: 'Research Papers', data: deptResearch, backgroundColor: '#10b981' },
        ]
      },
      options: { plugins: { title: { display: true, text: 'Workload & Research by Department' } } }
    }),
    getChartBuf({
      type: 'bar',
      data: {
        labels: rows.slice(0, 12).map(r => (r.name || '').split(' ')[0]),
        datasets: [{ label: 'Workload Score', data: rows.slice(0, 12).map(r => r.workloadScore), backgroundColor: '#8b5cf6' }]
      },
      options: { indexAxis: 'y', plugins: { legend: { display: false }, title: { display: true, text: 'Top 12 Faculty by Workload Score' } } }
    }),
  ]);

  const doc = new PDFDocument({ margins: { top: 45, left: 48, right: 48, bottom: 20 }, size: 'A4', bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Faculty_Workload_Report_${Date.now()}.pdf"`);
  doc.pipe(res);

  // Header bar
  doc.rect(0, 0, 595, 842).fill(LIGHT_);
  doc.rect(0, 0, 595, 52).fill(BLUE_);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14)
    .text('Faculty Workload Report', 48, 17, { width: 500, align: 'left' });
  doc.fillColor('#bfdbfe').font('Helvetica').fontSize(8)
    .text(`Generated: ${new Date(generatedAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}   |   IQAC Monitoring System`, 48, 36);
  doc.y = 70;

  // KPI Cards
  const kpiItems = [
    { label: 'Total Faculty', value: summary.faculty },
    { label: 'Active Faculty', value: summary.activeFaculty },
    { label: 'Avg Subjects Handled', value: summary.avgSubjectsHandled },
    { label: 'Research Papers', value: summary.totalResearchPapers },
  ];
  const cardW = 118;
  let cx_ = 48;
  kpiItems.forEach(({ label, value }) => {
    doc.rect(cx_, 70, cardW, 46).fillAndStroke('#ffffff', BORDER_);
    doc.fillColor(BLUE_).font('Helvetica-Bold').fontSize(16).text(String(value), cx_ + 6, 78, { width: cardW - 12, align: 'center' });
    doc.fillColor(GRAY_).font('Helvetica').fontSize(7).text(label, cx_ + 4, 96, { width: cardW - 8, align: 'center' });
    cx_ += cardW + 8;
  });
  doc.y = 128;

  // Charts
  const drawSection = (title) => {
    if (doc.y > 680) doc.addPage(); else doc.moveDown(0.8);
    doc.rect(48, doc.y, 499, 18).fill('#eff6ff');
    doc.fillColor(BLUE_).font('Helvetica-Bold').fontSize(10).text(title, 55, doc.y + 4, { width: 480 });
    doc.moveDown(1.2);
  };

  drawSection('Department Analytics');
  if (barChart || lineChart) {
    const sy = doc.y;
    if (barChart) doc.image(barChart, 48, sy, { width: 237 });
    if (lineChart) doc.image(lineChart, 310, sy, { width: 237 });
    doc.y = sy + 175;
  }

  // Faculty Table
  drawSection('Faculty Detail Table');
  const colDefs = [115, 65, 80, 52, 45, 55, 40, 45];
  const hds = ['Name', 'Dept', 'Designation', 'Subjects', 'Credits', 'Research', 'Cites', 'Score'];
  const rowH = 20;
  const totalW_ = colDefs.reduce((a, b) => a + b, 0);
  let y_ = doc.y;

  const drawHeader_ = (y) => {
    doc.rect(48, y, totalW_, rowH).fill('#dbeafe');
    let x_ = 48;
    hds.forEach((h, i) => {
      doc.fillColor(BLUE_).font('Helvetica-Bold').fontSize(8).text(h, x_ + 4, y + 6, { width: colDefs[i] - 8, lineBreak: false });
      x_ += colDefs[i];
    });
  };

  drawHeader_(y_);
  y_ += rowH;

  rows.forEach((row, idx) => {
    if (y_ + rowH > 760) {
      doc.addPage();
      y_ = 50;
      drawHeader_(y_);
      y_ += rowH;
    }
    if (idx % 2 === 1) doc.rect(48, y_, totalW_, rowH).fill('#f1f5f9');
    const cells = [
      row.name, row.department?.code || row.department?.name || 'N/A',
      row.designation || 'N/A', row.subjectsHandled,
      row.totalCredits, row.researchPapers, row.citations, row.workloadScore,
    ];
    let rx_ = 48;
    cells.forEach((cell, i) => {
      doc.fillColor(DARK_).font('Helvetica').fontSize(8).text(String(cell ?? '—'), rx_ + 4, y_ + 6, { width: colDefs[i] - 8, lineBreak: false });
      rx_ += colDefs[i];
    });
    doc.moveTo(48, y_ + rowH).lineTo(48 + totalW_, y_ + rowH).strokeColor(BORDER_).lineWidth(0.5).stroke();
    y_ += rowH;
  });
  doc.y = y_ + 8;

  // Footer
  const range_ = doc.bufferedPageRange();
  for (let i = range_.start; i < range_.start + range_.count; i++) {
    doc.switchToPage(i);
    doc.fillColor(GRAY_).font('Helvetica').fontSize(7)
      .text(`Page ${i - range_.start + 1} of ${range_.count}   |   IQAC Monitoring System — Faculty Workload Report`, 48, 822, { width: 499, align: 'center' });
  }
  doc.flushPages();
  doc.end();
};

const getAnalyticsSnapshot = async (filters = {}) => {
  const academicYear = normalizeAcademicYearFilter(filters);
  const semester = filters.semester ? parseInt(filters.semester, 10) : undefined;
  const departmentId = filters.department || filters.departmentId;

  const analyticsFilters = {
    ...(departmentId ? { departmentId } : {}),
    ...(academicYear ? { academicYear } : {}),
    ...(Number.isFinite(semester) ? { semester } : {}),
  };

  const studentMatchFilter = {
    isActive: true,
    ...(departmentId ? { department: toObjectId(departmentId) || departmentId } : {}),
  };

  const departmentFilter = departmentId
    ? { _id: toObjectId(departmentId) || departmentId, isActive: true }
    : { isActive: true };

  const [
    totalUsers,
    activeUsers,
    totalStudents,
    atRiskStudents,
    avgCgpaResult,
    avgAttendanceResult,
    totalFaculty,
    activeFaculty,
    avgExperienceResult,
    totalDepartments,
    departmentsWithHod,
    totalDocuments,
    pendingDocuments,
    approvedDocuments,
    totalReports,
    reportsThisMonth,
    roleDistribution,
    departmentRanking,
    recentReports,
    disabledAccounts,
    totalResearchPapers,
    passByDepartment,
    cgpaTrendBySemester,
    backlogByDepartment,
    departmentStudentStats,
    activeDepartmentList,
    recentStudents,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    Student.countDocuments({ isActive: true }),
    Student.countDocuments({ performanceCategory: 'At Risk', isActive: true }),
    Student.aggregate([{ $group: { _id: null, avgCgpa: { $avg: '$cgpa' } } }]),
    Attendance.aggregate([{ $group: { _id: null, avgAttendance: { $avg: '$percentage' } } }]),
    Faculty.countDocuments({ isActive: true }),
    Faculty.countDocuments({ isActive: true }),
    Faculty.aggregate([{ $group: { _id: null, avgExperience: { $avg: '$experience' } } }]),
    Department.countDocuments({ isActive: true }),
    Department.countDocuments({ hod: { $ne: null }, isActive: true }),
    Document.countDocuments({ isActive: true }),
    Document.countDocuments({ isActive: true, status: 'Pending Approval' }),
    Document.countDocuments({ isActive: true, status: 'Approved' }),
    Report.countDocuments(),
    Report.countDocuments({ createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }),
    User.aggregate([
      { $group: { _id: '$role', total: { $sum: 1 }, active: { $sum: { $cond: ['$isActive', 1, 0] } } } },
      { $sort: { total: -1 } },
    ]),
    analyticsService.getDepartmentRanking(analyticsFilters),
    listReports(),
    User.countDocuments({ isActive: false }),
    ResearchPaper.countDocuments(),
    analyticsService.getPassPercentageByDept(analyticsFilters),
    analyticsService.getCGPATrend(analyticsFilters),
    analyticsService.getBacklogAnalysis(analyticsFilters),
    Student.aggregate([
      { $match: studentMatchFilter },
      {
        $group: {
          _id: '$department',
          studentCount: { $sum: 1 },
          avgCgpa: { $avg: '$cgpa' },
          avgAttendance: { $avg: '$academicRecords.avgAttendance' },
          atRiskStudents: { $sum: { $cond: ['$isAtRisk', 1, 0] } },
          studentsWithoutBacklogs: {
            $sum: {
              $cond: [{ $eq: ['$currentBacklogs', 0] }, 1, 0],
            },
          },
          totalBacklogs: { $sum: '$currentBacklogs' },
        },
      },
    ]),
    Department.find(departmentFilter).select('name code totalSeats').sort({ name: 1 }).lean(),
    Student.find(studentMatchFilter)
      .populate('department', 'name code')
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(6)
      .lean(),
  ]);

  const totalPassEntries = passByDepartment.reduce((sum, item) => sum + (item.totalEntries || 0), 0);
  const totalPassCount = passByDepartment.reduce((sum, item) => sum + (item.passCount || 0), 0);
  const passPercentage = totalPassEntries
    ? Number(((totalPassCount / totalPassEntries) * 100).toFixed(2))
    : 0;

  let cgpaTrend = cgpaTrendBySemester.map((entry) => ({
    semester: entry._id,
    label: `Sem ${entry._id}`,
    avgCGPA: Number((entry.avgCGPA || 0).toFixed(2)),
    avgMarks: Number((entry.avgMarks || 0).toFixed(2)),
    studentCount: entry.studentCount || 0,
  }));

  if (!cgpaTrend.length) {
    const fallbackCgpaTrend = await Student.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$academicRecords.semesterCgpa' },
      {
        $group: {
          _id: '$academicRecords.semesterCgpa.semester',
          avgCGPA: { $avg: '$academicRecords.semesterCgpa.cgpa' },
          studentCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    cgpaTrend = fallbackCgpaTrend.map((entry) => ({
      semester: entry._id,
      label: `Sem ${entry._id}`,
      avgCGPA: Number((entry.avgCGPA || 0).toFixed(2)),
      avgMarks: 0,
      studentCount: entry.studentCount || 0,
    }));
  }

  const rankingMap = new Map(
    departmentRanking.map((item) => [String(item.deptId), item])
  );
  const backlogMap = new Map(
    backlogByDepartment.map((item) => [String(item._id), item])
  );
  const departmentStudentMap = new Map(
    departmentStudentStats.map((item) => [String(item._id), item])
  );

  const departmentSummaries = activeDepartmentList
    .map((department) => {
      const key = String(department._id);
      const ranking = rankingMap.get(key) || {};
      const studentStats = departmentStudentMap.get(key) || {};
      const backlogStats = backlogMap.get(key) || {};
      const studentCount = studentStats.studentCount || 0;

      const fallbackPassPercentage = studentCount
        ? Number((((studentStats.studentsWithoutBacklogs || 0) / studentCount) * 100).toFixed(2))
        : 0;

      return {
        id: department._id,
        name: department.name,
        code: department.code,
        totalSeats: department.totalSeats || 0,
        studentCount,
        passPercentage: ranking.passPercentage || fallbackPassPercentage,
        avgCgpa: Number((studentStats.avgCgpa || 0).toFixed(2)),
        avgAttendance: Number((ranking.avgAttendance || studentStats.avgAttendance || 0).toFixed(2)),
        atRiskStudents: studentStats.atRiskStudents || 0,
        studentsWithBacklogs:
          backlogStats.studentsWithBacklogs ||
          Math.max(studentCount - (studentStats.studentsWithoutBacklogs || 0), 0),
        backlogPercentage: Number(
          (
            backlogStats.backlogPercentage ||
            (studentCount
              ? ((Math.max(studentCount - (studentStats.studentsWithoutBacklogs || 0), 0) / studentCount) * 100)
              : 0)
          ).toFixed(2)
        ),
        totalBacklogs: backlogStats.totalBacklogs || studentStats.totalBacklogs || 0,
        placementPercentage: ranking.placementPercentage || 0,
        researchPapers: ranking.researchPapers || 0,
        score: ranking.score || 0,
        rank: ranking.rank || null,
      };
    })
    .sort((left, right) => {
      if (right.passPercentage !== left.passPercentage) {
        return right.passPercentage - left.passPercentage;
      }

      return right.avgCgpa - left.avgCgpa;
    });

  const recentStudentPerformance = recentStudents.map((student) => ({
    id: student._id,
    name: student.name,
    rollNumber: student.rollNumber,
    department: student.department,
    currentSemester: student.currentSemester,
    cgpa: student.cgpa || 0,
    avgAttendance: student.academicRecords?.avgAttendance || 0,
    currentBacklogs: student.currentBacklogs || 0,
    performanceCategory: student.performanceCategory || 'Average',
    updatedAt: student.updatedAt,
  }));

  return {
    generatedAt: new Date().toISOString(),
    overview: {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      totalStudents,
      totalFaculty,
      totalDepartments,
      totalDocuments,
      totalReports,
    },
    studentStats: {
      totalStudents,
      atRiskStudents,
      avgCgpa: Number((avgCgpaResult[0]?.avgCgpa || 0).toFixed(2)),
      avgAttendance: Math.round(avgAttendanceResult[0]?.avgAttendance || 0),
      healthyRate: totalStudents ? Math.round(((totalStudents - atRiskStudents) / totalStudents) * 100) : 0,
      passPercentage,
      cgpaTrend,
    },
    facultyStats: {
      totalFaculty,
      activeFaculty,
      avgExperience: Number((avgExperienceResult[0]?.avgExperience || 0).toFixed(1)),
      totalResearchPapers,
      activationRate: totalFaculty ? Math.round((activeFaculty / totalFaculty) * 100) : 0,
    },
    departmentMetrics: {
      totalDepartments,
      departmentsWithHod,
      coverageRate: totalDepartments ? Math.round((departmentsWithHod / totalDepartments) * 100) : 0,
      topDepartments: departmentRanking.slice(0, 4),
      summaries: departmentSummaries,
    },
    systemUsage: {
      totalDocuments,
      pendingDocuments,
      approvedDocuments,
      totalReports,
      reportsThisMonth,
      disabledAccounts,
    },
    roleDistribution,
    recentReports,
    recentStudentPerformance,
  };
};

module.exports = {
  buildBacklogReport,
  buildDepartmentDetail,
  buildDepartmentReport,
  buildFacultyWorkloadReport,
  buildStudentPerformanceReport,
  createManagedUser,
  disableManagedUser,
  getAnalyticsSnapshot,
  getUserProfile,
  listDepartments,
  listDocuments,
  listFaculty,
  listReports,
  listStudents,
  listUsers,
  logReport,
  streamFacultyWorkloadReport,
  updateDepartmentRecord,
  updateFacultyRecord,
  updateManagedUser,
  updateStudentRecord,
  uploadDocument,
  reportService,
};


