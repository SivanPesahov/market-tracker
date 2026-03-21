require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    /\.vercel\.app$/
  ],
  credentials: true
}));
app.use(express.json());

const auth = require('./middleware/auth');

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/trades', auth, require('./routes/tradeRoutes'));
app.use('/api/ai', auth, require('./routes/aiRoutes'));
app.use('/api/settings', auth, require('./routes/settingsRoutes'));

// Basic Route for root
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Port configuration
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
