const mongoose = require('mongoose');

const placementSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
  },
  package: {
    type: Number, // in LPA (Lakhs Per Annum)
    required: [true, 'Package is required'],
    min: 0,
  },
  role: {
    type: String,
    required: [true, 'Job role is required'],
    trim: true,
  },
  placementDate: {
    type: Date,
    required: true,
  },
  placementType: {
    type: String,
    enum: ['On-Campus', 'Off-Campus', 'PPO', 'Pool Campus'],
    default: 'On-Campus',
  },
  location: {
    type: String,
    trim: true,
  },
  academicYear: {
    type: String,
    required: true,
  },
  isHighestPackage: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

module.exports = mongoose.model('Placement', placementSchema);
