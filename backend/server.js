require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');

// ── Fail-fast: crash at startup if required secrets are absent ────────────────
// This prevents the server from running in a partially-configured state and
// accidentally exposing endpoints that rely on missing credentials.
const REQUIRED_ENV = [
  'MONGO_URI',
  'JWT_SECRET',
  'ANTHROPIC_API_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length > 0) {
  console.error(`[Startup] Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const connectDB             = require('./config/db');
const { globalLimiter }     = require('./middleware/rateLimiter');

const app = express();

// Trust the first reverse-proxy hop (Railway, Vercel, etc.) so that req.ip
// reflects the real client IP for accurate rate-limit keying.
app.set('trust proxy', 1);

// Connect to Database
connectDB();

// ── Security headers (OWASP A05) ─────────────────────────────────────────────
app.use(helmet());

// ── CORS — explicit allowlist, no wildcards (OWASP A05) ──────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no Origin header)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// ── Global rate limiter — applied before every route (OWASP A04) ─────────────
app.use(globalLimiter);

// ── Body parser — explicit size cap prevents payload-based DoS ───────────────
app.use(express.json({ limit: '50kb' }));

const auth = require('./middleware/auth');

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/authRoutes'));
app.use('/api/trades',   auth, require('./routes/tradeRoutes'));
app.use('/api/ai',       auth, require('./routes/aiRoutes'));
app.use('/api/settings', auth, require('./routes/settingsRoutes'));

app.get('/', (_req, res) => res.send('API is running...'));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
