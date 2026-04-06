const router = require('express').Router();

const { protect } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorizeRoles');
const { createUploadMiddleware } = require('../middleware/upload.middleware');
const {
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
} = require('../controllers/studentPortal.controller');

const achievementUpload = createUploadMiddleware('student-achievements');
const documentUpload = createUploadMiddleware('student-documents');
const resumeUpload = createUploadMiddleware('student-resumes');

router.use(protect);
router.use(authorizeRoles('student'));

router.get('/profile', getStudentProfile);
router.put('/profile', updateStudentProfile);

router.get('/academic-progress', getAcademicProgress);
router.get('/subjects', getStudentSubjects);
router.get('/attendance', getStudentAttendance);
router.get('/backlogs', getStudentBacklogs);
router.get('/participation', listStudentParticipationHub);

router.get('/achievements', listStudentAchievements);
router.post('/achievements', achievementUpload.single('certificate'), createStudentAchievement);

router.get('/feedback', listStudentFeedback);
router.post('/feedback', createStudentFeedback);

router.get('/documents', listStudentDocuments);
router.post('/documents', documentUpload.single('file'), createStudentDocument);

router.get('/placements', getStudentPlacements);
router.post('/placements/apply', resumeUpload.single('resume'), applyToPlacement);

module.exports = router;
