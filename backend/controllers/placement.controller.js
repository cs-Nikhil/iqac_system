const Placement = require('../models/Placement');
const PlacementDrive = require('../models/PlacementDrive');
const PlacementApplication = require('../models/PlacementApplication');
const Student = require('../models/Student');
const { createNotification } = require('../services/notification.service');

const roundTo = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));

const normalizeObjectId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  if (value.id) return value.id.toString();

  const stringValue = value.toString?.();
  return stringValue && stringValue !== '[object Object]' ? stringValue : null;
};

const normalizeDepartmentIds = (value) => {
  if (!value) return [];

  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',').map((entry) => entry.trim()).filter(Boolean)
      : [value];

  return [...new Set(rawValues.map((entry) => normalizeObjectId(entry)).filter(Boolean))];
};

const toBoolean = (value, fallback = true) => {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  return Boolean(value);
};

const resolvePlacementDriveStatus = ({ status, deadline, driveDate }, referenceDate = new Date()) => {
  if (String(status || '') === 'Closed') {
    return 'Closed';
  }

  const deadlineDate = new Date(deadline || 0);
  const driveDateValue = new Date(driveDate || 0);

  if (!Number.isNaN(deadlineDate.getTime()) && deadlineDate < referenceDate) {
    return 'Closed';
  }

  if (!Number.isNaN(driveDateValue.getTime()) && driveDateValue > referenceDate) {
    return 'Upcoming';
  }

  return 'Open';
};

const getPlacementDepartmentScope = (req) => {
  if (req.user?.role === 'hod' || req.user?.role === 'faculty') {
    return normalizeObjectId(req.user.department);
  }

  return normalizeObjectId(req.query.department);
};

const getPlacementDriveDepartmentScope = (req) => {
  if (req.user?.role === 'hod') {
    return normalizeObjectId(req.user.department);
  }

  return normalizeObjectId(req.query.department);
};

const getDepartmentStudentIds = async (departmentId) => {
  if (!departmentId) return null;

  const studentIds = await Student.distinct('_id', {
    department: departmentId,
    isActive: true,
  });

  return studentIds;
};

const buildEligibleStudentFilter = (drive) => {
  const departmentIds = normalizeDepartmentIds(drive.departments);
  const filter = {
    isActive: true,
    status: 'active',
    cgpa: { $gte: Number(drive.minCgpa || 0) },
    currentBacklogs: { $lte: Number(drive.maxBacklogs ?? 0) },
  };

  if (departmentIds.length) {
    filter.department = { $in: departmentIds };
  }

  return filter;
};

const ensureHodCanManageDrive = (drive, hodDepartmentId) => {
  const driveDepartments = normalizeDepartmentIds(drive?.departments);

  return (
    Boolean(hodDepartmentId) &&
    driveDepartments.length === 1 &&
    driveDepartments[0] === hodDepartmentId
  );
};

const buildPlacementDrivePayload = (req, currentDrive = null) => {
  const payload = req.body || {};
  const hodDepartmentId = req.user.role === 'hod' ? normalizeObjectId(req.user.department) : null;
  const driveDate = new Date(payload.driveDate ?? currentDrive?.driveDate);
  const deadline = new Date(payload.deadline ?? currentDrive?.deadline);
  const departments = hodDepartmentId
    ? [hodDepartmentId]
    : normalizeDepartmentIds(payload.departments ?? currentDrive?.departments);

  return {
    company: String(payload.company ?? currentDrive?.company ?? '').trim(),
    role: String(payload.role ?? currentDrive?.role ?? '').trim(),
    package: Number(payload.package ?? currentDrive?.package ?? 0),
    location: String(payload.location ?? currentDrive?.location ?? '').trim(),
    description: String(payload.description ?? currentDrive?.description ?? '').trim(),
    academicYear: String(payload.academicYear ?? currentDrive?.academicYear ?? '').trim(),
    departments,
    minCgpa: Number(payload.minCgpa ?? currentDrive?.minCgpa ?? 0),
    maxBacklogs: Number(payload.maxBacklogs ?? currentDrive?.maxBacklogs ?? 0),
    deadline,
    driveDate,
    status: resolvePlacementDriveStatus({
      status: payload.status ?? currentDrive?.status,
      deadline,
      driveDate,
    }),
    isActive: toBoolean(payload.isActive, currentDrive?.isActive ?? true),
    createdBy: currentDrive?.createdBy || req.user._id,
  };
};

