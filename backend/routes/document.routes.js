const router = require("express").Router();

const { protect } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorizeRoles');
const { createUploadMiddleware } = require('../middleware/upload.middleware');

const {
  getDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  approveDocument,
  rejectDocument,
  getDocumentStats,
  getAccreditationRequiredDocs,
} = require("../controllers/document.controller");

const documentUpload = createUploadMiddleware('faculty-documents');

// All document routes require authentication
router.use(protect);

// Get documents
router.get(
  "/",
  authorizeRoles("iqac_admin", "hod", "faculty"),
  getDocuments
);

// Document statistics
router.get(
  "/stats",
  authorizeRoles("iqac_admin"),
  getDocumentStats
);

// Accreditation required documents
router.get(
  "/accreditation-required",
  authorizeRoles("iqac_admin", "hod"),
  getAccreditationRequiredDocs
);

// Get document by ID
router.get(
  "/:id",
  authorizeRoles("iqac_admin", "hod", "faculty"),
  getDocumentById
);

// Upload document
router.post(
  "/",
  authorizeRoles("faculty", "hod"),
  documentUpload.single('file'),
  createDocument
);

// Update document
router.put(
  "/:id",
  authorizeRoles("faculty", "hod"),
  updateDocument
);

// Approve document
router.post(
  "/:id/approve",
  authorizeRoles("iqac_admin"),
  approveDocument
);

// Reject document
router.post(
  "/:id/reject",
  authorizeRoles("iqac_admin"),
  rejectDocument
);

module.exports = router;
