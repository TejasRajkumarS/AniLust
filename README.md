# <p align="center">📺 AniLust 📺</p>

<p align="center">
  <img src="Gemini_Generated_Image_sk3tbysk3tbysk3t (1).png" alt="AniLust Brand Header" width="1000" />
</p>

<<<<<<< HEAD
<p align="center">
  <img src="https://img.shields.io/github/stars/tejasrajkumars/AniLust?style=for-the-badge&color=a855f7&logoColor=ffffff" alt="Stars Badge">
  <img src="https://img.shields.io/github/forks/tejasrajkumars/AniLust?style=for-the-badge&color=a855f7&logoColor=ffffff" alt="Forks Badge">
  <img src="https://img.shields.io/badge/License-MIT-8A2BE2?style=for-the-badge">
</p>
=======
This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1ahEqPDrAUIEew0BhaQYLrWgOQ5tXiomF

## Run Locally

### Prerequisites
>>>>>>> 54a1015 (commits)

- Node.js 18+ ([download](https://nodejs.org))
- A self-hosted [aniwatch-api](https://github.com/ghoshRitesh12/aniwatch-api) instance (**required for episodes & streaming** — all public streaming APIs are dead)
- Gemini API Key *(optional, only for AI insights)* ([get one](https://aistudio.google.com/api))

<<<<<<< HEAD
<p align="center">
  <a href="https://TejasRajkumarS.github.io/AniLust">
    <img src="https://img.shields.io/badge/Visit_AniLust-8A2BE2?style=for-the-badge&logo=icloud&logoColor=white" alt="Visit AniLust">
  </a>
</p>



---

## 🛠 Tech Stack

![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.dot-js&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)
![Tailwind_CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)


## 📖 Deep Dive Overview
**AniLust** is a high-performance discovery engine built for the modern anime community. Developed with a focus on **Minimalist UX** and **Real-time Data Fetching**, it provides a centralized "Multiverse" hub to browse, search, and manage anime titles.

As a second-year BCA student and Data Analyst, I designed this application to solve the common issue of cluttered anime databases by offering a "Cinema-First" dark mode interface that emphasizes high-quality cover art and smooth transitions.

### 📸 Interface Preview
<p align="center">
  <img src="Screenshot 2026-02-08 211301.png" width="850" alt="AniLust Dashboard Preview">
</p>

---

## 🚀 Advanced Features

### 🌟 Intelligent Discovery
* **Trending Sector:** Automatically pulls the most discussed titles (like *You and I Are Polar Opposites*) using weighted popularity metrics.
* **Search Multiverse:** A predictive search bar that allows users to find titles instantly without page reloads.

### 🎨 Premium UI/UX
* **Glassmorphism Sidebar:** A modern navigation menu featuring frosted glass effects and a vibrant purple accent theme.
* **Responsive Grid:** A custom-built CSS Grid system that adapts flawlessly from mobile smartphones to ultra-wide desktop monitors.
* **Interactive Call-to-Action:** Direct "Watch Now" integration to streamline the user journey from discovery to viewing.

### 🔐 User Ecosystem
* **Personalized Libraries:** Ready-to-use hooks for "My List" and "Favorites" sections.
* **Authentication Suite:** Pre-styled Login and Sign-up modules designed for future backend integration.

---

## 🛠️ Technical Architecture


[Image of Web Application Architecture diagram]

This project demonstrates modern frontend engineering principles:

* **API Management:** Leverages the **AniList GraphQL API** to fetch complex nested data (genres, ratings, status) in a single request, reducing latency.
* **State Control:** Managed via native JavaScript to ensure a lightweight footprint without the overhead of heavy frameworks.
* **Visual Assets:** Uses dynamic rendering for cover images to ensure the UI remains fast while loading high-resolution media.

---

## 🚀 Getting Started
1. **Clone the Repo**
   ```bash
   git clone https://github.com/tejasrajkumars/AniLust.git
=======
### Quick Setup

#### Windows Users
```bash
setup-dev.bat
```

#### macOS/Linux Users
```bash
chmod +x setup-dev.sh
./setup-dev.sh
```

#### Manual Setup

1. **Frontend Setup**
```bash
npm install
cp .env.example .env
# Edit .env and set:
# - VITE_HIANIME_API_URL=https://your-hianime-api-url  (required for streaming)
# - VITE_BACKEND_URL=http://localhost:5000             (optional AniList proxy)
# - VITE_GEMINI_API_KEY=your_api_key_here              (optional AI insights)
npm run dev
# Runs on http://localhost:3000
```

2. **Backend Setup** (optional — only needed as an AniList proxy in production)
```bash
cd server
npm install
cp .env.example .env
# Edit .env and set FRONTEND_URL if needed
npm run dev
# Runs on http://localhost:5000
```

### Streaming backend (aniwatch-api)

Episode lists and video streams come from a **self-hosted** aniwatch-api
instance (the public Consumet/Gogoanime/Zoro APIs no longer exist):

1. Deploy the API (free tiers work):
   - Fork/clone `https://github.com/ghoshRitesh12/aniwatch-api` (or a maintained fork)
   - Deploy to Render.com / Railway / Vercel — see that repo's deployment guide
2. Paste the instance URL into the frontend `.env`:
   ```env
   VITE_HIANIME_API_URL=https://your-aniwatch-api.onrender.com
   ```
3. Restart `npm run dev`.

Without this, browsing/searching (AniList metadata) works but playback is
unavailable.

### Environment Variables

Create `.env` file in the root directory:
```env
# Self-hosted aniwatch-api (required for episodes & streaming)
VITE_HIANIME_API_URL=

# Backend AniList proxy (optional)
VITE_BACKEND_URL=http://localhost:5000

# Google Gemini API Key (optional - AI insights on anime pages)
VITE_GEMINI_API_KEY=
```

## Backend Deployment

See [server/DEPLOYMENT.md](./server/DEPLOYMENT.md) for deploying the optional
AniList proxy to Heroku, Railway, Vercel, Render, or a VPS, and deploy
aniwatch-api using its own README (the steps are nearly identical).

## Troubleshooting

### "No streaming sources found"
1. Confirm `VITE_HIANIME_API_URL` is set in `.env` and the dev server was restarted
2. Verify the instance is alive: `curl https://your-hianime-api/api/v2/hianime/search?q=naruto`
3. If it returns 503, the free-tier instance is waking up — try again in ~30s

### "CORS error"
- If you run the optional backend: `FRONTEND_URL` in `server/.env` must match your frontend origin

## Project Structure

```
anilust/
├── server/                # Optional backend (AniList proxy)
│   ├── index.js           # Express server
│   ├── DEPLOYMENT.md      # Deployment guides
│   └── README.md          # Backend documentation
├── src/
│   ├── components/        # AnimeCard, Logo, Sidebar
│   ├── pages/             # Home, Trending, AnimeDetails, Watch,
│   │                      # Watchlist, Favorites, Login, Signup
│   ├── services/          # consumet.ts (data/streaming), gemini.ts (AI)
│   ├── utils/             # auth.ts, validation.ts
│   └── App.tsx            # Router + layout + toast
├── vite.config.ts
└── tsconfig.json
```
>>>>>>> 54a1015 (commits)
