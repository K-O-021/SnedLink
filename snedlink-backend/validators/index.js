const { body, validationResult } = require('express-validator');
const { AppError } = require('../utils/AppError');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msg = errors.array().map(e => `${e.path}: ${e.msg}`).join('; ');
    return next(new AppError(400, 'invalid-argument', msg));
  }
  next();
}

const createTeacherAccountRules = [
  body('name').isString().trim().notEmpty().withMessage('name is required'),
  body('email').isEmail().withMessage('a valid email is required'),
  // FIX: account creation no longer takes an admin-chosen password — the
  // teacher sets their own via the activation link (see
  // services/accountService.js createTeacherAccount / activateTeacherAccount).
  validate
];

// PUBLIC endpoint (routes/activationRoutes.js) — no Bearer token to
// validate against, so this only checks shape/length of what was sent.
const activateTeacherRules = [
  body('token').isString().trim().isLength({ min: 10 }).withMessage('a valid activation token is required'),
  body('password').isString().isLength({ min: 8 }).withMessage('password must be at least 8 characters'),
  validate
];

const createParentAccountRules = [
  body('name').isString().trim().notEmpty().withMessage('name is required'),
  body('email').isEmail().withMessage('a valid email is required'),
  body('studentId').notEmpty().withMessage('studentId is required'),
  validate
];

// PUBLIC endpoints (routes/activationRoutes.js parentRouter) — no Bearer
// token to validate against yet.
const verifyParentActivationRules = [
  body('token').isString().trim().isLength({ min: 10 }).withMessage('a valid activation code is required'),
  body('email').optional().isEmail(),
  body('studentId').optional().notEmpty(),
  validate
];

const activateParentRules = [
  body('token').isString().trim().isLength({ min: 10 }).withMessage('a valid activation token is required'),
  body('password').isString().isLength({ min: 8 }).withMessage('password must be at least 8 characters'),
  validate
];

// teacherId and sid are intentionally OPTIONAL: an admin can broadcast an
// alert unlinked to any specific teacher/student to reach everyone (same
// as the original app's "Send Notification" modal — see admin.html
// sendNotification()). Only title/body are actually required there.
const createAlertRules = [
  body('title').isString().trim().notEmpty().withMessage('title is required'),
  body('teacherId').optional({ nullable: true }).isString().trim(),
  body('sid').optional({ nullable: true }),
  body('severity').optional().isIn(['Low', 'Moderate', 'High', 'Critical']),
  validate
];

const createNotificationRules = [
  body('title').isString().trim().notEmpty().withMessage('title is required'),
  body('teacherId').optional({ nullable: true }).isString().trim(),
  body('sid').optional({ nullable: true }),
  body('forParents').optional().isBoolean(),
  body('category').optional().isString(),
  validate
];

// studentId is optional — parent_portal.html sends null when it has no
// resolved child context yet (see sendRequestToSchool()).
const createParentRequestRules = [
  body('message').isString().trim().notEmpty().withMessage('message is required'),
  body('studentId').optional({ nullable: true }),
  validate
];

module.exports = {
  validate,
  createTeacherAccountRules,
  activateTeacherRules,
  createParentAccountRules,
  verifyParentActivationRules,
  activateParentRules,
  createAlertRules,
  createNotificationRules,
  createParentRequestRules
};
