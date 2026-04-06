export const STUDENT_STATUS = {
  ACTIVE: 'active',
  GRADUATED: 'graduated',
};

const READ_ONLY_MESSAGE =
  'Your student record is marked as graduated, so editing, uploads, feedback submission, and placement applications are disabled.';

export const getStudentWorkspaceStatus = (profile) => {
  const status = profile?.status === STUDENT_STATUS.GRADUATED
    ? STUDENT_STATUS.GRADUATED
    : STUDENT_STATUS.ACTIVE;

  const isReadOnly = status === STUDENT_STATUS.GRADUATED;

  return {
    status,
    isReadOnly,
    badgeLabel: isReadOnly ? 'Graduated' : 'Active student',
    badgeClassName: isReadOnly ? 'badge-warning' : 'badge-success',
    bannerTitle: isReadOnly ? 'Graduated access is view-only' : 'Student workspace active',
    bannerMessage: isReadOnly
      ? READ_ONLY_MESSAGE
      : 'All student modules are available for viewing and updates based on your permissions.',
    readOnlyReason: READ_ONLY_MESSAGE,
  };
};
