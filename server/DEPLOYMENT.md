# AniLust Backend Deployment Guide

## Overview

The AniLust backend is a simple Express.js proxy server that:
- Routes anime streaming API calls through a centralized backend
- Handles CORS properly
- Provides fallback support across multiple streaming sources
- Can be deployed to various platforms

## Quick Start (Local Development)

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Create `.env` File

```bash
cp .env.example .env
```

Edit `.env` and set your frontend URL:
```
PORT=5000
FRONTEND_URL=http://localhost:3000
DEBUG=true
```

### 3. Start the Backend

```bash
npm start
# or with auto-reload
npm run dev
```

The server will run on `http://localhost:5000`

### 4. Update Frontend Configuration

In the root `.env` file (frontend):
```
VITE_BACKEND_URL=http://localhost:5000
```

Then start your frontend dev server:
```bash
npm run dev
```

---

## Deployment Options

### Option 1: Heroku (Recommended - Free tier available)

#### Setup:
1. **Create Heroku Account**: https://www.heroku.com
2. **Install Heroku CLI**: https://devcenter.heroku.com/articles/heroku-cli

#### Deploy:
```bash
cd server

# Login to Heroku
heroku login

# Create app
heroku create anilust-backend

# Set environment variables
heroku config:set FRONTEND_URL=https://TejasRajkumarS.github.io

# Deploy
git push heroku main
# or if you're on a different branch:
git push heroku your-branch:main
```

#### Get your backend URL:
```bash
heroku info anilust-backend
# Use the URL value in your frontend .env
```

---

### Option 2: Railway.app (Very Easy)

#### Setup:
1. **Create Railway Account**: https://railway.app
2. **Connect GitHub Repo**
3. **Configure Build Command**:
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start`

#### Set Environment Variables:
```
PORT=3000
FRONTEND_URL=https://TejasRajkumarS.github.io
```

#### Get URL from Railway Dashboard

---

### Option 3: Vercel

#### Setup:
1. Go to https://vercel.com
2. Import your GitHub repository
3. Configure:
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start`

#### Set Environment Variables in Vercel Dashboard

---

### Option 4: Self-hosted (VPS/Dedicated Server)

#### Using PM2 (Process Manager):

```bash
cd server

# Install PM2 globally
npm install -g pm2

# Start app with PM2
pm2 start index.js --name "anilust-backend"

# Save PM2 process list
pm2 save

# Setup auto-restart on system reboot
pm2 startup
```

#### Using Docker:

Create `server/Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 5000
CMD ["node", "index.js"]
```

Build and run:
```bash
docker build -t anilust-backend .
docker run -p 5000:5000 -e FRONTEND_URL=your-frontend-url anilust-backend
```

---

### Option 5: Render.com

#### Setup:
1. Go to https://render.com
2. Create New Web Service
3. Connect GitHub Repository
4. Configure:
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Set Environment Variables:
   - `FRONTEND_URL`: Your frontend URL

---

## Frontend Configuration

After deploying your backend, update the frontend `.env`:

```env
VITE_BACKEND_URL=https://your-backend-url.com
```

For local development:
```env
VITE_BACKEND_URL=http://localhost:5000
```

---

## Troubleshooting

### "Backend is not reachable"
- Verify `VITE_BACKEND_URL` is correct
- Check if backend is running: `curl https://your-backend-url/health`
- Enable CORS debugging in browser DevTools

### "CORS error still happening"
- Verify `FRONTEND_URL` in backend `.env` matches your frontend URL
- Check backend logs for CORS rejection
- Clear browser cache (Ctrl+Shift+Delete)

### "No streaming sources found"
- The backend no longer proxies streaming APIs (the public ones are gone)
- Verify `VITE_HIANIME_API_URL` points at your self-hosted aniwatch-api:
  `curl https://your-hianime-api/api/v2/hianime/search?q=naruto`
- Try different anime titles

### Backend keeps crashing
- Check for memory issues: `heroku ps` (Heroku)
- Increase dyno size or upgrade plan
- Enable PM2 logs for self-hosted: `pm2 logs anilust-backend`

---

## API Endpoints

```
GET  /health                  - Health check
POST /api/anilist             - AniList GraphQL proxy
```

---

## Performance Tips

1. **Enable Caching**: Backend caches results for 5 minutes
2. **Use CDN**: Add Cloudflare in front of your backend
3. **Optimize Database**: Not needed, backend is stateless
4. **Rate Limiting**: Consider implementing if high traffic

---

## Security Notes

- ⚠️ Backend makes requests to public APIs (data integrity depends on them)
- ✅ CORS is properly configured to only accept your frontend
- ✅ No authentication needed for public APIs
- 🔒 Consider adding rate limiting for production

---

## Support & Issues

- Check backend logs for detailed error messages
- Verify all environment variables are set correctly
- Ensure frontend `.env` file is created (not `.env.example`)
- Test health endpoint: `curl https://your-backend-url/health`
