# AniLust Backend Server

A Node.js/Express proxy for AniLust. It proxies the Aniraku streaming API
(anime info, episodes, stream resolution) and AniList GraphQL behind
centralized CORS, rate limiting and error handling, and serves JWT-based
accounts.

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
| `NODE_ENV` | `development` | `production` enables the JWT_SECRET hard-fail |
| `JWT_SECRET` | - | **Required in production.** 32+ random chars |
| `JWT_EXPIRES_IN` | `7d` | JWT lifetime |
| `USERS_FILE` | `server/data/users.json` | Where accounts are persisted |
| `ANIRAKU_BACKEND_URL` | `https://api.aniraku.tech` | Aniraku upstream |
| `DEBUG` | `true` | Enable debug logging |

## Authentication & Account Persistence

Accounts are stored in a JSON file at `server/data/users.json` (bcrypt password
hashes — the directory is gitignored, never commit it). Signups are written
atomically (tmp file + rename) and logins verify against it, so accounts
survive restarts without external infrastructure. Override the location with
`USERS_FILE` (e.g. `/var/lib/anilust/users.json`).

To generate a strong secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

With `NODE_ENV=production`, the server **refuses to boot** if `JWT_SECRET` is
missing or left at the built-in default. For multi-instance or replicated
deploys, swap the file store in `index.js` (`loadUsers`/`saveUsers`) for a
real database — the auth flow only depends on those two functions.

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
