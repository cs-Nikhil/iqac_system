'use strict';

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const ResearchPaper = require('../models/ResearchPaper');

const DEFAULT_FACTOR = 0.2;
const DEFAULT_CAP = 40;
const DEFAULT_BATCH_SIZE = 200;

function parseArgs(argv) {
  const config = {
    dryRun: false,
    factor: DEFAULT_FACTOR,
    cap: DEFAULT_CAP,
    batchSize: DEFAULT_BATCH_SIZE,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      config.dryRun = true;
      continue;
    }

    if (arg.startsWith('--factor=')) {
      config.factor = Number(arg.split('=')[1]);
      continue;
    }

    if (arg.startsWith('--cap=')) {
      config.cap = Number(arg.split('=')[1]);
      continue;
    }

    if (arg.startsWith('--batch-size=')) {
      config.batchSize = Number(arg.split('=')[1]);
    }
  }

  if (!Number.isFinite(config.factor) || config.factor <= 0 || config.factor > 1) {
    throw new Error('`--factor` must be a number greater than 0 and at most 1.');
  }

  if (!Number.isInteger(config.cap) || config.cap < 0) {
    throw new Error('`--cap` must be a non-negative integer.');
  }

  if (!Number.isInteger(config.batchSize) || config.batchSize <= 0) {
    throw new Error('`--batch-size` must be a positive integer.');
  }

  return config;
}

function getReducedCitationCount(currentCitations, factor, cap) {
  const current = Number(currentCitations || 0);

  if (current <= 0) {
    return 0;
  }

  const reduced = Math.round(current * factor);
  const capped = Math.min(cap, reduced);

  return Math.max(1, capped);
}

async function summarizeResearch() {
  const [summary] = await ResearchPaper.aggregate([
    {
      $group: {
        _id: null,
        paperCount: { $sum: 1 },
        totalCitations: { $sum: '$citations' },
        maxCitations: { $max: '$citations' },
        averageCitations: { $avg: '$citations' },
      },
    },
  ]);

  return summary || {
    paperCount: 0,
    totalCitations: 0,
    maxCitations: 0,
    averageCitations: 0,
  };
}

async function run() {
  const config = parseArgs(process.argv.slice(2));

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const before = await summarizeResearch();
  console.log(
    `Before update: ${before.paperCount} papers, ${before.totalCitations} citations, avg ${before.averageCitations.toFixed(2)}, max ${before.maxCitations}`,
  );

  const cursor = ResearchPaper.find({}, { citations: 1 }).cursor();
  const operations = [];
  let processed = 0;
  let changed = 0;
  let projectedTotal = 0;

  for await (const paper of cursor) {
    processed += 1;

    const current = Number(paper.citations || 0);
    const next = getReducedCitationCount(current, config.factor, config.cap);
    projectedTotal += next;

    if (next !== current) {
      changed += 1;
      operations.push({
        updateOne: {
          filter: { _id: paper._id },
          update: { $set: { citations: next } },
        },
      });
    }

    if (!config.dryRun && operations.length >= config.batchSize) {
      await ResearchPaper.bulkWrite(operations);
      operations.length = 0;
    }
  }

  if (!config.dryRun && operations.length > 0) {
    await ResearchPaper.bulkWrite(operations);
  }

  console.log(
    `${config.dryRun ? 'Dry run' : 'Updated'}: processed ${processed} papers, changed ${changed}, projected total citations ${projectedTotal}`,
  );

  if (!config.dryRun) {
    const after = await summarizeResearch();
    console.log(
      `After update: ${after.paperCount} papers, ${after.totalCitations} citations, avg ${after.averageCitations.toFixed(2)}, max ${after.maxCitations}`,
    );
  }

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

run().catch(async (error) => {
  console.error('Citation reduction failed:', error);

  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error('Disconnect failed:', disconnectError);
  }

  process.exit(1);
});
