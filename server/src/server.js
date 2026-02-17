// --- CORE IMPORTS ---
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// --- SECURITY MIDDLEWARE ---

// 1. Helmet
app.use(helmet());

// 2. CORS
const allowedOrigins = [
  'http://localhost:5173', // Local testing
  process.env.CLIENT_URL   // This will be your Vercel URL later
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// 3. JSON Parser
app.use(express.json());

// 4. Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later."
});
app.use('/api/', limiter);

// --- HEALTH CHECK ---
app.get('/', (req, res) => {
  res.send('<h1>MuniSolve ZA Backend is Live!</h1><p>Go to /health to check status.</p>');
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'Success',
    message: 'MuniSolve ZA API is running smoothly',
    timestamp: new Date().toISOString()
  });
});

// --- ROUTES ---
const authRoutes   = require('./routes/auth.routes');
const reportRoutes = require('./routes/report.routes');
const aiRoutes     = require('./routes/ai.routes');

app.use('/api/auth',    authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai',      aiRoutes);

// --- SERVER START ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server heart beating on: http://localhost:${PORT}`);
  console.log(`🔒 Security layers (Helmet/RateLimit) Active`);
});