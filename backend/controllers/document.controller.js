const path = require('path');
const Document = require('../models/Document');

const toUploadPath = (filePath) => {
  if (!filePath) {
    return '';
  }

  const relativePath = path.relative(path.join(__dirname, '..'), filePath);
  return `/${relativePath.split(path.sep).join('/')}`;
};

const buildStoredFile = (file, fallbackPath = '') => {
  if (file) {
    return {
      originalName: file.originalname,
      filename: file.filename,
      path: toUploadPath(file.path),
      size: file.size,
      mimeType: file.mimetype,
      uploadedAt: new Date(),
    };
  }

  if (!fallbackPath) {
    return null;
  }

  return {
    originalName: fallbackPath.split('/').pop(),
    filename: fallbackPath.split('/').pop(),
    path: fallbackPath,
    uploadedAt: new Date(),
  };
};

const normalizeTags = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean).map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
};

// @desc    Get all documents
// @route   GET /api/documents
// @access  Private
const getDocuments = async (req, res) => {
  try {
    const { category, type, accreditationType, department, academicYear, status, tags } = req.query;
    const filter = { isActive: true };

    // Faculty can only see their own uploads, HOD is department-scoped
    if (req.user.role === 'faculty') {
      filter.uploadedBy = req.user._id;
    } else if (req.user.role === 'hod') {
      filter.department = req.user.department;
    } else if (department) {
      filter.department = department;
    }

    if (category) filter.category = category;
    if (type) filter.type = type;
    if (accreditationType) filter.accreditationType = accreditationType;
    if (academicYear) filter.academicYear = academicYear;
    if (status) filter.status = status;
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      filter.tags = { $in: tagArray };
    }

    const documents = await Document.find(filter)
      .populate('department', 'name code')
      .populate('program', 'name code')
      .populate('uploadedBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, documents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single document
// @route   GET /api/documents/:id
// @access  Private
const getDocumentById = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('department', 'name code')
      .populate('program', 'name code')
      .populate('uploadedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('relatedDocuments', 'title type');

    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Check access permissions
    if (document.accessLevel === 'Confidential' && req.user.role !== 'iqac_admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, document });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create document
// @route   POST /api/documents
// @access  Private
const createDocument = async (req, res) => {
  try {
    const documentData = {
      ...req.body,
      uploadedBy: req.user.id,
      file: buildStoredFile(req.file, req.body.filePath || '/uploads/manual-entry'),
      tags: normalizeTags(req.body.tags),
    };

    if (req.user.role === 'faculty' && !documentData.department) {
      documentData.department = req.user.department?._id || req.user.department;
      documentData.program = req.user.department?._id || req.user.department;
    }

    // Auto-approve for ADMIN, otherwise set to pending
    if (req.user.role === 'iqac_admin') {
      documentData.status = 'Approved';
      documentData.approvedBy = req.user.id;
      documentData.approvedAt = new Date();
    } else {
      documentData.status = 'Pending Approval';
    }

    const document = await Document.create(documentData);
    
    await document.populate([
      { path: 'department', select: 'name code' },
      { path: 'program', select: 'name code' },
      { path: 'uploadedBy', select: 'name email' },
    ]);

    res.status(201).json({ success: true, document });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update document
// @route   PUT /api/documents/:id
// @access  Private
const updateDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Check permissions
    if (req.user.role !== 'iqac_admin' && document.uploadedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const updatedDocument = await Document.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate([
      { path: 'department', select: 'name code' },
      { path: 'program', select: 'name code' },
      { path: 'uploadedBy', select: 'name email' },
    ]);

    res.json({ success: true, document: updatedDocument });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Approve document
// @route   POST /api/documents/:id/approve
// @access  Private/ADMIN
const approveDocument = async (req, res) => {
  try {
    const document = await Document.findByIdAndUpdate(
      req.params.id,
      {
        status: 'Approved',
        approvedBy: req.user.id,
        approvedAt: new Date(),
      },
      { new: true }
    ).populate('uploadedBy', 'name email');

    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    res.json({ success: true, document });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Reject document
// @route   POST /api/documents/:id/reject
// @access  Private/ADMIN
const rejectDocument = async (req, res) => {
  try {
    const document = await Document.findByIdAndUpdate(
      req.params.id,
      {
        status: 'Rejected',
        approvedBy: req.user.id,
        approvedAt: new Date(),
      },
      { new: true }
    ).populate('uploadedBy', 'name email');

    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    res.json({ success: true, document });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get document statistics
// @route   GET /api/documents/stats
// @access  Private
const getDocumentStats = async (req, res) => {
  try {
    const filter = { isActive: true };
    
    // HOD can only see their department's stats
    if (req.user.role === 'hod') {
      filter.department = req.user.department;
    }

    const [
      totalDocs,
      approvedDocs,
      pendingDocs,
      rejectedDocs,
      docsByType,
      docsByCategory,
      expiringSoon,
    ] = await Promise.all([
      Document.countDocuments(filter),
      Document.countDocuments({ ...filter, status: 'Approved' }),
      Document.countDocuments({ ...filter, status: 'Pending Approval' }),
      Document.countDocuments({ ...filter, status: 'Rejected' }),
      Document.aggregate([
        { $match: filter },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Document.aggregate([
        { $match: filter },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Document.find({
        ...filter,
        expiryDate: { 
          $gte: new Date(),
          $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      }).select('title expiryDate category').sort({ expiryDate: 1 }),
    ]);

    res.json({
      success: true,
      stats: {
        totalDocs,
        approvedDocs,
        pendingDocs,
        rejectedDocs,
        docsByType,
        docsByCategory,
        expiringSoon: expiringSoon.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get accreditation-required documents
// @route   GET /api/documents/accreditation-required
// @access  Private
const getAccreditationRequiredDocs = async (req, res) => {
  try {
    const { accreditationType, academicYear } = req.query;
    const filter = { 
      isActive: true,
      isRequiredForAccreditation: true,
    };

    if (accreditationType) filter.accreditationType = accreditationType;
    if (academicYear) filter.academicYear = academicYear;

    // HOD can only see their department's documents
    if (req.user.role === 'hod') {
      filter.department = req.user.department;
    }

    const documents = await Document.find(filter)
      .populate('department', 'name code')
      .populate('uploadedBy', 'name email')
      .sort({ category: 1, type: 1 });

    res.json({ success: true, documents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  approveDocument,
  rejectDocument,
  getDocumentStats,
  getAccreditationRequiredDocs,
};

