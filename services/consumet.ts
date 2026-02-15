
import { Anime, SearchResult, StreamData, EpisodeServer } from '../types';

const ANILIST_GRAPHQL = 'https://graphql.anilist.co';

// AniWatch API Configuration
// Using public instance: https://api-aniwatch.onrender.com
// Docs: https://github.com/ghoshRitesh12/aniwatch-api
const ANIME_API_BASE = import.meta.env.VITE_ANIME_API_URL || '';

// Helper to check if anime API is configured
const hasAnimeAPI = () => !!ANIME_API_BASE;

// ============================================
// PERFORMANCE: In-Memory Cache with TTL
// ============================================
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string, fetcher: () => Promise<T>, forceRefresh = false): Promise<T> {
  const cached = cache.get(key);

  // Return cached data if still valid and not forcing refresh
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[Cache HIT] ${key}`);
    return Promise.resolve(cached.data);
  }

  // Fetch fresh data and cache it
  console.log(`[Cache MISS] ${key}`);
  return fetcher().then(data => {
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  });
}

// Clear cache manually if needed
export function clearCache(pattern?: string) {
  if (pattern) {
    // Clear specific cache entries matching pattern
    const keysToDelete: string[] = [];
    cache.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => cache.delete(key));
    console.log(`[Cache] Cleared ${keysToDelete.length} entries matching "${pattern}"`);
  } else {
    cache.clear();
    console.log('[Cache] Cleared all cached data');
  }
}

const mapAnilistToAnime = (media: any): Anime => {
  // Guard clauses for missing data
  if (!media) return {} as Anime;

  return {
    id: media.id?.toString() || '0',
    title: {
      english: media.title?.english || media.title?.romaji || 'Unknown',
      romaji: media.title?.romaji || 'Unknown',
      native: media.title?.native || 'Unknown'
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
      thumbnail: media.trailer.thumbnail
    } : undefined
  };
};

async function queryAnilist(query: string, variables: any = {}) {
  try {
    const response = await fetch(ANILIST_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`AniList API returned ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();

    if (json.errors) {
      console.error('AniList API Errors:', json.errors);
      throw new Error(json.errors[0]?.message || 'AniList API Error');
    }

    if (!json.data) {
      throw new Error('No data returned from AniList API');
    }

    return json.data;
  } catch (error) {
    console.error('Anilist Query Failed:', error);
    throw error;
  }
}

