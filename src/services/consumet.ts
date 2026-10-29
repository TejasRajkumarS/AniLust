import { Anime, SearchResult, StreamData, EpisodeServer, Episode } from '../types';
import { animeApiService, AnimeApiSource } from './animeApis';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const ANILIST_GRAPHQL = 'https://graphql.anilist.co';

const HIANIME_BASE = (import.meta.env.VITE_HIANIME_API_URL || '').replace(/\/+$/, '');

function hasHianime(): boolean {
  return HIANIME_BASE.length > 0;
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

export function clearCache(pattern?: string) {
  if (pattern) {
    const keysToDelete: string[] = [];
    cache.forEach((_, key) => { if (key.includes(pattern)) keysToDelete.push(key); });
    keysToDelete.forEach(key => cache.delete(key));
  } else {
    cache.clear();
  }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 12000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { 'Accept': 'application/json', ...options.headers },
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
    if (BACKEND_URL) {
      const response = await fetch(`${BACKEND_URL}/api/anilist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
      if (!response.ok) throw new Error(`Backend returned ${response.status}`);
      const json = await response.json();
      if (json.errors) throw new Error(json.errors[0]?.message || 'Backend AniList Error');
      if (!json.data) throw new Error('No data from backend');
      return json.data;
    }

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

const mapHianimeSearchToAnime = (item: any): Anime => {
  if (!item) return {} as Anime;
  return {
    id: item.id || '0',
    title: {
      english: item.title || 'Unknown',
      romaji: item.alternativeTitle || item.title || 'Unknown',
      native: item.alternativeTitle || item.title || 'Unknown',
    },
    synonyms: [],
    image: item.poster || '',
    cover: item.poster || '',
    description: '',
    status: 'UNKNOWN',
    releaseDate: item.aired ? new Date(item.aired).getFullYear().toString() : undefined,
    genres: [],
    rating: 0,
    type: item.type || 'TV',
    trailer: undefined,
  };
};

async function searchHianime(queryStr: string, page = 1): Promise<{ results: any[]; hasNextPage: boolean }> {
  const data = await fetchJson(`${HIANIME_BASE}/api/v2/search?keyword=${encodeURIComponent(queryStr)}&page=${page}`);
  if (!data.success) throw new Error('Hianime search failed');
  return {
    results: data.data?.response || [],
    hasNextPage: data.data?.pageInfo?.hasNextPage || false,
  };
}

async function fetchHianimeEpisodes(animeId: string): Promise<any[]> {
  const data = await fetchJson(`${HIANIME_BASE}/api/v2/episodes/${encodeURIComponent(animeId)}`);
  if (!data.success) throw new Error('Hianime episodes failed');
  return data.data || [];
}

async function fetchHianimeAnimeDetails(animeId: string): Promise<any> {
  const data = await fetchJson(`${HIANIME_BASE}/api/v2/anime/${encodeURIComponent(animeId)}`);
  if (!data.success) throw new Error('Hianime anime details failed');
  return data.data;
}

async function fetchHianimeServers(episodeId: string, type: 'sub' | 'dub' = 'sub'): Promise<any[]> {
  const data = await fetchJson(`${HIANIME_BASE}/api/v2/servers/${encodeURIComponent(episodeId)}?type=${type}`);
  if (!data.success) throw new Error('Hianime servers failed');
  return data.data?.servers || [];
}

async function fetchHianimeList(endpoint: string, page = 1): Promise<{ results: any[]; hasNextPage: boolean }> {
  const data = await fetchJson(`${HIANIME_BASE}${endpoint}?page=${page}`);
  if (!data.success) throw new Error('Hianime list failed');
  return {
    results: data.data?.response || [],
    hasNextPage: data.data?.pageInfo?.hasNextPage || false,
  };
}

export function isHianimeEpisodeId(episodeId: string): boolean {
  return !episodeId.includes('-ep-') && !episodeId.includes('gogoanime-');
}

export const consumetService = {
  getTrending: async (page = 1): Promise<SearchResult> => {
    if (hasHianime()) {
      return getCached(`hianime-trending-${page}`, async () => {
        const { results, hasNextPage } = await fetchHianimeList('/api/v2/animes/most-popular', page);
        return {
          currentPage: page,
          hasNextPage,
          results: results.map(mapHianimeSearchToAnime),
        };
      });
    }
    return animeApiService.getTrending(page);
  },

  getRecent: async (page = 1): Promise<SearchResult> => {
    if (hasHianime()) {
      return getCached(`hianime-recent-${page}`, async () => {
        const { results, hasNextPage } = await fetchHianimeList('/api/v2/animes/recently-updated', page);
        return {
          currentPage: page,
          hasNextPage,
          results: results.map(mapHianimeSearchToAnime),
        };
      });
    }
    return animeApiService.getRecent(page);
  },

  search: async (queryStr: string, page = 1): Promise<SearchResult> => {
    if (hasHianime()) {
      return getCached(`hianime-search-${queryStr}-${page}`, async () => {
        const { results, hasNextPage } = await searchHianime(queryStr, page);
        return {
          currentPage: page,
          hasNextPage,
          results: results.map(mapHianimeSearchToAnime),
        };
      });
    }
    return animeApiService.search(queryStr, page);
  },

  getByGenre: async (genre: string, page = 1): Promise<SearchResult> => {
    if (hasHianime()) {
      return getCached(`hianime-genre-${genre}-${page}`, async () => {
        const { results, hasNextPage } = await fetchHianimeList(`/api/v2/animes/genre/${encodeURIComponent(genre)}`, page);
        return {
          currentPage: page,
          hasNextPage,
          results: results.map(mapHianimeSearchToAnime),
        };
      });
    }
    return animeApiService.getByGenre(genre, page);
  },

  getInfo: async (id: string): Promise<Anime> => {
    return getCached(`info-${id}`, async () => {
      const baseAnime = await animeApiService.getInfo(id);

      const titleStr = typeof baseAnime.title === 'string'
        ? baseAnime.title
        : baseAnime.title.english || baseAnime.title.romaji || '';

      if (hasHianime()) {
        try {
          const searchResult = await searchHianime(titleStr, 1);
          if (searchResult.results.length > 0) {
            const hianimeId = searchResult.results[0].id;
            const [hianimeDetails, episodes] = await Promise.allSettled([
              fetchHianimeAnimeDetails(hianimeId),
              fetchHianimeEpisodes(hianimeId),
            ]);

            const mappedEpisodes: Episode[] = [];
            if (episodes.status === 'fulfilled') {
              for (const ep of episodes.value) {
                mappedEpisodes.push({
                  id: `${hianimeId}-ep-${ep.episodeNumber}`,
                  number: ep.episodeNumber,
                  title: ep.title || `Episode ${ep.episodeNumber}`,
                  isFiller: ep.isFiller || false,
                });
              }
            }

            if (hianimeDetails.status === 'fulfilled') {
              const hianimeAnime = mapHianimeSearchToAnime(hianimeDetails.value);
              return {
                ...baseAnime,
                ...hianimeAnime,
                episodes: mappedEpisodes,
                totalEpisodes: mappedEpisodes.length,
              };
            }

            if (mappedEpisodes.length > 0) {
              return { ...baseAnime, episodes: mappedEpisodes, totalEpisodes: mappedEpisodes.length };
            }
          }
        } catch (err) {
          console.warn('[Hianime] Failed to fetch episodes:', err);
        }
      }

      console.warn('⚠️ [Info] No episodes found. Set VITE_HIANIME_API_URL to your hianime-api instance to enable episode lists.');
      return { ...baseAnime, episodes: [], totalEpisodes: 0 };
    });
  },

  getStream: async (episodeId: string, server?: string, animeTitle?: string, episodeNumber?: number): Promise<StreamData> => {
    console.log('🔴 [Stream] Fetching stream:', episodeId, '| server:', server);

    if (hasHianime()) {
      try {
        const type = server?.toLowerCase().includes('dub') ? 'dub' : 'sub';
        const servers = await fetchHianimeServers(episodeId, type);

        if (servers.length === 0) {
          const altType = type === 'sub' ? 'dub' : 'sub';
          const altServers = await fetchHianimeServers(episodeId, altType);
          if (altServers.length > 0) {
            return {
              headers: {},
              sources: altServers.map(s => ({
                url: s.iframe,
                isM3U8: false,
                quality: s.serverName,
              })),
              download: altServers[0]?.iframe || '',
              subtitles: [],
            };
          }
        }

        if (servers.length > 0) {
          let selectedServer = servers[0];
          if (server) {
            const match = servers.find(s => s.serverName.toLowerCase() === server.toLowerCase() ||
              s.serverId.toLowerCase() === server.toLowerCase());
            if (match) selectedServer = match;
          }

          return {
            headers: {},
            sources: servers.map(s => ({
              url: s.iframe,
              isM3U8: false,
              quality: s.serverName,
            })),
            download: selectedServer.iframe,
            subtitles: [],
          };
        }
      } catch (err) {
        console.warn('[Stream] Hianime failed:', err);
      }
    }

    throw new Error(
      'No streaming sources found. ' +
      'Deploy hianime-api (https://github.com/ryanwtf7/hianime-api) to Vercel and set VITE_HIANIME_API_URL in .env'
    );
  },

  getServers: async (episodeId: string): Promise<EpisodeServer[]> => {
    try {
      if (hasHianime() && isHianimeEpisodeId(episodeId)) {
        const [subServers, dubServers] = await Promise.all([
          fetchHianimeServers(episodeId, 'sub'),
          fetchHianimeServers(episodeId, 'dub'),
        ]);

        const servers: EpisodeServer[] = [];

        for (const s of subServers) {
          servers.push({
            name: `${s.serverName} (Sub)`,
            url: s.iframe,
          });
        }
        for (const s of dubServers) {
          servers.push({
            name: `${s.serverName} (Dub)`,
            url: s.iframe,
          });
        }

        if (servers.length > 0) return servers;
      }
      return [{ name: 'Sub (Default)', url: episodeId }];
    } catch (err) {
      console.warn('[getServers] Error:', err);
      return [{ name: 'Sub (Default)', url: episodeId }];
    }
  },
};