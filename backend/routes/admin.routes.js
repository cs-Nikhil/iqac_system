const router = require('express').Router();
const { protect } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorizeRoles');
const { createUser, resetUserPassword } = require('../controllers/admin.controller');

// @route   POST /api/admin/users
// @access  MAINTENANCE only
router.post('/users', protect, authorizeRoles("iqac_admin", "staff"), createUser);

// @route   PUT /api/admin/users/:id/reset-password
// @access  MAINTENANCE only
router.put('/users/:id/reset-password', protect, authorizeRoles("iqac_admin", "staff"), resetUserPassword);

module.exports = router;

