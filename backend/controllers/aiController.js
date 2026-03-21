const Trade = require('../models/Trade');
const AIInsight = require('../models/AIInsight');

// Services
const { retrieveRelevantTrades, generateTradeStatistics, formatTradesForContext, formatStatisticsForContext } = require('../services/ragService');
const { getRelevantMemories, formatMemoriesForContext, runFullAnalysis } = require('../services/memoryService');
const { buildSystemPrompt, buildChartMetadataPrompt } = require('../services/systemPrompt');
const { fetchMarketContext, formatMarketContext, formatDailyBias, setDailyBias, getDailyBias } = require('../services/marketContext');


const OLLAMA_URL = 'http://localhost:11434/api/generate';

// ─── Main Analyze Endpoint (RAG-Enhanced, Streaming) ──────────────
// @desc    Deep AI analysis with RAG, Memory, conversation history, and streaming
// @route   POST /api/ai/analyze
// @access  Public
const analyzeTrades = async (req, res) => {
  try {
    const { prompt, history = [], includeMarketContext } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    // 1. RAG: Retrieve relevant trades based on the user's query
    const { trades, intent, totalInDb } = await retrieveRelevantTrades(prompt);
    const tradeContext = formatTradesForContext(trades);

    // 2. Statistics: Generate overall trader profile
    const stats = await generateTradeStatistics();
    const statsContext = formatStatisticsForContext(stats);

    // 3. Memory: Retrieve long-term learned insights
    const memories = await getRelevantMemories(intent);
    const memoryContext = formatMemoriesForContext(memories);

    // 4. Market Context (optional)
    let marketCtx = '';
    if (includeMarketContext) {
      const ctx = await fetchMarketContext();
      marketCtx = formatMarketContext(ctx);
    }

    // 5. Daily Bias (now async from MongoDB)
    const biasDoc = await getDailyBias();
    const biasCtx = formatDailyBias(biasDoc);

    // 6. Conversation history (last 6 messages = 3 exchanges)
    let historyCtx = '';
    if (history.length > 0) {
      const recent = history.slice(-6);
      historyCtx = '\n=== CONVERSATION HISTORY ===\n';
      historyCtx += recent.map(m =>
        `[${m.role === 'user' ? 'Trader' : 'Mentor'}]: ${m.content.substring(0, 400)}`
      ).join('\n');
      historyCtx += '\n';
    }

    // 7. Build the full prompt
    const systemPrompt = buildSystemPrompt();

    const fullPrompt = `${systemPrompt}

${statsContext}

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

    // 8. Stream Ollama response directly to client
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    const ollamaRes = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3',
        prompt: fullPrompt,
        stream: true,
        options: {
          temperature: 0.6,
          num_predict: 1500,
          top_p: 0.9
        }
      })
    });

    if (!ollamaRes.ok) {
      throw new Error(`Ollama API error: ${ollamaRes.statusText}`);
    }

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const chunk = JSON.parse(line);
          if (chunk.response) res.write(chunk.response);
          if (chunk.done) { res.end(); return; }
        } catch { /* partial JSON chunk, skip */ }
      }
    }

    res.end();
  } catch (error) {
    console.error('AI Error:', error);
    if (!res.headersSent) {
      if (error.cause && error.cause.code === 'ECONNREFUSED') {
        res.status(503).json({ message: 'Cannot connect to Ollama on port 11434. Is it running?' });
      } else {
        res.status(500).json({ message: error.message || 'Error communicating with AI engine' });
      }
    } else {
      res.end();
    }
  }
};

// ─── Extract Chart Metadata (Vision Gap Workaround) ───────────────
// @desc    Extract structured chart analysis from trade narratives
// @route   POST /api/ai/chart-analysis
// @access  Public
const analyzeChart = async (req, res) => {
  try {
    const { tradeId } = req.body;
    const trade = await Trade.findById(tradeId).lean();

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    const prompt = buildChartMetadataPrompt(trade);

    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3',
        prompt,
        stream: false,
        options: { temperature: 0.3 }  // Low temperature for structured output
      })
    });

    if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);

    const data = await response.json();

    // Try to parse JSON from response
    let chartMeta;
    try {
      const jsonMatch = data.response.match(/\{[\s\S]*\}/);
      chartMeta = jsonMatch ? JSON.parse(jsonMatch[0]) : data.response;
    } catch {
      chartMeta = data.response;
    }

    res.status(200).json({ chartAnalysis: chartMeta, rawResponse: data.response });
  } catch (error) {
    console.error('Chart Analysis Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── Get AI Memories / Insights ───────────────────────────────────
// @desc    Retrieve all stored AI insights
// @route   GET /api/ai/memories
// @access  Public
const getMemories = async (req, res) => {
  try {
    const { type, category, market } = req.query;
    const query = { active: true };

    if (type) query.type = type;
    if (category) query.category = category;
    if (market) query.markets = market;

    const memories = await AIInsight.find(query)
      .sort({ confidence: -1, updatedAt: -1 })
      .lean();

    res.status(200).json(memories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Trigger Full Journal Analysis ────────────────────────────────
// @desc    Run deep analysis on entire trade history
// @route   POST /api/ai/full-analysis
// @access  Public
const triggerFullAnalysis = async (req, res) => {
  try {
    res.status(202).json({ message: 'Full analysis started. Check /api/ai/memories for results.' });
    
    // Run in background (don't block the response)
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
// @desc    Set the trader's daily bias for context injection
// @route   POST /api/ai/daily-bias
// @access  Public
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
// @desc    Get comprehensive trading statistics
// @route   GET /api/ai/stats
// @access  Public
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
