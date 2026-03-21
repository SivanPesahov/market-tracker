const Anthropic = require('@anthropic-ai/sdk');
const Trade = require('../models/Trade');
const AIInsight = require('../models/AIInsight');

const { retrieveRelevantTrades, generateTradeStatistics, formatTradesForContext, formatStatisticsForContext } = require('../services/ragService');
const { getRelevantMemories, formatMemoriesForContext, runFullAnalysis } = require('../services/memoryService');
const { buildSystemPrompt, buildChartMetadataPrompt } = require('../services/systemPrompt');
const { fetchMarketContext, formatMarketContext, formatDailyBias, setDailyBias, getDailyBias } = require('../services/marketContext');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5-20251001';

// ─── Main Analyze Endpoint (RAG-Enhanced, Streaming) ──────────────
// @route   POST /api/ai/analyze
const analyzeTrades = async (req, res) => {
  try {
    const { prompt, history = [], includeMarketContext } = req.body;

    if (!prompt) return res.status(400).json({ message: 'Prompt is required' });

    // 1. RAG: Retrieve relevant trades
    const { trades, intent, totalInDb } = await retrieveRelevantTrades(prompt);
    const tradeContext = formatTradesForContext(trades);

    // 2. Statistics
    const stats = await generateTradeStatistics();
    const statsContext = formatStatisticsForContext(stats);

    // 3. Memory
    const memories = await getRelevantMemories(intent);
    const memoryContext = formatMemoriesForContext(memories);

    // 4. Market Context (optional)
    let marketCtx = '';
    if (includeMarketContext) {
      const ctx = await fetchMarketContext();
      marketCtx = formatMarketContext(ctx);
    }

    // 5. Daily Bias
    const biasDoc = await getDailyBias();
    const biasCtx = formatDailyBias(biasDoc);

    // 6. Conversation history (last 6 messages)
    let historyCtx = '';
    if (history.length > 0) {
      const recent = history.slice(-6);
      historyCtx = '\n=== CONVERSATION HISTORY ===\n';
      historyCtx += recent.map(m =>
        `[${m.role === 'user' ? 'Trader' : 'Mentor'}]: ${m.content.substring(0, 400)}`
      ).join('\n');
      historyCtx += '\n';
    }

    // 7. Build user message content
    const userContent = `${statsContext}

=== LONG-TERM INSIGHTS (AI Memory) ===
${memoryContext}

=== RELEVANT TRADES (${trades.length} of ${totalInDb} total) ===
${tradeContext}
${marketCtx}
${biasCtx}
${historyCtx}
=== CURRENT QUERY ===
The trader asks: "${prompt}"

Respond following the structured format. Be specific, reference actual trade data, and categorize your advice into the three pillars.`;

    // 8. Stream response
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 1500,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: userContent }]
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(chunk.delta.text);
      }
    }

    res.end();
  } catch (error) {
    console.error('AI Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message || 'Error communicating with AI engine' });
    } else {
      res.end();
    }
  }
};

// ─── Extract Chart Metadata ────────────────────────────────────────
// @route   POST /api/ai/chart-analysis
const analyzeChart = async (req, res) => {
  try {
    const { tradeId } = req.body;
    const trade = await Trade.findById(tradeId).lean();
    if (!trade) return res.status(404).json({ message: 'Trade not found' });

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{ role: 'user', content: buildChartMetadataPrompt(trade) }]
    });

    const responseText = message.content[0].text;
    let chartMeta;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      chartMeta = jsonMatch ? JSON.parse(jsonMatch[0]) : responseText;
    } catch {
      chartMeta = responseText;
    }

    res.status(200).json({ chartAnalysis: chartMeta, rawResponse: responseText });
  } catch (error) {
    console.error('Chart Analysis Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── Get AI Memories ──────────────────────────────────────────────
// @route   GET /api/ai/memories
const getMemories = async (req, res) => {
  try {
    const { type, category, market } = req.query;
    const query = { active: true };
    if (type) query.type = type;
    if (category) query.category = category;
    if (market) query.markets = market;

    const memories = await AIInsight.find(query).sort({ confidence: -1, updatedAt: -1 }).lean();
    res.status(200).json(memories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Trigger Full Analysis ─────────────────────────────────────────
// @route   POST /api/ai/full-analysis
const triggerFullAnalysis = async (req, res) => {
  try {
    res.status(202).json({ message: 'Full analysis started. Check /api/ai/memories for results.' });
    runFullAnalysis().then(result => {
      console.log('[AI] Full analysis complete:', result.message);
    }).catch(err => {
      console.error('[AI] Full analysis failed:', err.message);
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Set Daily Bias ───────────────────────────────────────────────
// @route   POST /api/ai/daily-bias
const setDailyBiasEndpoint = async (req, res) => {
  try {
    const { market, direction, keyLevels, session, notes } = req.body;
    await setDailyBias({ market, direction, keyLevels, session, notes });
    const bias = await getDailyBias();
    res.status(200).json({ message: 'Daily bias set successfully', bias });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Get Trader Stats ─────────────────────────────────────────────
// @route   GET /api/ai/stats
const getTraderStats = async (req, res) => {
  try {
    const stats = await generateTradeStatistics();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  analyzeTrades,
  analyzeChart,
  getMemories,
  triggerFullAnalysis,
  setDailyBiasEndpoint,
  getTraderStats
};
