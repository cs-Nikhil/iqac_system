const mongoose = require("mongoose");
const NBACriteria = require("../models/NBACriteria");


// ============================
// Get NBA criteria
// ============================
const getNBACriteria = async (req, res) => {

  try {

    const { program, academicYear, criteria, status } = req.query;

    const filter = { isActive: true };

    if (req.user.role === "hod") {
      filter.program = new mongoose.Types.ObjectId(req.user.department);
    } else if (program) {
      filter.program = program;
    }

    if (academicYear) filter.academicYear = academicYear;
    if (criteria) filter.criteria = criteria;
    if (status) filter.status = status;

    const nbaCriteria = await NBACriteria.find(filter)
      .populate("program", "name code")
      .populate("measurements.measuredBy", "name email")
      .populate("actionItems.responsible", "name email")
      .sort({ criteria: 1, title: 1 });

    res.json({
      success: true,
      data: nbaCriteria
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Create NBA Criterion
// ============================
const createNBACriterion = async (req, res) => {

  try {

    const criterion = await NBACriteria.create({
      ...req.body,
      lastUpdated: new Date(),
      createdBy: req.user._id
    });

    await criterion.populate("program", "name code");

    res.status(201).json({
      success: true,
      data: criterion
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Update NBA Criterion
// ============================
const updateNBACriterion = async (req, res) => {

  try {

    const criterion = await NBACriteria.findById(req.params.id);

    if (!criterion) {
      return res.status(404).json({
        success: false,
        message: "NBA criterion not found"
      });
    }

    // HOD restriction
    if (
      req.user.role === "hod" &&
      criterion.program.toString() !== req.user.department.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    Object.assign(criterion, req.body);

    criterion.lastUpdated = new Date();
    criterion.updatedBy = req.user._id;

    await criterion.save();

    await criterion.populate("program", "name code");

    res.json({
      success: true,
      data: criterion
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Add Measurement
// ============================
const addMeasurement = async (req, res) => {

  try {

    const { value, remarks } = req.body;

    if (value === undefined || isNaN(value)) {
      return res.status(400).json({
        success: false,
        message: "Measurement value must be numeric"
      });
    }

    const criterion = await NBACriteria.findById(req.params.id);

    if (!criterion) {
      return res.status(404).json({
        success: false,
        message: "NBA criterion not found"
      });
    }

    criterion.measurements.push({
      date: new Date(),
      value,
      remarks,
      measuredBy: req.user._id
    });

    criterion.actualValue = value;

    // Compliance score
    if (criterion.threshold > 0) {
      criterion.complianceScore = Math.min(
        (value / criterion.threshold) * 100,
        100
      );
    } else {
      criterion.complianceScore = 0;
    }

    // Status logic
    if (value >= criterion.targetValue) {
      criterion.status = "Exceeded";
    } else if (value >= criterion.threshold) {
      criterion.status = "Met";
    } else {
      criterion.status = "Not Met";
    }

    criterion.lastUpdated = new Date();

    await criterion.save();

    res.json({
      success: true,
      data: criterion
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// NBA Dashboard
// ============================
const getNBADashboard = async (req, res) => {

  try {

    const { program, academicYear } = req.query;

    const filter = { isActive: true };

    if (req.user.role === "hod") {
      filter.program = req.user.department;
    } else if (program) {
      filter.program = program;
    }

    if (academicYear) filter.academicYear = academicYear;

    const criteria = await NBACriteria.find(filter)
      .populate("program", "name code")
      .select(
        "criteria status complianceScore targetValue actualValue threshold"
      );

    const totalCriteria = criteria.length;

    const metCriteria = criteria.filter(
      c => c.status === "Met" || c.status === "Exceeded"
    ).length;

    const overallCompliance =
      totalCriteria > 0 ? (metCriteria / totalCriteria) * 100 : 0;

    const avgComplianceScore =
      totalCriteria > 0
        ? criteria.reduce((sum, c) => sum + (c.complianceScore || 0), 0) /
          totalCriteria
        : 0;

    const criteriaByType = criteria.reduce((acc, criterion) => {

      if (!acc[criterion.criteria]) {
        acc[criterion.criteria] = [];
      }

      acc[criterion.criteria].push(criterion);

      return acc;

    }, {});

    res.json({
      success: true,
      dashboard: {
        totalCriteria,
        metCriteria,
        overallCompliance: Number(overallCompliance.toFixed(2)),
        avgComplianceScore: Number(avgComplianceScore.toFixed(2)),
        criteriaByType,
        criteria
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
  getNBACriteria,
  createNBACriterion,
  updateNBACriterion,
  addMeasurement,
  getNBADashboard
};
