// ==========================================
// SECURITY CONFIGURATION MIDDLEWARE
// ==========================================
// Configures HTTP headers, CORS, and other security settings
// Uses Helmet.js for comprehensive security header management
// Author: MuniSolve ZA Security Team
// Last Updated: February 2026

// Import required packages
const helmet = require('helmet'); // Security headers
const cors = require('cors');     // Cross-Origin Resource Sharing

/**
 * ==========================================
 * WHY HELMET.JS IS ESSENTIAL
 * ==========================================
 * 
 * Helmet.js sets various HTTP headers to protect against:
 * 
 * 1. CLICKJACKING
 *    - Attacker embeds your site in an iframe
 *    - Users unknowingly click hidden elements
 *    - Defense: X-Frame-Options header
 * 
 * 2. MIME TYPE SNIFFING
 *    - Browser interprets files as different type
 *    - Can lead to XSS attacks
 *    - Defense: X-Content-Type-Options header
 * 
 * 3. XSS (Cross-Site Scripting)
 *    - Malicious scripts injected into pages
 *    - Can steal user data and sessions
 *    - Defense: Content-Security-Policy header
 * 
 * 4. DNS PREFETCH ATTACKS
 *    - Browser preloads DNS for performance
 *    - Can leak user browsing data
 *    - Defense: X-DNS-Prefetch-Control header
 * 
 * 5. HTTP TO HTTPS DOWNGRADE
 *    - Attacker forces insecure HTTP connection
 *    - Man-in-the-middle attack becomes possible
 *    - Defense: Strict-Transport-Security header
 */

/**
 * ==========================================
 * HELMET CONFIGURATION
 * ==========================================
 * Purpose: Configure all security-related HTTP headers
 * This function returns configured Helmet middleware
 * 
 * @returns {Function} Configured Helmet middleware
 */
const configureHelmet = () => {
  return helmet({
    // 1. Content Security Policy (CSP)
    // Controls which resources can be loaded (scripts, styles, images, etc.)
    // This is the MOST IMPORTANT security header for preventing XSS
    contentSecurityPolicy: {
      // Use default directives from Helmet
      useDefaults: true,
      
      directives: {
        // Allow scripts only from our domain and trusted CDNs
        "script-src": [
          "'self'",  // Our own domain
          "https://cdnjs.cloudflare.com",  // CDN for libraries (if needed)
          // In development, we might need 'unsafe-inline' for React
          // NEVER use this in production!
          ...(process.env.NODE_ENV === 'development' ? ["'unsafe-inline'"] : [])
        ],
        
        // Allow stylesheets from our domain and trusted sources
        "style-src": [
          "'self'",
          "https://fonts.googleapis.com",  // Google Fonts (if used)
          // Tailwind CSS might need unsafe-inline in some cases
          "'unsafe-inline'"  // Be cautious with this
        ],
        
        // Allow images from our domain and image hosting services
        "img-src": [
          "'self'",
          "data:",  // Data URLs (base64 images)
          "https:",  // Allow all HTTPS images
          "blob:"   // For dynamically generated images
        ],
        
        // Allow fonts from our domain and Google Fonts
        "font-src": [
          "'self'",
          "https://fonts.gstatic.com"
        ],
        
        // Allow connections (AJAX, WebSockets) to our API
        "connect-src": [
          "'self'",
          process.env.CLIENT_URL || "http://localhost:5173",
          // Add any external APIs you need to connect to
          // "https://maps.googleapis.com"  // Example: Google Maps API
        ],
        
        // Prevent loading in iframes (clickjacking protection)
        "frame-ancestors": ["'none'"],
        
        // Only load from HTTPS in production
        "upgrade-insecure-requests": process.env.NODE_ENV === 'production' ? [] : null
      }
    },
    
    // 2. X-DNS-Prefetch-Control
    // Controls browser DNS prefetching
    // Off by default for privacy (prevents DNS leakage)
    dnsPrefetchControl: {
      allow: false  // Disable DNS prefetching
    },
    
    // 3. X-Frame-Options
    // Prevents your site from being embedded in iframes (clickjacking)
    frameguard: {
      action: 'deny'  // Never allow framing
      // Alternative: action: 'sameorigin' - allow framing only from same domain
    },
    
    // 4. X-Powered-By
    // Hide Express.js fingerprint (don't reveal technology stack)
    hidePoweredBy: true,
    
    // 5. Strict-Transport-Security (HSTS)
    // Force browsers to use HTTPS for future requests
    // Only enable in production when HTTPS is configured
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,  // 1 year in seconds
      includeSubDomains: true,  // Apply to all subdomains
      preload: true  // Allow inclusion in browser HSTS preload list
    } : false,  // Disable in development (we use HTTP locally)
    
    // 6. X-Content-Type-Options
    // Prevent MIME type sniffing
    // Browser must respect the Content-Type header
    noSniff: true,
    
    // 7. Referrer-Policy
    // Control how much referrer information is sent
    // Prevents leaking sensitive URLs
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
      // Explanation:
      // - Same origin: Full URL sent
      // - Cross origin (HTTPS → HTTPS): Only origin sent
      // - HTTPS → HTTP: No referrer sent
    },
    
    // 8. X-XSS-Protection
    // Legacy XSS filter (mostly obsolete, but doesn't hurt)
    // Modern browsers rely on CSP instead
    xssFilter: true
  });
};

