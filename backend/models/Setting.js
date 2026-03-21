const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
  // Since we don't have a multi-user system yet, we'll use a singleton pattern
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'user_settings'
  },
  startingBalance: {
    type: Number,
    default: 10000
  },
  riskPerTrade: {
    type: Number,
    default: 100
  }
}, { timestamps: true });

module.exports = mongoose.model('Setting', SettingSchema);
