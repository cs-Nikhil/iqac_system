const NAACCriteria = require("../models/NAACCriteria");


// ============================
// Get NAAC criteria
// ============================
const getNAACCriteria = async (req, res) => {

  try {

    const { academicYear, criterion, status, assignedTo } = req.query;

    const filter = { isActive: true };

    if (academicYear) filter.academicYear = academicYear;
    if (criterion) filter.criterion = criterion;
    if (status) filter.status = status;
    if (assignedTo) filter.assignedTo = assignedTo;

    const naacCriteria = await NAACCriteria.find(filter)
      .populate("assignedTo", "name email")
      .populate("reviewers.user", "name email")
      .populate("documents.uploadedBy", "name email")
      .sort({ criterion: 1, keyIndicator: 1 });

    res.json({
      success: true,
      data: naacCriteria
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


// ============================
// Create NAAC Criterion
// ============================
const createNAACCriterium = async (req, res) => {

  try {

    const criterion = await NAACCriteria.create({
      ...req.body,
      lastUpdated: new Date(),
      createdBy: req.user._id
    });

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
// Update NAAC Criterion
// ============================
const updateNAACCriterium = async (req, res) => {

  try {

    const criterion = await NAACCriteria.findById(req.params.id);

    if (!criterion) {
      return res.status(404).json({
        success: false,
        message: "NAAC criterion not found"
      });
    }

    Object.assign(criterion, req.body);

    criterion.lastUpdated = new Date();
    criterion.updatedBy = req.user._id;

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
// Add Data Point
// ============================
const addDataPoint = async (req, res) => {

  try {

    const { name, value, unit, source } = req.body;

    if (!name || value === undefined) {
      return res.status(400).json({
        success: false,
        message: "name and value are required"
      });
    }

    const criterion = await NAACCriteria.findById(req.params.id);

    if (!criterion) {
      return res.status(404).json({
        success: false,
        message: "NAAC criterion not found"
      });
    }

    criterion.dataPoints.push({
      name,
      value,
      unit,
      source,
      collectedAt: new Date()
    });

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
// Upload Document
// ============================
const uploadDocument = async (req, res) => {

  try {

    const { title, type, path } = req.body;

    if (!title || !path) {
      return res.status(400).json({
        success: false,
        message: "title and path are required"
      });
    }

    const criterion = await NAACCriteria.findById(req.params.id);

    if (!criterion) {
      return res.status(404).json({
        success: false,
        message: "NAAC criterion not found"
      });
    }

    criterion.documents.push({
      title,
      type,
      path,
      uploadedAt: new Date(),
      uploadedBy: req.user._id
    });

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
// Add Review
// ============================
const addReview = async (req, res) => {

  try {

    const { review, rating } = req.body;

    const criterion = await NAACCriteria.findById(req.params.id);

    if (!criterion) {
      return res.status(404).json({
        success: false,
        message: "NAAC criterion not found"
      });
    }

    criterion.reviewers.push({
      user: req.user._id,
      review,
      rating,
      reviewedAt: new Date()
    });

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
// NAAC Dashboard
// ============================
const getNAACDashboard = async (req, res) => {

  try {

    const { academicYear } = req.query;

    const filter = { isActive: true };

    if (academicYear) filter.academicYear = academicYear;

    const criteria = await NAACCriteria.find(filter)
      .select("criterion complianceLevel status quantitativeMetric");

    const complianceLevels = criteria.reduce((acc, c) => {
      acc[c.complianceLevel] = (acc[c.complianceLevel] || 0) + 1;
      return acc;
    }, {});

    const statusDistribution = criteria.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {});

    const criteriaByType = criteria.reduce((acc, c) => {

      if (!acc[c.criterion]) acc[c.criterion] = [];

      acc[c.criterion].push(c);

      return acc;

    }, {});

    const totalCriteria = criteria.length;

    const exemplaryCriteria =
      criteria.filter(c => c.complianceLevel === "Exemplary").length;

    const compliantCriteria =
      criteria.filter(c => c.complianceLevel === "Compliant").length;

    const overallCompliance =
      totalCriteria > 0
        ? ((exemplaryCriteria + compliantCriteria) / totalCriteria) * 100
        : 0;

    const avgScore =
      totalCriteria > 0
        ? criteria.reduce(
            (sum, c) => sum + (c.quantitativeMetric?.score || 0),
            0
          ) / totalCriteria
        : 0;

    res.json({
      success: true,
      dashboard: {
        totalCriteria,
        overallCompliance: Number(overallCompliance.toFixed(2)),
        avgScore: Number(avgScore.toFixed(2)),
        complianceLevels,
        statusDistribution,
        criteriaByType
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
  getNAACCriteria,
  createNAACCriterium,
  updateNAACCriterium,
  addDataPoint,
  uploadDocument,
  addReview,
  getNAACDashboard
};
