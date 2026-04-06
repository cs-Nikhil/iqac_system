const mongoose = require('mongoose');

const marksSchema = new mongoose.Schema({
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
    type: String, // e.g., "2023-24"
    required: true,
  },
  internal: {
    type: Number,
    min: 0,
    max: 40,
    default: 0,
  },
  external: {
    type: Number,
    min: 0,
    max: 60,
    default: 0,
  },
  total: {
    type: Number,
    min: 0,
    max: 100,
  },
  grade: {
    type: String,
    enum: ['O', 'A+', 'A', 'B+', 'B', 'C', 'D', 'F', 'AB'],
  },
  result: {
    type: String,
    enum: ['PASS', 'FAIL', 'ABSENT', 'WITHHELD'],
    default: 'PASS',
  },
  gradePoints: {
    type: Number,
    min: 0,
    max: 10,
  },
}, { timestamps: true });

// Auto-calculate total, grade and result before saving
marksSchema.pre('save', function (next) {
  this.total = this.internal + this.external;

  // Grade calculation based on total marks out of 100
  if (this.result === 'ABSENT') {
    this.grade = 'AB';
    this.gradePoints = 0;
  } else {
    const t = this.total;
    if (t >= 90) { this.grade = 'O'; this.gradePoints = 10; }
    else if (t >= 80) { this.grade = 'A+'; this.gradePoints = 9; }
    else if (t >= 70) { this.grade = 'A'; this.gradePoints = 8; }
    else if (t >= 60) { this.grade = 'B+'; this.gradePoints = 7; }
    else if (t >= 55) { this.grade = 'B'; this.gradePoints = 6; }
    else if (t >= 50) { this.grade = 'C'; this.gradePoints = 5; }
    else if (t >= 45) { this.grade = 'D'; this.gradePoints = 4; }
    else { this.grade = 'F'; this.gradePoints = 0; }

    this.result = (t >= 40 && this.external >= 24) ? 'PASS' : 'FAIL';
  }
  next();
});

// Compound index to prevent duplicate entries
marksSchema.index({ student: 1, subject: 1, semester: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('Marks', marksSchema);
