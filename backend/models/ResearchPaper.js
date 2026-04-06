const mongoose = require('mongoose');

const researchPaperSchema = new mongoose.Schema({
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
  },
  journal: {
    type: String,
    required: [true, 'Journal/Conference name is required'],
    trim: true,
  },
  year: {
    type: Number,
    required: true,
  },
  citations: {
    type: Number,
    default: 0,
    min: 0,
  },
  publicationType: {
    type: String,
    enum: ['Journal', 'Conference', 'Book Chapter', 'Patent'],
    default: 'Journal',
  },
  indexing: {
    type: String,
    enum: ['SCI', 'SCOPUS', 'WOS', 'UGC', 'Others'],
    default: 'Others',
  },
  doi: String,
  impactFactor: {
    type: Number,
    default: 0,
  },
  coAuthors: [String],
}, { timestamps: true });

module.exports = mongoose.model('ResearchPaper', researchPaperSchema);
