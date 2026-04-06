const mongoose = require("mongoose");
const Faculty = require("../models/Faculty");
const ResearchPaper = require("../models/ResearchPaper");
const FacultyAchievement = require("../models/FacultyAchievement");
const Document = require("../models/Document");
const Subject = require("../models/Subject");
const Marks = require("../models/Marks");
const Student = require("../models/Student");

const roundTo = (value, digits = 1) => {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(digits)) : 0;
};

const getAcademicYearStart = (academicYear) => {
  const startYear = parseInt(String(academicYear || "").slice(0, 4), 10);
  return Number.isFinite(startYear) ? startYear : new Date().getFullYear();
};

const getCurrentAcademicYear = () => {
  const today = new Date();
  const startYear = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
};

const getFacultyForUser = async (user) => {
  const faculty = await Faculty.findOne({
    $or: [
      { user: user._id },
      { email: user.email }
    ]
  }).populate("department", "name code");

  if (!faculty) {
    const error = new Error("Faculty profile not found for the authenticated account.");
    error.statusCode = 404;
    throw error;
  }

  if (!faculty.user) {
    faculty.user = user._id;
    await faculty.save();
    await faculty.populate("department", "name code");
  }

  return faculty;
};

const mapContributionCategory = (achievement) => {
  if (achievement.type === "Workshop") {
    return "Workshop";
  }

  if (achievement.type === "FDP") {
    return "FDP";
  }

  return "Achievement";
};

const getDocumentTag = (document) => {
  if (Array.isArray(document.tags) && document.tags.length) {
    return document.tags[0];
  }

  if (document.type === "NAAC" || document.type === "NBA") {
    return document.type;
  }

  return document.category;
};

