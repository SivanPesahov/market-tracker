const express = require('express');
const router = express.Router();
const {
  analyzeTrades,
  analyzeChart,
  getMemories,
  triggerFullAnalysis,
  setDailyBiasEndpoint,
  getTraderStats
} = require('../controllers/aiController');

// Core AI chat (RAG-enhanced)
router.post('/analyze', analyzeTrades);

// Chart metadata extraction (vision gap workaround)
router.post('/chart-analysis', analyzeChart);

// AI Memory / Insights CRUD
router.get('/memories', getMemories);

// Trigger full journal deep analysis
router.post('/full-analysis', triggerFullAnalysis);

// Set daily bias for context injection
router.post('/daily-bias', setDailyBiasEndpoint);

// Get comprehensive trading statistics
router.get('/stats', getTraderStats);

module.exports = router;
