// --- CORE IMPORTS ---
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { requestId } = require('./middleware/requestId.middleware');
const { httpLogger } = require('./logger');
const { notFound } = require('./middleware/notFound.middleware');
const { errorHandler } = require('./middleware/error.middleware');
const { generalLimiter } = require('./middleware/rateLimit.middleware');
const { liveness, readiness } = require('./controllers/health.controller');

const app = express();
app.set('trust proxy', 1);

// --- SECURITY MIDDLEWARE ---

app.use(requestId);
app.use(httpLogger);

// 1. Helmet
app.use(helmet());

// 2. CORS
const allowedOrigins = [
  'http://localhost:5173',
  process.env.CLIENT_URL?.replace(/\/$/, ''),
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// 3. JSON Parser
app.use(express.json());

// --- HEALTH CHECK ---
app.get('/', (_req, res) => {
  res.send('<h1>MuniSolve ZA Backend is Live!</h1><p>Go to /health to check status.</p>');
});

app.get('/health', liveness);
app.get('/ready', readiness);

// 4. One global API limiter
app.use('/api/', generalLimiter);

// --- ROUTES ---
const authRoutes       = require('./routes/auth.routes');
const reportRoutes     = require('./routes/report.routes');
const aiRoutes         = require('./routes/ai.routes');
const adminRoutes      = require('./routes/admin.routes');
const publicRoutes     = require('./routes/public.routes');
const supervisorRoutes = require('./routes/supervisor.routes');

app.use('/api/auth',       authRoutes);
app.use('/api/reports',    reportRoutes);
app.use('/api/ai',         aiRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/public',     publicRoutes);
app.use('/api/supervisor', supervisorRoutes);

// --- ERROR HANDLING ---
// Every unmatched route and every thrown error leaves through the one envelope.
app.use(notFound);
app.use(errorHandler);

// --- SERVER START ---
// Listen only when run directly (npm start / node src/server.js). The tests
// require() the app instead, so importing this file never opens a port.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server heart beating on: http://localhost:${PORT}`);
    console.log(`🔒 Security layers (Helmet/RateLimit) Active`);
  });
}

module.exports = app;