// ============================
// Get Faculty List
// ============================
const getFaculty = async (req, res) => {

  try {
    if (req.user.role === "faculty") {
      const faculty = await getFacultyForUser(req.user);

      return res.json({
        success: true,
        data: [faculty],
        pagination: {
          total: 1,
          page: 1,
          pages: 1
        }
      });
    }

    const {
      department,
      designation,
      page = 1,
      limit = 20,
      search
    } = req.query;

    const filter = { isActive: true };

    if (req.user.role === "hod") {
      filter.department = req.user.department;
    } else if (department) {
      filter.department = department;
    }

    if (designation) filter.designation = designation;

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    const total = await Faculty.countDocuments(filter);

    const faculty = await Faculty.find(filter)
      .populate("department", "name code")
      .sort({ name: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      success: true,
      data: faculty,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Get Faculty Details
// ============================
const getFacultyById = async (req, res) => {

  try {

    const faculty = await Faculty
      .findById(req.params.id)
      .populate("department", "name code");

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty not found"
      });
    }

    if (req.user.role === "faculty") {
      const currentFaculty = await getFacultyForUser(req.user);

      if (String(faculty._id) !== String(currentFaculty._id)) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }
    }

    if (
      req.user.role === "hod" &&
      faculty.department._id.toString() !== req.user.department.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const research = await ResearchPaper
      .find({ faculty: faculty._id })
      .sort({ year: -1 });

    const researchStats = {
      total: research.length,
      totalCitations: research.reduce((sum, item) => sum + (item.citations || 0), 0),
      byType: research.reduce((acc, item) => {
        acc[item.publicationType] = (acc[item.publicationType] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({
      success: true,
      data: {
        faculty,
        research,
        researchStats
      }
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Get Faculty Workspace
// ============================
const getFacultyWorkspace = async (req, res) => {

  try {

    const academicYear = req.query.academicYear || getCurrentAcademicYear();
    const faculty = await getFacultyForUser(req.user);

    const subjects = await Subject.find({ faculty: faculty._id })
      .populate("department", "name code")
      .sort({ semester: 1, name: 1 })
      .lean();

    const subjectIds = subjects.map((subject) => subject._id);
    const subjectMetrics = subjectIds.length
      ? await Marks.aggregate([
        {
          $match: {
            subject: { $in: subjectIds },
            academicYear
          }
        },
        {
          $group: {
            _id: "$subject",
            totalEntries: { $sum: 1 },
            passedStudents: {
              $sum: {
                $cond: [{ $eq: ["$result", "PASS"] }, 1, 0]
              }
            },
            failedStudents: {
              $sum: {
                $cond: [{ $eq: ["$result", "FAIL"] }, 1, 0]
              }
            },
            avgMarks: { $avg: "$total" }
          }
        }
      ])
      : [];

    const departmentIds = [...new Set(
      subjects
        .map((subject) => String(subject.department?._id || subject.department || ""))
        .filter(Boolean)
    )];

    const semesters = [...new Set(
      subjects
        .map((subject) => Number(subject.semester || 0))
        .filter(Boolean)
    )];

    const departmentAverages = departmentIds.length && semesters.length
      ? await Marks.aggregate([
        {
          $match: {
            academicYear
          }
        },
        {
          $lookup: {
            from: "subjects",
            localField: "subject",
            foreignField: "_id",
            as: "subjectData"
          }
        },
        {
          $unwind: "$subjectData"
        },
        {
          $match: {
            "subjectData.department": { $in: departmentIds.map((id) => new mongoose.Types.ObjectId(id)) },
            "subjectData.semester": { $in: semesters }
          }
        },
        {
          $group: {
            _id: {
              department: "$subjectData.department",
              semester: "$subjectData.semester"
            },
            totalEntries: { $sum: 1 },
            passedStudents: {
              $sum: {
                $cond: [{ $eq: ["$result", "PASS"] }, 1, 0]
              }
            }
          }
        }
      ])
      : [];

    const metricsBySubject = new Map(
      subjectMetrics.map((entry) => [String(entry._id), entry])
    );

    const averageByDepartmentSemester = new Map(
      departmentAverages.map((entry) => [
        `${String(entry._id.department)}-${entry._id.semester}`,
        entry.totalEntries
          ? roundTo((entry.passedStudents / entry.totalEntries) * 100, 1)
          : 0
      ])
    );

    const subjectCards = subjects.map((subject) => {
      const metrics = metricsBySubject.get(String(subject._id));
      const totalEntries = metrics?.totalEntries || 0;
      const passPercentage = totalEntries
        ? roundTo((metrics.passedStudents / totalEntries) * 100, 1)
        : 0;
      const averageMarks = totalEntries
        ? roundTo(metrics.avgMarks, 1)
        : 0;
      const failedStudents = metrics?.failedStudents || 0;
      const departmentAverage = averageByDepartmentSemester.get(
        `${String(subject.department?._id || subject.department)}-${subject.semester}`
      ) || 0;
      const delta = totalEntries
        ? roundTo(passPercentage - departmentAverage, 1)
        : 0;

      let indicator = "No results yet";
      let tone = "info";

      if (totalEntries) {
        if (delta > 1) {
          indicator = "Above Department Average";
          tone = "success";
        } else if (delta < -1) {
          indicator = "Below Department Average";
          tone = "warning";
        } else {
          indicator = "On Department Average";
        }
      }

      return {
        id: subject._id,
        name: subject.name,
        code: subject.code,
        semester: subject.semester,
        credits: subject.credits,
        type: subject.type,
        passPercentage,
        averageMarks,
        failedStudents,
        studentsEvaluated: totalEntries,
        departmentAveragePassPercentage: departmentAverage,
        comparisonDelta: delta,
        performanceIndicator: indicator,
        tone,
      };
    });

    const subjectRowsWithData = subjectCards.filter((subject) => subject.studentsEvaluated > 0);
    const totalEntries = subjectMetrics.reduce((sum, subject) => sum + (subject.totalEntries || 0), 0);
    const totalPassed = subjectMetrics.reduce((sum, subject) => sum + (subject.passedStudents || 0), 0);
    const weightedMarksTotal = subjectRowsWithData.reduce(
      (sum, subject) => sum + (subject.averageMarks * subject.studentsEvaluated),
      0
    );
    const totalFailedStudents = subjectRowsWithData.reduce((sum, subject) => sum + subject.failedStudents, 0);
    const averagePassPercentage = totalEntries
      ? roundTo((totalPassed / totalEntries) * 100, 1)
      : 0;
    const averageMarks = totalEntries
      ? roundTo(weightedMarksTotal / totalEntries, 1)
      : 0;

    const focusSubject = subjectRowsWithData.length
      ? [...subjectRowsWithData].sort((left, right) =>
        left.passPercentage - right.passPercentage ||
        right.failedStudents - left.failedStudents
      )[0]
      : null;

    const subjectPerformanceInsight = focusSubject
      ? {
        title: `Your subject pass rate is ${focusSubject.passPercentage}%`,
        text: focusSubject.comparisonDelta < -1
          ? `Lower than department average by ${Math.abs(focusSubject.comparisonDelta)}%.`
          : focusSubject.comparisonDelta > 1
            ? `Higher than department average by ${focusSubject.comparisonDelta}%.`
            : "Aligned with the department average."
      }
      : {
        title: "No subject performance available yet",
        text: "Results will appear once marks are added for your assigned subjects."
      };

    const trackedStudentMetrics = subjectIds.length
      ? await Marks.aggregate([
        {
          $match: {
            subject: { $in: subjectIds },
            academicYear
          }
        },
        {
          $group: {
            _id: "$student",
            trackedSubjects: { $sum: 1 },
            averageMarks: { $avg: "$total" },
            passedSubjects: {
              $sum: {
                $cond: [{ $eq: ["$result", "PASS"] }, 1, 0]
              }
            },
            failedSubjects: {
              $sum: {
                $cond: [{ $eq: ["$result", "FAIL"] }, 1, 0]
              }
            }
          }
        },
        {
          $sort: {
            failedSubjects: -1,
            averageMarks: 1
          }
        }
      ])
      : [];

    const [trackedStudentProfiles, researchPapers, achievements, documents] = await Promise.all([
      trackedStudentMetrics.length
        ? Student.find({
          _id: {
            $in: trackedStudentMetrics.map((entry) => entry._id)
          },
          isActive: true
        })
          .populate("department", "name code")
          .select("name rollNumber department cgpa currentSemester performanceCategory currentBacklogs")
          .lean()
        : [],
      ResearchPaper.find({ faculty: faculty._id })
        .sort({ year: -1, createdAt: -1 })
        .lean(),
      FacultyAchievement.find({ faculty: faculty._id, isActive: true })
        .sort({ date: -1, createdAt: -1 })
        .lean(),
      Document.find({ uploadedBy: req.user._id, isActive: true })
        .populate("department", "name code")
        .sort({ createdAt: -1 })
        .lean()
    ]);

    const trackedStudentMap = new Map(
      trackedStudentProfiles.map((student) => [String(student._id), student])
    );

    const myStudents = trackedStudentMetrics
      .map((entry) => {
        const student = trackedStudentMap.get(String(entry._id));

        if (!student) {
          return null;
        }

        const totalTracked = entry.trackedSubjects || 0;
        const passPercentage = totalTracked
          ? roundTo((entry.passedSubjects / totalTracked) * 100, 1)
          : 0;

        return {
          _id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          department: student.department,
          currentSemester: student.currentSemester,
          cgpa: roundTo(student.cgpa, 2),
          performanceCategory: student.performanceCategory || "Average",
          currentBacklogs: student.currentBacklogs || 0,
          trackedSubjects: totalTracked,
          averageMarks: roundTo(entry.averageMarks, 1),
          passPercentage,
          failedSubjects: entry.failedSubjects || 0,
          isAtRisk:
            student.performanceCategory === "At Risk" ||
            (entry.failedSubjects || 0) > 0 ||
            passPercentage < 60
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        if (Number(right.isAtRisk) !== Number(left.isAtRisk)) {
          return Number(right.isAtRisk) - Number(left.isAtRisk);
        }

        return (
          left.passPercentage - right.passPercentage ||
          right.failedSubjects - left.failedSubjects ||
          left.averageMarks - right.averageMarks
        );
      });

    const contributionItems = [
      ...researchPapers.map((paper) => ({
        id: paper._id,
        title: paper.title,
        year: paper.year,
        category: "Research",
        note: `${paper.journal} - ${paper.publicationType}`,
        createdAt: paper.createdAt
      })),
      ...achievements.map((achievement) => ({
        id: achievement._id,
        title: achievement.title,
        year: new Date(achievement.date).getFullYear(),
        category: mapContributionCategory(achievement),
        note: `${achievement.issuingOrganization} - ${achievement.type}`,
        createdAt: achievement.createdAt
      }))
    ].sort((left, right) =>
      (right.year - left.year) ||
      (new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    );

    const currentYear = getAcademicYearStart(academicYear);
    const previousYear = currentYear - 1;
    const researchThisYear = researchPapers.filter((paper) => paper.year === currentYear).length;
    const previousYearResearch = researchPapers.filter((paper) => paper.year === previousYear).length;
    const contributionsThisYear = contributionItems.filter((entry) => entry.year === currentYear).length;
    const pendingDocuments = documents.filter((document) => document.status === "Pending Approval").length;
    const atRiskStudents = myStudents.filter((student) => student.isAtRisk).length;

    const insights = [];

    if (focusSubject && focusSubject.failedStudents > 0) {
      insights.push({
        tone: focusSubject.comparisonDelta < -1 ? "warning" : "info",
        text: `${focusSubject.code} has the highest failure load in your assigned subjects with ${focusSubject.failedStudents} failed students.`
      });
    }

    if (researchThisYear > previousYearResearch) {
      insights.push({
        tone: "success",
        text: "Research contributions increased this year compared with the previous cycle."
      });
    } else if (researchThisYear < previousYearResearch) {
      insights.push({
        tone: "warning",
        text: "Research contributions are lower this year than the previous cycle."
      });
    }

    if (pendingDocuments > 0) {
      insights.push({
        tone: "info",
        text: `${pendingDocuments} document upload${pendingDocuments > 1 ? "s are" : " is"} waiting for IQAC approval.`
      });
    }

    if (atRiskStudents > 0) {
      insights.push({
        tone: "warning",
        text: `${atRiskStudents} student${atRiskStudents > 1 ? "s are" : " is"} currently flagged for follow-up across your assigned subjects.`
      });
    }

    res.json({
      success: true,
      data: {
        academicYear,
        faculty: {
          _id: faculty._id,
          name: faculty.name,
          email: faculty.email,
          designation: faculty.designation,
          qualification: faculty.qualification,
          experience: faculty.experience,
          specialization: faculty.specialization,
          department: faculty.department
        },
        summary: {
          assignedSubjects: subjectCards.length,
          averagePassPercentage,
          averageMarks,
          totalFailedStudents,
          totalResearchPapers: researchPapers.length,
          totalContributions: contributionItems.length,
          contributionsThisYear,
          trackedStudents: myStudents.length,
          atRiskStudents,
          totalDocuments: documents.length,
          pendingDocuments
        },
        subjectPerformanceInsight,
        subjects: subjectCards,
        students: myStudents,
        contributions: contributionItems,
        documents: documents.map((document) => ({
          _id: document._id,
          title: document.title,
          academicYear: document.academicYear,
          category: document.category,
          displayCategory: getDocumentTag(document),
          status: document.status,
          file: document.file,
          tags: document.tags || [],
          description: document.description,
          createdAt: document.createdAt,
          department: document.department
        })),
        insights
      }
    });

  } catch (error) {

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Create Faculty
// ============================
const createFaculty = async (req, res) => {

  try {

    if (req.user.role === "hod") {
      req.body.department = req.user.department;
    }

    const faculty = await Faculty.create(req.body);

    await faculty.populate("department", "name code");

    res.status(201).json({
      success: true,
      data: faculty
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Update Faculty
// ============================
const updateFaculty = async (req, res) => {

  try {

    const faculty = await Faculty.findById(req.params.id);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty not found"
      });
    }

    if (
      req.user.role === "hod" &&
      faculty.department.toString() !== req.user.department.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    Object.assign(faculty, req.body);

    await faculty.save();

    await faculty.populate("department", "name code");

    res.json({
      success: true,
      data: faculty
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }

};


module.exports = {
  getFaculty,
  getFacultyWorkspace,
  getFacultyById,
  createFaculty,
  updateFaculty
};
