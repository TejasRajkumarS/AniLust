import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Readable } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load environment variables
// Note: Must be called before other imports that use env vars
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// The app runs behind reverse proxies when deployed (Render/Railway/Fly).
// Required so express-rate-limit sees real client IPs instead of the proxy's.
app.set('trust proxy', 1);

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
  max: 300, // One browsing session easily issues 100+ proxied calls
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

  // Add frontend URL(s) from environment. Comma-separated list is supported
  // so setups running several dev instances (e.g. :3000 and :3001) both pass.
  if (process.env.FRONTEND_URL) {
    process.env.FRONTEND_URL
      .split(',')
      .map(url => url.trim())
      .filter(Boolean)
      .forEach(url => origins.push(url));
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
      const err = new Error('Origin not allowed by CORS.');
      err.status = 403;
      err.code = 'CORS_NOT_ALLOWED';
      err.expose = true; // safe to surface to the client
      callback(err, false);
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

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

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
// Aniraku endpoints scrape upstream providers and can take 30s+ on a cold
// (uncached) request before Cloudflare caches the response. 12s aborts them.
const ANIRAKU_TIMEOUT_MS = 60000;

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
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const USING_DEFAULT_SECRET =
  !process.env.JWT_SECRET || process.env.JWT_SECRET === 'anilust-dev-secret-change-in-production';

if (IS_PRODUCTION && USING_DEFAULT_SECRET) {
  console.error(
    '[SECURITY FATAL] NODE_ENV=production requires a strong JWT_SECRET environment variable. ' +
    'Refusing to start with the built-in default secret.'
  );
  process.exit(1);
}

if (USING_DEFAULT_SECRET) {
  console.warn('[SECURITY WARNING] JWT_SECRET is using default value. Change JWT_SECRET environment variable for production!');
}

// File-backed user store so accounts survive restarts without external infra.
// For multi-instance deployments, swap this for a real database — the
// signup/login flow only depends on loadUsers/saveUsers.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = process.env.USERS_FILE || path.join(__dirname, 'data', 'users.json');

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      if (Array.isArray(parsed)) {
        console.log(`[Auth] Loaded ${parsed.length} account(s) from ${USERS_FILE}`);
        return parsed;
      }
      console.warn(`[Auth] Users file ${USERS_FILE} is not an array — starting with an empty store.`);
    }
  } catch (err) {
    console.error(`[Auth] Failed to read users file (${err.message}) — starting with an empty store.`);
  }
  return [];
}

function saveUsers(users) {
  try {
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
    const tmp = `${USERS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(users, null, 2));
    fs.renameSync(tmp, USERS_FILE); // atomic on the same filesystem
  } catch (err) {
    console.error(`[Auth] Failed to persist users to ${USERS_FILE}: ${err.message}`);
  }
}

const demoUsers = loadUsers();

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

    // Check if user exists. Queries the file-backed store (see loadUsers).
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
    saveUsers(demoUsers);

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

    // Find user in the file-backed store.
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
// Aniraku Streaming API Proxy
// ============================================================

const ANIRAKU_BASE = process.env.ANIRAKU_BACKEND_URL || 'https://api.aniraku.tech';

// AniList/Aniraku IDs are numeric — reject anything else before it reaches the
// upstream URL path (prevents encoded-path traversal like /anime/..%2F..%2Fx).
function parseNumericId(raw) {
  const id = String(raw ?? '');
  return /^\d{1,10}$/.test(id) ? id : null;
}

function isFiniteNumber(value) {
  return value !== undefined && value !== null && Number.isFinite(Number(value));
}

// The Aniraku API sits behind Cloudflare, which blocks requests without a
// browser-like User-Agent (it answers with an HTML challenge page and the
// JSON parse fails). Always send these headers and validate the response.
const ANIRAKU_FETCH_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

async function fetchAniraku(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANIRAKU_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      headers: { ...ANIRAKU_FETCH_HEADERS, ...(options.headers || {}) },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Proxy: POST /api/v1/stream
app.post('/api/aniraku/stream', async (req, res) => {
  try {
    const { animeId, episode, lang, provider, refresh } = req.body;
    if (!isFiniteNumber(animeId) || !isFiniteNumber(episode)) {
      return res.status(400).json({ error: 'animeId and episode are required and must be numbers.' });
    }
    const response = await fetchAniraku(`${ANIRAKU_BASE}/api/v1/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ animeId, episode, lang, provider: provider || '', refresh: refresh || false }),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[Aniraku Stream Proxy Error]', err);
    const status = err.name === 'AbortError' ? 504 : 500;
    res.status(status).json({ error: 'Failed to proxy stream request to Aniraku.' });
  }
});

