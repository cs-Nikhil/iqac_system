const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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
    enum: ["iqac_admin", "staff", "hod", "faculty", "student"],
    default: "student"
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


module.exports = mongoose.model("User", userSchema);