/**
 * ==========================================
 * CORS CONFIGURATION
 * ==========================================
 * Purpose: Control which domains can access your API
 * Prevents unauthorized cross-origin requests
 * 
 * CORS Headers Explained:
 * - Access-Control-Allow-Origin: Which domains can access
 * - Access-Control-Allow-Methods: Which HTTP methods allowed
 * - Access-Control-Allow-Headers: Which headers allowed
 * - Access-Control-Allow-Credentials: Allow cookies/auth
 * 
 * @returns {Object} CORS configuration object
 */
const configureCORS = () => {
  // List of allowed origins (domains that can access your API)
  const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:5173',  // Development frontend
    'http://localhost:3000',  // Alternative dev port
    // Add production URLs when deploying
    // 'https://munisolve.za',
    // 'https://www.munisolve.za'
  ];
  
  return {
    // Dynamic origin validation
    // Allows only whitelisted domains to access the API
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, server-to-server)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if the origin is in our whitelist
      if (allowedOrigins.includes(origin)) {
        // Origin is allowed
        callback(null, true);
      } else {
        // Origin is NOT allowed
        console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    
    // Allowed HTTP methods
    // Only permit methods that your API actually uses
    methods: [
      'GET',     // Reading data
      'POST',    // Creating data
      'PUT',     // Updating data (full replace)
      'PATCH',   // Updating data (partial update)
      'DELETE'   // Deleting data
    ],
    
    // Allowed headers in requests
    // These are headers that clients can send
    allowedHeaders: [
      'Content-Type',     // Required for JSON requests
      'Authorization',    // Required for JWT tokens
      'X-Requested-With', // AJAX indicator
      'Accept',           // Response format preference
      'Origin'            // CORS requirement
    ],
    
    // Headers that browser can access in response
    // Expose custom headers to JavaScript
    exposedHeaders: [
      'X-Total-Count',     // Pagination: total number of items
      'X-Page',            // Pagination: current page
      'X-Per-Page',        // Pagination: items per page
      'X-Rate-Limit',      // Rate limiting info
      'Retry-After'        // When to retry after rate limit
    ],
    
    // Allow credentials (cookies, authorization headers)
    // Required for JWT tokens and session cookies
    credentials: true,
    
    // How long browsers can cache CORS preflight results
    // Reduces number of OPTIONS requests
    maxAge: 86400,  // 24 hours in seconds
    
    // Whether to pass the CORS preflight response to next handler
    preflightContinue: false,
    
    // HTTP status code for successful OPTIONS requests
    optionsSuccessStatus: 204  // No Content
  };
};

/**
 * ==========================================
 * ADDITIONAL SECURITY MIDDLEWARE
 * ==========================================
 * Purpose: Extra security measures beyond Helmet and CORS
 * 
 * @param {Object} app - Express application instance
 */
