/**
 * Seed script: Generates achievements, events, participations, NBA/NAAC criteria, and documents
 * Run AFTER seedStudents.js: node scripts/seedNewFeatures.js
 */
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const dotenv = require('dotenv');
dotenv.config();

const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const Department = require('../models/Department');
const User = require('../models/User');
const FacultyAchievement = require('../models/FacultyAchievement');
const { Event, Participation } = require('../models/Event');
const NBACriteria = require('../models/NBACriteria');
const NAACCriteria = require('../models/NAACCriteria');
const Document = require('../models/Document');

const ACHIEVEMENT_TYPES = ['Award', 'Certification', 'Recognition', 'Publication', 'Grant', 'Patent', 'Conference', 'Workshop'];
const ACHIEVEMENT_LEVELS = ['International', 'National', 'State', 'Institutional'];
const EVENT_TYPES = ['Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar', 'Competition', 'Hackathon', 'Conference'];
const EVENT_LEVELS = ['International', 'National', 'State', 'Regional', 'Institutional'];
const EVENT_ROLES = ['Participant', 'Winner', 'Runner-up', 'Organizer', 'Volunteer', 'Coordinator'];
const EVENT_TIMELINES = ['past', 'ongoing', 'upcoming'];

const addDays = (date, days) => new Date(date.getTime() + (days * 24 * 60 * 60 * 1000));

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Clear existing new feature data
  await Promise.all([
    FacultyAchievement.deleteMany({}),
    Event.deleteMany({}),
    Participation.deleteMany({}),
    NBACriteria.deleteMany({}),
    NAACCriteria.deleteMany({}),
    Document.deleteMany({}),
  ]);
  console.log('🗑️  Cleared existing new feature data');

  const departments = await Department.find({});
  const faculty = await Faculty.find({});
  const students = await Student.find({});
  const existingUsers = await User.find({}).select('_id name email role department');
  const usersByEmail = new Map(existingUsers.map((user) => [user.email, user]));
  const facultyByDept = new Map();
  const facultyUploaderMap = new Map();

  for (const fac of faculty) {
    let linkedUser = usersByEmail.get(fac.email);

    if (!linkedUser) {
      linkedUser = await User.create({
        name: fac.name,
        email: fac.email,
        password: 'Faculty@123',
        role: 'faculty',
        department: fac.department,
      });
      usersByEmail.set(linkedUser.email, linkedUser);
    }

    facultyUploaderMap.set(fac._id.toString(), linkedUser._id);

    const deptKey = fac.department.toString();
    if (!facultyByDept.has(deptKey)) {
      facultyByDept.set(deptKey, []);
    }
    facultyByDept.get(deptKey).push(fac);
  }

  // ── Generate Faculty Achievements ─────────────────────────────────────────────
  console.log('⏳ Generating faculty achievements...');
  const achievements = [];
  for (let i = 0; i < 100; i++) {
    const fac = faker.helpers.arrayElement(faculty);
    achievements.push({
      faculty: fac._id,
      type: faker.helpers.arrayElement(ACHIEVEMENT_TYPES),
      title: `${faker.helpers.arrayElement(['Best', 'Outstanding', 'Excellence in'])} ${faker.helpers.arrayElement(['Research', 'Teaching', 'Service', 'Innovation'])} ${faker.helpers.arrayElement(['Award', 'Recognition', 'Achievement'])}`,
      description: faker.lorem.sentences(2),
      issuingOrganization: faker.company.name(),
      date: faker.date.past({ years: 3 }),
      level: faker.helpers.arrayElement(ACHIEVEMENT_LEVELS),
      category: faker.helpers.arrayElement(['Academic', 'Research', 'Teaching', 'Service', 'Professional Development']),
      points: faker.number.int({ min: 5, max: 50 }),
      isActive: true,
    });
  }
  await FacultyAchievement.insertMany(achievements);
  console.log(`✅ Created ${achievements.length} faculty achievements`);

  // ── Generate Events ─────────────────────────────────────────────────────────
  console.log('⏳ Generating events...');
  const events = [];
  const now = new Date();
  for (let i = 0; i < 50; i++) {
    const dept = faker.helpers.arrayElement(departments);
    const timeline = faker.helpers.arrayElement(EVENT_TIMELINES);
    const departmentScope = faker.helpers.arrayElement(['DEPARTMENT', 'DEPARTMENT', 'ALL']);
    let startDate;
    let endDate;

    if (timeline === 'ongoing') {
      startDate = faker.date.recent({ days: 12, refDate: now });
      endDate = addDays(now, faker.number.int({ min: 1, max: 10 }));
    } else if (timeline === 'upcoming') {
      startDate = faker.date.soon({ days: 120, refDate: now });
      endDate = addDays(startDate, faker.number.int({ min: 1, max: 7 }));
    } else {
      startDate = faker.date.past({ years: 2, refDate: addDays(now, -14) });
      endDate = addDays(startDate, faker.number.int({ min: 1, max: 7 }));
    }

    events.push({
      title: `${faker.helpers.arrayElement(['Annual', 'National', 'Technical', 'Cultural'])} ${faker.helpers.arrayElement(['Symposium', 'Conference', 'Workshop', 'Competition', 'Fest', 'Hackathon'])}`,
      description: faker.lorem.sentences(2),
      type: faker.helpers.arrayElement(EVENT_TYPES),
      level: faker.helpers.arrayElement(EVENT_LEVELS),
      startDate,
      endDate,
      location: faker.helpers.arrayElement(['Main Auditorium', 'Conference Hall', 'Sports Ground', 'Lab Complex', 'Online Platform']),
      organizingBody: departmentScope === 'ALL' ? 'IQAC Central Events Cell' : `${dept.name} Department`,
      departmentScope,
      department: departmentScope === 'ALL' ? undefined : dept._id,
      isActive: true,
    });
  }
  await Event.insertMany(events);
  console.log(`✅ Created ${events.length} events`);

  // ── Generate Event Participations ───────────────────────────────────────
  console.log('⏳ Generating event participations...');
  const participations = [];
  
  // Get the saved events with their IDs
  const savedEvents = await Event.find({});
  for (const event of savedEvents.slice(0, 30)) { // Add participations to first 30 events
    const participantCount = faker.number.int({ min: 5, max: 50 });
    const eligibleStudents = event.departmentScope === 'ALL'
      ? students
      : students.filter((student) => student.department.toString() === event.department.toString());
    const eventStudents = faker.helpers.arrayElements(eligibleStudents, Math.min(participantCount, eligibleStudents.length));
    
    for (const student of eventStudents) {
      const role = faker.helpers.arrayElement(EVENT_ROLES);
      const eventAlreadyEnded = new Date(event.endDate) < now;
      const registeredAt = addDays(new Date(event.startDate), faker.number.int({ min: -12, max: -1 }));
      participations.push({
        student: student._id,
        event: event._id,
        role,
        position: (role === 'Winner' || role === 'Runner-up') ? faker.number.int({ min: 1, max: 10 }) : null,
        achievement: role === 'Winner' ? 'First Place' : role === 'Runner-up' ? 'Second Place' : '',
        pointsEarned: role === 'Winner' ? 10 : role === 'Runner-up' ? 7 : role === 'Participant' ? 3 : 2,
        message: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.55 }) || '',
        registeredAt,
        status: eventAlreadyEnded ? 'Participated' : 'Registered',
        attended: true,
      });
    }
  }
  await Participation.insertMany(participations);
  console.log(`✅ Created ${participations.length} event participations`);

  // ── Generate NBA Criteria ─────────────────────────────────────────────────────
  console.log('⏳ Generating NBA criteria...');
  const nbaCriteria = [];
  const nbaCriteriaTypes = ['Vision', 'Mission', 'PEO', 'PO', 'PSO', 'CO', 'Curriculum', 'Assessment', 'Facilities', 'Faculty', 'StudentPerformance', 'ContinuousImprovement'];
  
  for (const dept of departments) {
    for (const criteriaType of nbaCriteriaTypes) {
      nbaCriteria.push({
        program: dept._id,
        academicYear: '2023-24',
        criteria: criteriaType,
        title: `${criteriaType} - ${dept.code}`,
        description: `Program Educational Objectives and Outcomes for ${dept.name}`,
        targetValue: faker.number.int({ min: 70, max: 100 }),
        actualValue: faker.number.int({ min: 60, max: 95 }),
        threshold: 60,
        unit: 'Percentage',
        measurements: [{
          date: faker.date.past({ months: 6 }),
          value: faker.number.int({ min: 65, max: 90 }),
          remarks: faker.lorem.sentence(),
        }],
        status: faker.helpers.arrayElement(['In Progress', 'Met', 'Not Met']),
        complianceScore: faker.number.int({ min: 50, max: 95 }),
        isActive: true,
      });
    }
  }
  await NBACriteria.insertMany(nbaCriteria);
  console.log(`✅ Created ${nbaCriteria.length} NBA criteria`);

  // ── Generate NAAC Criteria ────────────────────────────────────────────────────
  console.log('⏳ Generating NAAC criteria...');
  const naacCriteriaTypes = [
    'Curricular Aspects', 'Teaching-Learning and Evaluation', 'Research, Consultancy and Extension',
    'Infrastructure and Learning Resources', 'Student Support and Progression',
    'Governance, Leadership and Management', 'Innovations and Best Practices'
  ];
  const naacCriteria = [];
  
  for (const criterionType of naacCriteriaTypes) {
    for (let i = 1; i <= 3; i++) {
      naacCriteria.push({
        institution: 'IQAC Institution',
        academicYear: '2023-24',
        criterion: criterionType,
        keyIndicator: `Key Indicator ${i}`,
        metric: `Metric ${i} for ${criterionType}`,
        description: `Description for ${criterionType} metric ${i}`,
        dataPoints: [{
          name: `Data Point ${i}`,
          value: faker.datatype.number({ min: 50, max: 150 }),
          unit: 'Number',
          source: 'Institutional Records',
        }],
        quantitativeMetric: {
          target: faker.number.int({ min: 80, max: 100 }),
          achieved: faker.number.int({ min: 60, max: 95 }),
          weightage: 1,
          score: faker.number.int({ min: 2, max: 4 }),
        },
        status: faker.helpers.arrayElement(['Data Collection', 'Analysis', 'Report Generation']),
        complianceLevel: faker.helpers.arrayElement(['Not Compliant', 'Partially Compliant', 'Compliant', 'Exemplary']),
        isActive: true,
      });
    }
  }
  await NAACCriteria.insertMany(naacCriteria);
  console.log(`✅ Created ${naacCriteria.length} NAAC criteria`);

  // ── Generate Documents ──────────────────────────────────────────────────────────
  console.log('⏳ Generating documents...');
  const documents = [];
  const documentTypes = ['NBA', 'NAAC', 'Internal', 'External'];
  const categories = ['Accreditation', 'Academic', 'Administrative', 'Research', 'Student', 'Faculty', 'Infrastructure'];
  
  for (let i = 0; i < 80; i++) {
    const type = faker.helpers.arrayElement(documentTypes);
    const category = faker.helpers.arrayElement(categories);
    const dept = faker.helpers.arrayElement(departments);
    const uploaderFaculty = faker.helpers.arrayElement(facultyByDept.get(dept._id.toString()) || faculty);
    
    documents.push({
      title: `${type} ${faker.helpers.arrayElement(['Report', 'Certificate', 'Guidelines', 'Policy', 'Manual'])} ${faker.number.int({ min: 1, max: 12 })}`,
      description: faker.lorem.sentences(2),
      category,
      type,
      accreditationType: ['NBA', 'NAAC'].includes(type) ? type : null,
      criteria: `${type} Criterion ${faker.number.int({ min: 1, max: 5 })}`,
      department: type === 'Internal' || type === 'External' ? dept._id : null,
      program: ['NBA', 'NAAC'].includes(type) ? dept._id : null,
      academicYear: '2023-24',
      file: {
        originalName: `document_${i + 1}.pdf`,
        filename: `doc_${i + 1}.pdf`,
        path: `/uploads/documents/doc_${i + 1}.pdf`,
        size: faker.number.int({ min: 100000, max: 5000000 }),
        mimeType: 'application/pdf',
      },
      version: '1.0',
      tags: [type.toLowerCase(), category.toLowerCase(), dept.code.toLowerCase()],
      accessLevel: faker.helpers.arrayElement(['Public', 'Internal', 'Restricted', 'Confidential']),
      uploadedBy: facultyUploaderMap.get(uploaderFaculty._id.toString()),
      status: faker.helpers.arrayElement(['Draft', 'Pending Approval', 'Approved']),
      isRequiredForAccreditation: ['NBA', 'NAAC'].includes(type),
      isActive: true,
    });
  }
  await Document.insertMany(documents);
  console.log(`✅ Created ${documents.length} documents`);

  await mongoose.disconnect();
  console.log('\n🎉 New features seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`- Faculty Achievements: ${achievements.length}`);
  console.log(`- Events: ${events.length}`);
  console.log(`- Event Participations: ${participations.length}`);
  console.log(`- NBA Criteria: ${nbaCriteria.length}`);
  console.log(`- NAAC Criteria: ${naacCriteria.length}`);
  console.log(`- Documents: ${documents.length}`);
};

run().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
