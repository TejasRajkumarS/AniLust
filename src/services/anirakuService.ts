import { Anime, SearchResult, Episode, StreamData, EpisodeServer } from '../types';

const ANIRAKU_BACKEND = import.meta.env.VITE_ANIRAKU_BACKEND_URL || 'https://api.aniraku.tech';

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

export const anirakuService = {
  // ========== CATALOG ==========

  // GET /api/v1/anime/{id} — full anime info + episodes
  getInfo: async (id: string | number): Promise<Anime> => {
    return getCached(`aniraku-info-${id}`, async () => {
      const [animeRes, episodesRes] = await Promise.allSettled([
        fetchJson(`${ANIRAKU_BACKEND}/api/v1/anime/${id}`),
        fetchJson(`${ANIRAKU_BACKEND}/api/v1/anime/${id}/episodes`),
      ]);

      if (animeRes.status === 'rejected') {
        throw new Error(`Anime info failed: ${animeRes.reason.message}`);
      }

      const episodes = episodesRes.status === 'fulfilled' ? (episodesRes.value.episodes || []) : [];
      return mapAnirakuToAnime(animeRes.value, episodes);
    });
  },

  // GET /api/v1/anime/{id}/episodes
  getEpisodes: async (id: string | number): Promise<AnirakuEpisode[]> => {
    const data = await fetchJson(`${ANIRAKU_BACKEND}/api/v1/anime/${id}/episodes`);
    return data.episodes || [];
  },

  // GET /api/v1/anime/{id}/similar
  getSimilar: async (id: string | number, page = 1, perPage = 12): Promise<SearchResult> => {
    const url = new URL(`${ANIRAKU_BACKEND}/api/v1/anime/${id}/similar`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('perPage', String(perPage));
    const data = await fetchJson(url.toString());
    return {
      currentPage: data.pageInfo?.currentPage || page,
      hasNextPage: data.pageInfo?.hasNextPage || false,
      results: (data.media || []).map(mapAnirakuSearchToAnime),
    };
  },

  // GET /api/v1/anime/{id}/relations
  getRelations: async (id: string | number): Promise<SearchResult> => {
    const data = await fetchJson(`${ANIRAKU_BACKEND}/api/v1/anime/${id}/relations`);
    return {
      currentPage: 1,
      hasNextPage: false,
      results: (data.media || []).map(mapAnirakuSearchToAnime),
    };
  },

  // POST /api/v1/anilist — GraphQL proxy
  queryAnilist: async (query: string, variables: any = {}): Promise<any> => {
    const res = await fetch(`${ANIRAKU_BACKEND}/api/v1/anilist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    const data = await res.json();
    if (data.errors) throw new Error(data.errors[0]?.message || 'AniList error');
    return data.data;
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

  // POST /api/v1/stream
  getStream: async (animeId: number, episode: number, lang: 'sub' | 'dub' = 'sub', provider?: string): Promise<StreamData> => {
    const res = await fetch(`${ANIRAKU_BACKEND}/api/v1/stream`, {
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

  // GET /api/v1/servers
  getServers: async (animeId: number, episode: number, lang: 'sub' | 'dub' = 'sub'): Promise<EpisodeServer[]> => {
    const url = new URL(`${ANIRAKU_BACKEND}/api/v1/servers`);
    url.searchParams.set('animeId', String(animeId));
    url.searchParams.set('episode', String(episode));
    url.searchParams.set('lang', lang);
    const data: AnirakuServer[] = await fetchJson(url.toString());
    
    return data.map(s => ({
      name: `${s.name} (${s.lang.toUpperCase()})`,
      url: s.sources[0]?.url || '',
    }));
  },

  // GET /api/v1/proxy — build proxy URL for HLS
  buildProxyUrl: (mediaUrl: string): string => {
    return `${ANIRAKU_BACKEND}/api/v1/proxy?url=${encodeURIComponent(mediaUrl)}`;
  },

  // Health check
  healthCheck: async () => {
    const res = await fetch(`${ANIRAKU_BACKEND}/api/v1/health`);
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