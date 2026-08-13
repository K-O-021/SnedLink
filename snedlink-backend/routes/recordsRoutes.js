const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requireRole } = require('../middleware/auth');
const { makeCrudController } = require('../controllers/recordsController');

function buildRouter(collectionName, { writeRoles = ['teacher', 'admin'] } = {}) {
  const router = express.Router();
  const ctrl = makeCrudController(collectionName);

  router.use(verifyToken);
  router.get('/', asyncHandler(ctrl.list));
  router.get('/:id', asyncHandler(ctrl.get));
  router.post('/', requireRole(...writeRoles), asyncHandler(ctrl.create));
  router.patch('/:id', requireRole(...writeRoles), asyncHandler(ctrl.update));
  router.delete('/:id', requireRole(...writeRoles), asyncHandler(ctrl.remove));

  return router;
}

module.exports = {
  behaviorLogs: buildRouter('behaviorLogs'),
  ieps: buildRouter('ieps'),
  assessments: buildRouter('assessments'),
  reports: buildRouter('reports')
};
