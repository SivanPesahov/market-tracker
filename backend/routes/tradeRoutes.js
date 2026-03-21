const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary');
const {
  getTrades,
  getTradeById,
  createTrade,
  updateTrade,
  deleteTrade
} = require('../controllers/tradeController');

// Routes
router.route('/')
  .get(getTrades)
  .post(upload.array('images', 3), createTrade);

router.route('/:id')
  .get(getTradeById)
  .put(upload.array('images', 3), updateTrade)
  .delete(deleteTrade);

module.exports = router;
