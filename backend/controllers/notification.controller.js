const Notification = require('../models/Notification');
const Student = require('../models/Student');

const normalizeObjectId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString?.() || '';
};

const getStudentForUser = async (user) => {
  let student = await Student.findOne({ user: user._id }).select(
    'department cgpa currentBacklogs status batchYear currentSemester'
  );

  if (!student) {
    student = await Student.findOne({ email: user.email }).select(
      'department cgpa currentBacklogs status batchYear currentSemester'
    );
  }

  return student;
};

const matchesDepartmentScope = (notification, departmentId) => {
  const scopedDepartments = notification.audience?.departments || [];
  if (!scopedDepartments.length) {
    return true;
  }

  return scopedDepartments.some(
    (entry) => normalizeObjectId(entry) === normalizeObjectId(departmentId)
  );
};

const matchesStudentAudience = (notification, student) => {
  const audience = notification.audience || {};

  if (!student) {
    return false;
  }

  if (!matchesDepartmentScope(notification, student.department)) {
    return false;
  }

  if (audience.studentStatuses?.length && !audience.studentStatuses.includes(student.status)) {
    return false;
  }

  if (
    Number.isFinite(audience.minimumCgpa) &&
    Number(student.cgpa || 0) < Number(audience.minimumCgpa)
  ) {
    return false;
  }

  if (
    Number.isFinite(audience.maximumBacklogs) &&
    Number(student.currentBacklogs || 0) > Number(audience.maximumBacklogs)
  ) {
    return false;
  }

  return true;
};

const serializeNotification = (notification, userId) => {
  const notificationData = notification.toObject
    ? notification.toObject()
    : { ...notification };
  const isRead = (notificationData.readBy || []).some(
    (entry) => normalizeObjectId(entry) === normalizeObjectId(userId)
  );

  return {
    _id: notificationData._id,
    title: notificationData.title,
    message: notificationData.message,
    type: notificationData.type,
    route: notificationData.links?.route || '',
    links: notificationData.links || {},
    metadata: notificationData.metadata || {},
    createdAt: notificationData.createdAt,
    isRead,
  };
};

const listNotifications = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 12, 50);
    const role = req.user.role;
    const unreadOnly = req.query.unreadOnly === 'true';
    const roleFilter = {
      isActive: true,
      'audience.roles': role,
    };

    const notifications = await Notification.find(roleFilter)
      .sort({ createdAt: -1 })
      .limit(limit * 3);

    let student = null;
    if (role === 'student') {
      student = await getStudentForUser(req.user);
    }

    const visibleNotifications = notifications
      .filter((notification) => {
        if (role === 'student') {
          return matchesStudentAudience(notification, student);
        }

        return matchesDepartmentScope(notification, req.user.department);
      })
      .map((notification) => serializeNotification(notification, req.user._id));

    const filteredNotifications = unreadOnly
      ? visibleNotifications.filter((notification) => !notification.isRead)
      : visibleNotifications;

    const unreadCount = visibleNotifications.filter((notification) => !notification.isRead).length;

    res.json({
      success: true,
      data: {
        notifications: filteredNotifications.slice(0, limit),
        unreadCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Unable to load notifications.',
    });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification || !notification.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.',
      });
    }

    const userId = normalizeObjectId(req.user._id);
    const alreadyRead = (notification.readBy || []).some(
      (entry) => normalizeObjectId(entry) === userId
    );

    if (!alreadyRead) {
      notification.readBy.push(req.user._id);
      await notification.save();
    }

    res.json({
      success: true,
      data: serializeNotification(notification, req.user._id),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Unable to update notification status.',
    });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const roleFilter = {
      isActive: true,
      'audience.roles': req.user.role,
      readBy: { $ne: req.user._id },
    };

    const notifications = await Notification.find(roleFilter).select('_id');
    const notificationIds = notifications.map((notification) => notification._id);

    if (notificationIds.length) {
      await Notification.updateMany(
        { _id: { $in: notificationIds } },
        { $addToSet: { readBy: req.user._id } }
      );
    }

    res.json({
      success: true,
      data: {
        updated: notificationIds.length,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Unable to mark notifications as read.',
    });
  }
};

module.exports = {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
