const mongoose = require('mongoose');
const { calculateStudentPerformance } = require('../services/performance.service');

const studentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique: true,
    sparse: true,
  },
  name: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true,
  },
  rollNumber: {
    type: String,
    required: [true, 'Roll number is required'],
    unique: true,
    uppercase: true,
    trim: true,
  },
  email: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
  },
  batchYear: {
    type: Number,
    required: [true, 'Batch year is required'],
  },
  currentSemester: {
    type: Number,
    min: 1,
    max: 8,
    default: 1,
  },
  status: {
    type: String,
    enum: ['active', 'graduated'],
    default: function resolveDefaultStudentStatus() {
      const batchYear = Number(this.batchYear);
      const now = new Date();
      const academicStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;

      return Number.isFinite(batchYear) && batchYear <= academicStartYear - 4
        ? 'graduated'
        : 'active';
    },
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
  },
  cgpa: {
    type: Number,
    default: 0,
    min: 0,
    max: 10,
  },
  performanceScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  performanceCategory: {
    type: String,
    enum: ['Excellent', 'Good', 'Average', 'At Risk'],
    default: 'Average',
  },
  isAtRisk: {
    type: Boolean,
    default: false,
  },
  riskReasons: [{
    type: String,
  }],
  currentBacklogs: {
    type: Number,
    default: 0,
    min: 0,
  },
  academicRecords: {
    latestSemester: {
      type: Number,
      min: 1,
      max: 8,
    },
    latestAcademicYear: String,
    avgMarks: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    avgAttendance: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    creditsEarned: {
      type: Number,
      default: 0,
      min: 0,
    },
    performanceBand: {
      type: String,
      enum: ['Excellent', 'Good', 'Average', 'At Risk'],
      default: 'Average',
    },
    semesterCgpa: [{
      semester: {
        type: Number,
        min: 1,
        max: 8,
        required: true,
      },
      academicYear: {
        type: String,
        required: true,
      },
      cgpa: {
        type: Number,
        min: 0,
        max: 10,
        required: true,
      },
    }],
    yearlyCgpa: [{
      year: {
        type: Number,
        min: 1,
        required: true,
      },
      academicYear: {
        type: String,
        required: true,
      },
      cgpa: {
        type: Number,
        min: 0,
        max: 10,
        required: true,
      },
    }],
    remarks: String,
  },
  totalBacklogsCleared: {
    type: Number,
    default: 0,
    min: 0,
  },
  backlogHistory: [{
    academicYear: String,
    semester: Number,
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject'
    },
    clearedInSemester: Number,
    clearedInYear: String,
    attempts: {
      type: Number,
      default: 1,
    },
  }],
  phone: String,
  address: String,
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Index for faster queries
studentSchema.index({ department: 1, batchYear: 1 });
studentSchema.index({ performanceCategory: 1, isActive: 1 });

studentSchema.pre('save', function (next) {
  const performance = calculateStudentPerformance(this);

  this.performanceScore = performance.performanceScore;
  this.performanceCategory = performance.category;
  this.isAtRisk = performance.isAtRisk;
  this.riskReasons = performance.riskReasons;
  this.academicRecords = this.academicRecords || {};
  this.academicRecords.performanceBand = performance.category;

  next();
});

module.exports = mongoose.model('Student', studentSchema);
