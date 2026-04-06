/**
 * Data scope helper for role-based query filtering.
 * Automatically restricts queries based on logged-in user role.
 *
 * Roles:
 * IQAC_HEAD  -> full access
 * HOD        -> department scoped
 * FACULTY    -> own research/achievements or department students
 * STUDENT    -> own data only
 * MAINTENANCE-> only user management
 */

const mongoose = require("mongoose");

const applyDataScope = (query, req, modelType = "default") => {

  const user = req.user;

  // Safety check
  if (!user || !user.role) {
    query._id = null;
    return query;
  }

  // IQAC_HEAD has full access
  if (user.role === "iqac_admin") {
    return query;
  }

  switch (user.role) {

    // ========================
    // HOD → Department Scope
    // ========================
    case "hod":

      if (user.department) {

        const deptId = new mongoose.Types.ObjectId(user.department);

        if (modelType === "student") {
          query.department = deptId;
        }

        else if (modelType === "faculty") {
          query.department = deptId;
        }

        else if (modelType === "research") {
          query.department = deptId;
        }

        else if (modelType === "event") {
          query.department = deptId;
        }

        else {
          query.department = deptId;
        }

      }

      break;


    // ========================
    // FACULTY Scope
    // ========================
    case "faculty":

      if (modelType === "research") {
        query.uploadedBy = user._id;
      }

      else if (modelType === "achievement") {
        query.faculty = user._id;
      }

      else if (modelType === "student") {
        query.facultyAdvisor = user._id;
      }

      else {
        query.department = user.department;
      }

      break;


    // ========================
    // STUDENT Scope
    // ========================
    case "student":

      if (
        modelType === "marks" ||
        modelType === "attendance"
      ) {
        query.student = user._id;
      }

      else if (modelType === "event") {
        query["participations.user"] = user._id;
      }

      else {
        query._id = null; // block access
      }

      break;


    // ========================
    // MAINTENANCE Scope
    // ========================
    case "staff":

      if (modelType !== "user") {
        query._id = null;
      }

      break;


    // ========================
    // Unknown Role
    // ========================
    default:
      query._id = null;
  }

  return query;
};

module.exports = { applyDataScope };
