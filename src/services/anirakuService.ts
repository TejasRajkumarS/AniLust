import { Anime, SearchResult, Episode, StreamData, EpisodeServer } from '../types';
import { API_CONFIG, BACKEND_URL, ANILIST_GRAPHQL_URL, requireBackend } from '../config/api';

interface AnirakuAnimeRecord {
  id: number;
  idMal: number | null;
  title: {
    romaji: string | null;
    english: string | null;
    native: string | null;
    userPreferred: string | null;
  };
  description: string;
  format: string;
  status: string;
  episodes: number | null;
  duration: number | null;
  genres: string[];
  averageScore: number | null;
  popularity: number;
  season: string | null;
  seasonYear: number | null;
  nextAiringEpisode: {
    episode: number;
    airingAt: number;
  } | null;
  isAdult: boolean;
  coverImage: {
    extraLarge: string;
    large: string;
  };
  bannerImage: string;
  trailer: {
    id: string;
    site: string;
    thumbnail: string;
  } | null;
}

interface AnirakuEpisode {
  number: number;
  title: string;
  thumbnail: string;
  description: string;
  airdate: string;
}

interface AnirakuStreamSource {
  url: string;
  type: string;
  quality: string;
  subtitles?: Array<{ url: string; lang: string; label: string }>;
  verification?: string;
}

interface AnirakuServer {
  name: string;
  provider: string;
  lang: 'sub' | 'dub';
  sources: AnirakuStreamSource[];
  headers?: Record<string, string>;
  downloads?: Array<{ url: string; label: string }>;
}

interface AnirakuStreamResult {
  sources: AnirakuStreamSource[];
  headers: Record<string, string>;
  qualities: string[];
  servers: AnirakuServer[];
  downloads: Array<{ url: string; label: string }>;
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
}

function mapAnirakuToAnime(data: AnirakuAnimeRecord, episodes: AnirakuEpisode[] = []): Anime {
  const mappedEpisodes: Episode[] = episodes.map(ep => ({
    id: `${data.id}-ep-${ep.number}`,
    number: ep.number,
    title: ep.title || `Episode ${ep.number}`,
    image: ep.thumbnail,
    description: ep.description,
    isFiller: false,
  }));

  return {
    id: data.id.toString(),
    title: {
      english: data.title.english || data.title.romaji || 'Unknown',
      romaji: data.title.romaji || 'Unknown',
      native: data.title.native || 'Unknown',
    },
    synonyms: [],
    image: data.coverImage?.extraLarge || data.coverImage?.large || '',
    cover: data.bannerImage || data.coverImage?.extraLarge || '',
    description: data.description || '',
    status: data.status || 'UNKNOWN',
    releaseDate: data.seasonYear ? `${data.seasonYear}` : undefined,
    genres: data.genres || [],
    rating: data.averageScore || 0,
    type: data.format || 'TV',
    episodes: mappedEpisodes,
    totalEpisodes: mappedEpisodes.length,
    trailer: data.trailer ? {
      id: data.trailer.id,
      site: data.trailer.site,
      thumbnail: data.trailer.thumbnail,
    } : undefined,
  };
}

function mapAnirakuSearchToAnime(data: AnirakuAnimeRecord): Anime {
  return {
    id: data.id.toString(),
    title: {
      english: data.title.english || data.title.romaji || 'Unknown',
      romaji: data.title.romaji || 'Unknown',
      native: data.title.native || 'Unknown',
    },
    synonyms: [],
    image: data.coverImage?.extraLarge || data.coverImage?.large || '',
    cover: data.bannerImage || data.coverImage?.extraLarge || '',
    description: data.description || '',
    status: data.status || 'UNKNOWN',
    releaseDate: data.seasonYear ? `${data.seasonYear}` : undefined,
    genres: data.genres || [],
    rating: data.averageScore || 0,
    type: data.format || 'TV',
    trailer: data.trailer ? {
      id: data.trailer.id,
      site: data.trailer.site,
      thumbnail: data.trailer.thumbnail,
    } : undefined,
  };
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 5 * 60 * 1000;

function getCached<T>(key: string, fetcher: () => Promise<T>, forceRefresh = false): Promise<T> {
  const cached = cache.get(key);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return Promise.resolve(cached.data);
  }
  return fetcher().then(data => {
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  });
}

