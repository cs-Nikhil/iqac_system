const mongoose = require('mongoose');

const studentSemesterAttendanceSchema = new mongoose.Schema({
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
  attendedClasses: {
    type: Number,
    required: true,
    min: 0,
  },
  totalClasses: {
    type: Number,
    required: true,
    min: 1,
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  isBelowThreshold: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

studentSemesterAttendanceSchema.index(
  { student: 1, semester: 1, academicYear: 1 },
  { unique: true }
);

module.exports = mongoose.model('StudentSemesterAttendance', studentSemesterAttendanceSchema);
