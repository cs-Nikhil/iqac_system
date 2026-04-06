const Student = require('../models/Student');
const Placement = require('../models/Placement');
const ResearchPaper = require('../models/ResearchPaper');
const Event = require('../models/Event');
const Marks = require('../models/Marks');
const FacultyAchievement = require('../models/FacultyAchievement');

/**
 * Accreditation report service for NAAC/NBA
 */
class AccreditationService {
  // NAAC SSR data aggregation
  static async getNAACReport() {
    const [
      studentStats,
      placementStats,
      researchStats,
      eventStats,
      passStats,
      achievementStats
    ] = await Promise.all([
      // Student demographics
      Student.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalStudents: { $sum: 1 },
            uniqueDepts: { $addToSet: '$department' },
            avgCGPA: { $avg: '$cgpa' },
            phdStudents: { $sum: { $cond: [{ $eq: ['$qualification', 'PhD'] }, 1, 0 ] } }
          }
        }
      ]),

      // Placement trends
      Placement.aggregate([
        { $group: { _id: null, total: { $sum: 1 }, avgPackage: { $avg: '$package' } } }
      ]),

      // Research publications
      ResearchPaper.aggregate([
        { $group: { _id: null, totalPapers: { $sum: 1 }, totalCitations: { $sum: '$citations' }, avgImpact: { $avg: '$impactFactor' } } }
      ]),

      // Event participation
      Event.aggregate([
        { $unwind: { path: '$participations', preserveNullAndEmptyArrays: true } },
        { $group: { _id: null, totalEvents: { $sum: 1 }, totalParticipations: { $sum: 1 } } }
      ]),

      // Pass statistics
      Marks.aggregate([
        { $match: { result: 'PASS' } },
        { $group: { _id: null, totalExams: { $sum: 1 } } },
        {
          $lookup: {
            from: 'marks',
            let: { },
            pipeline: [ { $count: 'allExams' } ],
            as: 'allExams'
          }
        },
        {
          $addFields: {
            passPercentage: { $round: [{ $multiply: [{ $divide: ['$totalExams', { $arrayElemAt: ['$allExams.allExams', 0] }] }, 100 ] }, 2 ] }
          }
        }
      ]),

      // Faculty achievements
      FacultyAchievement.aggregate([
        { $group: { _id: null, totalAchievements: { $sum: 1 } } }
      ])
    ]);

    return {
      naacSSR: {
        enrollment: studentStats[0] || { totalStudents: 0 },
        placement: placementStats[0] || { total: 0 },
        research: researchStats[0] || { totalPapers: 0 },
        events: eventStats[0] || { totalParticipations: 0 },
        academics: passStats[0] || { passPercentage: 0 },
        achievements: achievementStats[0] || { totalAchievements: 0 }
      }
    };
  }

  // NBA department performance
  static async getNBAReport(departmentId = null) {
    const match = departmentId ? { department: departmentId } : {};
    
    const [
      deptPerformance,
      placementByDept,
      researchByDept
    ] = await Promise.all([
      // Department KPIs
      Student.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$department',
            students: { $sum: 1 },
            avgCGPA: { $avg: '$cgpa' },
            atRisk: { $sum: { $toInt: '$isAtRisk' } }
          }
        }
      ]),

      Placement.aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'students',
            localField: 'student',
            foreignField: '_id',
            as: 'studentData'
          }
        },
        {
          $group: {
            _id: { $arrayElemAt: ['$studentData.department', 0] },
            placements: { $sum: 1 },
            avgPackage: { $avg: '$package' }
          }
        }
      ]),

      ResearchPaper.aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'faculties',
            localField: 'faculty',
            foreignField: '_id',
            as: 'facultyData'
          }
        },
        {
          $group: {
            _id: { $arrayElemAt: ['$facultyData.department', 0] },
            papers: { $sum: 1 },
            citations: { $sum: '$citations' }
          }
        }
      ])
    ]);

    return {
      nbaPerformance: deptPerformance,
      placementByDepartment: placementByDept,
      researchByDepartment: researchByDept
    };
  }
}

module.exports = AccreditationService;

