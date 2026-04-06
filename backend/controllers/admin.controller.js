const User = require('../models/User');
const Faculty = require('../models/Faculty');
const { applyDataScope } = require('../utils/dataScope');

// @desc    Create new user (MAINTENANCE role)
// @route   POST /api/admin/users
// @access  Private/MAINTENANCE
const createUser = async (req, res) => {
  try {
    const { name, email, role, department, password } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and role are required'
      });
    }

    // Apply data scope for validation (though MAINTENANCE sees all)
    const filter = {};
    applyDataScope(filter, req, 'user');

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const userData = {
      name,
      email,
      role,
      department: department || null,
      isActive: true
    };

    // Generate secure default password if not provided
    if (!password) {
      userData.password = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
    } else {
      userData.password = password;
    }

    const user = await User.create(userData);

    // Auto-create Faculty record if FACULTY role
    if (role === 'faculty' && department) {
      const faculty = await Faculty.create({
        name,
        email,
        department
      });
      // Link back if needed
    }

    const populatedUser = await User.findById(user._id).populate('department', 'name code');

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: populatedUser,
      defaultPassword: !password ? userData.password : undefined
    });

  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Reset user password (MAINTENANCE role)
// @route   PUT /api/admin/users/:id/reset-password
// @access  Private/MAINTENANCE
const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Find user (dataScope allows MAINTENANCE to see all)
    const filter = { _id: id };
    applyDataScope(filter, req, 'user');

    const user = await User.findOne(filter).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Let the User model pre-save hook hash the password once.
    user.password = password;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully. User must login with new password.'
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createUser, resetUserPassword };


