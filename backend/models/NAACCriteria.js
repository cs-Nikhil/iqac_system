const mongoose = require('mongoose');

const naacCriteriaSchema = new mongoose.Schema({
  institution: {
    type: String,
    default: 'Institution',
  },
  academicYear: {
    type: String,
    required: true,
  },
  criterion: {
    type: String,
    enum: [
      'Curricular Aspects',
      'Teaching-Learning and Evaluation',
      'Research, Consultancy and Extension',
      'Infrastructure and Learning Resources',
      'Student Support and Progression',
      'Governance, Leadership and Management',
      'Innovations and Best Practices',
    ],
    required: true,
  },
  keyIndicator: {
    type: String,
    required: true,
    trim: true,
  },
  metric: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  dataPoints: [{
    name: String,
    value: mongoose.Schema.Types.Mixed,
    unit: String,
    source: String,
    collectedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  documents: [{
    title: String,
    type: {
      type: String,
      enum: ['PDF', 'Excel', 'Image', 'Video', 'Other'],
      default: 'PDF',
    },
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  }],
  qualitativeAssessment: {
    strengths: [String],
    weaknesses: [String],
    opportunities: [String],
    threats: [String],
  },
  quantitativeMetric: {
    target: Number,
    achieved: Number,
    weightage: {
      type: Number,
      default: 1,
    },
    score: {
      type: Number,
      default: 0,
    },
  },
  status: {
    type: String,
    enum: ['Data Collection', 'Analysis', 'Report Generation', 'Completed'],
    default: 'Data Collection',
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    review: String,
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    reviewedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  complianceLevel: {
    type: String,
    enum: ['Not Compliant', 'Partially Compliant', 'Compliant', 'Exemplary'],
    default: 'Not Compliant',
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Indexes for efficient queries
naacCriteriaSchema.index({ academicYear: 1, criterion: 1 });
naacCriteriaSchema.index({ status: 1, complianceLevel: 1 });
naacCriteriaSchema.index({ assignedTo: 1 });

module.exports = mongoose.model('NAACCriteria', naacCriteriaSchema);
