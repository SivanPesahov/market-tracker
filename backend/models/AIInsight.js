const mongoose = require('mongoose');

const aiInsightSchema = new mongoose.Schema({
  // Type categorizes the insight
  type: {
    type: String,
    enum: [
      'pattern',           // Recurring trading patterns detected
      'rule',              // Learned rules about the trader's behavior
      'weakness',          // Identified weaknesses
      'strength',          // Identified strengths
      'session_summary',   // Periodic summary of trading sessions
      'market_profile'     // Per-market behavioral profile
    ],
    required: true
  },

  // The insight content itself
  content: {
    type: String,
    required: true
  },

  // Category for structured advice retrieval
  category: {
    type: String,
    enum: [
      'liquidity_alignment',     // How well the trader reads liquidity
      'time_price_consistency',  // Killzone timing, session discipline
      'psychological_discipline', // FOMO, revenge trading, overtrading
      'concept_mastery',         // How well specific ICT concepts are applied
      'risk_management',         // R:R discipline, position sizing
      'general'
    ],
    default: 'general'
  },

  // Which market(s) this insight relates to
  markets: [{
    type: String
  }],

  // Which ICT concepts this insight relates to
  concepts: [{
    type: String
  }],

  // Confidence score (0-1) — how confident the AI is in this insight
  confidence: {
    type: Number,
    default: 0.5,
    min: 0,
    max: 1
  },

  // How many trades contributed to this insight
  tradeCount: {
    type: Number,
    default: 0
  },

  // Reference to specific trade IDs that informed this insight
  tradeRefs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trade'
  }],

  // Whether this insight is still considered active/valid
  active: {
    type: Boolean,
    default: true
  },

  // Version tracking — insights evolve over time
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Index for fast retrieval by type and category
aiInsightSchema.index({ type: 1, category: 1, active: 1 });
aiInsightSchema.index({ markets: 1 });
aiInsightSchema.index({ concepts: 1 });

module.exports = mongoose.model('AIInsight', aiInsightSchema);
