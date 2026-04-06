const mongoose = require('mongoose');

const placementApplicationSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  drive: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlacementDrive',
    required: true,
  },
  resume: {
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
  applicationStatus: {
    type: String,
    enum: ['Applied', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Rejected', 'Withdrawn'],
    default: 'Applied',
  },
  notes: {
    type: String,
    trim: true,
  },
  appliedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

placementApplicationSchema.index({ student: 1, drive: 1 }, { unique: true });

module.exports = mongoose.model('PlacementApplication', placementApplicationSchema);
