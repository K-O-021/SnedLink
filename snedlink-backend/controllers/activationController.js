/* controllers/activationController.js
   PUBLIC surface — a first-time teacher/parent has no Firebase session yet,
   so this can't sit behind verifyToken. See services/accountService.js's
   activateTeacherAccount / verifyParentActivation / activateParentAccount
   for how the single-use token is validated instead. */
const accountService = require('../services/accountService');

// POST /api/teachers/activate  { token, password }
async function activateTeacher(req, res) {
  const { token, password } = req.body;
  const result = await accountService.activateTeacherAccount({ token, password });
  res.json(result);
}

// POST /api/parents/verify-activation  { email, studentId, token }
async function verifyParentActivation(req, res) {
  const { email, studentId, token } = req.body;
  const result = await accountService.verifyParentActivation({ email, studentId, token });
  res.json(result);
}

// POST /api/parents/activate  { token, password }
async function activateParent(req, res) {
  const { token, password } = req.body;
  const result = await accountService.activateParentAccount({ token, password });
  res.json(result);
}

module.exports = { activateTeacher, verifyParentActivation, activateParent };
