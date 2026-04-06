/**
 * ============================================================
 * seedPlacement.js — Realistic Placement Data Generator
 * ============================================================
 *
 * ACADEMIC TIMELINE RULES
 * ───────────────────────
 * • A student admitted in batchYear graduates after 4 years:
 *     passoutYear = batchYear + 4
 *
 * • Placement happens in the FINAL academic year BEFORE graduation:
 *     academicYear = `${passoutYear - 1}-${String(passoutYear).slice(-2)}`
 *     e.g.  batch 2020 → passout 2024 → academicYear "2023-24"
 *           batch 2021 → passout 2025 → academicYear "2024-25"
 *
 * ELIGIBILITY CRITERIA (all must be true)
 * ─────────────────────────────────────────
 *   1. currentSemester === 8        (final semester)
 *   2. passoutYear <= CURRENT_YEAR  (has already graduated / is graduating this year)
 *   3. cgpa >= 6.0                  (minimum academic standing)
 *   4. currentBacklogs <= 2         (not heavily backlogged)
 *
 * PLACEMENT PROBABILITY (CGPA-based gate)
 * ─────────────────────────────────────────
 *   CGPA >= 8   → 90 % placed
 *   CGPA  6–8   → 70 % placed
 *   CGPA < 6    → 30 % placed  (kept as fallback; normally ineligible)
 *
 * RUN AFTER seedStudents.js:
 *   node scripts/seedPlacement.js
 * ============================================================
 */

'use strict';

const mongoose = require('mongoose');
const { faker }  = require('@faker-js/faker');
const dotenv     = require('dotenv');
dotenv.config();

const Department         = require('../models/Department');
const Student            = require('../models/Student');
const Faculty            = require('../models/Faculty');
const User               = require('../models/User');
const Placement          = require('../models/Placement');
const PlacementDrive     = require('../models/PlacementDrive');
const PlacementApplication = require('../models/PlacementApplication');
const ResearchPaper      = require('../models/ResearchPaper');

// ════════════════════════════════════════════════════════════
// §1  CONSTANTS
// ════════════════════════════════════════════════════════════

/**
 * The "real-world" year the seed script treats as TODAY.
 * Adjust this if your student data uses a different reference year.
 * Currently set to 2025 so batch-2021 students (passout 2025) are eligible.
 */
const CURRENT_YEAR = 2025;

const LOCATIONS       = ['Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Mumbai', 'Delhi', 'Kolkata', 'Noida'];
const PLACEMENT_TYPES = ['On-Campus', 'Off-Campus', 'PPO', 'Pool Campus'];
const INDEXINGS       = ['SCI', 'SCOPUS', 'WOS', 'UGC', 'Others'];
const PUB_TYPES       = ['Journal', 'Conference', 'Book Chapter', 'Patent'];

const JOURNALS = [
  'IEEE Transactions on Neural Networks',
  'Journal of Computer Science and Technology',
  'Springer Nature - Machine Learning',
  'Elsevier - Expert Systems with Applications',
  'ACM Computing Surveys',
  'International Journal of Advanced Research',
  'VLSI Design Journal',
  'Journal of Mechanical Engineering Science',
  'Construction and Building Materials',
  'Journal of Civil Engineering',
];

/**
 * COMPANY_TIERS — each tier maps to realistic salary bands (LPA).
 *
 *   tier1 → top product / FAANG-adjacent companies   (₹18 – ₹45 LPA)
 *   tier2 → solid mid-level service / product firms  (₹ 8 – ₹18 LPA)
 *   tier3 → mass-campus / IT-services recruiters     (₹3.5 – ₹ 8 LPA)
 */
