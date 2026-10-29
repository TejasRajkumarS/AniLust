import { Anime, SearchResult, Episode } from '../types';

const JIKAN_BASE = 'https://api.jikan.moe/v4';
const ANILIST_GRAPHQL = 'https://graphql.anilist.co';
const KITSU_BASE = 'https://kitsu.io/api/edge';

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

const mapJikanToAnime = (data: any): Anime => {
  if (!data) return {} as Anime;
  return {
    id: data.mal_id?.toString() || '0',
    title: {
      english: data.title_english || data.title || 'Unknown',
      romaji: data.title_japanese || data.title || 'Unknown',
      native: data.title_japanese || data.title || 'Unknown',
    },
    synonyms: data.title_synonyms || [],
    image: data.images?.jpg?.large_image_url || data.images?.jpg?.image_url || '',
    cover: data.images?.jpg?.large_image_url || data.images?.jpg?.image_url || '',
    description: data.synopsis || '',
    status: data.status || 'UNKNOWN',
    releaseDate: data.aired?.from ? new Date(data.aired.from).getFullYear().toString() : undefined,
    genres: data.genres?.map((g: any) => g.name) || [],
    rating: data.score || 0,
    type: data.type || 'TV',
    trailer: data.trailer ? {
      id: data.trailer.youtube_id,
      site: 'youtube',
      thumbnail: data.trailer.images?.maximum_image_url,
    } : undefined,
  };
};

const mapKitsuToAnime = (data: any): Anime => {
  if (!data) return {} as Anime;
  const attrs = data.attributes || {};
  return {
    id: data.id?.toString() || '0',
    title: {
      english: attrs.titles?.en_us || attrs.titles?.en_jp || attrs.canonicalTitle || 'Unknown',
      romaji: attrs.titles?.en_jp || attrs.titles?.en_us || attrs.canonicalTitle || 'Unknown',
      native: attrs.titles?.ja_jp || attrs.canonicalTitle || 'Unknown',
    },
    synonyms: attrs.abbreviations || [],
    image: attrs.posterImage?.large || attrs.posterImage?.medium || '',
    cover: attrs.coverImage?.large || attrs.coverImage?.medium || '',
    description: attrs.synopsis || '',
    status: attrs.status || 'UNKNOWN',
    releaseDate: attrs.startDate ? new Date(attrs.startDate).getFullYear().toString() : undefined,
    genres: attrs.genres?.map((g: any) => g.name) || [],
    rating: attrs.averageRating ? parseFloat(attrs.averageRating) * 10 : 0,
    type: attrs.subtype || 'TV',
    trailer: attrs.youtubeVideoId ? {
      id: attrs.youtubeVideoId,
      site: 'youtube',
      thumbnail: `https://img.youtube.com/vi/${attrs.youtubeVideoId}/maxresdefault.jpg`,
    } : undefined,
  };
};

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
}

