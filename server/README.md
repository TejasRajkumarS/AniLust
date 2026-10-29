# AniLust Backend Server

A lightweight Node.js/Express proxy for AniLust. In production it proxies
AniList GraphQL queries so the browser never talks to anilist.co directly
(centralized CORS + error handling). Streaming itself is provided by a
self-hosted [aniwatch-api](https://github.com/ghoshRitesh12/aniwatch-api)
instance configured via `VITE_HIANIME_API_URL` on the frontend (see the
root README).

## Features

✅ **CORS-Enabled** - Properly configured for production deployments  
✅ **AniList Proxy** - `POST /api/anilist` forwards GraphQL queries  
✅ **Lightweight** - No dependencies beyond Express/CORS/dotenv (Node 18+)  
✅ **Deployable** - Ready for Heroku, Railway, Vercel, or self-hosting

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start dev server (with auto-reload)
npm run dev

# Or start production server
npm start
```

Server runs on `http://localhost:5000`

### Health Check

```bash
curl http://localhost:5000/health
# Response: {"status":"ok","message":"AniLust Backend is running"}
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `FRONTEND_URL` | - | Your frontend URL (for CORS) |
| `DEBUG` | `true` | Enable debug logging |

## API Endpoints

### Health
```
GET /health
```

### AniList GraphQL Proxy
```
POST /api/anilist
Content-Type: application/json

{ "query": "...", "variables": { ... } }
```

## Troubleshooting

**"Cannot GET /api/..."**
- Check if backend is running: `curl http://localhost:5000/health`
- Verify endpoint path is correct

**"CORS error"**
- Verify `FRONTEND_URL` in `.env` matches your frontend URL
- Add wildcard `*` to `origin` array temporarily for debugging

## Development

### Project Structure

```
server/
├── index.js           # Main server file
├── package.json       # Dependencies & scripts
├── .env.example       # Environment template
├── DEPLOYMENT.md      # Deployment guide
└── README.md          # This file
```

## License

MIT

## Support

For issues or questions:
1. Check backend logs
2. Verify `.env` configuration
3. Test with curl before debugging in frontend
