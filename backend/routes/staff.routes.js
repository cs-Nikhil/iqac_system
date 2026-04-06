const router = require('express').Router();

const {
  createUser,
  disableUser,
  getAnalytics,
  getBacklogReport,
  getDepartmentDetails,
  getDepartmentReport,
  getDepartments,
  getDocuments,
  getFaculty,
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
} = require('../controllers/staff.controller');

const { protect } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorizeRoles');
const { createUploadMiddleware } = require('../middleware/upload.middleware');

const staffDocumentUpload = createUploadMiddleware('staff-documents');

router.use(protect, authorizeRoles('staff', 'iqac_admin'));

router.post('/users/create', createUser);
router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id', updateUser);
router.patch('/users/:id/disable', disableUser);

router.get('/students', getStudents);
router.put('/students/:id', updateStudent);

router.get('/faculty', getFaculty);
router.put('/faculty/:id', updateFaculty);

router.get('/departments', getDepartments);
router.get('/departments/:id/details', getDepartmentDetails);
router.put('/departments/:id', updateDepartment);

router.get('/reports', getReports);
router.get('/reports/department', getDepartmentReport);
router.get('/reports/student-performance', getStudentPerformanceReport);
router.get('/reports/backlog', getBacklogReport);
router.get('/reports/faculty-workload', getFacultyWorkloadReport);

router.post('/documents/upload', staffDocumentUpload.single('file'), uploadDocument);
router.get('/documents', getDocuments);

router.get('/analytics', getAnalytics);

module.exports = router;