const refreshPlacementDriveStatuses = async () => {
  const now = new Date();

  await PlacementDrive.updateMany(
    {
      isActive: true,
      status: { $ne: 'Closed' },
      deadline: { $lt: now },
    },
    { $set: { status: 'Closed' } }
  );

  await PlacementDrive.updateMany(
    {
      isActive: true,
      status: { $ne: 'Closed' },
      deadline: { $gte: now },
      driveDate: { $gt: now },
    },
    { $set: { status: 'Upcoming' } }
  );

  await PlacementDrive.updateMany(
    {
      isActive: true,
      status: { $ne: 'Closed' },
      deadline: { $gte: now },
      driveDate: { $lte: now },
    },
    { $set: { status: 'Open' } }
  );
};

const enrichPlacementDrives = async (drives = []) => {
  if (!drives.length) {
    return [];
  }

  const driveIds = drives.map((drive) => drive._id);
  const applicationStats = await PlacementApplication.aggregate([
    {
      $match: {
        drive: { $in: driveIds },
      },
    },
    {
      $group: {
        _id: '$drive',
        applications: { $sum: 1 },
        shortlisted: {
          $sum: {
            $cond: [
              { $in: ['$applicationStatus', ['Shortlisted', 'Interview Scheduled', 'Selected']] },
              1,
              0,
            ],
          },
        },
        selected: {
          $sum: {
            $cond: [{ $eq: ['$applicationStatus', 'Selected'] }, 1, 0],
          },
        },
      },
    },
  ]);

  const applicationMap = new Map(
    applicationStats.map((entry) => [normalizeObjectId(entry._id), entry])
  );

  const eligibleCounts = await Promise.all(
    drives.map((drive) => Student.countDocuments(buildEligibleStudentFilter(drive)))
  );

  return drives.map((drive, index) => {
    const driveData = drive.toObject ? drive.toObject() : { ...drive };
    const applicationSummary =
      applicationMap.get(normalizeObjectId(driveData._id)) || {};

    return {
      ...driveData,
      status: resolvePlacementDriveStatus(driveData),
      departments: driveData.departments || [],
      insights: {
        eligibleStudents: eligibleCounts[index] || 0,
        applications: applicationSummary.applications || 0,
        shortlisted: applicationSummary.shortlisted || 0,
        selected: applicationSummary.selected || 0,
      },
    };
  });
};

const notifyStudentsForPlacementDrive = async (drive, creatorId) => {
  await createNotification({
    title: `${drive.company} hiring for ${drive.role}`,
    message: `${drive.company} has opened a placement drive. Check eligibility and apply before ${new Date(drive.deadline).toLocaleDateString('en-IN')}.`,
    type: 'placement',
    roles: ['student'],
    departments: normalizeDepartmentIds(drive.departments),
    studentStatuses: ['active'],
    minimumCgpa: Number(drive.minCgpa || 0),
    maximumBacklogs: Number(drive.maxBacklogs ?? 0),
    route: '/student-dashboard/placements',
    placementDriveId: drive._id,
    createdBy: creatorId,
    metadata: {
      company: drive.company,
      role: drive.role,
      academicYear: drive.academicYear,
      package: roundTo(drive.package, 2),
    },
  });
};

