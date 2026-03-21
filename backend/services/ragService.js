const Trade = require('../models/Trade');

/**
 * RAG Service — Retrieval-Augmented Generation for Trade Analysis
 * 
 * Instead of dumping all trades into the prompt, this service performs
 * intelligent retrieval: it queries MongoDB for trades matching the
 * user's question context, summarizes patterns, and builds a compact
 * but information-dense context block for the LLM.
 */

// ─── Keyword Extraction ───────────────────────────────────────────
// Simple NLP-free keyword extractor for trade-relevant terms
function extractQueryIntent(prompt) {
  const lower = prompt.toLowerCase();

  const intent = {
    markets: [],
    concepts: [],
    outcomes: [],
    timeframe: null,    // 'week', 'month', 'all'
    tradeCount: null,   // "last 10", "last 5"
    keywords: []
  };

  // Detect markets
  const marketMap = {
    'nas100': 'NAS100', 'nasdaq': 'NAS100', 'nq': 'NAS100',
    'us500': 'US500', 'sp500': 'US500', 'spx': 'US500', 's&p': 'US500',
    'eurusd': 'EURUSD', 'eur/usd': 'EURUSD',
    'gbpusd': 'GBPUSD', 'gbp/usd': 'GBPUSD', 'cable': 'GBPUSD',
    'xauusd': 'XAUUSD', 'gold': 'XAUUSD'
  };
  for (const [key, val] of Object.entries(marketMap)) {
    if (lower.includes(key)) intent.markets.push(val);
  }

  // Detect ICT concepts
  const conceptMap = {
    'mss': 'MSS', 'market structure shift': 'MSS',
    'bos': 'BOS', 'break of structure': 'BOS',
    'fvg': 'FVG', 'fair value gap': 'FVG',
    'ifvg': 'IFVG', 'inverse fvg': 'IFVG', 'inverse fair value gap': 'IFVG',
    'order block': 'Order Block', 'ob': 'Order Block',
    'liquidity sweep': 'Liquidity Sweep', 'liq sweep': 'Liquidity Sweep',
    'cisd': 'CISD', 'change in state of delivery': 'CISD',
    'smt': 'SMT', 'smt divergence': 'SMT', 'smart money technique': 'SMT'
  };
  for (const [key, val] of Object.entries(conceptMap)) {
    if (lower.includes(key) && !intent.concepts.includes(val)) {
      intent.concepts.push(val);
    }
  }

  // Detect outcomes
  if (lower.includes('loss') || lower.includes('lost') || lower.includes('losing')) intent.outcomes.push('Loss');
  if (lower.includes('win') || lower.includes('won') || lower.includes('winning')) intent.outcomes.push('Win');
  if (lower.includes('breakeven') || lower.includes('break even') || lower.includes('be')) intent.outcomes.push('Breakeven');

  // Detect timeframe
  if (lower.includes('today')) intent.timeframe = 'today';
  else if (lower.includes('this week') || lower.includes('past week')) intent.timeframe = 'week';
  else if (lower.includes('this month') || lower.includes('past month')) intent.timeframe = 'month';
  else if (lower.includes('all time') || lower.includes('overall') || lower.includes('history')) intent.timeframe = 'all';

  // Detect trade count (e.g., "last 10", "last 5")
  const countMatch = lower.match(/last\s+(\d+)/);
  if (countMatch) intent.tradeCount = parseInt(countMatch[1]);

  // Detect psychological keywords
  const psychKeywords = ['fomo', 'revenge', 'fear', 'greed', 'overtrad', 'impatien', 'disciplin', 'emoti', 'tilt', 'anxious', 'confiden'];
  intent.keywords = psychKeywords.filter(k => lower.includes(k));

  return intent;
}

// ─── Date Range Calculator ────────────────────────────────────────
function getDateRange(timeframe) {
  const now = new Date();
  switch (timeframe) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'all':
    default:
      return null;
  }
}

// ─── Main RAG Retrieval ───────────────────────────────────────────
async function retrieveRelevantTrades(prompt) {
  const intent = extractQueryIntent(prompt);

  // Build MongoDB query dynamically
  const query = {};

  if (intent.markets.length > 0) {
    query.market = { $in: intent.markets };
  }
  if (intent.concepts.length > 0) {
    query.concepts = { $in: intent.concepts };
  }
  if (intent.outcomes.length > 0) {
    query.outcome = { $in: intent.outcomes };
  }
  if (intent.timeframe) {
    const fromDate = getDateRange(intent.timeframe);
    if (fromDate) query.date = { $gte: fromDate };
  }

  // If psychological keywords detected, search narratives
  let narrativeFilter = null;
  if (intent.keywords.length > 0) {
    narrativeFilter = new RegExp(intent.keywords.join('|'), 'i');
    query.narrative = { $regex: narrativeFilter };
  }

  const limit = intent.tradeCount || 30;

  // Execute the targeted query
  const targetedTrades = await Trade.find(query).sort({ date: -1 }).limit(limit).lean();

  // Also fetch the most recent 5 trades as "current context" regardless
  const recentTrades = await Trade.find().sort({ date: -1 }).limit(5).lean();

  // Deduplicate
  const seenIds = new Set(targetedTrades.map(t => t._id.toString()));
  const combined = [...targetedTrades];
  for (const t of recentTrades) {
    if (!seenIds.has(t._id.toString())) {
      combined.push(t);
    }
  }

  return {
    trades: combined,
    intent,
    queryUsed: query,
    totalInDb: await Trade.countDocuments()
  };
}

