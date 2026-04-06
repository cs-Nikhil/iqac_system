  const mongoose = require('mongoose');
  const { faker } = require('@faker-js/faker');
  const dotenv = require('dotenv');

  dotenv.config();

  const Department = require('../models/Department');
  const Faculty = require('../models/Faculty');
  const Student = require('../models/Student');
  const Subject = require('../models/Subject');
  const Marks = require('../models/Marks');
  const Attendance = require('../models/Attendance');
  const StudentSemesterPerformance = require('../models/StudentSemesterPerformance');
  const StudentSemesterAttendance = require('../models/StudentSemesterAttendance');
  const { calculateStudentPerformance } = require('../services/performance.service');

  const BATCH_SIZE = 500;
  const MAX_SEMESTER = 8;
  const PASSING_EXTERNAL_MIN = 24;
  const PASSING_TOTAL_MIN = 40;
  const ATTENDANCE_YEAR_SWINGS = {
    2020: -2.5,
    2021: 1.8,
    2022: -1.4,
    2023: 2.6,
    2024: -1.9,
  };

  const COMMON_CURRICULUM = {
    1: [
      { name: 'Engineering Mathematics I', credits: 4, type: 'Theory' },
      { name: 'Engineering Physics', credits: 4, type: 'Theory' },
      { name: 'Programming Fundamentals', credits: 3, type: 'Theory' },
      { name: 'Basic Electrical Engineering', credits: 3, type: 'Theory' },
      { name: 'Engineering Graphics', credits: 2, type: 'Theory' },
      { name: 'Programming Lab', credits: 2, type: 'Practical' },
    ],
    2: [
      { name: 'Engineering Mathematics II', credits: 4, type: 'Theory' },
      { name: 'Engineering Chemistry', credits: 4, type: 'Theory' },
      { name: 'Data Structures Fundamentals', credits: 3, type: 'Theory' },
      { name: 'Basic Electronics', credits: 3, type: 'Theory' },
      { name: 'Workshop Practice', credits: 2, type: 'Practical' },
      { name: 'Chemistry Lab', credits: 2, type: 'Practical' },
    ],
  };

  const DEPARTMENT_CURRICULUM = {
    CSE: {
      3: [
        { name: 'Object Oriented Programming', credits: 4, type: 'Theory' },
        { name: 'Digital Logic Design', credits: 3, type: 'Theory' },
        { name: 'Discrete Mathematics', credits: 4, type: 'Theory' },
        { name: 'Computer Organization', credits: 3, type: 'Theory' },
        { name: 'Database Systems', credits: 3, type: 'Theory' },
        { name: 'OOP Lab', credits: 2, type: 'Practical' },
      ],
      4: [
        { name: 'Operating Systems', credits: 4, type: 'Theory' },
        { name: 'Design and Analysis of Algorithms', credits: 4, type: 'Theory' },
        { name: 'Software Engineering', credits: 3, type: 'Theory' },
        { name: 'Web Technologies', credits: 3, type: 'Theory' },
        { name: 'Probability and Statistics', credits: 3, type: 'Theory' },
        { name: 'Web Technologies Lab', credits: 2, type: 'Practical' },
      ],
      5: [
        { name: 'Computer Networks', credits: 4, type: 'Theory' },
        { name: 'Theory of Computation', credits: 3, type: 'Theory' },
        { name: 'Artificial Intelligence', credits: 3, type: 'Theory' },
        { name: 'Java Programming', credits: 3, type: 'Theory' },
        { name: 'Microprocessors and Microcontrollers', credits: 3, type: 'Theory' },
        { name: 'Networks Lab', credits: 2, type: 'Practical' },
      ],
      6: [
        { name: 'Compiler Design', credits: 4, type: 'Theory' },
        { name: 'Machine Learning', credits: 4, type: 'Theory' },
        { name: 'Cloud Computing', credits: 3, type: 'Theory' },
        { name: 'Distributed Systems', credits: 3, type: 'Theory' },
        { name: 'Data Warehousing', credits: 3, type: 'Theory' },
        { name: 'Machine Learning Lab', credits: 2, type: 'Practical' },
      ],
      7: [
        { name: 'DevOps Engineering', credits: 3, type: 'Theory' },
        { name: 'Cyber Security', credits: 4, type: 'Theory' },
        { name: 'Big Data Analytics', credits: 3, type: 'Theory' },
        { name: 'Mobile Computing', credits: 3, type: 'Theory' },
        { name: 'Professional Elective I', credits: 3, type: 'Elective' },
        { name: 'Project Phase I', credits: 2, type: 'Practical' },
      ],
      8: [
        { name: 'Deep Learning', credits: 4, type: 'Theory' },
        { name: 'Blockchain Systems', credits: 3, type: 'Theory' },
        { name: 'Enterprise Systems', credits: 3, type: 'Theory' },
        { name: 'Professional Elective II', credits: 3, type: 'Elective' },
        { name: 'Internship Seminar', credits: 2, type: 'Practical' },
        { name: 'Project Phase II', credits: 4, type: 'Practical' },
      ],
    },
    ECE: {
      3: [
        { name: 'Network Theory', credits: 4, type: 'Theory' },
        { name: 'Electronic Devices', credits: 3, type: 'Theory' },
        { name: 'Signals and Systems', credits: 4, type: 'Theory' },
        { name: 'Digital System Design', credits: 3, type: 'Theory' },
        { name: 'Probability for Engineers', credits: 3, type: 'Theory' },
        { name: 'Circuits Lab', credits: 2, type: 'Practical' },
      ],
      4: [
        { name: 'Analog Circuits', credits: 4, type: 'Theory' },
        { name: 'Microprocessors', credits: 4, type: 'Theory' },
        { name: 'Control Systems', credits: 3, type: 'Theory' },
        { name: 'Linear Integrated Circuits', credits: 3, type: 'Theory' },
        { name: 'Electromagnetic Fields', credits: 3, type: 'Theory' },
        { name: 'Microprocessors Lab', credits: 2, type: 'Practical' },
      ],
      5: [
        { name: 'Communication Systems', credits: 4, type: 'Theory' },
        { name: 'Digital Signal Processing', credits: 4, type: 'Theory' },
        { name: 'VLSI Design', credits: 3, type: 'Theory' },
        { name: 'Transmission Lines and Waveguides', credits: 3, type: 'Theory' },
        { name: 'Embedded Systems', credits: 3, type: 'Theory' },
        { name: 'DSP Lab', credits: 2, type: 'Practical' },
      ],
      6: [
        { name: 'Wireless Communication', credits: 4, type: 'Theory' },
        { name: 'Antenna and Propagation', credits: 3, type: 'Theory' },
        { name: 'Digital Image Processing', credits: 3, type: 'Theory' },
        { name: 'CMOS VLSI', credits: 3, type: 'Theory' },
        { name: 'Internet of Things', credits: 3, type: 'Theory' },
        { name: 'Communication Lab', credits: 2, type: 'Practical' },
      ],
      7: [
        { name: 'Radar Systems', credits: 3, type: 'Theory' },
        { name: '5G Networks', credits: 3, type: 'Theory' },
        { name: 'Advanced Embedded Systems', credits: 4, type: 'Theory' },
        { name: 'Professional Elective I', credits: 3, type: 'Elective' },
        { name: 'Seminar', credits: 2, type: 'Practical' },
        { name: 'Project Phase I', credits: 2, type: 'Practical' },
      ],
      8: [
        { name: 'Satellite Communication', credits: 3, type: 'Theory' },
        { name: 'Optical Networks', credits: 3, type: 'Theory' },
        { name: 'Professional Elective II', credits: 3, type: 'Elective' },
        { name: 'VLSI Testing', credits: 3, type: 'Theory' },
        { name: 'Internship Seminar', credits: 2, type: 'Practical' },
        { name: 'Project Phase II', credits: 4, type: 'Practical' },
      ],
    },
    MECH: {
      3: [
        { name: 'Engineering Mechanics', credits: 4, type: 'Theory' },
        { name: 'Material Science', credits: 3, type: 'Theory' },
        { name: 'Manufacturing Processes', credits: 4, type: 'Theory' },
        { name: 'Thermodynamics', credits: 3, type: 'Theory' },
        { name: 'Machine Drawing', credits: 3, type: 'Theory' },
        { name: 'Workshop Lab', credits: 2, type: 'Practical' },
      ],
      4: [
        { name: 'Fluid Mechanics', credits: 4, type: 'Theory' },
        { name: 'Kinematics of Machinery', credits: 4, type: 'Theory' },
        { name: 'Machine Tools', credits: 3, type: 'Theory' },
        { name: 'Strength of Materials', credits: 3, type: 'Theory' },
        { name: 'Metrology', credits: 3, type: 'Theory' },
        { name: 'Mechanics Lab', credits: 2, type: 'Practical' },
      ],
      5: [
        { name: 'Heat Transfer', credits: 4, type: 'Theory' },
        { name: 'Dynamics of Machinery', credits: 4, type: 'Theory' },
        { name: 'Design of Machine Elements', credits: 3, type: 'Theory' },
        { name: 'Industrial Engineering', credits: 3, type: 'Theory' },
        { name: 'Hydraulic Machinery', credits: 3, type: 'Theory' },
        { name: 'CAD Lab', credits: 2, type: 'Practical' },
      ],
      6: [
        { name: 'Finite Element Methods', credits: 4, type: 'Theory' },
        { name: 'Refrigeration and Air Conditioning', credits: 3, type: 'Theory' },
        { name: 'Automobile Engineering', credits: 3, type: 'Theory' },
        { name: 'Robotics', credits: 3, type: 'Theory' },
        { name: 'Quality Engineering', credits: 3, type: 'Theory' },
        { name: 'Thermal Lab', credits: 2, type: 'Practical' },
      ],
      7: [
        { name: 'Renewable Energy Systems', credits: 3, type: 'Theory' },
        { name: 'Advanced Manufacturing', credits: 3, type: 'Theory' },
        { name: 'Professional Elective I', credits: 3, type: 'Elective' },
        { name: 'Operations Research', credits: 3, type: 'Theory' },
        { name: 'Seminar', credits: 2, type: 'Practical' },
        { name: 'Project Phase I', credits: 2, type: 'Practical' },
      ],
      8: [
        { name: 'Mechatronics', credits: 3, type: 'Theory' },
        { name: 'Professional Elective II', credits: 3, type: 'Elective' },
        { name: 'Maintenance Engineering', credits: 3, type: 'Theory' },
        { name: 'Product Design', credits: 3, type: 'Theory' },
        { name: 'Internship Seminar', credits: 2, type: 'Practical' },
        { name: 'Project Phase II', credits: 4, type: 'Practical' },
      ],
    },
    CIVIL: {
      3: [
        { name: 'Surveying', credits: 4, type: 'Theory' },
        { name: 'Strength of Materials', credits: 4, type: 'Theory' },
        { name: 'Building Materials', credits: 3, type: 'Theory' },
        { name: 'Fluid Mechanics', credits: 3, type: 'Theory' },
        { name: 'Engineering Geology', credits: 3, type: 'Theory' },
        { name: 'Surveying Lab', credits: 2, type: 'Practical' },
      ],
      4: [
        { name: 'Structural Analysis', credits: 4, type: 'Theory' },
        { name: 'Concrete Technology', credits: 3, type: 'Theory' },
        { name: 'Hydraulics', credits: 4, type: 'Theory' },
        { name: 'Soil Mechanics', credits: 3, type: 'Theory' },
        { name: 'Transportation Engineering', credits: 3, type: 'Theory' },
        { name: 'Materials Lab', credits: 2, type: 'Practical' },
      ],
      5: [
        { name: 'Design of Reinforced Concrete Structures', credits: 4, type: 'Theory' },
        { name: 'Environmental Engineering', credits: 4, type: 'Theory' },
        { name: 'Foundation Engineering', credits: 3, type: 'Theory' },
        { name: 'Water Resources Engineering', credits: 3, type: 'Theory' },
        { name: 'Estimation and Costing', credits: 3, type: 'Theory' },
        { name: 'Concrete Lab', credits: 2, type: 'Practical' },
      ],
      6: [
        { name: 'Steel Structures', credits: 4, type: 'Theory' },
        { name: 'Construction Planning', credits: 3, type: 'Theory' },
        { name: 'Pavement Engineering', credits: 3, type: 'Theory' },
        { name: 'Advanced Surveying', credits: 3, type: 'Theory' },
        { name: 'Remote Sensing', credits: 3, type: 'Theory' },
        { name: 'Hydraulics Lab', credits: 2, type: 'Practical' },
      ],
      7: [
        { name: 'Bridge Engineering', credits: 3, type: 'Theory' },
        { name: 'Town Planning', credits: 3, type: 'Theory' },
        { name: 'Professional Elective I', credits: 3, type: 'Elective' },
        { name: 'Quantity Surveying', credits: 3, type: 'Theory' },
        { name: 'Seminar', credits: 2, type: 'Practical' },
        { name: 'Project Phase I', credits: 2, type: 'Practical' },
      ],
      8: [
        { name: 'Advanced Concrete Technology', credits: 3, type: 'Theory' },
        { name: 'Professional Elective II', credits: 3, type: 'Elective' },
        { name: 'Earthquake Engineering', credits: 3, type: 'Theory' },
        { name: 'Construction Safety', credits: 3, type: 'Theory' },
        { name: 'Internship Seminar', credits: 2, type: 'Practical' },
        { name: 'Project Phase II', credits: 4, type: 'Practical' },
      ],
    },
    IT: {
      3: [
        { name: 'Object Oriented Analysis', credits: 4, type: 'Theory' },
        { name: 'Discrete Structures', credits: 4, type: 'Theory' },
        { name: 'Database Management Systems', credits: 3, type: 'Theory' },
        { name: 'Digital Principles', credits: 3, type: 'Theory' },
        { name: 'Statistics for IT', credits: 3, type: 'Theory' },
        { name: 'DBMS Lab', credits: 2, type: 'Practical' },
      ],
      4: [
        { name: 'Operating Systems', credits: 4, type: 'Theory' },
        { name: 'Design of Algorithms', credits: 4, type: 'Theory' },
        { name: 'Web Application Development', credits: 3, type: 'Theory' },
        { name: 'Software Testing', credits: 3, type: 'Theory' },
        { name: 'Computer Organization', credits: 3, type: 'Theory' },
        { name: 'Web Development Lab', credits: 2, type: 'Practical' },
      ],
      5: [
        { name: 'Computer Networks', credits: 4, type: 'Theory' },
        { name: 'Data Analytics', credits: 4, type: 'Theory' },
        { name: 'Cloud Foundations', credits: 3, type: 'Theory' },
        { name: 'Information Security', credits: 3, type: 'Theory' },
        { name: 'Java Technologies', credits: 3, type: 'Theory' },
        { name: 'Data Analytics Lab', credits: 2, type: 'Practical' },
      ],
      6: [
        { name: 'Machine Learning for IT', credits: 4, type: 'Theory' },
        { name: 'DevOps', credits: 3, type: 'Theory' },
        { name: 'Mobile Application Development', credits: 3, type: 'Theory' },
        { name: 'Data Mining', credits: 3, type: 'Theory' },
        { name: 'Internet of Things', credits: 3, type: 'Theory' },
        { name: 'Mobile Development Lab', credits: 2, type: 'Practical' },
      ],
      7: [
        { name: 'Cyber Security', credits: 4, type: 'Theory' },
        { name: 'Enterprise Application Integration', credits: 3, type: 'Theory' },
        { name: 'Professional Elective I', credits: 3, type: 'Elective' },
        { name: 'Big Data Engineering', credits: 3, type: 'Theory' },
        { name: 'Seminar', credits: 2, type: 'Practical' },
        { name: 'Project Phase I', credits: 2, type: 'Practical' },
      ],
      8: [
        { name: 'Artificial Intelligence in Practice', credits: 4, type: 'Theory' },
        { name: 'Professional Elective II', credits: 3, type: 'Elective' },
        { name: 'Blockchain for IT', credits: 3, type: 'Theory' },
        { name: 'IT Service Management', credits: 3, type: 'Theory' },
        { name: 'Internship Seminar', credits: 2, type: 'Practical' },
        { name: 'Project Phase II', credits: 4, type: 'Practical' },
      ],
    },
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function roundTo(value, digits = 2) {
    return Number(value.toFixed(digits));
  }

  function getAcademicYearLabel(batchYear, semester) {
    const startYear = batchYear + Math.floor((semester - 1) / 2);
    const endYear = String((startYear + 1) % 100).padStart(2, '0');
    return `${startYear}-${endYear}`;
  }

  function getAcademicYearStart(academicYear) {
    return Number(String(academicYear || '').slice(0, 4));
  }

  function getAttendanceYearSwing(academicYear) {
    const startYear = getAcademicYearStart(academicYear);
    return ATTENDANCE_YEAR_SWINGS[startYear] || 0;
  }

  function getGradeDetails(total) {
    if (total >= 90) return { grade: 'O', gradePoints: 10 };
    if (total >= 80) return { grade: 'A+', gradePoints: 9 };
    if (total >= 70) return { grade: 'A', gradePoints: 8 };
    if (total >= 60) return { grade: 'B+', gradePoints: 7 };
    if (total >= 55) return { grade: 'B', gradePoints: 6 };
    if (total >= 50) return { grade: 'C', gradePoints: 5 };
    if (total >= 45) return { grade: 'D', gradePoints: 4 };
    return { grade: 'F', gradePoints: 0 };
  }

  function pickWeighted(items) {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let cursor = faker.number.int({ min: 1, max: totalWeight });

    for (const item of items) {
      cursor -= item.weight;
      if (cursor <= 0) {
        return item.value;
      }
    }

    return items[items.length - 1].value;
  }

  function buildCurriculumForDepartment(departmentCode) {
    const specialized = DEPARTMENT_CURRICULUM[departmentCode] || DEPARTMENT_CURRICULUM.CSE;
    return {
      ...COMMON_CURRICULUM,
      ...specialized,
    };
  }

  function buildSubjectDocs(departments, facultyByDepartment) {
    const subjectDocs = [];

    for (const department of departments) {
      const curriculum = buildCurriculumForDepartment(department.code);
      const facultyPool = facultyByDepartment.get(String(department._id)) || [];

      for (let semester = 1; semester <= MAX_SEMESTER; semester += 1) {
        const semesterSubjects = curriculum[semester] || [];

        semesterSubjects.forEach((subject, index) => {
          const faculty = facultyPool.length
            ? faker.helpers.arrayElement(facultyPool)
            : undefined;

          subjectDocs.push({
            name: subject.name,
            code: `${department.code}${String(semester).padStart(2, '0')}${String(index + 1).padStart(2, '0')}`,
            department: department._id,
            semester,
            faculty,
            credits: subject.credits,
            type: subject.type,
          });
        });
      }
    }

    return subjectDocs;
  }

  function createStudentProfile() {
    return {
      marksProfile: pickWeighted([
        { value: 'average', weight: 70 },
        { value: 'weak', weight: 15 },
        { value: 'topper', weight: 15 },
      ]),
      attendanceProfile: pickWeighted([
        { value: 'regular', weight: 60 },
        { value: 'high', weight: 20 },
        { value: 'low', weight: 20 },
      ]),
    };
  }

  function generatePassingScores(profile, semester, subject) {
    const semesterBoost = Math.floor((semester - 1) / 2);
    const practicalBoost = subject.type === 'Practical' ? 2 : 0;

    let internalRange;
    let externalRange;

    if (profile === 'weak') {
      internalRange = { min: 12, max: 24 };
      externalRange = { min: 24, max: 38 };
    } else if (profile === 'topper') {
      internalRange = { min: 30, max: 40 };
      externalRange = { min: 42, max: 60 };
    } else {
      internalRange = { min: 18, max: 30 };
      externalRange = { min: 30, max: 46 };
    }

    let internal = faker.number.int({
      min: internalRange.min,
      max: clamp(internalRange.max + semesterBoost + practicalBoost, 0, 40),
    });
    let external = faker.number.int({
      min: clamp(externalRange.min + practicalBoost, PASSING_EXTERNAL_MIN, 60),
      max: clamp(externalRange.max + semesterBoost + practicalBoost, PASSING_EXTERNAL_MIN, 60),
    });

    internal = clamp(internal, 0, 40);
    external = clamp(external, PASSING_EXTERNAL_MIN, 60);

    if (internal + external < PASSING_TOTAL_MIN) {
      internal = clamp(PASSING_TOTAL_MIN - external, 0, 40);
    }

    if (internal + external > 100) {
      const overflow = internal + external - 100;
      if (external - overflow >= PASSING_EXTERNAL_MIN) {
        external -= overflow;
      } else {
        internal = clamp(internal - overflow, 0, 40);
      }
    }

    return { internal, external };
  }

  function generateFailingScores(profile, semester, subject) {
    const failureMode = faker.helpers.arrayElement(['lowTotal', 'lowExternal']);
    const semesterBoost = Math.floor((semester - 1) / 3);
    const practicalBoost = subject.type === 'Practical' ? 1 : 0;

    let internal;
    let external;

    if (failureMode === 'lowTotal') {
      if (profile === 'topper') {
        internal = faker.number.int({ min: 16, max: 24 });
        external = faker.number.int({ min: 14, max: 22 });
      } else if (profile === 'average') {
        internal = faker.number.int({ min: 10, max: 22 });
        external = faker.number.int({ min: 12, max: 23 });
      } else {
        internal = faker.number.int({ min: 6, max: 18 });
        external = faker.number.int({ min: 8, max: 22 });
      }

      internal = clamp(internal + practicalBoost, 0, 40);
      external = clamp(external + semesterBoost, 0, PASSING_EXTERNAL_MIN - 1);

      while (internal + external >= PASSING_TOTAL_MIN) {
        if (internal > 0) {
          internal -= 1;
        } else {
          external = Math.max(0, external - 1);
        }
      }
    } else {
      if (profile === 'topper') {
        internal = faker.number.int({ min: 26, max: 36 });
        external = faker.number.int({ min: 18, max: 23 });
      } else if (profile === 'average') {
        internal = faker.number.int({ min: 18, max: 30 });
        external = faker.number.int({ min: 15, max: 23 });
      } else {
        internal = faker.number.int({ min: 10, max: 22 });
        external = faker.number.int({ min: 10, max: 23 });
      }

      internal = clamp(internal + semesterBoost + practicalBoost, 0, 40);
      external = clamp(external + practicalBoost, 0, PASSING_EXTERNAL_MIN - 1);
    }

    return { internal, external };
  }

  function generateMarksRecord(studentProfile, subject, semester, academicYear) {
    const passChanceByProfile = {
      weak: 68,
      average: 92,
      topper: 99,
    };

    const willPass = faker.number.int({ min: 1, max: 100 }) <= passChanceByProfile[studentProfile];
    const scoreBreakdown = willPass
      ? generatePassingScores(studentProfile, semester, subject)
      : generateFailingScores(studentProfile, semester, subject);

    const total = scoreBreakdown.internal + scoreBreakdown.external;
    const { grade, gradePoints } = getGradeDetails(total);
    const result = total >= PASSING_TOTAL_MIN && scoreBreakdown.external >= PASSING_EXTERNAL_MIN
      ? 'PASS'
      : 'FAIL';

    return {
      semester,
      academicYear,
      internal: scoreBreakdown.internal,
      external: scoreBreakdown.external,
      total,
      grade,
      gradePoints,
      result,
    };
  }

  function generateAttendanceRecord(attendanceProfile, subject, semester, academicYear) {
    const practicalBoost = subject.type === 'Practical' ? 2 : 0;
    const totalClasses = faker.number.int({ min: 40, max: 60 });
    let targetPercentage;

    if (attendanceProfile === 'low') {
      targetPercentage = faker.number.int({ min: 58, max: 74 });
    } else if (attendanceProfile === 'high') {
      targetPercentage = faker.number.int({ min: 88, max: 98 });
    } else {
      targetPercentage = faker.number.int({ min: 76, max: 90 });
    }

    targetPercentage = clamp(
      targetPercentage
        + practicalBoost
        - Math.floor((semester - 1) / 4)
        + getAttendanceYearSwing(academicYear),
      50,
      99
    );

    const attendedClasses = clamp(
      Math.round((targetPercentage / 100) * totalClasses),
      0,
      totalClasses
    );
    const percentage = roundTo((attendedClasses / totalClasses) * 100, 2);

    return {
      semester,
      academicYear,
      attendedClasses,
      totalClasses,
      percentage,
      isBelowThreshold: percentage < 75,
    };
  }

  async function flushInsertBuffer(Model, buffer) {
    if (!buffer.length) {
      return;
    }

    const docs = buffer.splice(0, buffer.length);
    await Model.insertMany(docs, { ordered: false });
  }

  async function flushBulkUpdates(buffer) {
    if (!buffer.length) {
      return;
    }

    const operations = buffer.splice(0, buffer.length);
    await Student.bulkWrite(operations, { ordered: false });
  }

  function buildYearlyCgpa(semesterCgpa = []) {
    const yearlyMap = new Map();

    semesterCgpa.forEach((record) => {
      if (!record?.academicYear) {
        return;
      }

      const existing = yearlyMap.get(record.academicYear);
      if (!existing || record.semester > existing.semester) {
        yearlyMap.set(record.academicYear, record);
      }
    });

    return Array.from(yearlyMap.values())
      .sort((a, b) => a.semester - b.semester)
      .map((record, index) => ({
        year: index + 1,
        academicYear: record.academicYear,
        cgpa: record.cgpa,
      }));
  }

  async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    await Promise.all([
      Marks.deleteMany({}),
      Attendance.deleteMany({}),
      StudentSemesterPerformance.deleteMany({}),
      StudentSemesterAttendance.deleteMany({}),
      Subject.deleteMany({}),
    ]);

    const [departments, faculty, students] = await Promise.all([
      Department.find({}).lean(),
      Faculty.find({}).select('_id department').lean(),
      Student.find({}).select('_id department batchYear currentSemester').lean(),
    ]);

    if (!departments.length) {
      throw new Error('No departments found. Run seedStudents.js first.');
    }

    if (!students.length) {
      throw new Error('No students found. Run seedStudents.js first.');
    }

    const facultyByDepartment = faculty.reduce((map, facultyDoc) => {
      const key = String(facultyDoc.department);
      const bucket = map.get(key) || [];
      bucket.push(facultyDoc._id);
      map.set(key, bucket);
      return map;
    }, new Map());

    const subjectDocs = buildSubjectDocs(departments, facultyByDepartment);
    const subjects = await Subject.insertMany(subjectDocs, { ordered: false });
    console.log(`Created subjects: ${subjects.length}`);

    const subjectMap = subjects.reduce((map, subject) => {
      const key = `${subject.department.toString()}-${subject.semester}`;
      const bucket = map.get(key) || [];
      bucket.push(subject);
      map.set(key, bucket);
      return map;
    }, new Map());

    const marksBuffer = [];
    const attendanceBuffer = [];
    const performanceBuffer = [];
    const semesterAttendanceBuffer = [];
    const studentUpdateBuffer = [];

    const marksKeys = new Set();
    const attendanceKeys = new Set();
    const performanceKeys = new Set();
    const semesterAttendanceKeys = new Set();

    let marksCount = 0;
    let attendanceCount = 0;
    let performanceCount = 0;
    let semesterAttendanceCount = 0;

    for (const student of students) {
      const studentProfile = createStudentProfile();
      const studentDepartment = String(student.department);
      const currentSemester = clamp(student.currentSemester || 1, 1, MAX_SEMESTER);

      let cumulativeSgpa = 0;
      let sgpaCount = 0;
      let totalMarksSum = 0;
      let marksRecordCount = 0;
      let totalAttendedClasses = 0;
      let totalScheduledClasses = 0;
      let totalEarnedCredits = 0;
      let currentBacklogs = 0;
      const semesterCgpa = [];

      for (let semester = 1; semester <= currentSemester; semester += 1) {
        const semesterSubjects = subjectMap.get(`${studentDepartment}-${semester}`) || [];

        if (!semesterSubjects.length) {
          continue;
        }

        const academicYear = getAcademicYearLabel(student.batchYear, semester);
        let semesterCredits = 0;
        let semesterEarnedCredits = 0;
        let semesterWeightedPoints = 0;
        let semesterAttendedClasses = 0;
        let semesterTotalClasses = 0;
        let semesterFailures = 0;

        for (const subject of semesterSubjects) {
          const marksKey = `${student._id}-${subject._id}-${semester}-${academicYear}`;
          if (!marksKeys.has(marksKey)) {
            const marksRecord = generateMarksRecord(
              studentProfile.marksProfile,
              subject,
              semester,
              academicYear
            );

            marksKeys.add(marksKey);
            marksBuffer.push({
              student: student._id,
              subject: subject._id,
              ...marksRecord,
            });
            marksCount += 1;

            totalMarksSum += marksRecord.total;
            marksRecordCount += 1;
            semesterCredits += subject.credits;
            semesterWeightedPoints += marksRecord.gradePoints * subject.credits;

            if (marksRecord.result === 'PASS') {
              semesterEarnedCredits += subject.credits;
            } else {
              semesterFailures += 1;
            }
          }

          const attendanceKey = `${student._id}-${subject._id}-${semester}-${academicYear}`;
          if (!attendanceKeys.has(attendanceKey)) {
            const attendanceRecord = generateAttendanceRecord(
              studentProfile.attendanceProfile,
              subject,
              semester,
              academicYear
            );

            attendanceKeys.add(attendanceKey);
            attendanceBuffer.push({
              student: student._id,
              subject: subject._id,
              ...attendanceRecord,
            });
            attendanceCount += 1;

            semesterAttendedClasses += attendanceRecord.attendedClasses;
            semesterTotalClasses += attendanceRecord.totalClasses;
            totalAttendedClasses += attendanceRecord.attendedClasses;
            totalScheduledClasses += attendanceRecord.totalClasses;
          }

          if (marksBuffer.length >= BATCH_SIZE) {
            await flushInsertBuffer(Marks, marksBuffer);
          }

          if (attendanceBuffer.length >= BATCH_SIZE) {
            await flushInsertBuffer(Attendance, attendanceBuffer);
          }
        }

        const sgpa = semesterCredits
          ? roundTo(semesterWeightedPoints / semesterCredits)
          : 0;
        cumulativeSgpa += sgpa;
        sgpaCount += 1;
        const cgpa = sgpaCount ? roundTo(cumulativeSgpa / sgpaCount) : 0;
        const attendancePercentage = semesterTotalClasses
          ? roundTo((semesterAttendedClasses / semesterTotalClasses) * 100)
          : 0;

        totalEarnedCredits += semesterEarnedCredits;
        semesterCgpa.push({
          semester,
          academicYear,
          cgpa,
        });

        const performanceKey = `${student._id}-${semester}-${academicYear}`;
        if (!performanceKeys.has(performanceKey)) {
          performanceKeys.add(performanceKey);
          performanceBuffer.push({
            student: student._id,
            semester,
            academicYear,
            sgpa,
            cgpa,
            totalCredits: semesterCredits,
            earnedCredits: semesterEarnedCredits,
          });
          performanceCount += 1;
        }

        const semesterAttendanceKey = `${student._id}-${semester}-${academicYear}`;
        if (!semesterAttendanceKeys.has(semesterAttendanceKey)) {
          semesterAttendanceKeys.add(semesterAttendanceKey);
          semesterAttendanceBuffer.push({
            student: student._id,
            semester,
            academicYear,
            attendedClasses: semesterAttendedClasses,
            totalClasses: semesterTotalClasses,
            percentage: attendancePercentage,
            isBelowThreshold: attendancePercentage < 75,
          });
          semesterAttendanceCount += 1;
        }

        if (performanceBuffer.length >= BATCH_SIZE) {
          await flushInsertBuffer(StudentSemesterPerformance, performanceBuffer);
        }

        if (semesterAttendanceBuffer.length >= BATCH_SIZE) {
          await flushInsertBuffer(StudentSemesterAttendance, semesterAttendanceBuffer);
        }

        if (semester === currentSemester) {
          currentBacklogs = semesterFailures;
        }
      }

      const finalCgpa = semesterCgpa.length ? semesterCgpa[semesterCgpa.length - 1].cgpa : 0;
      const yearlyCgpa = buildYearlyCgpa(semesterCgpa);
      const averageMarks = marksRecordCount ? roundTo(totalMarksSum / marksRecordCount) : 0;
      const averageAttendance = totalScheduledClasses
        ? roundTo((totalAttendedClasses / totalScheduledClasses) * 100)
        : 0;
      const performance = calculateStudentPerformance({
        cgpa: finalCgpa,
        currentBacklogs,
        academicRecords: {
          avgAttendance: averageAttendance,
        },
      });

      studentUpdateBuffer.push({
        updateOne: {
          filter: { _id: student._id },
          update: {
            $set: {
              cgpa: finalCgpa,
              performanceScore: performance.performanceScore,
              performanceCategory: performance.category,
              isAtRisk: performance.isAtRisk,
              riskReasons: performance.riskReasons,
              currentBacklogs,
              'academicRecords.latestSemester': currentSemester,
              'academicRecords.latestAcademicYear': semesterCgpa.length
                ? semesterCgpa[semesterCgpa.length - 1].academicYear
                : undefined,
              'academicRecords.avgMarks': averageMarks,
              'academicRecords.avgAttendance': averageAttendance,
              'academicRecords.creditsEarned': totalEarnedCredits,
              'academicRecords.performanceBand': performance.category,
              'academicRecords.semesterCgpa': semesterCgpa,
              'academicRecords.yearlyCgpa': yearlyCgpa,
            },
          },
        },
      });

      if (studentUpdateBuffer.length >= BATCH_SIZE) {
        await flushBulkUpdates(studentUpdateBuffer);
      }
    }

    await flushInsertBuffer(Marks, marksBuffer);
    await flushInsertBuffer(Attendance, attendanceBuffer);
    await flushInsertBuffer(StudentSemesterPerformance, performanceBuffer);
    await flushInsertBuffer(StudentSemesterAttendance, semesterAttendanceBuffer);
    await flushBulkUpdates(studentUpdateBuffer);

    console.log(`Generated marks: ${marksCount}`);
    console.log(`Generated semester performance: ${performanceCount}`);
    console.log(`Generated attendance: ${attendanceCount} subject records, ${semesterAttendanceCount} semester summaries`);
    console.log('Seed completed');

    await mongoose.disconnect();
  }

  run().catch(async (error) => {
    console.error('Seed failed:', error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