// Proxy: GET /api/v1/servers
app.get('/api/aniraku/servers', async (req, res) => {
  try {
    const { animeId, episode, lang } = req.query;
    if (!isFiniteNumber(animeId) || !isFiniteNumber(episode)) {
      return res.status(400).json({ error: 'animeId and episode query parameters are required and must be numbers.' });
    }
    const url = new URL(`${ANIRAKU_BASE}/api/v1/servers`);
    url.searchParams.set('animeId', String(animeId));
    url.searchParams.set('episode', String(episode));
    url.searchParams.set('lang', lang || 'sub');
    const response = await fetchAniraku(url.toString());
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[Aniraku Servers Proxy Error]', err);
    const status = err.name === 'AbortError' ? 504 : 500;
    res.status(status).json({ error: 'Failed to proxy servers request to Aniraku.' });
  }
});

// Proxy: GET /api/v1/anime/{id}
app.get('/api/aniraku/anime/:id', async (req, res) => {
  try {
    const id = parseNumericId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid anime id — expected a numeric id.' });
    const response = await fetchAniraku(`${ANIRAKU_BASE}/api/v1/anime/${id}`);
    if (!response.ok) {
      return res.status(response.status).json({ error: `Aniraku API returned ${response.status}.` });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Aniraku Anime Proxy Error]', err);
    const status = err.name === 'AbortError' ? 504 : 500;
    res.status(status).json({ error: 'Failed to proxy anime request to Aniraku.' });
  }
});

// Proxy: GET /api/v1/anime/{id}/episodes
app.get('/api/aniraku/anime/:id/episodes', async (req, res) => {
  try {
    const id = parseNumericId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid anime id — expected a numeric id.' });
    const response = await fetchAniraku(`${ANIRAKU_BASE}/api/v1/anime/${id}/episodes`);
    if (!response.ok) {
      return res.status(response.status).json({ error: `Aniraku API returned ${response.status}.` });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Aniraku Episodes Proxy Error]', err);
    const status = err.name === 'AbortError' ? 504 : 500;
    res.status(status).json({ error: 'Failed to proxy episodes request to Aniraku.' });
  }
});

