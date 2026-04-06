export const formatEventDate = (value) => {
  if (!value) {
    return 'Date pending';
  }

  return new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' });
};

export const formatEventDateRange = (startDate, endDate) =>
  `${formatEventDate(startDate)} - ${formatEventDate(endDate)}`;

export const getEventStatus = (startDate, endDate, referenceDate = new Date()) => {
  const start = new Date(startDate || 0);
  const end = new Date(endDate || 0);

  if (start <= referenceDate && end >= referenceDate) {
    return 'Ongoing';
  }

  if (start > referenceDate) {
    return 'Upcoming';
  }

  return 'Closed';
};

export const getEventStatusBadgeClass = (status) => {
  if (status === 'Ongoing') {
    return 'badge-success';
  }

  if (status === 'Upcoming') {
    return 'badge-info';
  }

  return 'badge-warning';
};

export const getDepartmentBadgeClass = (departmentScope) =>
  departmentScope === 'ALL' ? 'badge-warning' : 'badge-info';
