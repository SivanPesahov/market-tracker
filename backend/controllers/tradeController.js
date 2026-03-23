const Trade = require('../models/Trade');
const { processNewTrade } = require('../services/memoryService');

// @desc    Get all trades
// @route   GET /api/trades
// @access  Public
const getTrades = async (req, res) => {
  try {
    const trades = await Trade.find().sort({ date: -1 });
    res.status(200).json(trades);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single trade
// @route   GET /api/trades/:id
// @access  Public
const getTradeById = async (req, res) => {
  try {
    const trade = await Trade.findById(req.params.id);
    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }
    res.status(200).json(trade);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a trade
// @route   POST /api/trades
// @access  Public
const createTrade = async (req, res) => {
  try {
    
    // Process image URLs from Multer (uploaded to Cloudinary)
    const images = req.files ? req.files.map(file => file.path) : [];

    const { market, date, concepts, narrative, outcome, rrRatio, session } = req.body;

    // Parse concepts if they come as a JSON string (from FormData)
    let parsedConcepts = concepts;
    if (typeof concepts === 'string') {
      try {
        parsedConcepts = JSON.parse(concepts);
      } catch (e) {
        parsedConcepts = concepts.split(',').map(c => c.trim());
      }
    }
    const trade = await Trade.create({
      market,
      date: date || Date.now(),
      concepts: parsedConcepts,
      narrative,
      outcome,
      rrRatio: parseFloat(rrRatio) || 0,
      session: session || 'NY AM',
      images
    });

    // Trigger async background AI analysis (non-blocking)
    processNewTrade(trade._id).catch(err => {
      console.error('[Memory] Background insight generation failed:', err.message);
    });

    res.status(201).json(trade);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a trade
// @route   PUT /api/trades/:id
// @access  Public
const updateTrade = async (req, res) => {
  try {
    const trade = await Trade.findById(req.params.id);
    
    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    const { market, date, concepts, narrative, outcome, rrRatio } = req.body;
    
    // If there are new files uploaded, add to the images array
    // You might want to handle removing old images later
    let updatedImages = [...trade.images];
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => file.path);
      updatedImages = [...updatedImages, ...newImages];
    }
    
    let parsedConcepts = concepts;
    if (typeof concepts === 'string') {
      try {
        parsedConcepts = JSON.parse(concepts);
      } catch (e) {
        parsedConcepts = concepts.split(',').map(c => c.trim());
      }
    }

    const updateData = {};
    if (market) updateData.market = market;
    if (date) updateData.date = date;
    if (parsedConcepts) updateData.concepts = parsedConcepts;
    if (narrative) updateData.narrative = narrative;
    if (outcome) updateData.outcome = outcome;
    if (rrRatio) updateData.rrRatio = parseFloat(rrRatio);
    updateData.images = updatedImages;

    const updatedTrade = await Trade.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json(updatedTrade);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a trade
// @route   DELETE /api/trades/:id
// @access  Public
const deleteTrade = async (req, res) => {
  try {
    const trade = await Trade.findById(req.params.id);
    
    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }
    
    // Optionally: delete images from Cloudinary here
    // const publicIds = trade.images.map(img => img.split('/').pop().split('.')[0]);
    // for (const id of publicIds) {
    //  await cloudinary.uploader.destroy(`market_tracker_trades/${id}`);
    // }

    await trade.deleteOne();

    res.status(200).json({ id: req.params.id, message: 'Trade deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTrades,
  getTradeById,
  createTrade,
  updateTrade,
  deleteTrade
};
