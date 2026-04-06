const router = require('express').Router();

const { protect } = require('../middleware/auth.middleware');
const {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/notification.controller');

router.use(protect);

router.get('/', listNotifications);
router.post('/read-all', markAllNotificationsRead);
router.post('/:id/read', markNotificationRead);

module.exports = router;
