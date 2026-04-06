const Notification = require('../models/Notification');

const createNotification = async ({
  title,
  message,
  type = 'system',
  roles = ['student'],
  departments = [],
  studentStatuses = [],
  minimumCgpa,
  maximumBacklogs,
  route = '',
  eventId,
  placementDriveId,
  metadata = {},
  createdBy,
}) =>
  Notification.create({
    title,
    message,
    type,
    audience: {
      roles,
      departments,
      studentStatuses,
      minimumCgpa,
      maximumBacklogs,
    },
    links: {
      route,
      event: eventId,
      placementDrive: placementDriveId,
    },
    metadata,
    createdBy,
  });

module.exports = {
  createNotification,
};