export const jikanService = {
  getTrending: async (page = 1): Promise<SearchResult> => {
    return getCached(`jikan-trending-${page}`, async () => {
      const data = await fetchJson(`${JIKAN_BASE}/top/anime?page=${page}&filter=airing`);
      return {
        currentPage: page,
        hasNextPage: data.pagination?.has_next_page || false,
        results: data.data?.map(mapJikanToAnime) || [],
      };
    });
  },

  getRecent: async (page = 1): Promise<SearchResult> => {
    return getCached(`jikan-recent-${page}`, async () => {
      const data = await fetchJson(`${JIKAN_BASE}/top/anime?page=${page}&filter=bypopularity`);
      return {
        currentPage: page,
        hasNextPage: data.pagination?.has_next_page || false,
        results: data.data?.map(mapJikanToAnime) || [],
      };
    });
  },

  search: async (queryStr: string, page = 1): Promise<SearchResult> => {
    return getCached(`jikan-search-${queryStr}-${page}`, async () => {
      const data = await fetchJson(`${JIKAN_BASE}/anime?q=${encodeURIComponent(queryStr)}&page=${page}&sfw=true`);
      return {
        currentPage: page,
        hasNextPage: data.pagination?.has_next_page || false,
        results: data.data?.map(mapJikanToAnime) || [],
      };
    });
  },

  getByGenre: async (genre: string, page = 1): Promise<SearchResult> => {
    return getCached(`jikan-genre-${genre}-${page}`, async () => {
      const data = await fetchJson(`${JIKAN_BASE}/anime?genres=${encodeURIComponent(genre)}&page=${page}&sfw=true&order_by=popularity&sort=desc`);
      return {
        currentPage: page,
        hasNextPage: data.pagination?.has_next_page || false,
        results: data.data?.map(mapJikanToAnime) || [],
      };
    });
  },

  getInfo: async (id: string): Promise<Anime> => {
    return getCached(`jikan-info-${id}`, async () => {
      const data = await fetchJson(`${JIKAN_BASE}/anime/${id}/full`);
      return mapJikanToAnime(data.data);
    });
  },

  getEpisodes: async (id: string, page = 1): Promise<Episode[]> => {
    return getCached(`jikan-episodes-${id}-${page}`, async () => {
      const data = await fetchJson(`${JIKAN_BASE}/anime/${id}/episodes?page=${page}`);
      return data.data?.map((ep: any) => ({
        id: `${id}-ep-${ep.mal_id}`,
        number: ep.mal_id,
        title: ep.title || `Episode ${ep.mal_id}`,
        image: ep.images?.jpg?.image_url,
        description: ep.synopsis,
      })) || [];
    });
  },
};

export const anilistService = {
  getTrending: async (page = 1): Promise<SearchResult> => {
    return getCached(`anilist-trending-${page}`, async () => {
      const query = `query ($page: Int) { Page(page: $page, perPage: 20) { pageInfo { hasNextPage } media(sort: TRENDING_DESC, type: ANIME, isAdult: false) { id title { english romaji native } synonyms coverImage { extraLarge large } bannerImage description status genres averageScore format seasonYear trailer { id site thumbnail } } } }`;
      const data = await queryAnilist(query, { page });
      return {
        currentPage: page,
        hasNextPage: data.Page.pageInfo.hasNextPage,
        results: data.Page.media.map(mapAnilistToAnime),
      };
    });
  },

  getRecent: async (page = 1): Promise<SearchResult> => {
    return getCached(`anilist-recent-${page}`, async () => {
      const query = `query ($page: Int) { Page(page: $page, perPage: 20) { pageInfo { hasNextPage } media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) { id title { english romaji native } synonyms coverImage { extraLarge large } bannerImage description status genres averageScore format seasonYear trailer { id site thumbnail } } } }`;
      const data = await queryAnilist(query, { page });
      return {
        currentPage: page,
        hasNextPage: data.Page.pageInfo.hasNextPage,
        results: data.Page.media.map(mapAnilistToAnime),
      };
    });
  },

  search: async (queryStr: string, page = 1): Promise<SearchResult> => {
    return getCached(`anilist-search-${queryStr}-${page}`, async () => {
      const query = `query ($page: Int, $search: String) { Page(page: $page, perPage: 20) { pageInfo { hasNextPage } media(search: $search, type: ANIME, isAdult: false) { id title { english romaji native } synonyms coverImage { extraLarge large } bannerImage description status genres averageScore format seasonYear trailer { id site thumbnail } } } }`;
      const data = await queryAnilist(query, { page, search: queryStr });
      return {
        currentPage: page,
        hasNextPage: data.Page.pageInfo.hasNextPage,
        results: data.Page.media.map(mapAnilistToAnime),
      };
    });
  },

  getByGenre: async (genre: string, page = 1): Promise<SearchResult> => {
    return getCached(`anilist-genre-${genre}-${page}`, async () => {
      const query = `query ($page: Int, $genre: [String]) { Page(page: $page, perPage: 20) { pageInfo { hasNextPage } media(genre_in: $genre, sort: POPULARITY_DESC, type: ANIME, isAdult: false) { id title { english romaji native } synonyms coverImage { extraLarge large } bannerImage description status genres averageScore format seasonYear trailer { id site thumbnail } } } }`;
      const data = await queryAnilist(query, { page, genre: [genre] });
      return {
        currentPage: page,
        hasNextPage: data.Page.pageInfo.hasNextPage,
        results: data.Page.media.map(mapAnilistToAnime),
      };
    });
  },

  getInfo: async (id: string): Promise<Anime> => {
    return getCached(`anilist-info-${id}`, async () => {
      const query = `query ($id: Int) { Media(id: $id, type: ANIME) { id title { english romaji native } synonyms coverImage { extraLarge large } bannerImage description status genres averageScore format seasonYear streamingEpisodes { title thumbnail url site } trailer { id site thumbnail } } }`;
      const data = await queryAnilist(query, { id: parseInt(id) });
      return mapAnilistToAnime(data.Media);
    });
  },
};