// ─── Statistical Summary Generator ────────────────────────────────
async function generateTradeStatistics() {
  const allTrades = await Trade.find().lean();
  if (allTrades.length === 0) return null;

  const stats = {
    totalTrades: allTrades.length,
    wins: allTrades.filter(t => t.outcome === 'Win').length,
    losses: allTrades.filter(t => t.outcome === 'Loss').length,
    breakevens: allTrades.filter(t => t.outcome === 'Breakeven').length,
    avgRR: 0,
    winRate: 0,
    marketBreakdown: {},
    conceptFrequency: {},
    conceptWinRate: {},
    conceptAvgRR: {},
    conceptCombos: {},
    sessionPerformance: {},
    dayOfWeekPerformance: {},
    streaks: { currentStreak: '', maxWinStreak: 0, maxLossStreak: 0 }
  };

  // Win rate
  stats.winRate = ((stats.wins / stats.totalTrades) * 100).toFixed(1);

  // Average RR
  const rrValues = allTrades.filter(t => t.rrRatio).map(t => t.rrRatio);
  stats.avgRR = rrValues.length > 0 ? (rrValues.reduce((a, b) => a + b, 0) / rrValues.length).toFixed(2) : 0;

  // Per-market breakdown
  for (const trade of allTrades) {
    if (!stats.marketBreakdown[trade.market]) {
      stats.marketBreakdown[trade.market] = { total: 0, wins: 0, losses: 0, avgRR: [] };
    }
    const mb = stats.marketBreakdown[trade.market];
    mb.total++;
    if (trade.outcome === 'Win') mb.wins++;
    if (trade.outcome === 'Loss') mb.losses++;
    if (trade.rrRatio) mb.avgRR.push(trade.rrRatio);
  }
  // Calculate per-market averages
  for (const [market, data] of Object.entries(stats.marketBreakdown)) {
    data.winRate = ((data.wins / data.total) * 100).toFixed(1) + '%';
    data.avgRR = data.avgRR.length > 0 ? (data.avgRR.reduce((a, b) => a + b, 0) / data.avgRR.length).toFixed(2) : '0';
  }

  // Concept frequency, win rate, avg RR, and combination analysis
  for (const trade of allTrades) {
    const concepts = trade.concepts || [];
    for (const concept of concepts) {
      if (!stats.conceptFrequency[concept]) stats.conceptFrequency[concept] = 0;
      stats.conceptFrequency[concept]++;

      if (!stats.conceptWinRate[concept]) stats.conceptWinRate[concept] = { wins: 0, total: 0 };
      stats.conceptWinRate[concept].total++;
      if (trade.outcome === 'Win') stats.conceptWinRate[concept].wins++;

      if (!stats.conceptAvgRR[concept]) stats.conceptAvgRR[concept] = [];
      if (trade.rrRatio) stats.conceptAvgRR[concept].push(trade.rrRatio);
    }

    // Concept combination pairs
    const sorted = [...concepts].sort();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = `${sorted[i]} + ${sorted[j]}`;
        if (!stats.conceptCombos[key]) stats.conceptCombos[key] = { wins: 0, total: 0 };
        stats.conceptCombos[key].total++;
        if (trade.outcome === 'Win') stats.conceptCombos[key].wins++;
      }
    }
  }
  for (const [concept, data] of Object.entries(stats.conceptWinRate)) {
    data.rate = ((data.wins / data.total) * 100).toFixed(1) + '%';
  }
  for (const [concept, rrs] of Object.entries(stats.conceptAvgRR)) {
    stats.conceptAvgRR[concept] = rrs.length > 0
      ? (rrs.reduce((a, b) => a + b, 0) / rrs.length).toFixed(2)
      : '0';
  }
  for (const [combo, data] of Object.entries(stats.conceptCombos)) {
    data.rate = ((data.wins / data.total) * 100).toFixed(1) + '%';
  }

  // Day of week performance
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (const trade of allTrades) {
    const day = days[new Date(trade.date).getDay()];
    if (!stats.dayOfWeekPerformance[day]) stats.dayOfWeekPerformance[day] = { total: 0, wins: 0 };
    stats.dayOfWeekPerformance[day].total++;
    if (trade.outcome === 'Win') stats.dayOfWeekPerformance[day].wins++;
  }

  // Session performance
  for (const trade of allTrades) {
    if (!trade.session) continue;
    if (!stats.sessionPerformance[trade.session]) {
      stats.sessionPerformance[trade.session] = { total: 0, wins: 0, rrValues: [] };
    }
    const sp = stats.sessionPerformance[trade.session];
    sp.total++;
    if (trade.outcome === 'Win') sp.wins++;
    if (trade.rrRatio) sp.rrValues.push(trade.rrRatio);
  }
  for (const [session, data] of Object.entries(stats.sessionPerformance)) {
    data.winRate = ((data.wins / data.total) * 100).toFixed(1) + '%';
    data.avgRR = data.rrValues.length > 0
      ? (data.rrValues.reduce((a, b) => a + b, 0) / data.rrValues.length).toFixed(2)
      : '0';
    delete data.rrValues;
  }

  // Streaks
  let currentStreak = 0;
  let currentType = null;
  let maxWin = 0, maxLoss = 0;
  const sorted = [...allTrades].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const t of sorted) {
    if (t.outcome === currentType) {
      currentStreak++;
    } else {
      currentType = t.outcome;
      currentStreak = 1;
    }
    if (currentType === 'Win') maxWin = Math.max(maxWin, currentStreak);
    if (currentType === 'Loss') maxLoss = Math.max(maxLoss, currentStreak);
  }
  stats.streaks.maxWinStreak = maxWin;
  stats.streaks.maxLossStreak = maxLoss;
  stats.streaks.currentStreak = `${currentStreak} ${currentType || 'N/A'}`;

  return stats;
}

