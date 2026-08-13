const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { accountCreationLimiter } = require('../middleware/rateLimiter');
const { activateTeacherRules, verifyParentActivationRules, activateParentRules } = require('../validators');
const ctrl = require('../controllers/activationController');

const teacherRouter = express.Router();
const parentRouter = express.Router();

// Deliberately NOT behind verifyToken — a first-time teacher/parent has no
// Firebase session until this succeeds. The single-use token is the
// credential; see services/accountService.js for validation, expiry, and
// single-use enforcement. Rate-limited like other Auth-touching endpoints
// since these are unauthenticated and guessable tokens are the main risk.
teacherRouter.post('/activate', accountCreationLimiter, activateTeacherRules, asyncHandler(ctrl.activateTeacher));

parentRouter.post('/verify-activation', accountCreationLimiter, verifyParentActivationRules, asyncHandler(ctrl.verifyParentActivation));
parentRouter.post('/activate', accountCreationLimiter, activateParentRules, asyncHandler(ctrl.activateParent));

module.exports = { teacherRouter, parentRouter };
