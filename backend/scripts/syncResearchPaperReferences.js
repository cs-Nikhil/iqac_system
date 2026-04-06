'use strict';

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Faculty = require('../models/Faculty');
const ResearchPaper = require('../models/ResearchPaper');
const User = require('../models/User');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const users = await User.find({}, '_id email').lean();
  const userIdByEmail = new Map(
    users
      .filter((user) => user.email)
      .map((user) => [String(user.email).toLowerCase(), user._id]),
  );

  const faculties = await Faculty.find({}, '_id email user department').lean();
  const facultyUpdates = [];
  const facultyById = new Map();

  for (const member of faculties) {
    const matchedUserId = member.user || userIdByEmail.get(String(member.email || '').toLowerCase());
    facultyById.set(String(member._id), {
      ...member,
      user: matchedUserId || member.user || null,
    });

    if (!member.user && matchedUserId) {
      facultyUpdates.push({
        updateOne: {
          filter: { _id: member._id },
          update: { $set: { user: matchedUserId } },
        },
      });
    }
  }

  if (facultyUpdates.length > 0) {
    await Faculty.bulkWrite(facultyUpdates);
  }

  const papers = await ResearchPaper.find({}, '_id faculty department uploadedBy').lean();
  const paperUpdates = [];

  for (const paper of papers) {
    const faculty = facultyById.get(String(paper.faculty));

    if (!faculty) {
      continue;
    }

    const nextDepartment = faculty.department || paper.department || null;
    const nextUploadedBy = faculty.user || paper.uploadedBy || null;
    const update = {};

    if (nextDepartment && String(nextDepartment) !== String(paper.department || '')) {
      update.department = nextDepartment;
    }

    if (nextUploadedBy && String(nextUploadedBy) !== String(paper.uploadedBy || '')) {
      update.uploadedBy = nextUploadedBy;
    }

    if (Object.keys(update).length > 0) {
      paperUpdates.push({
        updateOne: {
          filter: { _id: paper._id },
          update: { $set: update },
        },
      });
    }
  }

  if (paperUpdates.length > 0) {
    await ResearchPaper.bulkWrite(paperUpdates);
  }

  console.log(`Synced ${facultyUpdates.length} faculty user links`);
  console.log(`Synced ${paperUpdates.length} research paper references`);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

run().catch(async (error) => {
  console.error('Research sync failed:', error);

  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error('Disconnect failed:', disconnectError);
  }

  process.exit(1);
});