// ─── Format Trades for Prompt ─────────────────────────────────────
function formatTradesForContext(trades) {
  if (!trades || trades.length === 0) return 'No trades match the query.';

  return trades.map((t, idx) => {
    const date = new Date(t.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    const concepts = (t.concepts || []).join(', ') || 'None tagged';
    const images = (t.images || []).length;
    return `[Trade #${idx + 1}] ${date} | ${t.market} | ${t.outcome} | RR: ${t.rrRatio} | Concepts: ${concepts} | Charts: ${images} attached\nNarrative: ${t.narrative || 'No narrative provided'}`;
  }).join('\n---\n');
}

function formatStatisticsForContext(stats) {
  if (!stats) return 'No trades in journal yet.';

  let out = `=== TRADER PROFILE (${stats.totalTrades} trades) ===\n`;
  out += `Win Rate: ${stats.winRate}% | Wins: ${stats.wins} | Losses: ${stats.losses} | BE: ${stats.breakevens} | Avg RR: ${stats.avgRR}\n`;
  out += `Current Streak: ${stats.streaks.currentStreak} | Max Win Streak: ${stats.streaks.maxWinStreak} | Max Loss Streak: ${stats.streaks.maxLossStreak}\n\n`;

  out += `--- Per-Market ---\n`;
  for (const [market, data] of Object.entries(stats.marketBreakdown)) {
    out += `${market}: ${data.total} trades, WR: ${data.winRate}, AvgRR: ${data.avgRR}\n`;
  }

  out += `\n--- Concept Performance ---\n`;
  for (const [concept, data] of Object.entries(stats.conceptWinRate)) {
    const avgRR = stats.conceptAvgRR[concept] || '0';
    out += `${concept}: WR ${data.rate} (${data.wins}/${data.total}), Avg RR: ${avgRR}\n`;
  }

  if (Object.keys(stats.conceptCombos).length > 0) {
    out += `\n--- Concept Combinations ---\n`;
    for (const [combo, data] of Object.entries(stats.conceptCombos)) {
      out += `${combo}: ${data.rate} (${data.wins}/${data.total})\n`;
    }
  }

  if (Object.keys(stats.sessionPerformance).length > 0) {
    out += `\n--- Session Performance ---\n`;
    for (const [session, data] of Object.entries(stats.sessionPerformance)) {
      out += `${session}: ${data.total} trades, WR: ${data.winRate}, AvgRR: ${data.avgRR}\n`;
    }
  }

  out += `\n--- Day of Week ---\n`;
  for (const [day, data] of Object.entries(stats.dayOfWeekPerformance)) {
    const rate = ((data.wins / data.total) * 100).toFixed(0);
    out += `${day}: ${data.total} trades, ${rate}% WR\n`;
  }

  return out;
}

module.exports = {
  extractQueryIntent,
  retrieveRelevantTrades,
  generateTradeStatistics,
  formatTradesForContext,
  formatStatisticsForContext
};
