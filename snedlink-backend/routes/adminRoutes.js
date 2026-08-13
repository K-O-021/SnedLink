const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requireRole } = require('../middleware/auth');
const { accountCreationLimiter } = require('../middleware/rateLimiter');
const { createTeacherAccountRules, createParentAccountRules } = require('../validators');
const ctrl = require('../controllers/adminController');

const router = express.Router();

// Every route in this file requires an authenticated ADMIN — mirrors the
// old requireAdmin() check that every onCall function ran first.
router.use(verifyToken, requireRole('admin'));

// createTeacherAccount
router.post('/teachers', accountCreationLimiter, createTeacherAccountRules, asyncHandler(ctrl.createTeacherAccount));
router.get('/teachers', asyncHandler(ctrl.listTeachers));
router.patch('/teachers/:uid', asyncHandler(ctrl.updateTeacher));
router.delete('/teachers/:uid', asyncHandler(ctrl.deleteTeacher));

// createParentAccount
router.post('/parents', accountCreationLimiter, createParentAccountRules, asyncHandler(ctrl.createParentAccount));
router.post('/parents/:uid/reset-password', accountCreationLimiter, asyncHandler(ctrl.resetParentPassword));
router.get('/parents', asyncHandler(ctrl.listParents));
router.delete('/parents/:uid', asyncHandler(ctrl.deleteParent));

// Manage students
router.get('/students', asyncHandler(ctrl.listStudents));
router.post('/students', asyncHandler(ctrl.createStudent));
router.patch('/students/:sid', asyncHandler(ctrl.updateStudent));
router.delete('/students/:sid', asyncHandler(ctrl.deleteStudent));

module.exports = router;
