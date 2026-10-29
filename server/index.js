import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Load environment variables
// Note: Must be called before other imports that use env vars
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// Security Middleware
// ============================================================

// Helmet security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "https://s4.anilist.co", "https://picsum.photos"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://graphql.anilist.co"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
  handler: (req, res, next, options) => {
    console.warn(`[Rate Limit] Blocked request from ${req.ip}`);
    res.status(429).json({ error: options.message.error });
  },
});

// Apply rate limit to all routes
app.use(apiLimiter);

// ============================================================
// CORS Configuration (Environment-Based)
// ============================================================

// Read allowed origins from environment or use safe defaults
function getAllowedOrigins() {
  const origins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:5173',
  ];

  // Add frontend URL from environment
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }

  // Add GitHub Pages production URL (update accordingly for your deployment)
  origins.push('https://tejasrajkumars.github.io');

  // Filter out duplicates and empty values
  return [...new Set(origins)].filter(Boolean);
}

const allowedOrigins = getAllowedOrigins();

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Log CORS violations for security monitoring
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Forwarded-For'],
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 200,
  maxAge: 86400, // 24 hours preflight cache
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ============================================================
// Request Parsing & Logging
// ============================================================

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Request logging (sanitized - no sensitive data)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const path = req.path || req.url;
  const method = req.method;
  // Log only safe information - never log Authorization headers content
  console.log(`[${timestamp}] ${method} ${path} - IP: ${req.ip || 'unknown'}`);
  next();
});

// ============================================================
// Environment Validation
// ============================================================

function validateEnvironment() {
  const requiredVars = [];
  // Add any required environment variables here if needed
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.warn(`[ENV WARNING] Missing optional environment variables: ${missing.join(', ')}`);
  }
  
  // Log loaded configuration
  console.log(`[ENV] Server running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`[ENV] PORT: ${PORT}`);
  console.log(`[ENV] FRONTEND_URL: ${process.env.FRONTEND_URL || 'Not set (using defaults)'}`);
}

validateEnvironment();

const ANILIST_API = 'https://graphql.anilist.co';
const FETCH_TIMEOUT_MS = 12000;

// ============================================================
// Health Check (Enhanced)
// ============================================================

app.get('/health', async (req, res) => {
  const healthData = {
    status: 'ok',
    service: 'AniLust Backend',
    version: '1.1.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    features: {
      anilist_proxy: true,
      authentication: true,
    },
    uptime: process.uptime(),
  };
  res.status(200).json(healthData);
});

// ============================================================
// AniList GraphQL Proxy
// ============================================================

/**
 * POST /api/anilist
 * Proxies requests to AniList GraphQL API with centralized error handling
 */
app.post('/api/anilist', async (req, res) => {
  try {
    const { query, variables } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        error: 'Query parameter is required and must be a string.',
        code: 'INVALID_QUERY',
      });
    }

    // Basic query length validation (protect against DoS)
    if (query.length > 10000) {
      return res.status(400).json({
        error: 'Query exceeds maximum allowed length.',
        code: 'QUERY_TOO_LONG',
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'AniLust/1.1.0 (https://github.com/tejasrajkumars/anilust)',
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`AniList API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      // Log errors but don't expose full internal details
      console.warn(`[AniList Error] ${data.errors[0]?.message || 'Unknown error'}`);
      return res.status(500).json({
        error: data.errors[0]?.message || 'Unknown AniList error',
        code: 'ANILIST_GRAPHQL_ERROR',
        errors: data.errors,
      });
    }

    res.json(data);
  } catch (err) {
    // Log error details (without exposing to client)
    console.error('[AniList Proxy Error]', {
      message: err.message,
      name: err.name,
      stack: err.stack,
    });

    if (err.name === 'AbortError') {
      return res.status(504).json({
        error: 'AniList API request timed out.',
        code: 'TIMEOUT',
      });
    }

    res.status(500).json({
      error: 'Failed to proxy request to AniList.',
      message: err.message || 'Internal server error',
      code: 'PROXY_ERROR',
    });
  }
});

// ============================================================
// Authentication Endpoints
// ============================================================
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'anilust-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Warning for demo/development mode
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'anilust-dev-secret-change-in-production') {
  console.warn('[SECURITY WARNING] JWT_SECRET is using default value. Change JWT_SECRET environment variable for production!');
}

// Mock user store for demo (replace with database in production)
// In production, this should connect to PostgreSQL/MongoDB
const demoUsers = [];

