const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  market: {
    type: String,
    required: [true, 'Please add a market (e.g., NAS100, US500)'],
    trim: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  concepts: {
    type: [String],
    enum: ['MSS', 'BOS', 'FVG', 'IFVG', 'Order Block', 'Liquidity Sweep', 'CISD', 'SMT'],
    default: []
  },
  direction: {
    type: String,
    enum: ['Long', 'Short'],
  },
  disciplineRating: {
    type: Number,
    min: 1,
    max: 5,
  },
  narrative: {
    type: String,
    required: [true, 'Please add a narrative explaining the trade and your psychological state']
  },
  outcome: {
    type: String,
    enum: ['Win', 'Loss', 'Breakeven'],
    required: [true, 'Please select the trade outcome']
  },
  rrRatio: {
    type: Number,
    required: [true, 'Please add the Risk to Reward ratio']
  },
  session: {
    type: String,
    enum: ['London', 'NY AM', 'NY PM', 'Asian', 'Off-Session'],
    default: 'NY AM'
  },
  images: [{
    type: String // URLs to Cloudinary images
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Trade', tradeSchema);
