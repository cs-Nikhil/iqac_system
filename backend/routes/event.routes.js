const router = require("express").Router();

const { protect } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorizeRoles');
const { validateRequest } = require('../middleware/validateRequest');
const { validateEventPayload } = require('../utils/requestValidators');

const {
  getEvents,
  createEvent,
  updateEvent,
  getEventParticipations,
  addParticipation,
  markAttendance,
  updateParticipation,
} = require("../controllers/event.controller");

// All event routes require authentication
router.use(protect);

// Get all events
router.get(
  "/",
  authorizeRoles("iqac_admin", "hod", "faculty", "student"),
  getEvents
);

// Create event
router.post(
  "/",
  authorizeRoles("iqac_admin", "hod"),
  validateRequest(validateEventPayload),
  createEvent
);

// Update event
router.put(
  "/:id",
  authorizeRoles("iqac_admin", "hod"),
  validateRequest(validateEventPayload),
  updateEvent
);

// Get event participations
router.get(
  "/:id/participations",
  authorizeRoles("iqac_admin", "hod"),
  getEventParticipations
);

// Student participation
router.post(
  "/:id/participate",
  authorizeRoles("student"),
  addParticipation
);

router.post(
  "/:id/attendance/mark",
  authorizeRoles("student"),
  markAttendance
);

// Update participation
router.put(
  "/participations/:id",
  authorizeRoles("iqac_admin", "hod"),
  updateParticipation
);

module.exports = router;
