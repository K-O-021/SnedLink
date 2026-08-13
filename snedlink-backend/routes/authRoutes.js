const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

const router = express.Router();

router.get('/me', verifyToken, asyncHandler(ctrl.getCurrentUser));
router.patch('/me', verifyToken, asyncHandler(ctrl.updateOwnProfile));

module.exports = router;
