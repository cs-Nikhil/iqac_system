const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['department', 'student-performance', 'faculty-workload', 'backlog'],
    required: true,
  },
  format: {
    type: String,
    enum: ['json', 'pdf', 'csv'],
    default: 'json',
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
  },
  filters: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  status: {
    type: String,
    enum: ['generated', 'failed'],
    default: 'generated',
  },
  metadata: {
    recordCount: {
      type: Number,
      default: 0,
    },
    exportedAt: {
      type: Date,
      default: Date.now,
    },
  },
}, { timestamps: true });

reportSchema.index({ type: 1, createdAt: -1 });
reportSchema.index({ generatedBy: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
