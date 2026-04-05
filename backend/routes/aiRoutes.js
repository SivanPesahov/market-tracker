const express  = require('express');
const router   = express.Router();
const { aiAnalyzeLimiter, fullAnalysisLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const {
  analyzeTrades,
  analyzeChart,
  getMemories,
  triggerFullAnalysis,
  setDailyBiasEndpoint,
  getTraderStats,
} = require('../controllers/aiController');

// ── Schemas ───────────────────────────────────────────────────────────────────

const analyzeSchema = {
  // prompt: the trader's question — capped tightly to limit injection surface
  prompt:               { type: 'string',  required: true,  minLength: 1, maxLength: 2000 },
  // history: recent conversation turns for context — cap items and each item's
  //          content is further truncated inside the controller
  history:              { type: 'array',   required: false, maxItems: 20 },
  includeMarketContext: { type: 'boolean', required: false },
};

const chartAnalysisSchema = {
  // tradeId must be a valid 24-hex-char MongoDB ObjectId
  tradeId: { type: 'string', required: true, objectId: true },
};

const dailyBiasSchema = {
  market:    { type: 'string', required: false, maxLength: 20 },
  direction: { type: 'string', required: false, enum: validate.BIAS_DIRS },
  keyLevels: { type: 'string', required: false, maxLength: 500 },
  session:   { type: 'string', required: false, maxLength: 50 },
  notes:     { type: 'string', required: false, maxLength: 1000 },
};

const memoriesQuerySchema = {
  type:     { type: 'string', required: false, maxLength: 50 },
  category: { type: 'string', required: false, maxLength: 50 },
  market:   { type: 'string', required: false, enum: validate.MARKETS },
};

// ── Routes ────────────────────────────────────────────────────────────────────

// aiAnalyzeLimiter: 30 req / 15 min / user — each call hits the Anthropic API
router.post('/analyze',
  aiAnalyzeLimiter,
  validate(analyzeSchema),
  analyzeTrades
);

router.post('/chart-analysis',
  aiAnalyzeLimiter,
  validate(chartAnalysisSchema),
  analyzeChart
);

// Query-param validation for the memories listing endpoint
router.get('/memories',
  validate(memoriesQuerySchema, { source: 'query' }),
  getMemories
);

// fullAnalysisLimiter: 5 req / hour / user — re-processes entire trade history
router.post('/full-analysis',
  fullAnalysisLimiter,
  triggerFullAnalysis
);

router.post('/daily-bias',
  validate(dailyBiasSchema),
  setDailyBiasEndpoint
);

router.get('/stats', getTraderStats);

module.exports = router;
