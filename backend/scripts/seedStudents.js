

const mongoose = require('mongoose');
const path = require('path');
const { spawnSync } = require('child_process');
const { faker } = require('@faker-js/faker');
const dotenv = require('dotenv');
dotenv.config();

const Department = require('../models/Department');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Marks = require('../models/Marks');
const Attendance = require('../models/Attendance');
const Placement = require('../models/Placement');
const ResearchPaper = require('../models/ResearchPaper');
const FacultyAchievement = require('../models/FacultyAchievement');
const { Event, Participation } = require('../models/Event');
const Document = require('../models/Document');
const NBACriteria = require('../models/NBACriteria');
const NAACCriteria = require('../models/NAACCriteria');
const StudentSemesterPerformance = require('../models/StudentSemesterPerformance');
const StudentSemesterAttendance = require('../models/StudentSemesterAttendance');
const StudentFeedback = require('../models/StudentFeedback');
const PlacementDrive = require('../models/PlacementDrive');
const PlacementApplication = require('../models/PlacementApplication');

const DEPT_DATA = [
  { name: 'Computer Science & Engineering', code: 'CSE', totalSeats: 2000 },
  { name: 'Electronics & Communication Engineering', code: 'ECE', totalSeats: 1000 },
  { name: 'Mechanical Engineering', code: 'MECH', totalSeats: 600 },
  { name: 'Civil Engineering', code: 'CIVIL', totalSeats: 400 },
  { name: 'Information Technology', code: 'IT', totalSeats: 250 },
];

const DESIGNATIONS = ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer'];
const QUALIFICATIONS = ['PhD', 'MTech', 'ME', 'MSc', 'MCA'];
const GENDERS = ['Male', 'Female'];
// 8 batch years: 2017-2021 = graduated (eligible for placement), 2022-2024 = current students
const BATCH_YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const CURRENT_BATCH_YEAR = 2024;
const TOTAL_STUDENTS = DEPT_DATA.reduce((sum, department) => sum + department.totalSeats, 0);
const GUARANTEED_COHORTS = [
  { departmentCode: 'CSE', batchYear: 2024, count: 50 },
];
// 8 weights per dept (2017 → 2024). Each row must sum to 1.00.
// Slightly larger in recent cohorts to simulate growing enrolment.
const DEPARTMENT_ADMISSION_PATTERNS = {
  CSE:   [0.09, 0.10, 0.11, 0.12, 0.12, 0.14, 0.15, 0.17],
  ECE:   [0.09, 0.11, 0.12, 0.12, 0.13, 0.14, 0.15, 0.14],
  MECH:  [0.10, 0.11, 0.12, 0.13, 0.13, 0.14, 0.14, 0.13],
  CIVIL: [0.10, 0.12, 0.12, 0.12, 0.13, 0.14, 0.14, 0.13],
  IT:    [0.09, 0.11, 0.11, 0.12, 0.13, 0.14, 0.15, 0.15],
};
const DEFAULT_ADMISSION_PATTERN = [0.10, 0.11, 0.11, 0.12, 0.13, 0.14, 0.15, 0.14];

/* ---------------- INDIAN NAME GENERATOR ---------------- */

const INDIAN_MALE_NAMES = [
  "Aarav","Vivaan","Aditya","Arjun","Sai","Krishna","Rahul","Rohan",
  "Karthik","Vikram","Siddharth","Varun","Harsha","Nikhil","Manoj",
  "Tejas","Anil","Ravi","Surya","Praveen","Vamsi","Chaitanya",
  "Tarun","Rohith","Sandeep","Naveen","Praneeth","Mahesh","Pavan",
  "Srinivas","Satish","Gopal","Rakesh","Ashwin","Dinesh"
];

const INDIAN_FEMALE_NAMES = [
  "Ananya","Sravani","Keerthi","Divya","Pooja","Sneha","Swathi",
  "Lakshmi","Harika","Deepika","Nandini","Aishwarya","Meghana",
  "Bhavya","Kavya","Pranavi","Shreya","Priya","Sowmya","Vaishnavi"
];

const INDIAN_LAST_NAMES = [
  "Reddy","Naidu","Kumar","Sharma","Patel","Singh","Gupta",
  "Chowdary","Rao","Varma","Yadav","Agarwal","Bansal",
  "Kapoor","Joshi","Nair","Iyer","Goud","Mishra","Tripathi"
];

const getIndianName = (gender) => {
  const first =
    gender === "Male"
      ? faker.helpers.arrayElement(INDIAN_MALE_NAMES)
      : faker.helpers.arrayElement(INDIAN_FEMALE_NAMES);

  const last = faker.helpers.arrayElement(INDIAN_LAST_NAMES);

  return `${first} ${last}`;
};

