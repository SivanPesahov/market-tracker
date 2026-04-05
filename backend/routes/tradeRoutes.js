const express  = require('express');
const router   = express.Router();
const { upload }       = require('../config/cloudinary');
const { writeLimiter } = require('../middleware/rateLimiter');
const validate         = require('../middleware/validate');
const {
  getTrades,
  getTradeById,
  createTrade,
  updateTrade,
  deleteTrade,
} = require('../controllers/tradeController');

// ── Schemas ───────────────────────────────────────────────────────────────────
// Trade routes use multipart/form-data (image uploads), so all body fields
// arrive as strings from multer. The validate middleware coerces number fields
// and parses JSON-stringified arrays automatically.
// strict: false because multer may inject its own metadata keys.

const createTradeSchema = {
  market:           { type: 'string', required: true,  enum: validate.MARKETS },
  date:             { type: 'string', required: false },
  outcome:          { type: 'string', required: true,  enum: validate.OUTCOMES },
  rrRatio:          { type: 'number', required: true,  min: -100, max: 1000 },
  narrative:        { type: 'string', required: true,  minLength: 1, maxLength: 5000 },
  session:          { type: 'string', required: false, enum: validate.SESSIONS },
  direction:        { type: 'string', required: false, enum: validate.DIRECTIONS },
  disciplineRating: { type: 'number', required: false, min: 1, max: 5 },
  concepts:         { type: 'array',  required: false, maxItems: 10, items: { enum: validate.CONCEPTS } },
};

const updateTradeSchema = {
  market:           { type: 'string', required: false, enum: validate.MARKETS },
  date:             { type: 'string', required: false },
  outcome:          { type: 'string', required: false, enum: validate.OUTCOMES },
  rrRatio:          { type: 'number', required: false, min: -100, max: 1000 },
  narrative:        { type: 'string', required: false, maxLength: 5000 },
  session:          { type: 'string', required: false, enum: validate.SESSIONS },
  direction:        { type: 'string', required: false, enum: validate.DIRECTIONS },
  disciplineRating: { type: 'number', required: false, min: 1, max: 5 },
  concepts:         { type: 'array',  required: false, maxItems: 10, items: { enum: validate.CONCEPTS } },
};

// ── Routes ────────────────────────────────────────────────────────────────────

router.route('/')
  .get(getTrades)
  // writeLimiter: 60 writes / 15 min / user
  .post(
    writeLimiter,
    upload.array('images', 3),
    validate(createTradeSchema, { strict: false }),
    createTrade
  );

router.route('/:id')
  .get(getTradeById)
  .put(
    writeLimiter,
    upload.array('images', 3),
    validate(updateTradeSchema, { strict: false }),
    updateTrade
  )
  .delete(writeLimiter, deleteTrade);

module.exports = router;