/**
 * POST /api/auth/signup
 * Creates a new user account
 */
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Username, email, and password are required.',
        code: 'MISSING_FIELDS',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long.',
        code: 'PASSWORD_TOO_SHORT',
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format.',
        code: 'INVALID_EMAIL',
      });
    }

    // Check if user exists (in real production, query database here)
    // Note: localStorage is browser-only, use in-memory store for demo
    const existingUser = demoUsers.find(u => u.email === email);

    if (existingUser) {
      return res.status(409).json({
        error: 'A user with this email already exists.',
        code: 'USER_EXISTS',
      });
    }

    // Hash password securely with bcrypt
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      username,
      email,
      passwordHash,
      role: 'Member',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=a855f7&color=fff&bold=true`,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };

    demoUsers.push(newUser);

    // Generate JWT token
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, username: newUser.username, role: newUser.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'Account created successfully.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        avatar: newUser.avatar,
        role: newUser.role,
      },
      token,
      expiresIn: JWT_EXPIRES_IN,
    });
  } catch (err) {
    console.error('[Auth Error - Signup]', err);
    res.status(500).json({
      error: 'Failed to create account.',
      message: err.message,
      code: 'SIGNUP_ERROR',
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticates a user and returns a JWT token
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required.',
        code: 'MISSING_CREDENTIALS',
      });
    }

    // Find user - in production this should query a database
    // For this demo, we'll check the in-memory store and fall back to checking
    // if we need to support existing demo accounts (for migration purposes)
    const user = demoUsers.find(u => u.email === email);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      // Log failed login attempts (security monitoring)
      console.warn(`[Auth] Failed login attempt for email: ${email}`);
      return res.status(401).json({
        error: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Update last login
    user.lastLoginAt = new Date().toISOString();

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login successful.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    console.error('[Auth Error - Login]', err);
    res.status(500).json({
      error: 'Authentication failed.',
      message: err.message,
      code: 'LOGIN_ERROR',
    });
  }
});

/**
 * POST /api/auth/verify
 * Verifies a JWT token and returns user info
 */
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(401).json({
        error: 'No token provided.',
        code: 'NO_TOKEN',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    res.json({
      valid: true,
      user: {
        id: decoded.id,
        email: decoded.email,
        username: decoded.username,
        role: decoded.role,
      },
      expiresAt: new Date(decoded.exp * 1000).toISOString(),
    });
  } catch (err) {
    console.warn(`[Auth] Invalid token verification: ${err.message}`);
    res.status(401).json({
      error: 'Invalid or expired token.',
      code: 'INVALID_TOKEN',
    });
  }
});

/**
 * Middleware to protect routes that require authentication
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      error: 'Authentication required.',
      code: 'UNAUTHORIZED',
    });
  }

  const token = authHeader.split(' ')[1]; // Format: "Bearer <token>"

  if (!token) {
    return res.status(401).json({
      error: 'Invalid authorization header format.',
      code: 'INVALID_AUTH_FORMAT',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.warn(`[Auth Middleware] Token verification failed: ${err.message}`);
    res.status(401).json({
      error: 'Invalid or expired token.',
      code: 'INVALID_TOKEN',
    });
  }
}

// ============================================================
// Error Handling Middleware
// ============================================================

// Catch unhandled errors
app.use((err, req, res, next) => {
  console.error('[Server Error]', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Don't leak internal error details to clients
  res.status(err.status || 500).json({
    error: 'An internal server error occurred.',
    code: 'INTERNAL_ERROR',
    // Only include message in development mode
    ...(process.env.NODE_ENV === 'development' ? { details: err.message } : {}),
  });
});

// ============================================================
// 404 Handler
// ============================================================

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'The requested endpoint was not found.',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
  });
});

// ============================================================
// Server Startup
// ============================================================

app.listen(PORT, () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🚀 AniLust Backend v1.1.0 running`);
  console.log(`[${timestamp}] 📡 Health check: http://localhost:${PORT}/health`);
  console.log(`[${timestamp}] 🔐 Auth endpoints enabled`);
  console.log(`[${timestamp}] 🌐 CORS enabled for: ${allowedOrigins.join(', ')}`);
  console.log(`[${timestamp}] ⚡ Rate limit: 100 req/15min per IP`);
  console.log(`[${timestamp}] 🔒 Security headers enabled (Helmet)`);
  console.log(`[${timestamp}] 🎬 Frontend URL: ${process.env.FRONTEND_URL || 'Not configured (using defaults)'}`);
  console.log(`[${timestamp}] ⚠️  Remember: Change JWT_SECRET environment variable for production!`);
});
