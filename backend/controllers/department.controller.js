const Department = require("../models/Department");
const Student = require("../models/Student");
const Faculty = require("../models/Faculty");
const Attendance = require("../models/Attendance");
const mongoose = require("mongoose");
const analyticsService = require("../services/analytics.service");

const resolveDepartmentId = (department) => {
  if (!department) return null;
  return department._id || department;
};


// ============================
// Get Departments
// ============================
const getDepartments = async (req, res) => {

  try {

    const match = { isActive: true };

    if (req.user.role === "hod") {
      match._id = req.user.department;
    }

    const departments = await Department.aggregate([
      { $match: match },

      {
        $lookup: {
          from: "faculties",
          localField: "_id",
          foreignField: "department",
          as: "faculty"
        }
      },

      {
        $lookup: {
          from: "students",
          localField: "_id",
          foreignField: "department",
          as: "students"
        }
      },

      {
        $project: {
          name: 1,
          code: 1,
          hod: 1,
          isActive: 1,
          studentCount: { $size: "$students" },
          facultyCount: { $size: "$faculty" }
        }
      },

      { $sort: { name: 1 } }

    ]);

    const populated = await Department.populate(departments, {
      path: "hod",
      select: "name email designation"
    });

    res.json({
      success: true,
      data: populated
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Get Department By ID
// ============================
const getDepartmentById = async (req, res) => {

  try {

    const dept = await Department
      .findById(req.params.id)
      .populate("hod", "name email designation");

    if (!dept) {
      return res.status(404).json({
        success: false,
        message: "Department not found"
      });
    }

    if (
      req.user.role === "hod" &&
      dept._id.toString() !== req.user.department.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const studentCount = await Student.countDocuments({
      department: dept._id,
      isActive: true
    });

    const facultyCount = await Faculty.countDocuments({
      department: dept._id,
      isActive: true
    });

    res.json({
      success: true,
      data: {
        ...dept.toObject(),
        studentCount,
        facultyCount
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
// Get Department Summary
// ============================
const getDepartmentSummary = async (req, res) => {

  try {

    const departmentId =
      req.user.role === "hod"
        ? resolveDepartmentId(req.user.department)
        : resolveDepartmentId(req.query.departmentId || req.query.department);

    if (!departmentId) {
      return res.status(400).json({
        success: false,
        message: "Department is required"
      });
    }

    const scopedDepartmentId = new mongoose.Types.ObjectId(departmentId);

    const department = await Department
      .findOne({
        _id: scopedDepartmentId,
        isActive: true
      })
      .populate("hod", "name email designation");

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found"
      });
    }

    const [totalStudents, totalFaculty, ranking, admissionsByYear, attendanceByYear] = await Promise.all([
      Student.countDocuments({
        department: scopedDepartmentId,
        isActive: true
      }),
      Faculty.countDocuments({
        department: scopedDepartmentId,
        isActive: true
      }),
      analyticsService.getDepartmentRanking({
        departmentId: scopedDepartmentId
      }),
      Student.aggregate([
        {
          $match: {
            department: scopedDepartmentId,
            isActive: true,
            batchYear: { $ne: null }
          }
        },
        {
          $group: {
            _id: "$batchYear",
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            year: "$_id",
            count: 1
          }
        }
      ]),
      Attendance.aggregate([
        {
          $lookup: {
            from: "students",
            localField: "student",
            foreignField: "_id",
            as: "studentData"
          }
        },
        { $unwind: "$studentData" },
        {
          $match: {
            "studentData.department": scopedDepartmentId,
            academicYear: { $exists: true, $ne: null }
          }
        },
        {
          $addFields: {
            startYear: {
              $toInt: {
                $substrBytes: ["$academicYear", 0, 4]
              }
            }
          }
        },
        {
          $group: {
            _id: "$startYear",
            averageAttendance: { $avg: "$percentage" }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            year: "$_id",
            percentage: { $round: ["$averageAttendance", 1] }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        department: department.name,
        code: department.code,
        total_students: totalStudents,
        total_faculty: totalFaculty,
        avg_score: ranking[0]?.score ?? 0,
        admissions_by_year: admissionsByYear,
        attendance_by_year: attendanceByYear,
        hod: department.hod
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
// Create Department
// ============================
const createDepartment = async (req, res) => {

  try {

    const dept = await Department.create(req.body);

    res.status(201).json({
      success: true,
      data: dept
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Update Department
// ============================
const updateDepartment = async (req, res) => {

  try {

    const dept = await Department.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate("hod", "name email designation");

    if (!dept) {
      return res.status(404).json({
        success: false,
        message: "Department not found"
      });
    }

    res.json({
      success: true,
      data: dept
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }

};


module.exports = {
  getDepartments,
  getDepartmentById,
  getDepartmentSummary,
  createDepartment,
  updateDepartment
};
