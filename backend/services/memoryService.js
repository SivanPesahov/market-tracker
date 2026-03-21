const Anthropic = require('@anthropic-ai/sdk');
const Trade = require('../models/Trade');
const AIInsight = require('../models/AIInsight');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5-20251001'; // Use Haiku for background jobs (cheap + fast)

// ─── Call Claude for background insight generation ─────────────────
async function callClaude(prompt) {
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });
    return message.content[0].text;
  } catch (err) {
    console.error('[MemoryService] Claude unavailable for background analysis:', err.message);
    return null;
  }
}

// ─── Async Background Job: Process New Trade ──────────────────────
async function processNewTrade(tradeId) {
  try {
    const trade = await Trade.findById(tradeId).lean();
    if (!trade) return;

    const recentTrades = await Trade.find({ _id: { $ne: tradeId } })
      .sort({ date: -1 })
      .limit(20)
      .lean();

    const sameMarketTrades = await Trade.find({ market: trade.market, _id: { $ne: tradeId } })
      .sort({ date: -1 })
      .limit(10)
      .lean();

    const allTrades = await Trade.find().lean();

    const analysisPrompt = buildInsightExtractionPrompt(trade, recentTrades, sameMarketTrades, allTrades);
    const rawInsight = await callClaude(analysisPrompt);
    if (!rawInsight) return;

    await parseAndStoreInsights(rawInsight, trade);
    console.log(`[MemoryService] Processed insights for trade ${tradeId}`);
  } catch (err) {
    console.error('[MemoryService] Error processing trade:', err.message);
  }
}

// ─── Build the Insight Extraction Prompt ──────────────────────────
function buildInsightExtractionPrompt(newTrade, recentTrades, sameMarketTrades, allTrades) {
  const formatTrade = (t) => {
    const date = new Date(t.date).toLocaleDateString();
    const dir = t.direction ? ` | ${t.direction}` : '';
    const disc = t.disciplineRating ? ` | Discipline:${t.disciplineRating}/5` : '';
    return `${date} | ${t.market}${dir} | ${t.outcome} | RR:${t.rrRatio} | Session:${t.session || 'unknown'} | Concepts: ${(t.concepts || []).join(',')}${disc} | "${t.narrative || ''}"`;
  };

  // Calculate concept win rates across all trades
  const conceptStats = {};
  for (const t of allTrades) {
    for (const c of (t.concepts || [])) {
      if (!conceptStats[c]) conceptStats[c] = { wins: 0, total: 0 };
      conceptStats[c].total++;
      if (t.outcome === 'Win') conceptStats[c].wins++;
    }
  }
  const conceptSummary = Object.entries(conceptStats)
    .map(([c, s]) => `${c}: ${((s.wins/s.total)*100).toFixed(0)}% WR (${s.total} trades)`)
    .join(', ');

  let lossStreak = 0;
  for (const t of recentTrades) {
    if (t.outcome === 'Loss') lossStreak++;
    else break;
  }

  return `You are analyzing a trader's ICT/SMC journal to extract specific, personalized insights about their trading strategy and behavior.

NEW TRADE JUST LOGGED:
${formatTrade(newTrade)}

RECENT TRADE HISTORY (last 20):
${recentTrades.map(formatTrade).join('\n') || 'No prior trades'}

SAME MARKET (${newTrade.market}) HISTORY:
${sameMarketTrades.map(formatTrade).join('\n') || 'No prior trades in this market'}

OVERALL CONCEPT PERFORMANCE:
${conceptSummary || 'Not enough data yet'}

${lossStreak >= 3 ? `⚠️ WARNING: Trader is on a ${lossStreak}-trade LOSS STREAK.` : ''}

Analyze this data and generate 1-3 insights. Focus on learning THIS TRADER'S specific strategy:
- What setups do they actually take? What conditions do they look for?
- What are their personal rules (stated or implied from their narratives)?
- What patterns repeat in their wins vs losses?
- What is their edge, and are they sticking to it?

Return ONLY a JSON array, no markdown:
[
  {
    "type": "pattern|rule|weakness|strength|strategy",
    "category": "liquidity_alignment|time_price_consistency|psychological_discipline|concept_mastery|risk_management|strategy_rule|general",
    "content": "A specific, personalized insight about THIS trader's behavior or strategy",
    "markets": ["MARKET"],
    "concepts": ["CONCEPT"],
    "confidence": 0.1-1.0
  }
]

Rules:
- Be SPECIFIC — reference actual markets, concepts, sessions, and patterns from the data
- For wins: what exactly did they do right that should be reinforced?
- For losses: what broke down — setup quality, timing, psychology, or random variance?
- "strategy" type is for insights about their personal trading rules and setups
- Output ONLY the JSON array`;
}

