const mongoose = require('mongoose');

const placementDriveSchema = new mongoose.Schema({
  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    trim: true,
  },
  package: {
    type: Number,
    required: [true, 'Package is required'],
    min: 0,
  },
  location: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    trim: true,
  },
  departments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
  }],
  minCgpa: {
    type: Number,
    default: 0,
    min: 0,
    max: 10,
  },
  maxBacklogs: {
    type: Number,
    default: 0,
    min: 0,
  },
  deadline: {
    type: Date,
    required: true,
  },
  driveDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['Open', 'Closed', 'Upcoming'],
    default: 'Open',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

placementDriveSchema.index({ company: 1, deadline: -1 });
placementDriveSchema.index({ departments: 1, status: 1 });

module.exports = mongoose.model('PlacementDrive', placementDriveSchema);
