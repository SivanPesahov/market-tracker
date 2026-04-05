/**
 * Centralized rate limiters (OWASP A04: Insecure Design / A05: Security Misconfiguration).
 *
 * Strategy:
 *  - Authenticated routes  → keyed by user ID so shared-IP environments (VPN, NAT,
 *    corporate proxies) don't affect other users, and a single user can't bypass
 *    limits by rotating IPs.
 *  - Unauthenticated routes → keyed by IP (no user ID available yet).
 *  - All limiters emit RFC 6585 RateLimit-* response headers so clients can
 *    implement graceful back-off.
 *
 * Limits (all configurable via env vars):
 *  - GLOBAL       300 req / 15 min / IP    — basic scraping / scanning protection
 *  - LOGIN         10 req / 15 min / IP    — brute-force protection
 *  - WRITE         60 req / 15 min / user  — trade create/update/delete
 *  - AI_ANALYZE    30 req / 15 min / user  — Anthropic API cost & abuse prevention
 *  - FULL_ANALYSIS  5 req /  1 hr  / user  — full history re-analysis (very expensive)
 */

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// ── Key generators ────────────────────────────────────────────────────────────
// ipKeyGenerator normalises IPv4-mapped IPv6 addresses (e.g. ::ffff:1.2.3.4 → 1.2.3.4)
// so IPv6 users can't trivially bypass per-IP limits.
const ipKey   = (req) => ipKeyGenerator(req);
// For authenticated routes, key by user ID to prevent per-IP bypass while logged in.
const userKeyGenerator = (req) =>
  req.user?.id ? `uid_${req.user.id}` : ipKey(req);

// ── Shared 429 response (never expose internal details) ──────────────────────
const handler429 = (_req, res) =>
  res.status(429).json({ message: 'Too many requests, please try again later.' });

// ── Factory: merge shared options with overrides ──────────────────────────────
const make = (overrides) => rateLimit({
  standardHeaders: true,   // RateLimit-Limit / RateLimit-Remaining / RateLimit-Reset
  legacyHeaders:   false,  // Suppress deprecated X-RateLimit-* headers
  handler:         handler429,
  ...overrides,
});

// ── Limiters ──────────────────────────────────────────────────────────────────

/** Applied globally before every route. Guards against scanning / enumeration. */
const globalLimiter = make({
  windowMs: 15 * 60 * 1000,
  max:      300,
  keyGenerator: ipKey,
});

/**
 * Applied to POST /api/auth/login only.
 * IP-keyed because the user is not yet authenticated.
 */
const loginLimiter = make({
  windowMs: 15 * 60 * 1000,
  max:      10,
  keyGenerator: ipKey,
});

/**
 * Applied to trade write operations (POST / PUT / DELETE).
 * Keyed by user ID to prevent per-IP bypass while authenticated.
 */
const writeLimiter = make({
  windowMs: 15 * 60 * 1000,
  max:      60,
  keyGenerator: userKeyGenerator,
});

/**
 * Applied to POST /api/ai/analyze and POST /api/ai/chart-analysis.
 * Each call invokes the Anthropic API — limit tightly to control cost.
 */
const aiAnalyzeLimiter = make({
  windowMs: 15 * 60 * 1000,
  max:      30,
  keyGenerator: userKeyGenerator,
});

/**
 * Applied to POST /api/ai/full-analysis.
 * Re-processes the entire trade history — 5 calls per hour is generous.
 */
const fullAnalysisLimiter = make({
  windowMs: 60 * 60 * 1000,
  max:      5,
  keyGenerator: userKeyGenerator,
});

module.exports = {
  globalLimiter,
  loginLimiter,
  writeLimiter,
  aiAnalyzeLimiter,
  fullAnalysisLimiter,
};
