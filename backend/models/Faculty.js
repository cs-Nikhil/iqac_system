const mongoose = require('mongoose');

const facultySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique: true,
    sparse: true,
  },
  name: {
    type: String,
    required: [true, 'Faculty name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
  },
  designation: {
    type: String,
    enum: ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Visiting Faculty'],
    default: 'Assistant Professor',
  },
  qualification: {
    type: String,
    enum: ['PhD', 'MTech', 'ME', 'MSc', 'MCA', 'MBA'],
  },
  experience: {
    type: Number, // years
    default: 0,
  },
  specialization: String,
  phone: String,
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Faculty', facultySchema);
