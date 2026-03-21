const DailyBias = require('../models/DailyBias');

// ─── Fetch live market data from Yahoo Finance (no API key needed) ─
async function fetchMarketContext() {
  const symbols = [
    { sym: '%5ENDX',    label: 'NAS100'  },
    { sym: '%5EGSPC',   label: 'S&P500'  },
    { sym: 'XAUUSD%3DX', label: 'Gold'   },
    { sym: 'EURUSD%3DX', label: 'EURUSD' },
  ];

  const context = {
    timestamp: new Date().toISOString(),
    markets: []
  };

  for (const { sym, label } of symbols) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=2d`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      clearTimeout(timeout);

      if (!res.ok) continue;

      const data = await res.json();
      const result = data.chart?.result?.[0];
      if (!result) continue;

      const closes = result.indicators?.quote?.[0]?.close;
      if (!closes || closes.length < 2) continue;

      const prev = closes[closes.length - 2];
      const curr = closes[closes.length - 1];
      if (!prev || !curr) continue;

      const changePct = (((curr - prev) / prev) * 100).toFixed(2);
      context.markets.push({
        symbol: label,
        price: curr.toFixed(2),
        change: `${changePct > 0 ? '+' : ''}${changePct}%`,
        direction: changePct > 0 ? 'bullish' : changePct < 0 ? 'bearish' : 'flat'
      });
    } catch {
      // silently skip failed symbols
    }
  }

  return context;
}

// ─── Format market context for the prompt ─────────────────────────
function formatMarketContext(context) {
  if (!context || context.markets.length === 0) {
    return '[Market Context: Live data unavailable. Analyzing from journal only.]';
  }

  let out = `=== LIVE MARKET DATA (${new Date(context.timestamp).toUTCString()}) ===\n`;
  for (const m of context.markets) {
    out += `• ${m.symbol}: $${m.price} (${m.change}) — ${m.direction}\n`;
  }
  return out;
}

// ─── Daily Bias — persisted to MongoDB ────────────────────────────
async function setDailyBias(bias) {
  const today = new Date().toISOString().split('T')[0];
  await DailyBias.findOneAndUpdate(
    { date: today },
    { ...bias, date: today },
    { upsert: true, new: true }
  );
}

async function getDailyBias() {
  const today = new Date().toISOString().split('T')[0];
  return DailyBias.findOne({ date: today }).lean();
}

function formatDailyBias(bias) {
  if (!bias) return '';
  return `
=== TRADER'S DAILY BIAS (${bias.date}) ===
Market: ${bias.market || 'All'}
Bias: ${bias.direction || 'Neutral'}
Key Levels: ${bias.keyLevels || 'None specified'}
Session Focus: ${bias.session || 'Not specified'}
Notes: ${bias.notes || 'None'}
===\n`;
}

module.exports = {
  fetchMarketContext,
  formatMarketContext,
  setDailyBias,
  getDailyBias,
  formatDailyBias
};