const applyAdditionalSecurityMeasures = (app) => {
  // 1. Disable X-Powered-By header (hide Express.js)
  // This prevents attackers from knowing your framework
  app.disable('x-powered-by');
  
  // 2. Trust proxy (if behind a reverse proxy like Nginx, Cloudflare)
  // This ensures req.ip returns the real client IP, not the proxy IP
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1); // Trust first proxy
    // For multiple proxies: app.set('trust proxy', 'loopback, 10.0.0.0/8');
  }
  
  // 3. Limit request body size (prevent DOS attacks via large payloads)
  // This is configured in express.json() middleware
  // Example: app.use(express.json({ limit: '10kb' }));
  
  // 4. Set secure session cookies (if using sessions)
  // Example session configuration:
  /*
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
      httpOnly: true,     // Prevent JavaScript access
      maxAge: 3600000,    // 1 hour
      sameSite: 'strict'  // CSRF protection
    }
  }));
  */
};

/**
 * ==========================================
 * SECURITY LOGGING MIDDLEWARE
 * ==========================================
 * Purpose: Log security-relevant events
 * Helps with incident response and forensics
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
const securityLogger = (req, res, next) => {
  // Log potentially suspicious requests
  const suspiciousPatterns = [
    /\.\./,           // Path traversal attempt
    /<script>/i,      // XSS attempt
    /union.*select/i, // SQL injection attempt
    /javascript:/i,   // JavaScript protocol (XSS)
    /on\w+=/i         // Event handler attributes (XSS)
  ];
  
  // Check URL and query parameters for suspicious patterns
  const url = req.url.toLowerCase();
  const queryString = JSON.stringify(req.query).toLowerCase();
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(url) || pattern.test(queryString)
  );
  
  if (isSuspicious) {
    console.warn('[SECURITY] Suspicious request detected:', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    
    // Optionally block the request
    // return res.status(400).json({
    //   success: false,
    //   message: 'Invalid request',
    //   errorCode: 'SUSPICIOUS_REQUEST'
    // });
  }
  
  next();
};

// ==========================================
// EXPORT ALL SECURITY CONFIGURATIONS
// ==========================================
module.exports = {
  configureHelmet,
  configureCORS,
  applyAdditionalSecurityMeasures,
  securityLogger
};

// ==========================================
// USAGE IN SERVER.JS
// ==========================================
/*

const express = require('express');
const app = express();

const {
  configureHelmet,
  configureCORS,
  applyAdditionalSecurityMeasures,
  securityLogger
} = require('./middleware/security.config');

// Apply security middleware in the correct order
// ORDER MATTERS!

// 1. Helmet (must be early to set headers)
app.use(configureHelmet());

// 2. CORS (must be before routes)
app.use(cors(configureCORS()));

// 3. Body parser with size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 4. Additional security measures
applyAdditionalSecurityMeasures(app);

// 5. Security logging
app.use(securityLogger);

// 6. Rate limiting (from rateLimit.middleware.js)
const { generalLimiter } = require('./middleware/rateLimit.middleware');
app.use('/api', generalLimiter);

// 7. Your routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
// ... more routes

*/

// ==========================================
// PRODUCTION SECURITY CHECKLIST
// ==========================================
/*

Before deploying to production:

✅ 1. Enable HTTPS
   - Obtain SSL/TLS certificate (Let's Encrypt, Cloudflare)
   - Configure HTTPS redirect
   - Enable HSTS header

✅ 2. Update Environment Variables
   - Use strong, random JWT secrets
   - Change all default passwords
   - Set NODE_ENV=production

✅ 3. Configure Firewall
   - Only allow ports 80 (HTTP) and 443 (HTTPS)
   - Block direct database access from outside
   - Use security groups / network rules

✅ 4. Enable Security Headers
   - All Helmet middleware enabled
   - CSP configured properly
   - HSTS enabled with long maxAge

✅ 5. Set Up Monitoring
   - Log security events
   - Set up alerts for suspicious activity
   - Monitor failed authentication attempts

✅ 6. Regular Security Audits
   - Run npm audit regularly
   - Update dependencies
   - Penetration testing
   - Code review

✅ 7. Database Security
   - Use parameterized queries (Prisma ORM)
   - Principle of least privilege for DB user
   - Enable encryption at rest
   - Regular backups

✅ 8. Rate Limiting
   - Configure appropriate limits
   - Use Redis for distributed rate limiting
   - Monitor rate limit hits

✅ 9. Input Validation
   - Validate ALL user input
   - Sanitize HTML/scripts
   - Use express-validator

✅ 10. Authentication
   - Use bcrypt for passwords
   - Implement JWT properly
   - Add refresh tokens
   - Implement account lockout after failed attempts

*/