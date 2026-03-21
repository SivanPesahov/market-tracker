const mongoose = require('mongoose');

const DailyBiasSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // YYYY-MM-DD
  market: { type: String, default: 'All' },
  direction: { type: String, enum: ['Bullish', 'Bearish', 'Neutral'], default: 'Neutral' },
  keyLevels: { type: String, default: '' },
  session: { type: String, default: '' },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('DailyBias', DailyBiasSchema);
