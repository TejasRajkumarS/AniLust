# Anilust

## What This Is

Anilust is an anime streaming and tracking web application. It allows users to discover, stream, and keep track of their watched anime through a custom frontend that integrates with a self-hosted API backend for metadata, trending lists, and video streaming.

## Core Value

Reliable and seamless anime discovery and streaming experience integrated with user watch history.

## Requirements

### Validated

- ✓ Basic UI frame and routing — existing
- ✓ Basic pages (Home, Watch, Signup, Trending) — existing

### Active

- [ ] Deploy and integrate a self-hosted anime scraping API (e.g., aniwatch-api or gogoanime-api) to serve streaming links.
- [ ] Implement Search & Stream functionality using the new API.
- [ ] Implement Trending / top-airing anime lists on the frontend.
- [ ] Implement User Watch History and tracking (potentially integrating with MyAnimeList or AniList).

### Out of Scope

- [Direct use of public free streaming APIs] — Discontinued or too unstable (e.g., Consumet, Amvstrm) and result in broken playback.

## Context

- The project previously relied on Amvstrm API, which was discontinued, leaving the app without functional streaming.
- We are pivoting to self-hosting a community scraper (like ghoshRitesh12/aniwatch-api) alongside the app to ensure reliable streaming links.
- The web application uses React/Vite (TSX) based on existing files mapping.

## Constraints

- **API Stability**: Must use self-hosted scrapers — Public ones frequently go offline.
- **Cost**: Targeting a free deployment tier whenever possible (e.g., Vercel, Render) for the API backend.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Self-host anime API scraper | Public free APIs (Consumet, Amvstrm) are dead or unstable. Self-hosting ensures uptime. | — Pending |
| Build Search, Trending, Watch History | Provides a complete anime tracking experience beyond simple playback. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-05 after initialization*
