const { Event, Participation } = require("../models/Event");
const Student = require("../models/Student");
const { createNotification } = require("../services/notification.service");

const ACTIVE_STUDENT_STATUS = "active";
const GRADUATED_STUDENT_STATUS = "graduated";
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

const readDepartmentId = (value) => value?._id?.toString?.() || value?.toString?.() || "";

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const normalizeStartOfDay = (value) => {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  date.setHours(0, 0, 0, 0);
  return date;
};

const normalizeEndOfDay = (value) => {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  date.setHours(23, 59, 59, 999);
  return date;
};

const buildAttendanceSession = (startDate, endDate, existingSession = {}) => ({
  autoCreated: existingSession.autoCreated ?? true,
  isActive: existingSession.isActive ?? true,
  opensAt: existingSession.opensAt || normalizeStartOfDay(startDate),
  closesAt: existingSession.closesAt || normalizeEndOfDay(endDate),
  markedCount: existingSession.markedCount || 0,
});

const isWithinAttendanceWindow = (event, referenceDate = new Date()) => {
  const opensAt = new Date(event?.attendanceSession?.opensAt || event?.startDate || 0);
  const closesAt = new Date(event?.attendanceSession?.closesAt || event?.endDate || 0);

  if (event?.attendanceSession?.isActive === false) {
    return false;
  }

  return opensAt <= referenceDate && closesAt >= referenceDate;
};

const syncEventAttendanceCount = async (eventId) => {
  const markedCount = await Participation.countDocuments({
    event: eventId,
    attended: true,
  });

  await Event.findByIdAndUpdate(eventId, {
    $set: { "attendanceSession.markedCount": markedCount },
  });

  return markedCount;
};

const notifyStudentsForEvent = async (event, creatorId) => {
  const departments =
    event.departmentScope === "ALL"
      ? []
      : [event.department?._id || event.department].filter(Boolean);

  await createNotification({
    title: `New event published: ${event.title}`,
    message:
      event.departmentScope === "ALL"
        ? `${event.title} is now open for all departments. Register from your student participation workspace.`
        : `${event.title} is now open for eligible students in your department. Register from your student participation workspace.`,
    type: "event",
    roles: ["student"],
    departments,
    studentStatuses: [ACTIVE_STUDENT_STATUS],
    route: "/student-dashboard/participation",
    eventId: event._id,
    createdBy: creatorId,
    metadata: {
      eventType: event.type,
      eventLevel: event.level,
      eventScope: event.departmentScope,
    },
  });
};

const normalizeDepartmentScope = (value, departmentValue) => {
  if (String(value || "").toUpperCase() === "ALL" || String(departmentValue || "").toUpperCase() === "ALL") {
    return "ALL";
  }

  return "DEPARTMENT";
};

const parseDepartmentFilter = (value) => {
  if (!value) {
    return null;
  }

  return String(value).toUpperCase() === "ALL"
    ? { departmentScope: "ALL" }
    : { departmentScope: "DEPARTMENT", department: value };
};

const buildEventSearchFilter = (search) => {
  if (!search?.trim()) {
    return null;
  }

  const expression = new RegExp(search.trim(), "i");
  return {
    $or: [
      { title: expression },
      { description: expression },
      { organizingBody: expression },
      { location: expression },
    ],
  };
};

const getStudentForUser = async (user) => {
  let student = await Student.findOne({ user: user._id })
    .populate("department", "name code");

  if (!student) {
    student = await Student.findOne({ email: user.email })
      .populate("department", "name code");

    if (student && !student.user) {
      student.user = user._id;
      await student.save();
    }
  }

  return student;
};

const formatEventResponse = (event) => {
  const eventData = event.toObject ? event.toObject() : { ...event };
  const isAllDepartments = eventData.departmentScope === "ALL";

  return {
    ...eventData,
    department: isAllDepartments ? null : eventData.department || null,
    departmentLabel: isAllDepartments
      ? "All Departments"
      : eventData.department?.name || eventData.department?.code || "Department",
    audienceLabel: isAllDepartments
      ? "All Departments"
      : eventData.department?.code || eventData.department?.name || "Department Event",
    attendanceSession: {
      autoCreated: eventData.attendanceSession?.autoCreated ?? true,
      isActive: eventData.attendanceSession?.isActive ?? true,
      opensAt: eventData.attendanceSession?.opensAt || eventData.startDate,
      closesAt: eventData.attendanceSession?.closesAt || eventData.endDate,
      markedCount: eventData.attendanceSession?.markedCount || 0,
      canMarkNow: isWithinAttendanceWindow(eventData),
    },
  };
};

