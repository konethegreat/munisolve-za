// --- CORE IMPORTS ---

const express = require('express');

const cors = require('cors');

const helmet = require('helmet');

const rateLimit = require('express-rate-limit');

require('dotenv').config(); // Loads your DATABASE_URL and JWT_SECRET



const app = express();



// Add this so the home page isn't empty

app.get('/', (req, res) => {

  res.send('<h1>MuniSolve ZA Backend is Live!</h1><p>Go to /health to check status.</p>');

});



// --- SECURITY MIDDLEWARE ---



// 1. Helmet: Sets various HTTP headers to help protect against common attacks.

app.use(helmet());



// 2. CORS: Controls which websites can talk to your API.

// It uses the CLIENT_URL (http://localhost:5173) from your .env file.

app.use(cors({

  origin: process.env.CLIENT_URL || 'http://localhost:5173',

  credentials: true

}));



// 3. JSON Parser: Allows the server to read JSON data sent from the frontend.

app.use(express.json());



// 4. Rate Limiting: Prevents brute-force attacks by limiting requests from one IP.

const limiter = rateLimit({

  windowMs: 15 * 60 * 1000, // 15 minutes

  max: 100, // Limit each IP to 100 requests per window

  message: "Too many requests from this IP, please try again later."

});

app.use('/api/', limiter);



// --- ROUTES ---



// Health Check: A simple "Are you alive?" test for the server.

app.get('/health', (req, res) => {

  res.status(200).json({

    status: 'Success',

    message: 'MuniSolve ZA API is running smoothly',

    timestamp: new Date().toISOString()

  });

});



// Auth routes: POST /api/auth/register, POST /api/auth/login, etc.

const authRoutes = require('./routes/auth.routes');

app.use('/api/auth', authRoutes);

const reportRoutes = require('./routes/report.routes');
app.use('/api/reports', reportRoutes);


// --- SERVER START ---

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

  console.log(`🚀 Server heart beating on: http://localhost:${PORT}`);

  console.log(`🔒 Security layers (Helmet/RateLimit) Active`);

});