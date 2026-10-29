import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Node 18+ provides global fetch; AbortSignal.timeout enforces real timeouts
// (node-fetch's `timeout` option was silently ignored).

// ============================================================
// CORS Configuration
// ============================================================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://TejasRajkumarS.github.io',
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

const ANILIST_API = 'https://graphql.anilist.co';
const FETCH_TIMEOUT_MS = 12000;

// ============================================================
// Health Check
// ============================================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'AniLust Backend is running' });
});

// ── AniList GraphQL Proxy ────────────────────────────────────
// The frontend uses this in production to avoid direct browser →
// anilist.co calls and to centralize error handling.
app.post('/api/anilist', async (req, res) => {
  try {
    const { query, variables } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`AniList API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors[0]?.message || 'Unknown AniList error');
    }

    res.json(data);
  } catch (err) {
    console.error('[AniList Error]:', err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ============================================================
// Error Handling
// ============================================================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================
// Start Server
// ============================================================
app.listen(PORT, () => {
  console.log(`🚀 AniLust Backend running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🎬 Frontend URL: ${process.env.FRONTEND_URL || 'Not configured'}`);
});
