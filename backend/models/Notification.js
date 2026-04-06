const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['event', 'placement', 'system'],
      default: 'system',
    },
    audience: {
      roles: [
        {
          type: String,
          enum: ['iqac_admin', 'staff', 'hod', 'faculty', 'student'],
        },
      ],
      departments: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Department',
        },
      ],
      studentStatuses: [
        {
          type: String,
          enum: ['active', 'graduated'],
        },
      ],
      minimumCgpa: {
        type: Number,
        min: 0,
        max: 10,
      },
      maximumBacklogs: {
        type: Number,
        min: 0,
      },
    },
    links: {
      route: {
        type: String,
        trim: true,
      },
      event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
      },
      placementDrive: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PlacementDrive',
      },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ 'audience.roles': 1, createdAt: -1 });
notificationSchema.index({ 'audience.departments': 1, createdAt: -1 });
notificationSchema.index({ readBy: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
