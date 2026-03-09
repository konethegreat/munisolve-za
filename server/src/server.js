// --- CORE IMPORTS ---
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);

// --- SECURITY MIDDLEWARE ---

// 1. Helmet
app.use(helmet());

// 2. CORS
// 2. CORS - Updated for better reliability
const allowedOrigins = [
  'http://localhost:5173',
  process.env.CLIENT_URL?.replace(/\/$/, "") // Removes trailing slash if present
].filter(Boolean); // Removes undefined values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl) 
    // or if the origin is in our allowed list
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("Blocked by CORS:", origin); // Helps you debug in Render logs!
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
const adminRoutes  = require('./routes/admin.routes');

app.use('/api/auth',    authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai',      aiRoutes);
app.use('/api/admin',   adminRoutes);

// --- SERVER START ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server heart beating on: http://localhost:${PORT}`);
  console.log(`🔒 Security layers (Helmet/RateLimit) Active`);
});