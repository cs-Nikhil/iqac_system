const mongoose = require('mongoose');

const studentSemesterPerformanceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8,
  },
  academicYear: {
    type: String,
    required: true,
  },
  sgpa: {
    type: Number,
    required: true,
    min: 0,
    max: 10,
  },
  cgpa: {
    type: Number,
    required: true,
    min: 0,
    max: 10,
  },
  totalCredits: {
    type: Number,
    required: true,
    min: 0,
  },
  earnedCredits: {
    type: Number,
    required: true,
    min: 0,
  },
}, { timestamps: true });

studentSemesterPerformanceSchema.index(
  { student: 1, semester: 1, academicYear: 1 },
  { unique: true }
);

module.exports = mongoose.model('StudentSemesterPerformance', studentSemesterPerformanceSchema);
