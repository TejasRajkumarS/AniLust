
import { Anime, SearchResult, StreamData, EpisodeServer } from '../types';

// ============================================================
// AniList GraphQL – used for ALL metadata (search, trending)
// ============================================================
const ANILIST_GRAPHQL = 'https://graphql.anilist.co';

// ============================================================
// Amvstrm API – used for episode lists + stream links
// Built on Consumet/Gogoanime under the hood.
// Self-host: https://github.com/amvstrm/api (uses Bun)
// ============================================================
const AMVSTRM_BASE = import.meta.env.VITE_AMVSTRM_API_URL || 'https://api-amvstrm.nyt92.eu.org';

// Consumet Gogoanime – direct fallback if Amvstrm is down
const CONSUMET_GOGO_BASE = 'https://consumet-api.onrender.com/anime/gogoanime';
const CONSUMET_GOGO_FALLBACK = 'https://consumet-api-one.vercel.app/anime/gogoanime';

// ============================================================
// Helper: check if Amvstrm API URL is configured
// ============================================================
function hasAnimeAPI(): boolean {
  return Boolean(AMVSTRM_BASE && AMVSTRM_BASE.trim() !== '');
}

// ============================================================
// PERFORMANCE: In-Memory Cache with TTL
// ============================================================
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string, fetcher: () => Promise<T>, forceRefresh = false): Promise<T> {
  const cached = cache.get(key);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[Cache HIT] ${key}`);
    return Promise.resolve(cached.data);
  }
  console.log(`[Cache MISS] ${key}`);
  return fetcher().then(data => {
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  });
}

export function clearCache(pattern?: string) {
  if (pattern) {
    const keysToDelete: string[] = [];
    cache.forEach((_, key) => { if (key.includes(pattern)) keysToDelete.push(key); });
    keysToDelete.forEach(key => cache.delete(key));
    console.log(`[Cache] Cleared ${keysToDelete.length} entries matching "${pattern}"`);
  } else {
    cache.clear();
    console.log('[Cache] Cleared all cached data');
  }
}

// ============================================================
// Fetch helpers with timeout + retry
// ============================================================
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 12000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        ...options.headers,
      },
    });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function fetchJson(url: string, options: RequestInit = {}): Promise<any> {
  const res = await fetchWithTimeout(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

// ============================================================
// AniList GraphQL helper
// ============================================================
const mapAnilistToAnime = (media: any): Anime => {
  if (!media) return {} as Anime;
  return {
    id: media.id?.toString() || '0',
    title: {
      english: media.title?.english || media.title?.romaji || 'Unknown',
      romaji: media.title?.romaji || 'Unknown',
      native: media.title?.native || 'Unknown',
    },
    synonyms: media.synonyms || [],
    image: media.coverImage?.extraLarge || media.coverImage?.large || '',
    cover: media.bannerImage || media.coverImage?.extraLarge || '',
    description: media.description || '',
    status: media.status || 'UNKNOWN',
    releaseDate: media.seasonYear ? `${media.seasonYear}` : undefined,
    genres: media.genres || [],
    rating: media.averageScore || 0,
    type: media.format || 'TV',
    trailer: media.trailer ? {
      id: media.trailer.id,
      site: media.trailer.site,
      thumbnail: media.trailer.thumbnail,
    } : undefined,
  };
};

async function queryAnilist(query: string, variables: any = {}) {
  try {
    const response = await fetch(ANILIST_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(`AniList API returned ${response.status}`);
    const json = await response.json();
    if (json.errors) throw new Error(json.errors[0]?.message || 'AniList API Error');
    if (!json.data) throw new Error('No data returned from AniList API');
    return json.data;
  } catch (error) {
    console.error('AniList Query Failed:', error);
    throw error;
  }
}

// ============================================================
// Amvstrm API helpers
// ============================================================

/**
 * Fetch from Amvstrm API.
 * In development, we go through the Vite proxy at /amvstrm-api.
 * In production, we call the base URL directly.
 */
async function fetchAmvstrm(path: string): Promise<any> {
  // In dev, Vite proxies /amvstrm-api → AMVSTRM_BASE (avoids CORS)
  const isDev = import.meta.env.DEV;
  const base = isDev ? '' : AMVSTRM_BASE;
  const prefix = isDev ? '/amvstrm-api' : '';

  try {
    const data = await fetchJson(`${base}${prefix}${path}`);
    return data;
  } catch (err) {
    console.warn(`[Amvstrm] ${path} failed:`, err);
    throw err;
  }
}

/**
 * Parse episode ID from Amvstrm/Gogoanime format.
 * Amvstrm episodes use Gogoanime IDs like "one-piece-episode-1108"
 * We need to split into gogoId ("one-piece") and ep number ("1108")
 *
 * AniList fallback uses format: "{anilistId}-ep-{number}" — these won't be parseable
 * as Gogoanime IDs and will return null, letting the Consumet fallback handle them.
 */
function parseEpisodeId(episodeId: string): { gogoId: string; ep: string } | null {
  // Match Gogoanime pattern: {slug}-episode-{number}
  const match = episodeId.match(/^(.+)-episode-(\d+)$/);
  if (!match) {
    // This is likely an AniList-format ID like "151807-ep-1"
    // Consumet fallback will handle it using the anime title
    if (!episodeId.match(/^\d+-ep-\d+$/)) {
      console.warn('[Amvstrm] Could not parse episode ID:', episodeId);
    }
    return null;
  }
  return { gogoId: match[1], ep: match[2] };
}

/**
 * Fetch episode list from Amvstrm using AniList ID.
 * Endpoint: GET /api/v2/episodes/:anilistId
 * Returns episodes with Gogoanime IDs.
 */
async function fetchEpisodesFromAmvstrm(anilistId: string): Promise<any[]> {
  try {
    console.log('📺 [Amvstrm] Fetching episodes for AniList ID:', anilistId);
    const data = await fetchAmvstrm(`/api/v2/episodes/${anilistId}`);

    // Amvstrm returns { code, message, results: [...] }
    const episodes = data?.results || data?.episodes || [];

    if (!Array.isArray(episodes) || episodes.length === 0) {
      console.log('⚠️ [Amvstrm] No episodes returned');
      return [];
    }

    console.log(`✅ [Amvstrm] Got ${episodes.length} episodes`);

    return episodes.map((ep: any) => ({
      id: ep.id || ep.episodeId || `ep-${ep.number}`,
      number: ep.number || 0,
      title: ep.title || `Episode ${ep.number}`,
      image: ep.image || ep.img || undefined,
      isFiller: ep.isFiller || false,
    }));
  } catch (err) {
    console.error('[Amvstrm] Episode fetch failed:', err);
    return [];
  }
}

/**
 * Fetch stream URLs from Amvstrm.
 * Endpoint: GET /api/v2/stream/:gogoId/:ep
 *
 * Response structure:
 * {
 *   stream: { multi: { main: { url, quality }, backup: { url, quality } }, tracks: {...} },
 *   iframe: "https://...",
 *   info: { title, cover }
 * }
 */
async function fetchStreamFromAmvstrm(episodeId: string): Promise<StreamData | null> {
  const parsed = parseEpisodeId(episodeId);
  if (!parsed) return null;

  try {
    console.log(`🎬 [Amvstrm] Fetching stream for ${parsed.gogoId} ep ${parsed.ep}`);
    const data = await fetchAmvstrm(`/api/v2/stream/${parsed.gogoId}/${parsed.ep}`);

    if (!data?.stream?.multi) {
      console.warn('[Amvstrm] Unexpected stream response structure:', data);
      return null;
    }

    const { main, backup } = data.stream.multi;
    const tracks = data.stream.tracks;

    const sources: StreamData['sources'] = [];

    if (main?.url) {
      sources.push({
        url: main.url,
        isM3U8: main.url.includes('.m3u8'),
        quality: main.quality || 'default',
      });
    }
    if (backup?.url) {
      sources.push({
        url: backup.url,
        isM3U8: backup.url.includes('.m3u8'),
        quality: backup.quality || 'backup',
      });
    }

    if (sources.length === 0) {
      console.warn('[Amvstrm] No sources in stream response');
      return null;
    }

    const subtitles: StreamData['subtitles'] = [];
    if (tracks?.file) {
      subtitles.push({
        url: tracks.file,
        lang: tracks.label || 'English',
        kind: tracks.kind || 'captions',
      });
    }

    console.log(`✅ [Amvstrm] Got ${sources.length} source(s)`);

    return {
      headers: data.headers || {},
      sources,
      download: sources[0]?.url || '',
      subtitles,
    };
  } catch (err) {
    console.error('[Amvstrm] Stream fetch failed:', err);
    return null;
  }
}

// ============================================================
// Consumet Gogoanime fallback helpers
// ============================================================

/**
 * Search Gogoanime for an anime by title, returns the first match slug.
 */
async function searchGogoAnime(title: string): Promise<string | null> {
  try {
    const bases = [CONSUMET_GOGO_BASE, CONSUMET_GOGO_FALLBACK];
    for (const base of bases) {
      try {
        const data = await fetchJson(`${base}/${encodeURIComponent(title)}`);
        if (data?.results?.length > 0) {
          const best = data.results[0];
          console.log('🔍 [Consumet] Found Gogoanime title:', best.id);
          return best.id; // e.g. "one-piece"
        }
      } catch {
        continue;
      }
    }
  } catch (err) {
    console.warn('[Consumet] Gogoanime search failed:', err);
  }
  return null;
}

/**
 * Fetch episodes from Consumet Gogoanime by anime ID.
 */
async function fetchEpisodesFromConsumет(gogoId: string): Promise<any[]> {
  try {
    const bases = [CONSUMET_GOGO_BASE, CONSUMET_GOGO_FALLBACK];
    for (const base of bases) {
      try {
        const data = await fetchJson(`${base}/info/${gogoId}`);
        if (data?.episodes?.length > 0) {
          console.log(`✅ [Consumet] Got ${data.episodes.length} episodes from Gogoanime`);
          return data.episodes.map((ep: any) => ({
            id: ep.id,                          // e.g. "one-piece-episode-1108"
            number: ep.number,
            title: ep.title || `Episode ${ep.number}`,
            image: ep.image,
          }));
        }
      } catch {
        continue;
      }
    }
  } catch (err) {
    console.warn('[Consumet] Episode fetch failed:', err);
  }
  return [];
}

/**
 * Fetch stream from Consumet Gogoanime by episode ID.
 * If episodeId is in AniList format (e.g. "151807-ep-1"), we need to use the
 * animeTitle to first locate the Gogoanime entry, then build the correct episode ID.
 */
async function fetchStreamFromConsumет(
  episodeId: string,
  animeTitle?: string,
  episodeNumber?: number
): Promise<StreamData | null> {
  let targetId = episodeId;

  // Check if this is an AniList-format ID (e.g. "151807-ep-1")
  const isAnilistFormat = /^\d+-ep-\d+$/.test(episodeId);
  if (isAnilistFormat && animeTitle && episodeNumber !== undefined) {
    console.log('[Consumet] AniList episode ID detected, searching by title:', animeTitle);
    const gogoId = await searchGogoAnime(animeTitle);
    if (gogoId) {
      targetId = `${gogoId}-episode-${episodeNumber}`;
      console.log('[Consumet] Mapped to Gogoanime episode ID:', targetId);
    } else {
      console.warn('[Consumet] Could not find Gogoanime ID for:', animeTitle);
      return null;
    }
  }

  try {
    const bases = [CONSUMET_GOGO_BASE, CONSUMET_GOGO_FALLBACK];
    for (const base of bases) {
      try {
        const data = await fetchJson(`${base}/watch/${encodeURIComponent(targetId)}`);
        if (data?.sources?.length > 0) {
          console.log(`✅ [Consumet] Got ${data.sources.length} source(s) from Gogoanime`);
          return {
            headers: data.headers || {},
            sources: data.sources.map((s: any) => ({
              url: s.url,
              isM3U8: s.isM3U8 || s.url.includes('.m3u8'),
              quality: s.quality || 'default',
            })),
            download: data.download || data.sources[0]?.url || '',
            subtitles: (data.subtitles || []).map((sub: any) => ({
              url: sub.url,
              lang: sub.lang || 'English',
              kind: 'subtitles',
            })),
          };
        }
      } catch {
        continue;
      }
    }
  } catch (err) {
    console.warn('[Consumet] Stream fetch failed:', err);
  }
  return null;
}

// ============================================================
// Public service
// ============================================================
export const consumetService = {
  // ── Trending ─────────────────────────────────────────────
  getTrending: async (page = 1): Promise<SearchResult> => {
    return getCached(`trending-${page}`, async () => {
      const query = `query ($page: Int) { Page(page: $page, perPage: 20) { pageInfo { hasNextPage } media(sort: TRENDING_DESC, type: ANIME, isAdult: false) { id title { english romaji native } synonyms coverImage { extraLarge large } bannerImage description status genres averageScore format seasonYear trailer { id site thumbnail } } } }`;
      const data = await queryAnilist(query, { page });
      return {
        currentPage: page,
        hasNextPage: data.Page.pageInfo.hasNextPage,
        results: data.Page.media.map(mapAnilistToAnime),
      };
    });
  },

  // ── Recent / Popular ──────────────────────────────────────
  getRecent: async (page = 1): Promise<SearchResult> => {
    return getCached(`recent-${page}`, async () => {
      const query = `query ($page: Int) { Page(page: $page, perPage: 20) { pageInfo { hasNextPage } media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) { id title { english romaji native } synonyms coverImage { extraLarge large } bannerImage description status genres averageScore format seasonYear trailer { id site thumbnail } } } }`;
      const data = await queryAnilist(query, { page });
      return {
        currentPage: page,
        hasNextPage: data.Page.pageInfo.hasNextPage,
        results: data.Page.media.map(mapAnilistToAnime),
      };
    });
  },

  // ── Search ───────────────────────────────────────────────
  search: async (queryStr: string, page = 1): Promise<SearchResult> => {
    return getCached(`search-${queryStr}-${page}`, async () => {
      const query = `query ($page: Int, $search: String) { Page(page: $page, perPage: 20) { pageInfo { hasNextPage } media(search: $search, type: ANIME, isAdult: false) { id title { english romaji native } synonyms coverImage { extraLarge large } bannerImage description status genres averageScore format seasonYear trailer { id site thumbnail } } } }`;
      const data = await queryAnilist(query, { page, search: queryStr });
      return {
        currentPage: page,
        hasNextPage: data.Page.pageInfo.hasNextPage,
        results: data.Page.media.map(mapAnilistToAnime),
      };
    });
  },

  // ── By Genre ─────────────────────────────────────────────
  getByGenre: async (genre: string, page = 1): Promise<SearchResult> => {
    const cacheKey = `genre-${genre}-${page}`;
    return getCached(cacheKey, async () => {
      const query = `query ($page: Int, $genre: [String]) { Page(page: $page, perPage: 20) { pageInfo { hasNextPage } media(genre_in: $genre, sort: POPULARITY_DESC, type: ANIME, isAdult: false) { id title { english romaji native } synonyms coverImage { extraLarge large } bannerImage description status genres averageScore format seasonYear trailer { id site thumbnail } } } }`;
      const data = await queryAnilist(query, { page, genre: [genre] });
      const results = data.Page.media.map(mapAnilistToAnime);
      return { currentPage: page, hasNextPage: data.Page.pageInfo.hasNextPage, results };
    }, true);
  },

  // ── Anime Info + Episodes ─────────────────────────────────
  getInfo: async (id: string): Promise<Anime> => {
    return getCached(`info-${id}`, async () => {
      // 1. Get base metadata from AniList
      const query = `query ($id: Int) { Media(id: $id, type: ANIME) { id title { english romaji native } synonyms coverImage { extraLarge large } bannerImage description status genres averageScore format seasonYear streamingEpisodes { title thumbnail url site } trailer { id site thumbnail } } }`;
      const anilistData = await queryAnilist(query, { id: parseInt(id) });
      const baseAnime = mapAnilistToAnime(anilistData.Media);

      const titleStr = typeof baseAnime.title === 'string'
        ? baseAnime.title
        : baseAnime.title.english || baseAnime.title.romaji || '';

      console.log('🎬 [Info] Fetching episodes for:', titleStr);

      // 2. Try Amvstrm API first (uses AniList ID directly)
      if (hasAnimeAPI()) {
        const amvEpisodes = await fetchEpisodesFromAmvstrm(id);
        if (amvEpisodes.length > 0) {
          return { ...baseAnime, episodes: amvEpisodes, totalEpisodes: amvEpisodes.length };
        }
      }

      // 3. Fallback: Consumet Gogoanime (search by title → fetch episodes)
      console.log('⬇️ [Info] Falling back to Consumet Gogoanime...');
      const gogoId = await searchGogoAnime(titleStr);
      if (gogoId) {
        const gogoEpisodes = await fetchEpisodesFromConsumет(gogoId);
        if (gogoEpisodes.length > 0) {
          return { ...baseAnime, episodes: gogoEpisodes, totalEpisodes: gogoEpisodes.length };
        }
      }

      // 4. Last resort: AniList streamingEpisodes metadata
      if (anilistData.Media.streamingEpisodes?.length > 0) {
        console.log('📺 [Info] Using AniList streamingEpisodes as last resort');
        const episodes = anilistData.Media.streamingEpisodes.map((ep: any, index: number) => ({
          id: `${id}-ep-${index + 1}`,
          number: index + 1,
          title: ep.title || `Episode ${index + 1}`,
          image: ep.thumbnail,
          url: ep.url,
        }));
        return { ...baseAnime, episodes };
      }

      console.warn('⚠️ [Info] No episodes found from any source');
      return { ...baseAnime, episodes: [], totalEpisodes: 0 };
    });
  },

  // ── Stream Links ─────────────────────────────────────────
  getStream: async (episodeId: string, _server?: string, animeTitle?: string, episodeNumber?: number): Promise<StreamData> => {
    console.log('🔴 [Stream] Fetching stream for episode:', episodeId);

    // 1. Try Amvstrm API (only works for Gogoanime-format episode IDs)
    if (hasAnimeAPI()) {
      const amvStream = await fetchStreamFromAmvstrm(episodeId);
      if (amvStream) return amvStream;
    }

    // 2. Fallback: Consumet Gogoanime direct
    // Pass animeTitle + episodeNumber so AniList-format IDs can be resolved
    console.log('⬇️ [Stream] Falling back to Consumet Gogoanime...');
    const gogoStream = await fetchStreamFromConsumет(episodeId, animeTitle, episodeNumber);
    if (gogoStream) return gogoStream;

    throw new Error(
      'No streaming sources found. The episode may not be available yet, ' +
      'or the streaming providers are temporarily unavailable.'
    );
  },

  // ── Servers (Sub / Dub toggle) ───────────────────────────
  getServers: async (episodeId: string): Promise<EpisodeServer[]> => {
    // For Gogoanime-format episode IDs: build sub + dub variants
    const parsed = parseEpisodeId(episodeId);
    if (!parsed) {
      // AniList-format ID — we can still show a default server
      return [{ name: 'Sub (Default)', url: episodeId }];
    }

    const servers: EpisodeServer[] = [];

    // Add sub/dub server buttons using the same gogoId structure
    // Dub variant has "-dub" suffix in Gogoanime
    const subId = episodeId;
    const dubId = `${parsed.gogoId}-dub-episode-${parsed.ep}`;

    servers.push({ name: 'Sub (Default)', url: subId });
    servers.push({ name: 'Sub (Backup)', url: subId });
    servers.push({ name: 'Dub', url: dubId });

    return servers;
  },
};