const buildStudentDoc = (dept, batchYear, gender, rollSet) => {
  // Reference year = 2025 so batch-2021 students land on semester 8 (final year)
  const semester = Math.min(8, (2025 - batchYear) * 2);
  const status = batchYear <= 2021 ? 'graduated' : 'active';

  let rollNumber;
  do {
    rollNumber = `${dept.code}${batchYear}${String(
      faker.number.int({ min: 1, max: 999 })
    ).padStart(3, '0')}`;
  } while (rollSet.has(rollNumber));

  rollSet.add(rollNumber);

  return {
    name: getIndianName(gender),
    rollNumber,
    email: `${rollNumber.toLowerCase()}@student.iqac.edu`,
    department: dept._id,
    batchYear,
    currentSemester: Math.max(1, semester),
    status,
    gender,
    cgpa: parseFloat(
      faker.number.float({ min: 6.5, max: 9.5, fractionDigits: 2 })
    ),
    phone: faker.string.numeric(10),
  };
};

const getGuaranteedCohortsForDepartment = (departmentCode) =>
  GUARANTEED_COHORTS.filter((cohort) => cohort.departmentCode === departmentCode);

const runDependentSeed = (scriptName) => {
  const result = spawnSync(process.execPath, [path.join(__dirname, scriptName)], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`${scriptName} failed with exit code ${result.status}`);
  }
};

const buildDepartmentBatchPlan = (departmentCode, totalSeats) => {
  const guaranteedCohorts = getGuaranteedCohortsForDepartment(departmentCode);
  const guaranteedCount = guaranteedCohorts.reduce((sum, cohort) => sum + cohort.count, 0);
  const weights = DEPARTMENT_ADMISSION_PATTERNS[departmentCode] || DEFAULT_ADMISSION_PATTERN;
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const rawPlan = BATCH_YEARS.map((year, index) => ({
    year,
    count: Math.floor((totalSeats * weights[index]) / totalWeight),
    remainder: (totalSeats * weights[index]) / totalWeight - Math.floor((totalSeats * weights[index]) / totalWeight),
  }));

  if (guaranteedCount > totalSeats) {
    throw new Error(`Guaranteed cohorts exceed totalSeats for ${departmentCode}`);
  }

  let remainingSeats = totalSeats - rawPlan.reduce((sum, item) => sum + item.count, 0);
  rawPlan
    .sort((a, b) => b.remainder - a.remainder)
    .forEach((item) => {
      if (remainingSeats <= 0) {
        return;
      }

      item.count += 1;
      remainingSeats -= 1;
    });

  const plan = new Map(rawPlan.map((item) => [item.year, item.count]));

  guaranteedCohorts.forEach((cohort) => {
    const allocated = plan.get(cohort.batchYear) || 0;
    const deficit = cohort.count - allocated;

    if (deficit <= 0) {
      return;
    }

    plan.set(cohort.batchYear, cohort.count);

    const donorYears = [...BATCH_YEARS]
      .filter((year) => year !== cohort.batchYear)
      .sort((left, right) => (plan.get(right) || 0) - (plan.get(left) || 0));

    let remainingDeficit = deficit;
    for (const donorYear of donorYears) {
      if (remainingDeficit <= 0) {
        break;
      }

      const donorCount = plan.get(donorYear) || 0;
      const transferable = Math.max(0, donorCount - 1);
      const reduction = Math.min(transferable, remainingDeficit);

      plan.set(donorYear, donorCount - reduction);
      remainingDeficit -= reduction;
    }
  });

  return plan;
};

