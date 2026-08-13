const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requireRole } = require('../middleware/auth');
const { createAlertRules, createNotificationRules, createParentRequestRules } = require('../validators');
const ctrl = require('../controllers/eventController');

const router = express.Router();
router.use(verifyToken);

// was onAlertCreated — raised by a teacher (or admin)
router.post('/alerts', requireRole('teacher', 'admin'), createAlertRules, asyncHandler(ctrl.createAlert));
router.get('/alerts', asyncHandler(ctrl.listAlerts));

// was onNotificationCreated — sent by a teacher or admin
router.post('/notifications', requireRole('teacher', 'admin'), createNotificationRules, asyncHandler(ctrl.createNotification));
router.get('/notifications', asyncHandler(ctrl.listNotifications));

// was onParentRequestCreated — sent by a parent
router.post('/parent-requests', requireRole('parent'), createParentRequestRules, asyncHandler(ctrl.createParentRequest));
router.get('/parent-requests', requireRole('admin'), asyncHandler(ctrl.listParentRequests));

module.exports = router;
