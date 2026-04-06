// faculty.routes.js

const express = require("express");
const facultyRouter = express.Router();

const {
  getFaculty,
  getFacultyWorkspace,
  getFacultyById,
  createFaculty,
  updateFaculty
} = require("../controllers/faculty.controller");

const { protect } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorizeRoles');

// All faculty routes require authentication
facultyRouter.use(protect);

// Get faculty list
facultyRouter.get(
  "/",
  authorizeRoles("iqac_admin", "hod", "faculty"),
  getFaculty
);

facultyRouter.get(
  "/workspace",
  authorizeRoles("faculty"),
  getFacultyWorkspace
);

// Get faculty by ID
facultyRouter.get(
  "/:id",
  authorizeRoles("iqac_admin", "hod", "faculty"),
  getFacultyById
);

// Create faculty
facultyRouter.post(
  "/",
  authorizeRoles("iqac_admin", "hod"),
  createFaculty
);

// Update faculty
facultyRouter.put(
  "/:id",
  authorizeRoles("iqac_admin", "hod"),
  updateFaculty
);

module.exports = facultyRouter;