const COMPANY_TIERS = {
  tier1: {
    companies:    ['Google', 'Microsoft', 'Amazon', 'Oracle', 'Freshworks', 'Flipkart', 'Adobe', 'Atlassian'],
    packageRange: { min: 18, max: 45 },
    roles:        ['Software Development Engineer', 'Full Stack Developer', 'Cloud Solutions Architect',
                   'Data Scientist', 'Backend Engineer', 'ML Engineer'],
  },
  tier2: {
    companies:    ['IBM', 'Zoho', 'KPIT Technologies', 'Mphasis', 'Hexaware', 'L&T Infotech',
                   'Mindtree', 'Persistent Systems'],
    packageRange: { min: 8, max: 18 },
    roles:        ['Software Engineer', 'DevOps Engineer', 'Backend Developer',
                   'Data Analyst', 'Business Analyst', 'Product Analyst'],
  },
  tier3: {
    companies:    ['Infosys', 'TCS', 'Wipro', 'Accenture', 'Cognizant', 'HCL Technologies',
                   'Tech Mahindra', 'Capgemini', 'Mphasis', 'NTT Data'],
    packageRange: { min: 3.5, max: 8 },
    roles:        ['System Engineer', 'Associate Consultant', 'Junior Developer',
                   'QA Engineer', 'Network Engineer', 'Embedded Engineer', 'Operations Analyst'],
  },
};

// ════════════════════════════════════════════════════════════
// §2  PURE UTILITY HELPERS
// ════════════════════════════════════════════════════════════

/**
 * Weighted random pick from `arr`.
 * `weights` must be the same length as `arr` and sum to 1.
 *
 * @param {any[]}    arr
 * @param {number[]} weights
 * @returns {any}
 */
function weightedRandom(arr, weights) {
  const roll = Math.random();
  let cumulative = 0;
  for (let i = 0; i < arr.length; i++) {
    cumulative += weights[i];
    if (roll < cumulative) return arr[i];
  }
  return arr[arr.length - 1];
}

/**
 * Derives the academic year string for a given passout (graduation) year.
 *
 * passoutYear 2024  →  "2023-24"
 * passoutYear 2025  →  "2024-25"
 *
 * @param {number} passoutYear  — calendar year of graduation
 * @returns {string}
 */
function deriveAcademicYear(passoutYear) {
  const start = passoutYear - 1;
  const end   = String(passoutYear).slice(-2);
  return `${start}-${end}`;
}

// ════════════════════════════════════════════════════════════
// §3  ELIGIBILITY FILTER
// ════════════════════════════════════════════════════════════

/**
 * Returns only those students who satisfy ALL placement eligibility criteria:
 *
 *   ✔ currentSemester === 8        (must be in final semester)
 *   ✔ passoutYear <= CURRENT_YEAR  (graduation year has arrived)
 *   ✔ cgpa >= 6.0                  (minimum academic standing)
 *   ✔ currentBacklogs <= 2         (not heavily backlogged)
 *
 * NOTE:  passoutYear = batchYear + 4
 *
 * @param {object[]} students
 * @returns {object[]}
 */
function getEligibleStudents(students) {
  return students.filter((s) => {
    const passoutYear = (s.batchYear || 2021) + 4;
    return (
      s.currentSemester  === 8         &&
      passoutYear        <= CURRENT_YEAR &&
      s.cgpa             >= 6.0        &&
      s.currentBacklogs  <= 2
    );
  });
}

// ════════════════════════════════════════════════════════════
// §4  PLACEMENT PROBABILITY GATE
// ════════════════════════════════════════════════════════════

/**
 * Simulates whether a student is actually selected by a company.
 * Even eligible students are not guaranteed a placement — this mirrors
 * real campus recruitment outcomes.
 *
 *   CGPA >= 8   → 90 % probability
 *   CGPA  6–8   → 70 % probability
 *   CGPA < 6    → 30 % probability  (fallback; normally filtered before this)
 *
 * @param {number} cgpa
 * @returns {boolean}
 */
function isPlaced(cgpa) {
  const roll = Math.random();
  if (cgpa >= 8) return roll < 0.90;
  if (cgpa >= 6) return roll < 0.70;
  return roll < 0.30;
}

// ════════════════════════════════════════════════════════════
// §5  TIER ASSIGNMENT
// ════════════════════════════════════════════════════════════

/**
 * Assigns a company tier based on the student's CGPA.
 * Higher CGPA → better odds of landing tier-1 roles.
 *
 *   CGPA >= 8.5  →  50 % t1,  35 % t2,  15 % t3
 *   CGPA >= 7.0  →  20 % t1,  50 % t2,  30 % t3
 *   CGPA >= 6.0  →   5 % t1,  35 % t2,  60 % t3
 *
 * @param {number} cgpa
 * @returns {'tier1'|'tier2'|'tier3'}
 */
