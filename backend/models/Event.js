const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  type: {
    type: String,
    enum: ['Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar', 'Competition', 'Hackathon', 'Conference', 'Social'],
    required: true,
  },
  level: {
    type: String,
    enum: ['International', 'National', 'State', 'Regional', 'Institutional'],
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  location: {
    type: String,
    trim: true,
  },
  organizingBody: {
    type: String,
    trim: true,
  },
  departmentScope: {
    type: String,
    enum: ['DEPARTMENT', 'ALL'],
    default: 'DEPARTMENT',
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    validate: {
      validator(value) {
        if (this.departmentScope === 'ALL') {
          return true;
        }

        return Boolean(value);
      },
      message: 'Department is required unless the event is open to all departments.',
    },
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  attendanceSession: {
    autoCreated: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    opensAt: Date,
    closesAt: Date,
    markedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

const participationSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  role: {
    type: String,
    enum: ['Participant', 'Winner', 'Runner-up', 'Organizer', 'Volunteer', 'Coordinator'],
    default: 'Participant',
  },
  position: {
    type: Number,
    min: 1,
  },
  achievement: {
    type: String,
    trim: true,
  },
  pointsEarned: {
    type: Number,
    default: 0,
  },
  certificate: {
    type: String, // File path
  },
  attended: {
    type: Boolean,
    default: false,
  },
  attendanceStatus: {
    type: String,
    enum: ['Pending', 'Marked'],
    default: 'Pending',
  },
  attendanceMarkedAt: {
    type: Date,
  },
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    comments: {
      type: String,
      trim: true,
    },
  },
  message: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  registeredAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['Registered', 'Participated', 'Cancelled'],
    default: 'Registered',
  },
}, { timestamps: true });

// Indexes for efficient queries
eventSchema.index({ type: 1, level: 1 });
eventSchema.index({ startDate: -1 });
eventSchema.index({ departmentScope: 1, department: 1, endDate: 1 });
participationSchema.index({ student: 1, event: -1 });
participationSchema.index({ student: 1, event: 1 }, { unique: true });
participationSchema.index({ event: 1, role: 1 });
participationSchema.index({ event: 1, registeredAt: -1 });

const Event = mongoose.model('Event', eventSchema);
const Participation = mongoose.model('Participation', participationSchema);

module.exports = { Event, Participation };
