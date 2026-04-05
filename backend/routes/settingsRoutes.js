const express  = require('express');
const router   = express.Router();
const validate = require('../middleware/validate');
const settingsController = require('../controllers/settingsController');

// ── Schemas ───────────────────────────────────────────────────────────────────

const updateSettingsSchema = {
  // Both fields are optional — a PATCH may update just one.
  // Upper bounds prevent absurdly large values reaching the database.
  startingBalance: { type: 'number', required: false, min: 0, max: 10_000_000 },
  riskPerTrade:    { type: 'number', required: false, min: 0, max: 1_000_000 },
};

// ── Routes ────────────────────────────────────────────────────────────────────

router.get ('/', settingsController.getSettings);
router.patch('/', validate(updateSettingsSchema), settingsController.updateSettings);

module.exports = router;