// ============================================
// AniWatch API Helper Functions
// ============================================
async function fetchAniwatchAPI(path: string): Promise<any> {
  if (!hasAnimeAPI()) {
    throw new Error('Anime API not configured.');
  }

  const response = await fetch(`${ANIME_API_BASE}${path}`, {
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const json = await response.json();

  // AniWatch API returns { success: boolean, data: {...} }
  if (!json.success) {
    throw new Error('API returned unsuccessful response');
  }

  return json.data;
}

// Search for anime in AniWatch API by title
async function searchAnimeInAniWatch(title: string): Promise<any | null> {
  try {
    console.log('🔍 Searching AniWatch API for:', title);
    const data = await fetchAniwatchAPI(`/api/v2/hianime/search?q=${encodeURIComponent(title)}`);

    console.log('📡 AniWatch search response:', data);

    if (!data.animes || data.animes.length === 0) {
      console.log('⚠️ No anime found in AniWatch search results');
      return null;
    }

    // Return the first result (best match)
    const anime = data.animes[0];
    console.log('🎯 Found AniWatch anime:', anime.name, 'ID:', anime.id);
    return anime;
  } catch (error) {
    console.error('❌ Failed to search AniWatch API:', error);
    return null;
  }
}

// Get episodes from AniWatch API
async function getEpisodesFromAniWatch(aniwatchId: string): Promise<any[]> {
  try {
    console.log('📺 Fetching episodes for AniWatch ID:', aniwatchId);
    const data = await fetchAniwatchAPI(`/api/v2/hianime/anime/${aniwatchId}/episodes`);

    console.log('📋 AniWatch episode response:', data);

    if (!data.episodes || !Array.isArray(data.episodes)) {
      console.log('⚠️ Episode data structure invalid');
      return [];
    }

    console.log(`✅ Successfully fetched ${data.episodes.length} episodes from AniWatch`);

    // Convert AniWatch episodes to our format
    return data.episodes.map((ep: any) => ({
      id: ep.episodeId,
      number: ep.number,
      title: ep.title || `Episode ${ep.number}`,
      isFiller: ep.isFiller || false
    }));
  } catch (error) {
    console.error('❌ Failed to fetch episodes from AniWatch API:', error);
    return [];
  }
}

export const consumetService = {
  getTrending: async (page = 1): Promise<SearchResult> => {
    return getCached(`trending-${page}`, async () => {
      const query = `query ($page: Int) { Page(page: $page, perPage: 20) { pageInfo { hasNextPage } media(sort: TRENDING_DESC, type: ANIME, isAdult: false) { id title { english romaji native } synonyms coverImage { extraLarge large } bannerImage description status genres averageScore format seasonYear trailer { id site thumbnail } } } }`;
      const data = await queryAnilist(query, { page });
      return {
        currentPage: page,
        hasNextPage: data.Page.pageInfo.hasNextPage,
        results: data.Page.media.map(mapAnilistToAnime)
      };
    });
  },

  getRecent: async (page = 1): Promise<SearchResult> => {
    return getCached(`recent-${page}`, async () => {
      const query = `query ($page: Int) { Page(page: $page, perPage: 20) { pageInfo { hasNextPage } media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) { id title { english romaji native } synonyms coverImage { extraLarge large } bannerImage description status genres averageScore format seasonYear trailer { id site thumbnail } } } }`;
      const data = await queryAnilist(query, { page });
      return {
        currentPage: page,
        hasNextPage: data.Page.pageInfo.hasNextPage,
        results: data.Page.media.map(mapAnilistToAnime)
      };
    });
  },

  search: async (queryStr: string, page = 1): Promise<SearchResult> => {
    return getCached(`search-${queryStr}-${page}`, async () => {
      const query = `query ($page: Int, $search: String) { Page(page: $page, perPage: 20) { pageInfo { hasNextPage } media(search: $search, type: ANIME, isAdult: false) { id title { english romaji native } synonyms coverImage { extraLarge large } bannerImage description status genres averageScore format seasonYear trailer { id site thumbnail } } } }`;
      const data = await queryAnilist(query, { page, search: queryStr });
      return {
        currentPage: page,
        hasNextPage: data.Page.pageInfo.hasNextPage,
        results: data.Page.media.map(mapAnilistToAnime)
      };
    });
  },

  getByGenre: async (genre: string, page = 1): Promise<SearchResult> => {
    const cacheKey = `genre-${genre}-${page}`;
    console.log(`🔑 Cache key for genre "${genre}":`, cacheKey);
    // Force refresh to bypass cache for genre requests
    return getCached(cacheKey, async () => {
      console.log(`🌐 Fetching from API for genre "${genre}"`);
      // Note: genre_in expects an array, so we pass it as [String] in the query
      const query = `query ($page: Int, $genre: [String]) { Page(page: $page, perPage: 20) { pageInfo { hasNextPage } media(genre_in: $genre, sort: POPULARITY_DESC, type: ANIME, isAdult: false) { id title { english romaji native } synonyms coverImage { extraLarge large } bannerImage description status genres averageScore format seasonYear trailer { id site thumbnail } } } }`;
      const data = await queryAnilist(query, { page, genre: [genre] });
      const results = data.Page.media.map(mapAnilistToAnime);
      console.log(`✅ API returned ${results.length} results for "${genre}"`);
      return {
        currentPage: page,
        hasNextPage: data.Page.pageInfo.hasNextPage,
        results
      };
    }, true); // Force refresh = true
  },

  getInfo: async (id: string): Promise<Anime> => {
    return getCached(`info-${id}`, async () => {
      // Get base info from AniList
      const query = `query ($id: Int) { Media(id: $id, type: ANIME) { id title { english romaji native } synonyms coverImage { extraLarge large } bannerImage description status genres averageScore format seasonYear streamingEpisodes { title thumbnail url site } trailer { id site thumbnail } } }`;
      const anilistData = await queryAnilist(query, { id: parseInt(id) });
      const baseAnime = mapAnilistToAnime(anilistData.Media);

      console.log('🎬 Fetching info for anime:', baseAnime.title);

      // Try to get episodes from AniWatch API if configured
      if (hasAnimeAPI()) {
        console.log('✅ AniWatch API is configured');
        try {
          // Search for the anime by title to get its AniWatch ID
          const titleToSearch = typeof baseAnime.title === 'string'
            ? baseAnime.title
            : baseAnime.title.english || baseAnime.title.romaji;

          const aniwatchAnime = await searchAnimeInAniWatch(titleToSearch);

          if (aniwatchAnime) {
            // Get episodes using the AniWatch ID
            const episodes = await getEpisodesFromAniWatch(aniwatchAnime.id);

            if (episodes.length > 0) {
              return {
                ...baseAnime,
                episodes,
                totalEpisodes: episodes.length
              };
            }
          }
        } catch (error) {
          console.error('❌ Failed to fetch episodes from AniWatch API:', error);
        }
      } else {
        console.log('⚠️ AniWatch API not configured');
      }

      // Fallback: use AniList streaming episodes if available
      if (anilistData.Media.streamingEpisodes && anilistData.Media.streamingEpisodes.length > 0) {
        console.log('📺 Using AniList streaming episodes as fallback');
        const episodes = anilistData.Media.streamingEpisodes.map((ep: any, index: number) => ({
          id: `${id}-ep-${index + 1}`,
          number: index + 1,
          title: ep.title || `Episode ${index + 1}`,
          image: ep.thumbnail,
          url: ep.url
        }));
        return { ...baseAnime, episodes };
      }

      // No episodes found
      console.log('⚠️ No episodes found from any source');
      return {
        ...baseAnime,
        episodes: [],
        totalEpisodes: 0
      };
    });
  },

  getStream: async (episodeId: string, server?: string): Promise<StreamData> => {
    if (!hasAnimeAPI()) {
      throw new Error(
        'Streaming requires AniWatch API. ' +
        'Please configure VITE_ANIME_API_URL in your .env.local file.'
      );
    }

    try {
      // AniWatch API endpoint: /api/v2/hianime/episode/sources
      const serverParam = server || 'hd-1';
      const category = 'sub'; // Default to sub, can be made configurable

      const data = await fetchAniwatchAPI(
        `/api/v2/hianime/episode/sources?animeEpisodeId=${episodeId}&server=${serverParam}&category=${category}`
      );

      if (data.sources && data.sources.length > 0) {
        return {
          headers: data.headers || {},
          sources: data.sources.map((source: any) => ({
            url: source.url,
            isM3U8: source.isM3U8 || source.url.includes('.m3u8'),
            quality: source.quality || 'auto'
          })),
          download: data.sources[0].url, // Add download link
          subtitles: data.subtitles?.map((sub: any) => ({
            url: sub.url,
            lang: sub.lang,
            kind: 'subtitles'
          })) || []
        };
      }

      throw new Error('No streaming links available');
    } catch (error: any) {
      throw new Error(`Failed to get stream: ${error.message}`);
    }
  },

  getServers: async (episodeId: string): Promise<EpisodeServer[]> => {
    if (!hasAnimeAPI()) {
      return [];
    }

    try {
      const data = await fetchAniwatchAPI(
        `/api/v2/hianime/episode/servers?animeEpisodeId=${episodeId}`
      );

      const servers: EpisodeServer[] = [];

      // Add sub servers
      if (data.sub) {
        data.sub.forEach((server: any) => {
          servers.push({
            name: `${server.serverName} (Sub)`,
            url: episodeId
          });
        });
      }

      // Add dub servers
      if (data.dub) {
        data.dub.forEach((server: any) => {
          servers.push({
            name: `${server.serverName} (Dub)`,
            url: episodeId
          });
        });
      }

      return servers;
    } catch {
      return [];
    }
  }
};
