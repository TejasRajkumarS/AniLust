// Centralized API configuration.
//
// AniLust talks to two upstream services:
//
// 1. AniList GraphQL (https://graphql.anilist.co)
//    - Public API that sends `Access-Control-Allow-Origin: *`, so the browser
//      can call it directly. Used for search / trending / metadata.
//
// 2. Aniraku (https://api.aniraku.tech)
//    - Streaming + anime info API. It is behind Cloudflare and sends NO
//      `Access-Control-Allow-Origin` header, so browsers can never call it
//      directly. All Aniraku traffic MUST go through the Express backend in
//      `server/` (deployed separately, e.g. on Render/Railway/Fly).
//
// Modes:
// - backend mode:    VITE_BACKEND_URL is set at build time to the deployed
//                    backend base URL (no trailing slash). All calls are
//                    proxied through it.
// - direct mode:     VITE_BACKEND_URL is empty. AniList is called directly;
//                    Aniraku-dependent calls fail fast with a clear error
//                    instead of 404ing against the static host.

const rawBackendUrl = (import.meta.env.VITE_BACKEND_URL || '').trim();

export const BACKEND_URL = rawBackendUrl.replace(/\/+$/, '');

export const API_CONFIG = {
  /** Deployed AniLust backend base URL ('' when not configured). */
  backendUrl: BACKEND_URL,

  /** Aniraku proxy base: `${backend}/api/aniraku`. '' when no backend. */
  aniraku: BACKEND_URL ? `${BACKEND_URL}/api/aniraku` : '',

  /** AniList GraphQL endpoint: backend proxy when available, direct otherwise. */
  anilist: BACKEND_URL ? `${BACKEND_URL}/api/anilist` : 'https://graphql.anilist.co',

  /** Backend health endpoint. '' when no backend. */
  health: BACKEND_URL ? `${BACKEND_URL}/health` : '',
};

/**
 * Guard for Aniraku-backed features. In direct mode (no backend configured)
 * these endpoints cannot work — throw an actionable error instead of letting
 * requests 404 against the static host (e.g. GitHub Pages).
 */
export function requireBackend(feature: string): string {
  if (!BACKEND_URL) {
    throw new Error(
      `${feature} requires the AniLust backend. Set VITE_BACKEND_URL to your deployed ` +
      `backend URL when building (see server/README.md for deployment instructions).`
    );
  }
  return BACKEND_URL;
}