async function fetchJson(url: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Accept': 'application/json', ...options.headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

// "Failed to fetch" is the browser's generic TypeError for any network-level
// failure (connection refused, DNS, CORS). Translate it into an actionable
// message instead of surfacing the raw string on the error screen.
function describeFailure(err: unknown): string {
  if (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(String(err))) {
    const target = BACKEND_URL || 'the AniLust backend';
    return `Cannot reach the backend at ${target}. Start it with "npm start" inside server/, or unset VITE_BACKEND_URL to browse in direct mode.`;
  }
  return err instanceof Error ? err.message : String(err);
}

// Backend-less metadata fallback. Aniraku is CORS-blocked and must go through
// the backend, but AniList GraphQL is callable directly — so when the backend
// is down or unconfigured, load anime metadata from AniList instead of dying.
// Episode lists / playback still require the backend (episodes: [] here).
const ANILIST_MEDIA_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      title { romaji english native }
      synonyms
      description
      format
      status
      episodes
      genres
      averageScore
      seasonYear
      coverImage { extraLarge large }
      bannerImage
      trailer { id site thumbnail }
    }
  }
`;

function mapAnilistMediaToAnime(media: any): Anime {
  return {
    id: media.id.toString(),
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
    episodes: [],
    totalEpisodes: 0,
    trailer: media.trailer ? {
      id: media.trailer.id,
      site: media.trailer.site,
      thumbnail: media.trailer.thumbnail,
    } : undefined,
  };
}

async function fetchAnilistInfoFallback(id: string | number): Promise<Anime> {
  const mediaId = parseInt(String(id), 10);
  if (!Number.isFinite(mediaId)) throw new Error(`Invalid anime id: ${id}`);
  try {
    const res = await fetch(ANILIST_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: ANILIST_MEDIA_QUERY, variables: { id: mediaId } }),
    });
    if (!res.ok) throw new Error(`AniList request failed: ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0]?.message || 'AniList error');
    if (!json.data?.Media) throw new Error('Anime not found on AniList');
    return mapAnilistMediaToAnime(json.data.Media);
  } catch (err) {
    throw new Error(describeFailure(err));
  }
}

