const express = require("express");
const authRouter = express.Router();

const {
  register,
  createStaffAccount,
  login,
  getMe
} = require("../controllers/auth.controller");

const { protect } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/authorizeRoles");

// Public routes
authRouter.post("/register", register);
authRouter.post("/login", login);

// Staff creation (only iqac_admin and staff can create accounts)
authRouter.post(
  "/staff",
  protect,
  authorizeRoles("iqac_admin", "staff"),
  createStaffAccount
);

// Current user
authRouter.get("/me", protect, getMe);

module.exports = authRouter;
