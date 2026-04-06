const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Document title is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  category: {
    type: String,
    enum: ['Accreditation', 'Academic', 'Administrative', 'Research', 'Student', 'Faculty', 'Infrastructure', 'Financial', 'Legal'],
    required: true,
  },
  subCategory: {
    type: String,
    trim: true,
  },
  type: {
    type: String,
    enum: ['NBA', 'NAAC', 'ISO', 'Internal', 'External', 'Policy', 'Report', 'Certificate', 'Agreement'],
    required: true,
  },
  accreditationType: {
    type: String,
    enum: ['NBA', 'NAAC', 'Other'],
    required: function() {
      return ['NBA', 'NAAC', 'Other'].includes(this.type);
    },
  },
  criteria: {
    type: String, // Specific criteria reference
    trim: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
  },
  program: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
  },
  academicYear: {
    type: String,
  },
  file: {
    originalName: String,
    filename: String,
    path: String,
    size: Number,
    mimeType: String,
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  version: {
    type: String,
    default: '1.0',
  },
  tags: [String],
  accessLevel: {
    type: String,
    enum: ['Public', 'Internal', 'Restricted', 'Confidential'],
    default: 'Internal',
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: Date,
  status: {
    type: String,
    enum: ['Draft', 'Pending Approval', 'Approved', 'Rejected', 'Archived'],
    default: 'Draft',
  },
  expiryDate: Date,
  reminderDates: [Date],
  isRequiredForAccreditation: {
    type: Boolean,
    default: false,
  },
  relatedDocuments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
  }],
  metadata: {
    pageCount: Number,
    language: String,
    author: String,
    publisher: String,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Indexes for efficient queries
documentSchema.index({ category: 1, type: 1 });
documentSchema.index({ accreditationType: 1, criteria: 1 });
documentSchema.index({ academicYear: 1, department: 1 });
documentSchema.index({ uploadedBy: 1, status: 1 });
documentSchema.index({ student: 1, status: 1 });
documentSchema.index({ tags: 1 });

module.exports = mongoose.model('Document', documentSchema);