// ─── Parse and Store Insights ──────────────────────────────────────
async function parseAndStoreInsights(rawResponse, trade) {
  try {
    let jsonStr = rawResponse;
    const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const insights = JSON.parse(jsonStr);
    if (!Array.isArray(insights)) return;

    for (const insight of insights) {
      if (!insight.type || !insight.content) continue;

      const existing = await AIInsight.findOne({
        type: insight.type,
        category: insight.category || 'general',
        content: { $regex: insight.content.substring(0, 50), $options: 'i' },
        active: true
      });

      if (existing) {
        existing.confidence = Math.min(1, existing.confidence + 0.1);
        existing.tradeCount += 1;
        existing.tradeRefs.push(trade._id);
        existing.version += 1;
        await existing.save();
      } else {
        await AIInsight.create({
          type: insight.type,
          category: insight.category || 'general',
          content: insight.content,
          markets: insight.markets || [trade.market],
          concepts: insight.concepts || trade.concepts || [],
          confidence: insight.confidence || 0.5,
          tradeCount: 1,
          tradeRefs: [trade._id]
        });
      }
    }
  } catch (err) {
    console.error('[MemoryService] Could not parse insight JSON:', err.message);
  }
}

// ─── Retrieve Relevant Memories ────────────────────────────────────
async function getRelevantMemories(intent) {
  const query = { active: true };

  if (intent.markets && intent.markets.length > 0) {
    query.markets = { $in: intent.markets };
  }
  if (intent.concepts && intent.concepts.length > 0) {
    query.concepts = { $in: intent.concepts };
  }

  const memories = await AIInsight.find(query)
    .sort({ confidence: -1, updatedAt: -1 })
    .limit(20)
    .lean();

  return memories;
}

// ─── Format Memories for Context ──────────────────────────────────
function formatMemoriesForContext(memories) {
  if (!memories || memories.length === 0) return 'No long-term insights stored yet.';

  return memories.map(m => {
    const conf = (m.confidence * 100).toFixed(0);
    return `[${m.type.toUpperCase()}] [${conf}% confidence, seen in ${m.tradeCount} trades] ${m.content}`;
  }).join('\n');
}

// ─── Full Journal Analysis ─────────────────────────────────────────
async function runFullAnalysis() {
  const trades = await Trade.find().sort({ date: -1 }).lean();
  if (trades.length < 3) return { message: 'Need at least 3 trades for full analysis' };

  const formatTrade = (t) => {
    const date = new Date(t.date).toLocaleDateString();
    const dir = t.direction ? ` | ${t.direction}` : '';
    const disc = t.disciplineRating ? ` | Disc:${t.disciplineRating}/5` : '';
    return `${date} | ${t.market}${dir} | ${t.outcome} | RR:${t.rrRatio} | ${t.session || ''} | ${(t.concepts||[]).join(',')}${disc} | "${t.narrative || ''}"`;
  };

  const prompt = `You are analyzing a complete ICT/SMC trading journal to build a deep understanding of this trader's personal strategy, strengths, and weaknesses.

COMPLETE TRADE HISTORY (${trades.length} trades, most recent first):
${trades.map(formatTrade).join('\n')}

Generate 5-8 insights that capture:
1. This trader's specific strategy — what setups do they take, what are their entry conditions?
2. Their personal rules (explicit or implied from narratives)
3. Their strongest and weakest concepts with evidence
4. Recurring psychological patterns
5. Best and worst sessions/markets for them specifically
6. What separates their winning trades from losing ones

Return ONLY a JSON array:
[
  {
    "type": "pattern|rule|weakness|strength|strategy",
    "category": "liquidity_alignment|time_price_consistency|psychological_discipline|concept_mastery|risk_management|strategy_rule|general",
    "content": "Specific insight with evidence from the data",
    "markets": ["MARKET"],
    "concepts": ["CONCEPT"],
    "confidence": 0.1-1.0
  }
]`;

  const rawInsight = await callClaude(prompt);
  if (!rawInsight) return { message: 'Claude unavailable' };

  await AIInsight.updateMany({ type: { $in: ['pattern', 'rule', 'strategy'] } }, { active: false });
  await parseAndStoreInsights(rawInsight, { _id: null, market: 'ALL', concepts: [] });

  const count = await AIInsight.countDocuments({ active: true });
  return { message: `Full analysis complete. ${count} active insights stored.` };
}

module.exports = {
  processNewTrade,
  getRelevantMemories,
  formatMemoriesForContext,
  runFullAnalysis
};
