const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Achievement title is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Achievement description is required'],
    trim: true,
  },
  type: {
    type: String,
    enum: ['Student', 'Faculty', 'Department'],
    required: [true, 'Achievement type is required'],
  },
  category: {
    type: String,
    enum: ['Competition', 'Award', 'Certification', 'Publication', 'Research', 'Sports', 'Cultural', 'Other'],
    required: [true, 'Achievement category is required'],
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'type',
    required: [true, 'Achievement recipient is required'],
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
  },
  date: {
    type: Date,
    required: [true, 'Achievement date is required'],
  },
  level: {
    type: String,
    enum: ['Local', 'State', 'National', 'International'],
    default: 'Local',
  },
  documents: [{
    type: String, // URLs to uploaded documents
  }],
  verified: {
    type: Boolean,
    default: false,
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  verificationDate: Date,
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Indexes for faster queries
achievementSchema.index({ type: 1, date: -1 });
achievementSchema.index({ recipient: 1, date: -1 });
achievementSchema.index({ department: 1, date: -1 });

module.exports = mongoose.model('Achievement', achievementSchema);