export const anirakuService = {
  // ========== CATALOG ==========

  // GET /api/v1/anime/{id} — full anime info + episodes (via backend proxy).
  // Falls back to direct AniList GraphQL metadata when the backend is
  // unreachable or unconfigured, so details pages degrade instead of dying
  // (episodes/playback still need the backend). Fallback results are not
  // cached, so recovery is instant once the backend is back.
  getInfo: async (id: string | number): Promise<Anime> => {
    let backendError: unknown;
    try {
      return await getCached(`aniraku-info-${id}`, async () => {
        requireBackend('Anime details');
        const [animeRes, episodesRes] = await Promise.allSettled([
          fetchJson(`${API_CONFIG.aniraku}/anime/${id}`),
          fetchJson(`${API_CONFIG.aniraku}/anime/${id}/episodes`),
        ]);

        if (animeRes.status === 'rejected') {
          throw new Error(describeFailure(animeRes.reason));
        }

        const episodes = episodesRes.status === 'fulfilled' ? (episodesRes.value.episodes || []) : [];
        return mapAnirakuToAnime(animeRes.value, episodes);
      });
    } catch (err) {
      backendError = err;
    }

    try {
      return await fetchAnilistInfoFallback(id);
    } catch (fallbackErr) {
      const fallbackError = fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr));
      // Prefer the AniList verdict for unknown ids (backend 404), and its
      // error when no backend is configured. Otherwise the backend error is
      // the actionable one ("start the server").
      const preferFallback = !backendError
        || (backendError instanceof Error && /\b404\b/.test(backendError.message));
      throw preferFallback ? fallbackError : backendError;
    }
  },

  // GET /api/v1/anime/{id}/episodes (via backend proxy)
  getEpisodes: async (id: string | number): Promise<AnirakuEpisode[]> => {
    requireBackend('Episode list');
    const data = await fetchJson(`${API_CONFIG.aniraku}/anime/${id}/episodes`);
    return data.episodes || [];
  },

  // GET /api/v1/anime/{id}/similar (via backend proxy)
  getSimilar: async (id: string | number, page = 1, perPage = 12): Promise<SearchResult> => {
    requireBackend('Similar anime');
    const url = new URL(`${API_CONFIG.aniraku}/anime/${id}/similar`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('perPage', String(perPage));
    const data = await fetchJson(url.toString());
    return {
      currentPage: data.pageInfo?.currentPage || page,
      hasNextPage: data.pageInfo?.hasNextPage || false,
      results: (data.media || []).map(mapAnirakuSearchToAnime),
    };
  },

  // GET /api/v1/anime/{id}/relations (via backend proxy)
  getRelations: async (id: string | number): Promise<SearchResult> => {
    requireBackend('Related anime');
    const data = await fetchJson(`${API_CONFIG.aniraku}/anime/${id}/relations`);
    // Upstream returns a MediaConnection: { edges: [{ relationType, node }] }.
    // Fall back to data.media for forward-compat with a plain media list.
    const nodes = Array.isArray(data?.edges)
      ? data.edges.map((e: any) => e?.node).filter(Boolean)
      : Array.isArray(data?.media) ? data.media : [];
    return {
      currentPage: 1,
      hasNextPage: false,
      results: nodes.map(mapAnirakuSearchToAnime),
    };
  },

  // POST — AniList GraphQL. Goes through the backend proxy when one is
  // configured, otherwise directly to graphql.anilist.co (CORS-enabled).
  // Both return the same AniList JSON envelope: { data, errors? }.
  queryAnilist: async (query: string, variables: any = {}): Promise<any> => {
    const res = await fetch(`${API_CONFIG.anilist}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`AniList request failed: ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0]?.message || 'AniList error');
    return json.data;
  },

  // ========== SEARCH / BROWSE (via AniList GraphQL proxy) ==========

  search: async (queryStr: string, page = 1): Promise<SearchResult> => {
    return getCached(`aniraku-search-${queryStr}-${page}`, async () => {
      const query = `
        query ($page: Int, $search: String) {
          Page(page: $page, perPage: 20) {
            pageInfo { hasNextPage }
            media(search: $search, type: ANIME, isAdult: false) {
              id title { english romaji native }
              coverImage { extraLarge large }
              bannerImage
              description
              status
              genres
              averageScore
              format
              seasonYear
              trailer { id site thumbnail }
            }
          }
        }
      `;
      const data = await anirakuService.queryAnilist(query, { page, search: queryStr });
      return {
        currentPage: page,
        hasNextPage: data.Page.pageInfo.hasNextPage,
        results: data.Page.media.map(mapAnirakuSearchToAnime),
      };
    });
  },

  getTrending: async (page = 1): Promise<SearchResult> => {
    return getCached(`aniraku-trending-${page}`, async () => {
      const query = `
        query ($page: Int) {
          Page(page: $page, perPage: 20) {
            pageInfo { hasNextPage }
            media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
              id title { english romaji native }
              coverImage { extraLarge large }
              bannerImage
              description
              status
              genres
              averageScore
              format
              seasonYear
              trailer { id site thumbnail }
            }
          }
        }
      `;
      const data = await anirakuService.queryAnilist(query, { page });
      return {
        currentPage: page,
        hasNextPage: data.Page.pageInfo.hasNextPage,
        results: data.Page.media.map(mapAnirakuSearchToAnime),
      };
    });
  },

  getRecent: async (page = 1): Promise<SearchResult> => {
    return getCached(`aniraku-recent-${page}`, async () => {
      const query = `
        query ($page: Int) {
          Page(page: $page, perPage: 20) {
            pageInfo { hasNextPage }
            media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
              id title { english romaji native }
              coverImage { extraLarge large }
              bannerImage
              description
              status
              genres
              averageScore
              format
              seasonYear
              trailer { id site thumbnail }
            }
          }
        }
      `;
      const data = await anirakuService.queryAnilist(query, { page });
      return {
        currentPage: page,
        hasNextPage: data.Page.pageInfo.hasNextPage,
        results: data.Page.media.map(mapAnirakuSearchToAnime),
      };
    });
  },

  getByGenre: async (genre: string, page = 1): Promise<SearchResult> => {
    return getCached(`aniraku-genre-${genre}-${page}`, async () => {
      const query = `
        query ($page: Int, $genre: [String]) {
          Page(page: $page, perPage: 20) {
            pageInfo { hasNextPage }
            media(genre_in: $genre, sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
              id title { english romaji native }
              coverImage { extraLarge large }
              bannerImage
              description
              status
              genres
              averageScore
              format
              seasonYear
              trailer { id site thumbnail }
            }
          }
        }
      `;
      const data = await anirakuService.queryAnilist(query, { page, genre: [genre] });
      return {
        currentPage: page,
        hasNextPage: data.Page.pageInfo.hasNextPage,
        results: data.Page.media.map(mapAnirakuSearchToAnime),
      };
    });
  },

  // ========== STREAMING ==========

  // POST /api/v1/stream (via backend proxy)
  getStream: async (animeId: number, episode: number, lang: 'sub' | 'dub' = 'sub', provider?: string): Promise<StreamData> => {
    requireBackend('Episode playback');
    const res = await fetch(`${API_CONFIG.aniraku}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ animeId, episode, lang, provider: provider || '', refresh: false }),
    });

    if (!res.ok) throw new Error(`Stream resolution failed: ${res.status}`);
    const data: AnirakuStreamResult = await res.json();

    return {
      headers: data.headers || {},
      sources: (data.sources || []).map(s => ({
        url: s.url,
        isM3U8: s.type === 'hls',
        quality: s.quality || 'auto',
      })),
      download: data.downloads?.[0]?.url || '',
      subtitles: (data.sources?.[0]?.subtitles || []).map(sub => ({
        url: sub.url,
        lang: sub.lang || 'en',
        kind: 'captions',
      })),
    };
  },

  // GET /api/v1/servers (via backend proxy)
  getServers: async (animeId: number, episode: number, lang: 'sub' | 'dub' = 'sub'): Promise<EpisodeServer[]> => {
    requireBackend('Episode servers');
    const url = new URL(`${API_CONFIG.aniraku}/servers`);
    url.searchParams.set('animeId', String(animeId));
    url.searchParams.set('episode', String(episode));
    url.searchParams.set('lang', lang);
    const data: AnirakuServer[] = await fetchJson(url.toString());
    
    return data.map(s => ({
      name: `${s.name} (${s.lang.toUpperCase()})`,
      url: s.sources[0]?.url || '',
    }));
  },

  // GET /api/v1/proxy — build proxy URL for media files. Pass the stream's
  // `headers` (e.g. { Referer: ... }) so CDNs that reject hot-linking answer.
  buildProxyUrl: (mediaUrl: string, headers?: Record<string, string>): string => {
    requireBackend('Media proxy');
    const params = new URLSearchParams({ url: mediaUrl });
    if (headers && Object.keys(headers).length > 0) {
      params.set('headers', JSON.stringify(headers));
    }
    return `${API_CONFIG.aniraku}/proxy?${params.toString()}`;
  },

  // Health check (backend /health)
  healthCheck: async () => {
    requireBackend('Health check');
    const res = await fetch(API_CONFIG.health);
    return res.json();
  },

  // Clear cache
  clearCache: (pattern?: string) => {
    if (pattern) {
      const keysToDelete: string[] = [];
      cache.forEach((_, key) => { if (key.includes(pattern)) keysToDelete.push(key); });
      keysToDelete.forEach(key => cache.delete(key));
    } else {
      cache.clear();
    }
  },
};