// @desc    Get all placements
// @route   GET /api/placements
// @access  Private
const getPlacements = async (req, res) => {
  try {
    const { academicYear, company, page = 1, limit = 20 } = req.query;
    const filter = {};
    const departmentId = getPlacementDepartmentScope(req);
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    if (academicYear) filter.academicYear = academicYear;
    if (company) filter.company = { $regex: company, $options: 'i' };

    const studentIds = departmentId ? await getDepartmentStudentIds(departmentId) : null;

    if (departmentId && !studentIds?.length) {
      return res.json({ success: true, total: 0, placements: [] });
    }

    if (studentIds) {
      filter.student = { $in: studentIds };
    }

    const placements = await Placement.find(filter)
      .populate({ path: 'student', populate: { path: 'department', select: 'name code' } })
      .sort({ placementDate: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await Placement.countDocuments(filter);

    res.json({ success: true, total, placements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get placement drives
// @route   GET /api/placements/drives
// @access  Private/ADMIN/HOD
const getPlacementDrives = async (req, res) => {
  try {
    await refreshPlacementDriveStatuses();

    const { academicYear, company, status } = req.query;
    const departmentId = getPlacementDriveDepartmentScope(req);
    const filter = {
      isActive: req.query.includeInactive === 'true' ? { $in: [true, false] } : true,
    };

    if (academicYear) filter.academicYear = academicYear;
    if (company) filter.company = { $regex: company, $options: 'i' };
    if (status) filter.status = status;
    if (departmentId) filter.departments = departmentId;

    const drives = await PlacementDrive.find(filter)
      .populate('departments', 'name code')
      .populate('createdBy', 'name email')
      .sort({ driveDate: 1, deadline: 1, createdAt: -1 });

    const enrichedDrives = await enrichPlacementDrives(drives);
    const summary = enrichedDrives.reduce(
      (accumulator, drive) => {
        if (drive.status === 'Open') accumulator.open += 1;
        if (drive.status === 'Upcoming') accumulator.upcoming += 1;
        if (drive.status === 'Closed') accumulator.closed += 1;

        accumulator.applications += drive.insights?.applications || 0;
        accumulator.eligibleStudents += drive.insights?.eligibleStudents || 0;
        return accumulator;
      },
      {
        open: 0,
        upcoming: 0,
        closed: 0,
        applications: 0,
        eligibleStudents: 0,
      }
    );

    res.json({
      success: true,
      data: {
        drives: enrichedDrives,
        total: enrichedDrives.length,
        summary,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Unable to load placement drives.',
    });
  }
};

// @desc    Create placement drive
// @route   POST /api/placements/drives
// @access  Private/ADMIN/HOD
const createPlacementDrive = async (req, res) => {
  try {
    const drivePayload = buildPlacementDrivePayload(req);
    const drive = await PlacementDrive.create(drivePayload);
    await drive.populate('departments', 'name code');
    await drive.populate('createdBy', 'name email');

    if (drive.status !== 'Closed') {
      await notifyStudentsForPlacementDrive(drive, req.user._id);
    }

    const [enrichedDrive] = await enrichPlacementDrives([drive]);

    res.status(201).json({
      success: true,
      data: enrichedDrive,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Unable to create placement drive.',
    });
  }
};

// @desc    Update placement drive
// @route   PUT /api/placements/drives/:id
// @access  Private/ADMIN/HOD
const updatePlacementDrive = async (req, res) => {
  try {
    const drive = await PlacementDrive.findById(req.params.id);

    if (!drive) {
      return res.status(404).json({
        success: false,
        message: 'Placement drive not found.',
      });
    }

    if (
      req.user.role === 'hod' &&
      !ensureHodCanManageDrive(drive, normalizeObjectId(req.user.department))
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can manage placement drives only for your department.',
      });
    }

    Object.assign(drive, buildPlacementDrivePayload(req, drive));
    await drive.save();
    await drive.populate('departments', 'name code');
    await drive.populate('createdBy', 'name email');

    const [enrichedDrive] = await enrichPlacementDrives([drive]);

    res.json({
      success: true,
      data: enrichedDrive,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Unable to update placement drive.',
    });
  }
};

// @desc    Create placement record
// @route   POST /api/placements
// @access  Private/ADMIN/HOD
const createPlacement = async (req, res) => {
  try {
    if (req.user.role === 'hod') {
      const hodDepartmentId = normalizeObjectId(req.user.department);
      const student = await Student.findById(req.body.student).select('department');
      const studentDepartmentId = normalizeObjectId(student?.department);

      if (!student || !hodDepartmentId || studentDepartmentId !== hodDepartmentId) {
        return res.status(403).json({
          success: false,
          message: 'You can create placement records only for your department students.',
        });
      }
    }

    const placement = await Placement.create(req.body);
    await placement.populate({ path: 'student', populate: { path: 'department', select: 'name code' } });
    res.status(201).json({ success: true, placement });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get placement statistics
// @route   GET /api/placements/stats
// @access  Private
const getPlacementStats = async (req, res) => {
  try {
    const { academicYear, company } = req.query;
    const matchFilter = academicYear ? { academicYear } : {};
    const departmentId = getPlacementDepartmentScope(req);
    const studentIds = departmentId ? await getDepartmentStudentIds(departmentId) : null;

    if (company) {
      matchFilter.company = { $regex: company, $options: 'i' };
    }

    if (departmentId && !studentIds?.length) {
      return res.json({
        success: true,
        stats: { totalPlaced: 0, avgPackage: 0, maxPackage: 0, minPackage: 0, totalCompanies: 0 },
        topCompanies: [],
        trendByYear: [],
        packageDistribution: [],
        departmentRates: [],
        topPackages: [],
      });
    }

    if (studentIds) {
      matchFilter.student = { $in: studentIds };
    }

    const departmentStudentScope = departmentId
      ? { department: departmentId, isActive: true }
      : { isActive: true };

    const [
      stats,
      byCompany,
      byYear,
      packageDistribution,
      companyList,
      topPackages,
      placedByDepartment,
      totalStudentsByDepartment,
    ] = await Promise.all([
      Placement.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            totalPlaced: { $sum: 1 },
            avgPackage: { $avg: '$package' },
            maxPackage: { $max: '$package' },
            minPackage: { $min: '$package' },
          },
        },
      ]),
      Placement.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$company',
            count: { $sum: 1 },
            avgPackage: { $avg: '$package' },
            maxPackage: { $max: '$package' },
          },
        },
        { $sort: { count: -1, avgPackage: -1 } },
        { $limit: 8 },
      ]),
      Placement.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$academicYear',
            count: { $sum: 1 },
            avgPackage: { $avg: '$package' },
            maxPackage: { $max: '$package' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Placement.aggregate([
        { $match: matchFilter },
        {
          $project: {
            band: {
              $switch: {
                branches: [
                  { case: { $lt: ['$package', 5] }, then: '3-5 LPA' },
                  { case: { $lt: ['$package', 10] }, then: '5-10 LPA' },
                  { case: { $lt: ['$package', 20] }, then: '10-20 LPA' },
                ],
                default: '20+ LPA',
              },
            },
            order: {
              $switch: {
                branches: [
                  { case: { $lt: ['$package', 5] }, then: 1 },
                  { case: { $lt: ['$package', 10] }, then: 2 },
                  { case: { $lt: ['$package', 20] }, then: 3 },
                ],
                default: 4,
              },
            },
          },
        },
        {
          $group: {
            _id: '$band',
            count: { $sum: 1 },
            order: { $first: '$order' },
          },
        },
        { $sort: { order: 1 } },
      ]),
      Placement.distinct('company', matchFilter),
      Placement.find(matchFilter)
        .populate({ path: 'student', populate: { path: 'department', select: 'name code' } })
        .sort({ package: -1, placementDate: -1 })
        .limit(8)
        .lean(),
      Placement.aggregate([
        { $match: matchFilter },
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
          $group: {
            _id: '$studentData.department',
            placedCount: { $sum: 1 },
            avgPackage: { $avg: '$package' },
            maxPackage: { $max: '$package' },
          },
        },
        {
          $lookup: {
            from: 'departments',
            localField: '_id',
            foreignField: '_id',
            as: 'department',
          },
        },
        { $unwind: '$department' },
        {
          $project: {
            _id: 1,
            deptName: '$department.name',
            deptCode: '$department.code',
            placedCount: 1,
            avgPackage: 1,
            maxPackage: 1,
          },
        },
        { $sort: { placedCount: -1 } },
      ]),
      Student.aggregate([
        { $match: departmentStudentScope },
        {
          $group: {
            _id: '$department',
            totalStudents: { $sum: 1 },
          },
        },
      ]),
    ]);

    const studentCountMap = new Map(
      totalStudentsByDepartment.map((entry) => [entry._id.toString(), entry.totalStudents])
    );

    const departmentRates = placedByDepartment
      .map((entry) => {
        const totalStudents = studentCountMap.get(entry._id.toString()) || 0;

        return {
          _id: entry._id,
          deptName: entry.deptName,
          deptCode: entry.deptCode,
          placedCount: entry.placedCount,
          totalStudents,
          placementPercentage: totalStudents > 0
            ? Math.round((entry.placedCount / totalStudents) * 100)
            : 0,
          avgPackage: roundTo(entry.avgPackage, 2),
          maxPackage: roundTo(entry.maxPackage, 2),
        };
      })
      .sort((left, right) => right.placementPercentage - left.placementPercentage);

    res.json({
      success: true,
      stats: {
        totalPlaced: stats[0]?.totalPlaced || 0,
        avgPackage: roundTo(stats[0]?.avgPackage || 0, 2),
        maxPackage: roundTo(stats[0]?.maxPackage || 0, 2),
        minPackage: roundTo(stats[0]?.minPackage || 0, 2),
        totalCompanies: companyList.length,
      },
      topCompanies: byCompany.map((entry) => ({
        ...entry,
        avgPackage: roundTo(entry.avgPackage, 2),
        maxPackage: roundTo(entry.maxPackage, 2),
      })),
      trendByYear: byYear.map((entry) => ({
        ...entry,
        avgPackage: roundTo(entry.avgPackage, 2),
        maxPackage: roundTo(entry.maxPackage, 2),
      })),
      packageDistribution: packageDistribution.map((entry) => ({
        range: entry._id,
        count: entry.count,
      })),
      departmentRates,
      topPackages: topPackages.map((entry) => ({
        _id: entry._id,
        company: entry.company,
        role: entry.role,
        package: roundTo(entry.package, 2),
        academicYear: entry.academicYear,
        placementType: entry.placementType,
        student: {
          _id: entry.student?._id,
          name: entry.student?.name,
          department: entry.student?.department,
        },
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getPlacements,
  getPlacementDrives,
  createPlacementDrive,
  updatePlacementDrive,
  createPlacement,
  getPlacementStats,
};