function assignTier(cgpa) {
  const tiers = ['tier1', 'tier2', 'tier3'];
  if (cgpa >= 8.5) return weightedRandom(tiers, [0.50, 0.35, 0.15]);
  if (cgpa >= 7.0) return weightedRandom(tiers, [0.20, 0.50, 0.30]);
  return weightedRandom(tiers, [0.05, 0.35, 0.60]);
}

// ════════════════════════════════════════════════════════════
// §6  PLACEMENT RECORD BUILDER
// ════════════════════════════════════════════════════════════

/**
 * Constructs a single placement document for an eligible, placed student.
 *
 * Key derivations:
 *   • Company / role / package — sourced from the assigned tier
 *   • academicYear             — derived from batchYear + 4 (passoutYear)
 *   • placementDate            — random date in the Jun → Apr window of the
 *                                placement academic year (realistic campus cycle)
 *   • placementType            — weighted: high-CGPA students more likely PPO
 *
 * @param {object} student — Mongoose Student document
 * @returns {object}       — Placement document (not yet saved)
 */
function buildPlacementRecord(student) {
  const tier                                = assignTier(student.cgpa);
  const { companies, packageRange, roles }  = COMPANY_TIERS[tier];

  const company = faker.helpers.arrayElement(companies);
  const role    = faker.helpers.arrayElement(roles);

  // Package: random within tier band, two decimal places
  const rawPkg = faker.number.float({
    min: packageRange.min,
    max: packageRange.max,
    fractionDigits: 2,
  });
  const pkg = Number(rawPkg.toFixed(2));

  // Placement type: PPO more likely for star performers
  const placementTypeWeights = student.cgpa >= 8
    ? [0.30, 0.10, 0.45, 0.15]   // On-Campus / Off-Campus / PPO / Pool
    : [0.55, 0.20, 0.10, 0.15];

  const placementType = weightedRandom(PLACEMENT_TYPES, placementTypeWeights);

  // Academic year derives from batchYear (4-year programme)
  const passoutYear    = (student.batchYear || 2021) + 4;
  const academicYear   = deriveAcademicYear(passoutYear);

  // Placement event date: spread across the campus recruitment window
  // (June of the penultimate year → April of the graduation year)
  const windowStart  = new Date(`${passoutYear - 1}-06-01`);
  const windowEnd    = new Date(`${passoutYear}-04-30`);
  const placementDate = faker.date.between({ from: windowStart, to: windowEnd });

  return {
    student:         student._id,
    company,
    package:         pkg,
    role,
    placementDate,
    placementType,
    location:        faker.helpers.arrayElement(LOCATIONS),
    academicYear,
    isHighestPackage: false,   // flagged in a post-processing pass
  };
}

// ════════════════════════════════════════════════════════════
// §7  FLAG HIGHEST-PACKAGE PER DEPT + ACADEMIC YEAR
// ════════════════════════════════════════════════════════════

/**
 * Scans all built placement docs and marks `isHighestPackage = true` on the
 * record with the highest package in each (academicYear + department) bucket.
 *
 * This pre-computation makes analytics queries trivially fast — no aggregation
 * needed on the fly.
 *
 * @param {object[]} placementDocs — array of unsaved placement objects
 * @param {object[]} allStudents   — all student documents (for dept lookup)
 * @returns {object[]}             — same array, mutated in-place
 */
function flagHighestPackages(placementDocs, allStudents) {
  const studentMap = new Map(allStudents.map((s) => [s._id.toString(), s]));

  // Determine the winner for each (academicYear, department) key
  const leaderboard = {};

  for (const doc of placementDocs) {
    const student = studentMap.get(doc.student.toString());
    if (!student) continue;

    const key = `${doc.academicYear}::${student.department?.toString()}`;

    if (!leaderboard[key] || doc.package > leaderboard[key].package) {
      leaderboard[key] = doc;
    }
  }

  // Set by object reference so mutation applies to the originals
  const winners = new Set(Object.values(leaderboard));
  for (const doc of placementDocs) {
    if (winners.has(doc)) {
      doc.isHighestPackage = true;
    }
  }

  return placementDocs;
}

