const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Student = require('../models/Student');
const { calculateStudentPerformance } = require('../services/performance.service');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const students = await Student.find({})
    .select('_id cgpa currentBacklogs academicRecords.avgAttendance')
    .lean();

  const operations = students.map((student) => {
    const performance = calculateStudentPerformance(student);

    return {
      updateOne: {
        filter: { _id: student._id },
        update: {
          $set: {
            performanceScore: performance.performanceScore,
            performanceCategory: performance.category,
            isAtRisk: performance.isAtRisk,
            riskReasons: performance.riskReasons,
            'academicRecords.performanceBand': performance.category,
          },
        },
      },
    };
  });

  if (operations.length) {
    await Student.bulkWrite(operations, { ordered: false });
  }

  const distribution = await Student.aggregate([
    {
      $group: {
        _id: '$performanceCategory',
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  console.log(`Updated ${operations.length} student performance records`);
  distribution.forEach((item) => {
    console.log(` - ${item._id}: ${item.count}`);
  });

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Performance sync failed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
