const Trade = require('../models/Trade');
const AIInsight = require('../models/AIInsight');

/**
 * Memory Service — Long-Term AI Learning System
 * 
 * Every time a trade is logged, this service runs asynchronously to:
 * 1. Analyze the new trade in context of existing history
 * 2. Detect emerging patterns, weaknesses, and strengths
 * 3. Store/update "Learned Rules" in the AI_Insights collection
 * 4. Keep the AI's understanding of the trader's style evolving
 */

const OLLAMA_URL = 'http://localhost:11434/api/generate';

// ─── Call Ollama for background insight generation ────────────────
async function callOllama(prompt, model = 'llama3') {
  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false })
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.response;
  } catch (err) {
    console.error('[MemoryService] Ollama unavailable for background analysis:', err.message);
    return null;
  }
}

// ─── Async Background Job: Process New Trade ──────────────────────
async function processNewTrade(tradeId) {
  try {
    const trade = await Trade.findById(tradeId).lean();
    if (!trade) return;

    // Get recent history for context
    const recentTrades = await Trade.find({ _id: { $ne: tradeId } })
      .sort({ date: -1 })
      .limit(15)
      .lean();

    // Get same-market history
    const sameMarketTrades = await Trade.find({ market: trade.market, _id: { $ne: tradeId } })
      .sort({ date: -1 })
      .limit(10)
      .lean();

    // Build analysis prompt
    const analysisPrompt = buildInsightExtractionPrompt(trade, recentTrades, sameMarketTrades);
    
    const rawInsight = await callOllama(analysisPrompt);
    if (!rawInsight) return;

    // Parse and store the insight
    await parseAndStoreInsights(rawInsight, trade);

    console.log(`[MemoryService] Processed insights for trade ${tradeId}`);
  } catch (err) {
    console.error('[MemoryService] Error processing trade:', err.message);
  }
}

// ─── Build the Insight Extraction Prompt ──────────────────────────
function buildInsightExtractionPrompt(newTrade, recentTrades, sameMarketTrades) {
  const formatTrade = (t) => {
    const date = new Date(t.date).toLocaleDateString();
    return `${date} | ${t.market} | ${t.outcome} | RR:${t.rrRatio} | Concepts: ${(t.concepts || []).join(',')} | "${t.narrative || ''}"`;
  };

  const newTradeStr = formatTrade(newTrade);
  const recentStr = recentTrades.map(formatTrade).join('\n');
  const sameMarketStr = sameMarketTrades.map(formatTrade).join('\n');

  // Count recent losses for streak detection
  let lossStreak = 0;
  for (const t of recentTrades) {
    if (t.outcome === 'Loss') lossStreak++;
    else break;
  }

  return `You are analyzing a trader's journal to extract behavioral insights. You are an ICT/SMC expert.

NEW TRADE JUST LOGGED:
${newTradeStr}

RECENT TRADE HISTORY (last 15):
${recentStr || 'No prior trades'}

SAME MARKET (${newTrade.market}) HISTORY:
${sameMarketStr || 'No prior trades in this market'}

${lossStreak >= 3 ? `⚠️ WARNING: Trader is on a ${lossStreak}-trade LOSS STREAK.` : ''}

Based on this data, generate EXACTLY 1-3 insights in this STRICT JSON format (no markdown, no extra text):
[
  {
    "type": "pattern|rule|weakness|strength",
    "category": "liquidity_alignment|time_price_consistency|psychological_discipline|concept_mastery|risk_management|general",
    "content": "A single clear, specific sentence about this trader's behavior",
    "markets": ["MARKET"],
    "concepts": ["CONCEPT"],
    "confidence": 0.1-1.0
  }
]

Rules:
- Be SPECIFIC: reference actual markets, concepts, days, and patterns you see
- If the trader just lost, check if it's FOMO, wrong session, or bad concept application
- If the trader won, check what they did right that can be reinforced
- Output ONLY the JSON array, nothing else`;
}

