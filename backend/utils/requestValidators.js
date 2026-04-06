const isValidDate = (value) => {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp);
};

const validateEventPayload = (req) => {
  const errors = [];
  const { title, type, level, startDate, endDate, departmentScope, department } = req.body;
  const isPartialUpdate = req.method === 'PUT';

  if ((!isPartialUpdate || title !== undefined) && !String(title || '').trim()) {
    errors.push('Event title is required.');
  }

  if ((!isPartialUpdate || type !== undefined) && !String(type || '').trim()) {
    errors.push('Event type is required.');
  }

  if ((!isPartialUpdate || level !== undefined) && !String(level || '').trim()) {
    errors.push('Event level is required.');
  }

  if (
    (!isPartialUpdate || startDate !== undefined || endDate !== undefined) &&
    (!isValidDate(startDate) || !isValidDate(endDate))
  ) {
    errors.push('Valid event start and end dates are required.');
  }

  if (
    (!isPartialUpdate || departmentScope !== undefined || department !== undefined) &&
    departmentScope !== 'ALL' &&
    !department &&
    req.user?.role !== 'hod'
  ) {
    errors.push('A department is required for department-scoped events.');
  }

  return errors;
};

const validatePlacementDrivePayload = (req) => {
  const errors = [];
  const { company, role, package: offerPackage, deadline, driveDate, academicYear } = req.body;
  const isPartialUpdate = req.method === 'PUT';

  if ((!isPartialUpdate || company !== undefined) && !String(company || '').trim()) {
    errors.push('Company name is required.');
  }

  if ((!isPartialUpdate || role !== undefined) && !String(role || '').trim()) {
    errors.push('Drive role is required.');
  }

  if (
    (!isPartialUpdate || offerPackage !== undefined) &&
    (!Number.isFinite(Number(offerPackage)) || Number(offerPackage) < 0)
  ) {
    errors.push('A valid package value is required.');
  }

  if (
    (!isPartialUpdate || deadline !== undefined || driveDate !== undefined) &&
    (!isValidDate(deadline) || !isValidDate(driveDate))
  ) {
    errors.push('Valid deadline and drive dates are required.');
  }

  if ((!isPartialUpdate || academicYear !== undefined) && !String(academicYear || '').trim()) {
    errors.push('Academic year is required.');
  }

  return errors;
};

module.exports = {
  validateEventPayload,
  validatePlacementDrivePayload,
};
