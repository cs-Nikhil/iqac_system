const ResearchPaper = require("../models/ResearchPaper");
const Faculty = require("../models/Faculty");

// ============================
// Get Research Papers
// ============================
const getResearchPapers = async (req, res) => {

  try {

    const {
      year,
      indexing,
      publicationType,
      faculty,
      page = 1,
      limit = 20
    } = req.query;

    const filter = {};

    if (year) filter.year = parseInt(year);
    if (indexing) filter.indexing = indexing;
    if (publicationType) filter.publicationType = publicationType;
    if (faculty) filter.faculty = faculty;

    const { applyDataScope } = require("../utils/dataScope");
    applyDataScope(filter, req, "research");

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const total = await ResearchPaper.countDocuments(filter);

    const papers = await ResearchPaper.find(filter)
      .populate({
        path: "faculty",
        populate: { path: "department", select: "name code" }
      })
      .populate("uploadedBy", "name email")
      .sort({ year: -1, citations: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      success: true,
      data: papers,
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
// Upload Research Paper
// ============================
const createResearchPaper = async (req, res) => {

  try {

    const user = req.user;

    if (user.role !== "faculty") {
      return res.status(403).json({
        success: false,
        message: "Faculty role required"
      });
    }

    const {
      title,
      journal,
      year,
      citations = 0,
      publicationType = "Journal",
      indexing = "Others",
      doi,
      impactFactor = 0,
      coAuthors
    } = req.body;

    const faculty = await Faculty.findOne({
      $or: [
        { user: user._id },
        { email: user.email }
      ]
    });

    if (!faculty) {
      return res.status(400).json({
        success: false,
        message: "Faculty record not found"
      });
    }

    const paper = await ResearchPaper.create({
      faculty: faculty._id,
      title,
      journal,
      year: parseInt(year),
      citations,
      publicationType,
      indexing,
      doi,
      impactFactor,
      coAuthors: coAuthors || [],
      uploadedBy: user._id,
      department: faculty.department
    });

    await paper.populate([
      {
        path: "faculty",
        populate: { path: "department", select: "name code" }
      },
      {
        path: "uploadedBy",
        select: "name email role"
      }
    ]);

    res.status(201).json({
      success: true,
      data: paper
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Research Statistics
// ============================
const getResearchStats = async (req, res) => {

  try {

    const matchStage = {};

    if (req.user.role === "hod") {
      matchStage.department = req.user.department;
    }

    const byDept = await ResearchPaper.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: "faculties",
          localField: "faculty",
          foreignField: "_id",
          as: "facultyData"
        }
      },
      { $unwind: "$facultyData" },
      {
        $lookup: {
          from: "departments",
          localField: "facultyData.department",
          foreignField: "_id",
          as: "deptData"
        }
      },
      { $unwind: "$deptData" },
      {
        $group: {
          _id: "$deptData._id",
          deptName: { $first: "$deptData.name" },
          totalPapers: { $sum: 1 },
          totalCitations: { $sum: "$citations" },
          avgImpactFactor: { $avg: "$impactFactor" }
        }
      },
      { $sort: { totalPapers: -1 } }
    ]);

    const byYear = await ResearchPaper.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$year",
          count: { $sum: 1 },
          citations: { $sum: "$citations" }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 6 }
    ]);

    const byIndexing = await ResearchPaper.aggregate([
      { $match: matchStage },
      { $group: { _id: "$indexing", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        byDepartment: byDept,
        byYear,
        byIndexing
      }
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


module.exports = {
  getResearchPapers,
  createResearchPaper,
  getResearchStats
};