// ════════════════════════════════════════════════════════════
// §8  PLACEMENT DRIVES GENERATOR
// ════════════════════════════════════════════════════════════

/**
 * Generates upcoming / open / closed campus recruitment drives.
 * Creates at least 10 drives, spread across departments.
 *
 * @param {object[]} departments
 * @returns {object[]}
 */
function buildPlacementDrives(departments) {
  const driveCount = Math.max(10, Math.ceil(departments.length * 2));

  return Array.from({ length: driveCount }, (_, index) => {
    const tierKey                           = weightedRandom(['tier1', 'tier2', 'tier3'], [0.15, 0.35, 0.50]);
    const { companies, packageRange, roles } = COMPANY_TIERS[tierKey];
    const company                           = faker.helpers.arrayElement(companies);

    const deadline   = faker.date.soon({ days: 45 });
    const driveDate  = faker.date.soon({ days: 75, refDate: deadline });

    return {
      company,
      role:       faker.helpers.arrayElement(roles),
      package:    Number(
        faker.number.float({ min: packageRange.min, max: packageRange.max, fractionDigits: 2 }).toFixed(2),
      ),
      location:    faker.helpers.arrayElement(LOCATIONS),
      description: `${company} campus hiring drive – recruitment cycle ${index + 1}.`,
      departments: faker.helpers
        .arrayElements(departments, faker.number.int({ min: 1, max: 3 }))
        .map((d) => d._id),
      minCgpa:     Number(faker.number.float({ min: 6.0, max: 8.0, fractionDigits: 1 }).toFixed(1)),
      maxBacklogs: faker.number.int({ min: 0, max: 2 }),
      deadline,
      driveDate,
      status:      faker.helpers.arrayElement(['Open', 'Upcoming', 'Closed']),
    };
  });
}

// ════════════════════════════════════════════════════════════
// §9  RESEARCH PAPERS GENERATOR
// ════════════════════════════════════════════════════════════

/**
 * Generates 2–5 research papers per faculty member with realistic indexing,
 * citation counts, and impact factors.
 *
 * @param {object[]} faculty
 * @returns {object[]}
 */
function buildResearchPapers(faculty, facultyUserIds = new Map()) {
  const docs = [];

  for (const fac of faculty) {
    const paperCount = faker.number.int({ min: 2, max: 5 });

    for (let i = 0; i < paperCount; i++) {
      const year     = faker.number.int({ min: 2018, max: 2024 });
      const indexing = faker.helpers.arrayElement(INDEXINGS);
      const isSCI    = indexing === 'SCI';

      docs.push({
        faculty:         fac._id,
        department:      fac.department,
        uploadedBy:      fac.user || facultyUserIds.get(String(fac._id)),
        title:           `${faker.hacker.adjective()} ${faker.hacker.noun()} for ${faker.hacker.ingverb()} ${faker.hacker.noun()}`,
        journal:         faker.helpers.arrayElement(JOURNALS),
        year,
        citations:       isSCI
                           ? faker.number.int({ min: 4,   max: 40  })
                           : faker.number.int({ min: 0,   max: 12  }),
        publicationType: faker.helpers.arrayElement(PUB_TYPES),
        indexing,
        impactFactor:    isSCI
                           ? faker.number.float({ min: 1.0, max: 8.0, fractionDigits: 3 })
                           : faker.number.float({ min: 0.1, max: 2.0, fractionDigits: 3 }),
        doi:             `10.${faker.number.int({ min: 1000, max: 9999 })}/${faker.string.alphanumeric(8)}`,
        coAuthors:       Array.from(
                           { length: faker.number.int({ min: 0, max: 3 }) },
                           () => faker.person.fullName(),
                         ),
      });
    }
  }

  return docs;
}

// ════════════════════════════════════════════════════════════
// §10  CONSOLE SUMMARY HELPER
// ════════════════════════════════════════════════════════════

/**
 * Prints a human-readable placement statistics block.
 *
 * @param {number}   eligibleCount
 * @param {object[]} placementDocs
 * @param {number}   notPlacedCount
 */
