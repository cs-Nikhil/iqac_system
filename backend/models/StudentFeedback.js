const mongoose = require('mongoose');

const studentFeedbackSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
  },
  courseName: {
    type: String,
    trim: true,
  },
  ratings: {
    teachingQuality: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    courseDifficulty: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    infrastructureQuality: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
  },
  overallRating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comments: {
    type: String,
    trim: true,
    maxlength: 1200,
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isAnonymous: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

studentFeedbackSchema.index({ student: 1, createdAt: -1 });
studentFeedbackSchema.index({ faculty: 1, createdAt: -1 });

module.exports = mongoose.model('StudentFeedback', studentFeedbackSchema);
