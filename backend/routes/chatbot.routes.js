const express = require('express');
const router = express.Router();
const { protect } = require("../middleware/auth.middleware");
const {
  chat,
  exportChatReport,
  exportInsightReport,
} = require('../controllers/chatbot.controller');

router.post('/', protect, chat);
router.post('/export', protect, exportChatReport);
router.post('/export-insight', protect, exportInsightReport);

module.exports = router;
