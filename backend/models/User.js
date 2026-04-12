const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const CANONICAL_ROLES = Object.freeze([
  "iqac_admin",
  "staff",
  "hod",
  "faculty",
  "student",
]);

const ROLE_ALIAS_MAP = Object.freeze({
  iqac_admin: "iqac_admin",
  IQAC_ADMIN: "iqac_admin",
  admin: "iqac_admin",
  ADMIN: "iqac_admin",
  iqac_head: "iqac_admin",
  IQAC_HEAD: "iqac_admin",
  staff: "staff",
  STAFF: "staff",
  hod: "hod",
  HOD: "hod",
  faculty: "faculty",
  FACULTY: "faculty",
  student: "student",
  STUDENT: "student",
});

const normalizeRole = (role) => {
  if (!role) {
    return "";
  }

  const trimmedRole = String(role).trim();
  if (!trimmedRole) {
    return "";
  }

  const underscoredRole = trimmedRole.replace(/[\s-]+/g, "_");

  return (
    ROLE_ALIAS_MAP[trimmedRole] ||
    ROLE_ALIAS_MAP[underscoredRole] ||
    ROLE_ALIAS_MAP[underscoredRole.toLowerCase()] ||
    trimmedRole.toLowerCase()
  );
};

const userSchema = new mongoose.Schema(
{
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true
  },

  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"]
  },

  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: 6,
    select: false
  },

  role: {
    type: String,
    enum: CANONICAL_ROLES,
    default: "student",
    set: normalizeRole
  },

  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department",
    validate: {
      validator: function (value) {

        if (this.role === "hod" || this.role === "faculty") {
          return !!value;
        }

        return true;
      },
      message: "Department is required for hod and faculty roles"
    }
  },

  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active"
  },

  isActive: {
    type: Boolean,
    default: true
  }

},
{
  timestamps: true
}
);

// ==============================
// Index for faster login queries
// ==============================
// Note: email field already has unique: true which creates an index automatically


// ==============================
// Sync Account Status
// ==============================
userSchema.pre("validate", function (next) {
  if (this.role) {
    this.role = normalizeRole(this.role);
  }

  if (this.isModified("status")) {
    this.isActive = this.status === "active";
  } else if (this.isModified("isActive")) {
    this.status = this.isActive ? "active" : "inactive";
  } else if (!this.status) {
    this.status = this.isActive === false ? "inactive" : "active";
  }

  next();
});


// ==============================
// Password Hashing Middleware
// ==============================
userSchema.pre("save", async function (next) {

  if (!this.isModified("password")) {
    return next();
  }

  try {

    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);

    next();

  } catch (error) {

    next(error);

  }

});


// ==============================
// Compare Password Method
// ==============================
userSchema.methods.comparePassword = async function (candidatePassword) {

  return bcrypt.compare(candidatePassword, this.password);

};


// ==============================
// Remove Sensitive Fields
// ==============================
userSchema.methods.toJSON = function () {

  const obj = this.toObject();

  delete obj.password;

  return obj;

};

userSchema.statics.normalizeRole = normalizeRole;
userSchema.statics.isSupportedRole = (role) =>
  CANONICAL_ROLES.includes(normalizeRole(role));

userSchema.statics.CANONICAL_ROLES = CANONICAL_ROLES;

module.exports = mongoose.model("User", userSchema);