export const kitsuService = {
  getTrending: async (page = 1): Promise<SearchResult> => {
    return getCached(`kitsu-trending-${page}`, async () => {
      const data = await fetchJson(`${KITSU_BASE}/trending/anime?page[limit]=20&page[offset]=${(page - 1) * 20}`);
      return {
        currentPage: page,
        hasNextPage: data.links?.next ? true : false,
        results: data.data?.map(mapKitsuToAnime) || [],
      };
    });
  },

  getRecent: async (page = 1): Promise<SearchResult> => {
    return getCached(`kitsu-recent-${page}`, async () => {
      const data = await fetchJson(`${KITSU_BASE}/anime?page[limit]=20&page[offset]=${(page - 1) * 20}&sort=-popularityRank`);
      return {
        currentPage: page,
        hasNextPage: data.links?.next ? true : false,
        results: data.data?.map(mapKitsuToAnime) || [],
      };
    });
  },

  search: async (queryStr: string, page = 1): Promise<SearchResult> => {
    return getCached(`kitsu-search-${queryStr}-${page}`, async () => {
      const data = await fetchJson(`${KITSU_BASE}/anime?page[limit]=20&page[offset]=${(page - 1) * 20}&filter[text]=${encodeURIComponent(queryStr)}`);
      return {
        currentPage: page,
        hasNextPage: data.links?.next ? true : false,
        results: data.data?.map(mapKitsuToAnime) || [],
      };
    });
  },

  getByGenre: async (genre: string, page = 1): Promise<SearchResult> => {
    return getCached(`kitsu-genre-${genre}-${page}`, async () => {
      const data = await fetchJson(`${KITSU_BASE}/anime?page[limit]=20&page[offset]=${(page - 1) * 20}&filter[genres]=${encodeURIComponent(genre)}&sort=-popularityRank`);
      return {
        currentPage: page,
        hasNextPage: data.links?.next ? true : false,
        results: data.data?.map(mapKitsuToAnime) || [],
      };
    });
  },

  getInfo: async (id: string): Promise<Anime> => {
    return getCached(`kitsu-info-${id}`, async () => {
      const data = await fetchJson(`${KITSU_BASE}/anime/${id}`);
      return mapKitsuToAnime(data.data);
    });
  },
};

export type AnimeApiSource = 'jikan' | 'anilist' | 'kitsu' | 'consumet';

export const animeApiService = {
  source: 'anilist' as AnimeApiSource,

  setSource(source: AnimeApiSource) {
    this.source = source;
  },

  getService() {
    switch (this.source) {
      case 'jikan': return jikanService;
      case 'anilist': return anilistService;
      case 'kitsu': return kitsuService;
      default: return null;
    }
  },

  getTrending: async (page = 1): Promise<SearchResult> => {
    const service = animeApiService.getService();
    if (!service) throw new Error('No API source selected');
    return service.getTrending(page);
  },

  getRecent: async (page = 1): Promise<SearchResult> => {
    const service = animeApiService.getService();
    if (!service) throw new Error('No API source selected');
    return service.getRecent(page);
  },

  search: async (queryStr: string, page = 1): Promise<SearchResult> => {
    const service = animeApiService.getService();
    if (!service) throw new Error('No API source selected');
    return service.search(queryStr, page);
  },

  getByGenre: async (genre: string, page = 1): Promise<SearchResult> => {
    const service = animeApiService.getService();
    if (!service) throw new Error('No API source selected');
    return service.getByGenre(genre, page);
  },

  getInfo: async (id: string): Promise<Anime> => {
    const service = animeApiService.getService();
    if (!service) throw new Error('No API source selected');
    return service.getInfo(id);
  },
};