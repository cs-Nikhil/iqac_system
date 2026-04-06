const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
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
    min: 0,
    max: 100,
  },
  isBelowThreshold: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Auto-calculate percentage before saving
attendanceSchema.pre('save', function (next) {
  this.percentage = Math.round((this.attendedClasses / this.totalClasses) * 100);
  this.isBelowThreshold = this.percentage < 75;
  next();
});

attendanceSchema.index({ student: 1, subject: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
