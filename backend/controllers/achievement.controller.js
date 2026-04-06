const mongoose = require("mongoose");
const FacultyAchievement = require("../models/FacultyAchievement");
const Faculty = require("../models/Faculty");

// ============================
// Get Achievements
// ============================
const getAchievements = async (req, res) => {

  try {

    const { type, level, academicYear, page = 1, limit = 20 } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.max(parseInt(limit, 10) || 20, 1);

    const filter = { isActive: true };

    if (type) filter.type = type;
    if (level) filter.level = level;

    if (req.user.role === "faculty") {

      const faculty = await Faculty.findOne({
        $or: [
          { user: req.user._id },
          { email: req.user.email }
        ]
      }).select("_id");

      if (!faculty) {
        return res.json({
          success: true,
          data: [],
          pagination: {
            total: 0,
            page: pageNumber,
            pages: 0
          }
        });
      }

      filter.faculty = faculty._id;

    }

    if (academicYear) {

      const [startYear] = academicYear.split("-").map(Number);

      filter.date = {
        $gte: new Date(`${startYear}-07-01`),
        $lt: new Date(`${startYear + 1}-07-01`)
      };

    }

    const pipeline = [

      { $match: filter },

      {
        $lookup: {
          from: "faculties",
          localField: "faculty",
          foreignField: "_id",
          as: "faculty"
        }
      },

      {
        $unwind: {
          path: "$faculty",
          preserveNullAndEmptyArrays: true
        }
      }

    ];

    // HOD department restriction
    if (req.user.role === "hod") {

      pipeline.push({
        $match: {
          "faculty.department": new mongoose.Types.ObjectId(req.user.department)
        }
      });

    }

    pipeline.push(

      {
        $lookup: {
          from: "departments",
          localField: "faculty.department",
          foreignField: "_id",
          as: "facultyDepartment"
        }
      },

      {
        $unwind: {
          path: "$facultyDepartment",
          preserveNullAndEmptyArrays: true
        }
      },

      {
        $addFields: {
          "faculty.department": "$facultyDepartment"
        }
      },

      { $project: { facultyDepartment: 0 } },

      { $sort: { date: -1 } },

      {
        $facet: {

          metadata: [{ $count: "total" }],

          achievements: [
            { $skip: (pageNumber - 1) * limitNumber },
            { $limit: limitNumber }
          ]

        }
      }

    );

    const [result = { metadata: [], achievements: [] }] =
      await FacultyAchievement.aggregate(pipeline);

    const total = result.metadata[0]?.total || 0;

    res.json({
      success: true,
      data: result.achievements,
      pagination: {
        total,
        page: pageNumber,
        pages: Math.ceil(total / limitNumber)
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
// Create Achievement
// ============================
const createAchievement = async (req, res) => {

  try {

    let facultyId = req.body.faculty;

    // Faculty can only add their own achievement
    if (req.user.role === "faculty") {

      const faculty = await Faculty.findOne({ email: req.user.email });

      if (!faculty) {
        return res.status(400).json({
          success: false,
          message: "Faculty record not found"
        });
      }

      facultyId = faculty._id;
    }

    if (!facultyId) {
      return res.status(400).json({
        success: false,
        message: "facultyId is required"
      });
    }

    const achievement = await FacultyAchievement.create({
      ...req.body,
      faculty: facultyId,
      uploadedBy: req.user._id
    });

    await achievement.populate({
      path: "faculty",
      populate: {
        path: "department",
        select: "name code"
      }
    });

    res.status(201).json({
      success: true,
      data: achievement
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Update Achievement
// ============================
const updateAchievement = async (req, res) => {

  try {

    const achievement = await FacultyAchievement.findById(req.params.id)
      .populate({
        path: "faculty",
        select: "department"
      });

    if (!achievement) {
      return res.status(404).json({
        success: false,
        message: "Achievement not found"
      });
    }

    if (
      req.user.role === "hod" &&
      achievement.faculty.department.toString() !== req.user.department.toString()
    ) {

      return res.status(403).json({
        success: false,
        message: "Access denied"
      });

    }

    Object.assign(achievement, req.body);

    await achievement.save();

    await achievement.populate({
      path: "faculty",
      populate: {
        path: "department",
        select: "name code"
      }
    });

    res.json({
      success: true,
      data: achievement
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Delete Achievement
// ============================
const deleteAchievement = async (req, res) => {

  try {

    const achievement = await FacultyAchievement.findById(req.params.id)
      .populate({
        path: "faculty",
        select: "department"
      });

    if (!achievement) {
      return res.status(404).json({
        success: false,
        message: "Achievement not found"
      });
    }

    if (
      req.user.role === "hod" &&
      achievement.faculty.department.toString() !== req.user.department.toString()
    ) {

      return res.status(403).json({
        success: false,
        message: "Access denied"
      });

    }

    achievement.isActive = false;

    await achievement.save();

    res.json({
      success: true,
      message: "Achievement deleted successfully"
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


module.exports = {
  getAchievements,
  createAchievement,
  updateAchievement,
  deleteAchievement
};