// Proxy: GET /api/v1/anime/{id}/similar
app.get('/api/aniraku/anime/:id/similar', async (req, res) => {
  try {
    const id = parseNumericId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid anime id — expected a numeric id.' });
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const perPage = Math.min(50, Math.max(1, parseInt(String(req.query.perPage), 10) || 12));
    const url = new URL(`${ANIRAKU_BASE}/api/v1/anime/${id}/similar`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('perPage', String(perPage));
    const response = await fetchAniraku(url.toString());
    if (!response.ok) {
      return res.status(response.status).json({ error: `Aniraku API returned ${response.status}.` });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Aniraku Similar Proxy Error]', err);
    const status = err.name === 'AbortError' ? 504 : 500;
    res.status(status).json({ error: 'Failed to proxy similar request to Aniraku.' });
  }
});

// Proxy: GET /api/v1/anime/{id}/relations
app.get('/api/aniraku/anime/:id/relations', async (req, res) => {
  try {
    const id = parseNumericId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid anime id — expected a numeric id.' });
    const response = await fetchAniraku(`${ANIRAKU_BASE}/api/v1/anime/${id}/relations`);
    if (!response.ok) {
      return res.status(response.status).json({ error: `Aniraku API returned ${response.status}.` });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Aniraku Relations Proxy Error]', err);
    const status = err.name === 'AbortError' ? 504 : 500;
    res.status(status).json({ error: 'Failed to proxy relations request to Aniraku.' });
  }
});

// Proxy: POST /api/v1/anilist
app.post('/api/aniraku/anilist', async (req, res) => {
  try {
    const { query, variables } = req.body;
    const response = await fetchAniraku(`${ANIRAKU_BASE}/api/v1/anilist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `Aniraku API returned ${response.status}.` });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Aniraku AniList Proxy Error]', err);
    const status = err.name === 'AbortError' ? 504 : 500;
    res.status(status).json({ error: 'Failed to proxy AniList request to Aniraku.' });
  }
});

// Headers the Aniraku upstream proxy accepts as its own `headers` query
// param. Used by CDNs that reject media requests without a Referer (e.g.
// megaplay-backed streams and their VTT caption files).
const PROXY_HEADERS_ALLOWLIST = new Set(['Referer', 'Origin', 'User-Agent']);

// Parse and validate the optional `headers` query param (a JSON object such
// as {"Referer":"https://example.com/"}). Returns { ok, value } where value
// is undefined when the param was absent.
function parseProxyHeaders(raw) {
  if (raw === undefined) return { ok: true, value: undefined };
  const text = String(raw);
  if (text.length > 1024) return { ok: false };
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false };
    const clean = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!PROXY_HEADERS_ALLOWLIST.has(key)) return { ok: false };
      if (typeof value !== 'string' || value.length > 256 || /[\r\n]/.test(value)) return { ok: false };
      clean[key] = value;
    }
    return { ok: true, value: clean };
  } catch {
    return { ok: false };
  }
}

// Proxy: GET /api/v1/proxy
// Streams upstream media (HLS playlists, .ts segments, WebVTT captions) back
// to the browser. The upstream response is NOT JSON, so the body is piped
// through verbatim with the upstream Content-Type instead of being parsed.
app.get('/api/aniraku/proxy', async (req, res) => {
  try {
    const { url, headers } = req.query;

    let target;
    try {
      target = new URL(String(url ?? ''));
      if (target.protocol !== 'http:' && target.protocol !== 'https:') throw new Error('unsupported protocol');
    } catch {
      return res.status(400).json({ error: 'A valid absolute http(s) "url" query parameter is required.' });
    }

    const parsedHeaders = parseProxyHeaders(headers);
    if (!parsedHeaders.ok) {
      return res.status(400).json({ error: 'Invalid "headers" parameter. Expected a JSON object with Referer/Origin/User-Agent string values.' });
    }

    const upstreamQuery = new URLSearchParams({ url: target.toString() });
    if (parsedHeaders.value) upstreamQuery.set('headers', JSON.stringify(parsedHeaders.value));

    const response = await fetchAniraku(`${ANIRAKU_BASE}/api/v1/proxy?${upstreamQuery.toString()}`);
    res.status(response.status);
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    const cacheControl = response.headers.get('cache-control');
    if (cacheControl) res.setHeader('Cache-Control', cacheControl);

    if (!response.body) {
      res.end();
      return;
    }
    Readable.fromWeb(response.body)
      .on('error', (streamErr) => {
        console.error('[Aniraku Proxy Stream Error]', streamErr);
        if (!res.headersSent) res.status(502);
        res.destroy();
      })
      .pipe(res);
  } catch (err) {
    console.error('[Aniraku Proxy Proxy Error]', err);
    if (res.headersSent) {
      res.destroy();
      return;
    }
    const status = err.name === 'AbortError' ? 504 : 500;
    res.status(status).json({ error: 'Failed to proxy proxy request to Aniraku.' });
  }
});

// ============================================================
// Error Handling Middleware
// ============================================================

// Catch unhandled errors
app.use((err, req, res, next) => {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;

  if (err.expose) {
    // Expected, client-representable error (e.g. CORS rejection) — not a server fault.
    console.warn(`[Client Error ${status}] ${err.message} - ${req.method} ${req.url}`);
    return res.status(status).json({ error: err.message, code: err.code || 'CLIENT_ERROR' });
  }

  console.error('[Server Error]', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Don't leak internal error details to clients
  res.status(status).json({
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
  console.log(`[${timestamp}] ⚡ Rate limit: 300 req/15min per IP`);
  console.log(`[${timestamp}] 🔒 Security headers enabled (Helmet)`);
  console.log(`[${timestamp}] 🎬 Frontend URL: ${process.env.FRONTEND_URL || 'Not configured (using defaults)'}`);
  console.log(`[${timestamp}] ⚠️  Remember: Change JWT_SECRET environment variable for production!`);
});
