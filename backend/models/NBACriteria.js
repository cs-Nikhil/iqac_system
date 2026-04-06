const mongoose = require('mongoose');

const nbaCriteriaSchema = new mongoose.Schema({
  program: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
  },
  academicYear: {
    type: String,
    required: true,
  },
  criteria: {
    type: String,
    enum: ['Vision', 'Mission', 'PEO', 'PO', 'PSO', 'CO', 'Curriculum', 'Assessment', 'Facilities', 'Faculty', 'StudentPerformance', 'ContinuousImprovement'],
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  targetValue: {
    type: Number,
    required: true,
  },
  actualValue: {
    type: Number,
    default: 0,
  },
  threshold: {
    type: Number,
    default: 60, // Minimum acceptable percentage
  },
  unit: {
    type: String,
    enum: ['Percentage', 'Number', 'Rating', 'Score'],
    default: 'Percentage',
  },
  evidence: [{
    type: String, // File paths or URLs
    description: String,
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  measurements: [{
    date: Date,
    value: Number,
    remarks: String,
    measuredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  }],
  status: {
    type: String,
    enum: ['Not Started', 'In Progress', 'Met', 'Not Met', 'Exceeded'],
    default: 'Not Started',
  },
  actionItems: [{
    description: String,
    responsible: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    deadline: Date,
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed'],
      default: 'Pending',
    },
    completedAt: Date,
  }],
  complianceScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
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
nbaCriteriaSchema.index({ program: 1, academicYear: 1 });
nbaCriteriaSchema.index({ criteria: 1, status: 1 });
nbaCriteriaSchema.index({ complianceScore: -1 });

module.exports = mongoose.model('NBACriteria', nbaCriteriaSchema);