function printPlacementSummary(eligibleCount, placementDocs, notPlacedCount) {
  const placed     = placementDocs.length;
  const avgPkg     = placed > 0
    ? (placementDocs.reduce((s, d) => s + d.package, 0) / placed).toFixed(2)
    : '0.00';
  const maxPkg     = placed > 0 ? Math.max(...placementDocs.map((d) => d.package)) : 0;
  const rate       = eligibleCount > 0
    ? ((placed / eligibleCount) * 100).toFixed(1)
    : '0.0';

  console.log('\n🎯  Placement Summary');
  console.log('    ─────────────────────────────────────');
  console.log(`    Eligible students  : ${eligibleCount}`);
  console.log(`    Placed             : ${placed}`);
  console.log(`    Not placed         : ${notPlacedCount}`);
  console.log(`    Placement rate     : ${rate}%`);
  console.log(`    Avg package        : ₹${avgPkg} LPA`);
  console.log(`    Highest package    : ₹${maxPkg} LPA`);

  // Breakdown by academic year
  const byYear = {};
  for (const doc of placementDocs) {
    byYear[doc.academicYear] = (byYear[doc.academicYear] || 0) + 1;
  }
  if (Object.keys(byYear).length) {
    console.log('\n    Placements by academic year:');
    for (const [yr, count] of Object.entries(byYear).sort()) {
      console.log(`      ${yr}  →  ${count} students`);
    }
  }
}

// ════════════════════════════════════════════════════════════
// §11  MAIN ENTRY POINT
// ════════════════════════════════════════════════════════════

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅  Connected to MongoDB');

  // ── 11.1  Clear stale data ───────────────────────────────
  await Promise.all([
    Placement.deleteMany({}),
    PlacementDrive.deleteMany({}),
    PlacementApplication.deleteMany({}),
    ResearchPaper.deleteMany({}),
  ]);
  console.log('🧹  Cleared: placements, drives, applications, research papers');

  // ── 11.2  Load master data ───────────────────────────────
  const departments = await Department.find({});
  const allStudents = await Student.find({});
  const faculty     = await Faculty.find({});
  const facultyUsers = await User.find({ role: 'faculty' }).select('_id email');
  const userIdByEmail = new Map(facultyUsers.map((user) => [user.email, user._id]));
  const facultyUserIds = new Map(
    faculty.map((member) => [String(member._id), member.user || userIdByEmail.get(member.email)]),
  );

  console.log(`\n📊  Loaded — students: ${allStudents.length}, faculty: ${faculty.length}, departments: ${departments.length}`);

  // ── 11.3  Placement records ──────────────────────────────
  //
  //  Pipeline:
  //    allStudents
  //      → [getEligibleStudents]  filter by eligibility rules
  //      → [isPlaced]             probability gate per student
  //      → [buildPlacementRecord] construct the document
  //      → [flagHighestPackages]  post-process to mark top earner per dept/year

  const eligibleStudents = getEligibleStudents(allStudents);

  console.log(`\n📋  Total students     : ${allStudents.length}`);
  console.log(`✅  Eligible (sem 8, passoutYear ≤ ${CURRENT_YEAR}, CGPA ≥ 6, backlogs ≤ 2): ${eligibleStudents.length}`);

  const placementDocs = [];
  let notPlacedCount  = 0;

  for (const student of eligibleStudents) {
    if (isPlaced(student.cgpa)) {
      placementDocs.push(buildPlacementRecord(student));
    } else {
      notPlacedCount++;
    }
  }

  flagHighestPackages(placementDocs, allStudents);

  await Placement.insertMany(placementDocs);
  printPlacementSummary(eligibleStudents.length, placementDocs, notPlacedCount);

  // ── 11.4  Placement drives ───────────────────────────────
  const drives = buildPlacementDrives(departments);
  await PlacementDrive.insertMany(drives);
  console.log(`\n🚀  Created ${drives.length} placement drives`);

  // ── 11.5  Research papers ────────────────────────────────
  const papers = buildResearchPapers(faculty, facultyUserIds);
  await ResearchPaper.insertMany(papers);
  console.log(`📄  Created ${papers.length} research papers`);

  await mongoose.disconnect();
  console.log('\n🎉  Placement & Research seed completed successfully!');
};

run().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
