const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const authController = require('../controllers/authController');

// ── Schemas ───────────────────────────────────────────────────────────────────

const loginSchema = {
  // Both fields are strings; lengths are capped to prevent oversized payloads
  // being passed through to the database query.
  username: { type: 'string', required: true,  maxLength: 254 },
  password: { type: 'string', required: true,  maxLength: 128 },
};

const changePasswordSchema = {
  currentPassword: { type: 'string', required: true, maxLength: 128 },
  // Minimum 8 characters enforced here *and* in the controller for defense-in-depth
  newPassword:     { type: 'string', required: true, minLength: 8, maxLength: 128 },
};

// ── Routes ────────────────────────────────────────────────────────────────────

// loginLimiter: 10 req / 15 min / IP — brute-force protection
router.post('/login',    loginLimiter, validate(loginSchema),          authController.login);
router.get ('/me',       auth,                                          authController.getMe);
router.patch('/password', auth,        validate(changePasswordSchema),  authController.changePassword);

module.exports = router;
