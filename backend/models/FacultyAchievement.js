const mongoose = require('mongoose');

const facultyAchievementSchema = new mongoose.Schema({
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  type: {
    type: String,
    enum: ['Award', 'Certification', 'Recognition', 'Publication', 'Grant', 'Patent', 'Conference', 'Workshop', 'FDP'],
    required: true,
  },
  title: {
    type: String,
    required: [true, 'Achievement title is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  issuingOrganization: {
    type: String,
    required: [true, 'Issuing organization is required'],
    trim: true,
  },
  date: {
    type: Date,
    required: true,
  },
  level: {
    type: String,
    enum: ['International', 'National', 'State', 'Institutional'],
    default: 'Institutional',
  },
  category: {
    type: String,
    enum: ['Academic', 'Research', 'Teaching', 'Service', 'Professional Development'],
    default: 'Academic',
  },
  documents: [{
    type: String, // File paths or URLs
  }],
  points: {
    type: Number,
    default: 0, // For performance evaluation
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Compound index for efficient queries
facultyAchievementSchema.index({ faculty: 1, date: -1 });
facultyAchievementSchema.index({ type: 1, level: 1 });

module.exports = mongoose.model('FacultyAchievement', facultyAchievementSchema);