// ─── Parse Ollama's response and store to MongoDB ─────────────────
async function parseAndStoreInsights(rawResponse, trade) {
  try {
    // Extract JSON from the response (Llama sometimes wraps in markdown)
    let jsonStr = rawResponse;
    const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const insights = JSON.parse(jsonStr);

    if (!Array.isArray(insights)) return;

    for (const insight of insights) {
      // Validate required fields
      if (!insight.type || !insight.content) continue;

      // Check for duplicate/similar insights
      const existing = await AIInsight.findOne({
        type: insight.type,
        category: insight.category || 'general',
        content: { $regex: insight.content.substring(0, 50), $options: 'i' },
        active: true
      });

      if (existing) {
        // Update existing insight — increase confidence and trade count
        existing.confidence = Math.min(1, existing.confidence + 0.1);
        existing.tradeCount += 1;
        existing.tradeRefs.push(trade._id);
        existing.version += 1;
        await existing.save();
      } else {
        // Create new insight
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
    // If JSON parsing fails, store the raw insight as a general note
    console.error('[MemoryService] Could not parse insight JSON:', err.message);
    if (rawResponse && rawResponse.length > 20) {
      await AIInsight.create({
        type: 'pattern',
        category: 'general',
        content: rawResponse.substring(0, 500),
        markets: [trade.market],
        concepts: trade.concepts || [],
        confidence: 0.3,
        tradeCount: 1,
        tradeRefs: [trade._id]
      });
    }
  }
}

// ─── Retrieve Relevant Memories for Prompt ────────────────────────
async function getRelevantMemories(intent) {
  const query = { active: true };

  // Filter by markets if the user is asking about specific ones
  if (intent.markets && intent.markets.length > 0) {
    query.markets = { $in: intent.markets };
  }

  // Filter by concepts if mentioned
  if (intent.concepts && intent.concepts.length > 0) {
    query.concepts = { $in: intent.concepts };
  }

  // Get high-confidence insights first
  const memories = await AIInsight.find(query)
    .sort({ confidence: -1, updatedAt: -1 })
    .limit(15)
    .lean();

  return memories;
}

// ─── Format Memories for Context ──────────────────────────────────
function formatMemoriesForContext(memories) {
  if (!memories || memories.length === 0) return 'No long-term insights stored yet.';

  return memories.map(m => {
    const conf = (m.confidence * 100).toFixed(0);
    return `[${m.type.toUpperCase()}] (${m.category}) [${conf}% confidence, ${m.tradeCount} trades] ${m.content}`;
  }).join('\n');
}

// ─── Periodic Full Analysis (callable via endpoint) ───────────────
async function runFullAnalysis() {
  const trades = await Trade.find().sort({ date: -1 }).lean();
  if (trades.length < 5) return { message: 'Need at least 5 trades for full analysis' };

  const prompt = `You are an expert ICT/SMC trading analyst reviewing a complete journal.

COMPLETE TRADE HISTORY (${trades.length} trades):
${trades.map(t => {
  const date = new Date(t.date).toLocaleDateString();
  return `${date} | ${t.market} | ${t.outcome} | RR:${t.rrRatio} | ${(t.concepts||[]).join(',')} | "${t.narrative || ''}"`;
}).join('\n')}

Perform a DEEP analysis and generate 5-8 insights in this JSON format:
[
  {
    "type": "pattern|rule|weakness|strength",
    "category": "liquidity_alignment|time_price_consistency|psychological_discipline|concept_mastery|risk_management|general",
    "content": "Specific insight with evidence from the data",
    "markets": ["MARKET"],
    "concepts": ["CONCEPT"],
    "confidence": 0.1-1.0
  }
]

Focus on:
1. Which ICT concepts the trader uses most/least effectively
2. Time-of-day or day-of-week patterns
3. Psychological patterns in the narratives (FOMO, revenge, discipline)
4. Market-specific tendencies
5. Risk management habits

Output ONLY the JSON array.`;

  const rawInsight = await callOllama(prompt);
  if (!rawInsight) return { message: 'Ollama unavailable' };

  // Clear old general insights before rebuilding
  await AIInsight.updateMany({ type: { $in: ['pattern', 'rule'] } }, { active: false });

  // Parse and store
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
