const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Department name is required'],
    unique: true,
    trim: true,
  },
  code: {
    type: String,
    required: [true, 'Department code is required'],
    unique: true,
    uppercase: true,
    trim: true,
  },
  hod: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
  },
  establishedYear: {
    type: Number,
    default: 2000,
  },
  totalSeats: {
    type: Number,
    default: 60,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Department', departmentSchema);