const ensureEventWindowIsValid = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return null;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Invalid event dates supplied.";
  }

  if (end < start) {
    return "End date cannot be earlier than start date.";
  }

  return null;
};

const ensureHodCanAccessEvent = (event, hodDepartment) => {
  if (!event) {
    return false;
  }

  if (event.departmentScope === "ALL") {
    return true;
  }

  return readDepartmentId(event.department) === readDepartmentId(hodDepartment);
};

const ensureHodCanManageEvent = (event, hodDepartment) =>
  Boolean(event) &&
  event.departmentScope !== "ALL" &&
  readDepartmentId(event.department) === readDepartmentId(hodDepartment);

const ensureStudentCanRegisterForEvent = (event, student) => {
  if (!event?.isActive) {
    return "This event is not currently active.";
  }

  if (new Date(event.endDate) < startOfToday()) {
    return "This event is no longer open for registration.";
  }

  if (event.departmentScope !== "ALL") {
    const eventDepartmentId = readDepartmentId(event.department);
    const studentDepartmentId = readDepartmentId(student.department);

    if (!eventDepartmentId || eventDepartmentId !== studentDepartmentId) {
      return "This event is not available for your department.";
    }
  }

  return null;
};

// ============================
// Get Events
// ============================
const getEvents = async (req, res) => {

  try {

    const {
      search,
      department,
      type,
      level,
      status,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = { isActive: true };
    const today = startOfToday();
    const searchFilter = buildEventSearchFilter(search);
    const andConditions = [];

    if (searchFilter) {
      andConditions.push(searchFilter);
    }

    if (req.user.role === "hod") {
      andConditions.push({
        $or: [
        { departmentScope: "ALL" },
        {
          departmentScope: "DEPARTMENT",
          department: req.user.department,
        },
      ],
      });
    } else if (req.user.role === "student") {
      const student = await getStudentForUser(req.user);

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student record not found",
        });
      }

      filter.endDate = { $gte: today };
      andConditions.push({
        $or: [
          { departmentScope: "ALL" },
          {
            departmentScope: "DEPARTMENT",
            department: student.department?._id || student.department,
          },
        ],
      });

      if (status === "ongoing") {
        filter.startDate = { $lte: today };
      } else if (status === "upcoming") {
        filter.startDate = { $gt: today };
      }
    } else if (department) {
      andConditions.push(parseDepartmentFilter(department));
    }

    if (type) filter.type = type;
    if (level) filter.level = level;

    if (andConditions.length) {
      filter.$and = andConditions;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const total = await Event.countDocuments(filter);

    const events = await Event.find(filter)
      .populate("department", "name code")
      .sort(req.user.role === "student" ? { startDate: 1, endDate: 1 } : { startDate: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      success: true,
      data: events.map(formatEventResponse),
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Create Event
// ============================
const createEvent = async (req, res) => {

  try {

    const departmentScope = normalizeDepartmentScope(req.body.departmentScope, req.body.department);
    const invalidDateMessage = ensureEventWindowIsValid(req.body.startDate, req.body.endDate);

    if (invalidDateMessage) {
      return res.status(400).json({
        success: false,
        message: invalidDateMessage,
      });
    }

    if (req.user.role === "hod") {
      req.body.department = req.user.department;
      req.body.departmentScope = "DEPARTMENT";
    } else {
      req.body.departmentScope = departmentScope;

      if (departmentScope === "ALL") {
        req.body.department = undefined;
      }
    }

    const event = await Event.create({
      ...req.body,
      attendanceSession: buildAttendanceSession(req.body.startDate, req.body.endDate),
      uploadedBy: req.user._id
    });

    await event.populate("department", "name code");
    await notifyStudentsForEvent(event, req.user._id);

    res.status(201).json({
      success: true,
      data: formatEventResponse(event)
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.code === 11000
        ? "Student already participating in this event"
        : error.message
    });

  }

};


// ============================
// Update Event
// ============================
const updateEvent = async (req, res) => {

  try {

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    if (
      req.user.role === "hod" &&
      !ensureHodCanManageEvent(event, req.user.department)
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const departmentScope = req.user.role === "hod"
      ? "DEPARTMENT"
      : normalizeDepartmentScope(req.body.departmentScope ?? event.departmentScope, req.body.department);
    const invalidDateMessage = ensureEventWindowIsValid(
      req.body.startDate ?? event.startDate,
      req.body.endDate ?? event.endDate
    );

    if (invalidDateMessage) {
      return res.status(400).json({
        success: false,
        message: invalidDateMessage,
      });
    }

    Object.assign(event, req.body, {
      departmentScope,
      department:
        departmentScope === "ALL"
          ? undefined
          : (req.user.role === "hod" ? req.user.department : req.body.department ?? event.department),
      attendanceSession: buildAttendanceSession(
        req.body.startDate ?? event.startDate,
        req.body.endDate ?? event.endDate,
        event.attendanceSession || {}
      ),
    });

    await event.save();

    await event.populate("department", "name code");

    res.json({
      success: true,
      data: formatEventResponse(event)
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Get Event Participations
// ============================
const getEventParticipations = async (req, res) => {

  try {

    const { search, department, page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const event = await Event.findById(req.params.id).populate("department", "name code");

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (req.user.role === "hod" && !ensureHodCanAccessEvent(event, req.user.department)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const studentFilter = {};

    if (department && String(department).toUpperCase() !== "ALL") {
      studentFilter.department = department;
    }

    if (search?.trim()) {
      const expression = new RegExp(search.trim(), "i");
      studentFilter.$or = [
        { name: expression },
        { email: expression },
        { rollNumber: expression },
      ];
    }

    const overallTotal = await Participation.countDocuments({ event: req.params.id });
    const overallMarkedAttendance = await Participation.countDocuments({
      event: req.params.id,
      attended: true,
    });
    let matchingStudentIds = null;

    if (Object.keys(studentFilter).length > 0) {
      const students = await Student.find(studentFilter).select("_id");
      matchingStudentIds = students.map((student) => student._id);

      if (!matchingStudentIds.length) {
        return res.json({
          success: true,
          data: [],
          pagination: {
            total: 0,
            page: pageNum,
            pages: 0,
          },
          summary: {
            totalParticipants: overallTotal,
            filteredParticipants: 0,
            visibleParticipants: 0,
            markedAttendance: 0,
            pendingAttendance: Math.max(overallTotal - overallMarkedAttendance, 0),
            department: department || "",
          },
        });
      }
    }

    const participationFilter = {
      event: req.params.id,
      ...(matchingStudentIds ? { student: { $in: matchingStudentIds } } : {}),
    };

    const total = await Participation.countDocuments(participationFilter);
    const markedAttendanceCount = await Participation.countDocuments({
      ...participationFilter,
      attended: true,
    });

    const participations = await Participation.find(participationFilter)
      .populate({
        path: "student",
        populate: {
          path: "department",
          select: "name code"
        }
      })
      .sort({ registeredAt: -1, createdAt: -1, role: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      success: true,
      data: participations,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
      },
      summary: {
        totalParticipants: overallTotal,
        filteredParticipants: total,
        visibleParticipants: participations.length,
        markedAttendance: markedAttendanceCount,
        pendingAttendance: Math.max(total - markedAttendanceCount, 0),
        department: department || "",
        event: {
          _id: event._id,
          title: event.title,
          departmentLabel: event.departmentScope === "ALL"
            ? "All Departments"
            : event.department?.name || event.department?.code || "Department",
          attendanceWindow: {
            opensAt: event.attendanceSession?.opensAt || event.startDate,
            closesAt: event.attendanceSession?.closesAt || event.endDate,
            isActive: event.attendanceSession?.isActive !== false,
          },
        },
      }
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Add Participation
// ============================
const addParticipation = async (req, res) => {

  try {

    const event = await Event.findById(req.params.id).populate("department", "name code");

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    let studentId = req.body.studentId;

    // Student self participation
    if (req.user.role === "student") {

      const student = await getStudentForUser(req.user);

      if (!student) {
        return res.status(400).json({
          success: false,
          message: "Student record not found"
        });
      }

      if (resolveStudentStatus(student) === GRADUATED_STUDENT_STATUS) {
        return res.status(403).json({
          success: false,
          message: "Graduated student profiles are read-only.",
        });
      }

      const availabilityMessage = ensureStudentCanRegisterForEvent(event, student);

      if (availabilityMessage) {
        return res.status(403).json({
          success: false,
          message: availabilityMessage,
        });
      }

      studentId = student._id;
    }

    const existing = await Participation.findOne({
      student: studentId,
      event: req.params.id
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Student already participating in this event"
      });
    }

    const role = req.body.role || "Participant";
    const message = String(req.body.message || "").trim();

    const participation = await Participation.create({
      student: studentId,
      event: req.params.id,
      role,
      message,
      achievement: req.body.achievement,
      pointsEarned: getPointsForRole(role),
      registeredAt: new Date(),
      status: "Registered",
      attended: false,
      attendanceStatus: "Pending",
    });

    await participation.populate({
      path: "student",
      populate: {
        path: "department",
        select: "name code"
      }
    });

    res.status(201).json({
      success: true,
      data: participation
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Mark Event Attendance
// ============================
const markAttendance = async (req, res) => {

  try {

    const event = await Event.findById(req.params.id).populate("department", "name code");

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    const student = await getStudentForUser(req.user);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student record not found"
      });
    }

    if (resolveStudentStatus(student) === GRADUATED_STUDENT_STATUS) {
      return res.status(403).json({
        success: false,
        message: "Graduated student profiles are read-only.",
      });
    }

    if (!isWithinAttendanceWindow(event)) {
      return res.status(400).json({
        success: false,
        message: "Attendance can only be marked while the event attendance session is active.",
      });
    }

    const participation = await Participation.findOne({
      event: event._id,
      student: student._id,
    }).populate({
      path: "student",
      populate: {
        path: "department",
        select: "name code"
      }
    });

    if (!participation) {
      return res.status(404).json({
        success: false,
        message: "You need to register for this event before marking attendance.",
      });
    }

    if (!participation.attended) {
      participation.attended = true;
      participation.attendanceStatus = "Marked";
      participation.attendanceMarkedAt = new Date();
      if (participation.status !== "Cancelled") {
        participation.status = "Participated";
      }
      await participation.save();
    }

    const markedCount = await syncEventAttendanceCount(event._id);
    event.attendanceSession = buildAttendanceSession(
      event.startDate,
      event.endDate,
      {
        ...(event.attendanceSession?.toObject?.() || event.attendanceSession || {}),
        markedCount,
      }
    );

    res.json({
      success: true,
      data: {
        participation,
        event: formatEventResponse(event)
      }
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Update Participation
// ============================
const updateParticipation = async (req, res) => {

  try {

    const participation = await Participation.findById(req.params.id);

    if (!participation) {
      return res.status(404).json({
        success: false,
        message: "Participation not found"
      });
    }

    Object.assign(participation, req.body);

    if (req.body.role) {
      participation.pointsEarned = getPointsForRole(req.body.role);
    }

    if (req.body.attended === true || req.body.attendanceStatus === "Marked") {
      participation.attended = true;
      participation.attendanceStatus = "Marked";
      participation.attendanceMarkedAt = participation.attendanceMarkedAt || new Date();
      if (participation.status !== "Cancelled") {
        participation.status = "Participated";
      }
    }

    await participation.save();
    await syncEventAttendanceCount(participation.event);

    await participation.populate({
      path: "student",
      populate: {
        path: "department",
        select: "name code"
      }
    });

    res.json({
      success: true,
      data: participation
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Role Points System
// ============================
const getPointsForRole = (role) => {

  const normalized = role?.toLowerCase();

  const pointsMap = {
    winner: 10,
    "runner-up": 7,
    participant: 3,
    organizer: 5,
    volunteer: 2,
    coordinator: 8
  };

  return pointsMap[normalized] || 3;

};


module.exports = {
  getEvents,
  createEvent,
  updateEvent,
  getEventParticipations,
  addParticipation,
  markAttendance,
  updateParticipation
};
