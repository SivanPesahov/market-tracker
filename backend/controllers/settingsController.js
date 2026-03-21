const Setting = require('../models/Setting');

// Get settings
exports.getSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne({ key: 'user_settings' });
    if (!settings) {
      // Create default if doesn't exist
      settings = await Setting.create({ key: 'user_settings' });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update settings
exports.updateSettings = async (req, res) => {
  try {
    const { startingBalance, riskPerTrade } = req.body;
    let settings = await Setting.findOneAndUpdate(
      { key: 'user_settings' },
      { startingBalance, riskPerTrade },
      { new: true, upsert: true }
    );
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
