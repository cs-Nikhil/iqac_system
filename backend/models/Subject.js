const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true,
  },
  code: {
    type: String,
    required: [true, 'Subject code is required'],
    unique: true,
    uppercase: true,
    trim: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
  },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8,
  },
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
  },
  credits: {
    type: Number,
    default: 3,
  },
  type: {
    type: String,
    enum: ['Theory', 'Practical', 'Elective'],
    default: 'Theory',
  },
}, { timestamps: true });

module.exports = mongoose.model('Subject', subjectSchema);
