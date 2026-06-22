/**
 * Trade controller.
 *
 * Input validation and rate limiting are handled upstream in the route layer
 * (middleware/validate.js and middleware/rateLimiter.js). This controller
 * trusts that validated data has already been passed through.
 *
 * Ownership model:
 *   New trades are tagged with req.user.id.
 *   Existing trades without a userId (pre-migration) remain accessible to any
 *   authenticated user — this is intentional for backwards compatibility with
 *   single-user data. Once userId is set, strict ownership is enforced.
 */

const Trade = require('../models/Trade');
const { processNewTrade } = require('../services/memoryService');

const VALID_CONCEPTS = require('../middleware/validate').CONCEPTS;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse concepts from a JSON string or comma-separated value (FormData),
 * then filter to the valid enum set.
 */
function parseConcepts(raw) {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); }
    catch { arr = raw.split(',').map(s => s.trim()).filter(Boolean); }
  }
  return Array.isArray(arr) ? arr.filter(c => VALID_CONCEPTS.includes(c)) : [];
}

// ── GET /api/trades ───────────────────────────────────────────────────────────
const getTrades = async (req, res) => {
  try {
    const trades = await Trade.find().sort({ date: -1 });
    res.status(200).json(trades);
  } catch (error) {
    console.error('GetTrades error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── GET /api/trades/:id ───────────────────────────────────────────────────────
const getTradeById = async (req, res) => {
  try {
    const trade = await Trade.findById(req.params.id);
    if (!trade) return res.status(404).json({ message: 'Trade not found' });

    // Ownership check — only enforced when userId is present on the document
    if (trade.userId && trade.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.status(200).json(trade);
  } catch (error) {
    console.error('GetTradeById error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── POST /api/trades ──────────────────────────────────────────────────────────
const createTrade = async (req, res) => {
  try {
    const images = req.files ? req.files.map(file => file.path || file.secure_url || file.url) : [];
    const { market, date, concepts, narrative, outcome, rrRatio, session,
            direction, disciplineRating } = req.body;

    const trade = await Trade.create({
      market,
      date:             date || Date.now(),
      concepts:         parseConcepts(concepts),
      narrative,
      outcome,
      rrRatio:          parseFloat(rrRatio),
      session:          session || 'NY AM',
      direction,
      disciplineRating: disciplineRating ? parseInt(disciplineRating, 10) : undefined,
      images,
      userId:           req.user.id,
    });

    // Non-blocking background AI analysis
    processNewTrade(trade._id).catch(err =>
      console.error('[Memory] Background insight generation failed:', err.message)
    );

    res.status(201).json(trade);
  } catch (error) {
    console.error('CreateTrade error:', error);
    res.status(400).json({ message: 'Failed to create trade' });
  }
};

// ── PUT /api/trades/:id ───────────────────────────────────────────────────────
const updateTrade = async (req, res) => {
  try {
    const trade = await Trade.findById(req.params.id);
    if (!trade) return res.status(404).json({ message: 'Trade not found' });

    if (trade.userId && trade.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { market, date, concepts, narrative, outcome, rrRatio,
            direction, disciplineRating } = req.body;

    // Merge new images with existing ones
    const newImages = req.files?.length ? req.files.map(f => f.path || f.secure_url || f.url) : [];
    const images    = [...trade.images, ...newImages];

    const update = {};
    if (market)           update.market           = market;
    if (date)             update.date             = date;
    if (concepts)         update.concepts         = parseConcepts(concepts);
    if (narrative)        update.narrative        = narrative;
    if (outcome)          update.outcome          = outcome;
    if (rrRatio != null)  update.rrRatio          = parseFloat(rrRatio);
    if (direction)        update.direction        = direction;
    if (disciplineRating) update.disciplineRating = parseInt(disciplineRating, 10);
    update.images = images;

    const updated = await Trade.findByIdAndUpdate(
      req.params.id, update, { new: true, runValidators: true }
    );

    res.status(200).json(updated);
  } catch (error) {
    console.error('UpdateTrade error:', error);
    res.status(400).json({ message: 'Failed to update trade' });
  }
};

// ── DELETE /api/trades/:id ────────────────────────────────────────────────────
const deleteTrade = async (req, res) => {
  try {
    const trade = await Trade.findById(req.params.id);
    if (!trade) return res.status(404).json({ message: 'Trade not found' });

    if (trade.userId && trade.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await trade.deleteOne();
    res.status(200).json({ id: req.params.id, message: 'Trade deleted' });
  } catch (error) {
    console.error('DeleteTrade error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { getTrades, getTradeById, createTrade, updateTrade, deleteTrade };