/* ------------------------------------------------------- */

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    Participation.deleteMany({}),
    Event.deleteMany({}),
    Marks.deleteMany({}),
    Attendance.deleteMany({}),
    StudentSemesterPerformance.deleteMany({}),
    StudentSemesterAttendance.deleteMany({}),
    StudentFeedback.deleteMany({}),
    PlacementDrive.deleteMany({}),
    PlacementApplication.deleteMany({}),
    Subject.deleteMany({}),
    Placement.deleteMany({}),
    ResearchPaper.deleteMany({}),
    FacultyAchievement.deleteMany({}),
    Document.deleteMany({}),
    NBACriteria.deleteMany({}),
    NAACCriteria.deleteMany({}),
    Department.deleteMany({}),
    Faculty.deleteMany({}),
    Student.deleteMany({}),
    User.deleteMany({}),
  ]);
  console.log('🗑️  Cleared existing data');

  // ── Create Departments ─────────────────────────────────────
  const departments = await Department.insertMany(
    DEPT_DATA.map(d => ({
      ...d,
      establishedYear: faker.number.int({ min: 1990, max: 2005 })
    }))
  );
  console.log(`✅ Created ${departments.length} departments`);

  // ── Create Faculty ─────────────────────────────────────────
  const departmentBatchPlans = new Map(
    departments.map((department) => [
      department.code,
      buildDepartmentBatchPlan(department.code, department.totalSeats),
    ])
  );

  const facultyDocs = [];
  for (const dept of departments) {
    const currentYearStudents = departmentBatchPlans.get(dept.code)?.get(CURRENT_BATCH_YEAR) || 0;
    const facultyCount = Math.max(1, Math.ceil(currentYearStudents / 8));

    for (let index = 0; index < facultyCount; index += 1) {
      const gender = faker.helpers.arrayElement(GENDERS);

      facultyDocs.push({
        name: getIndianName(gender),
        email: `${dept.code.toLowerCase()}.faculty${String(index + 1).padStart(3, '0')}@iqac.edu`,
        department: dept._id,
        designation: faker.helpers.arrayElement(DESIGNATIONS),
        qualification: faker.helpers.arrayElement(QUALIFICATIONS),
        experience: faker.number.int({ min: 1, max: 30 }),
        specialization: faker.helpers.arrayElement([
          'Data Structures','Machine Learning','VLSI Design','Thermodynamics',
          'Structural Analysis','Web Technologies','Networks','Embedded Systems'
        ]),
        phone: faker.string.numeric(10),
      });
    }
  }

  const faculty = await Faculty.insertMany(facultyDocs);
  console.log(`✅ Created ${faculty.length} faculty members`);

  // Assign HODs
  for (const dept of departments) {
    const deptFaculty = faculty.filter(f => f.department.toString() === dept._id.toString());
    if (deptFaculty.length > 0) {
      const hod = faker.helpers.arrayElement(deptFaculty);
      await Department.findByIdAndUpdate(dept._id, { hod: hod._id });
    }
  }
  console.log('✅ Assigned HODs');

  // ── Create Students ────────────────────────────────────────
  const studentDocs = [];
  const rollSet = new Set();

  for (const dept of departments) {
    const batchPlan = departmentBatchPlans.get(dept.code);

    for (const batchYear of BATCH_YEARS) {
      const targetCount = batchPlan?.get(batchYear) || 0;

      for (let index = 0; index < targetCount; index += 1) {
        const gender = faker.helpers.arrayElement(GENDERS);
        studentDocs.push(buildStudentDoc(dept, batchYear, gender, rollSet));
      }
    }
  }

  const students = await Student.insertMany(studentDocs);
  console.log(`? Created ${students.length} students`);
  console.log(`? Target student capacity seeded: ${TOTAL_STUDENTS}`);
  for (const dept of departments) {
    const batchPlan = departmentBatchPlans.get(dept.code);
    const currentYearStudents = departmentBatchPlans.get(dept.code)?.get(CURRENT_BATCH_YEAR) || 0;
    const facultyCount = faculty.filter((item) => item.department.toString() === dept._id.toString()).length;
    console.log(`   - ${dept.code}: ${dept.totalSeats} students total, ${currentYearStudents} in ${CURRENT_BATCH_YEAR}, ${facultyCount} faculty`);
    console.log(`     Admissions by year: ${BATCH_YEARS.map((year) => `${year}=${batchPlan?.get(year) || 0}`).join(', ')}`);
  }

  const demoStudents = students.slice(0, 5);

  for (let index = 0; index < demoStudents.length; index += 1) {
    const student = demoStudents[index];
    const studentUser = await User.create({
      name: student.name,
      email: student.email,
      password: 'Student@123',
      role: 'student',
    });

    student.user = studentUser._id;
    await student.save();
  }

  console.log('? Created demo student users (use seeded student emails / Student@123)');

  // ── Create Admin User ─────────────────────────────────────
  await User.create({
    name: 'IQAC Administrator',
    email: 'admin@iqac.edu',
    password: 'Admin@123',
    role: 'iqac_admin',
  });

  console.log('✅ Admin created (admin@iqac.edu / Admin@123)');

  // Create Staff user
  await User.create({
    name: 'System Staff',
    email: 'staff@iqac.edu',
    password: 'Staff@123',
    role: 'staff',
  });

  console.log('✅ Staff created (staff@iqac.edu / Staff@123)');

  // Create HOD users
  for (const dept of departments) {
    await User.create({
      name: `HOD ${dept.code}`,
      email: `hod.${dept.code.toLowerCase()}@iqac.edu`,
      password: 'Hod@123',
      role: 'hod',
      department: dept._id,
    });
  }

  console.log('✅ Created HOD users');

  // Create faculty users linked to the seeded faculty records
  for (const member of faculty) {
    const facultyUser = await User.create({
      name: member.name,
      email: member.email,
      password: 'Faculty@123',
      role: 'faculty',
      department: member.department,
    });

    member.user = facultyUser._id;
    await member.save();
  }

  console.log('✅ Created Faculty users (for example: cse.faculty001@iqac.edu / Faculty@123)');

  await mongoose.disconnect();
  console.log('\n🎉 Student seed completed successfully!');
  console.log('⏳ Running dependent seeds for marks, placements, and dashboard features...');

  runDependentSeed('seedMarks.js');
  runDependentSeed('seedPlacement.js');
  runDependentSeed('seedNewFeatures.js');

  console.log('\n🎉 Full seed pipeline completed successfully!');
};

run().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

