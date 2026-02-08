
import { Anime, SearchResult, StreamData, EpisodeServer } from '../types';

const ANILIST_GRAPHQL = 'https://graphql.anilist.co';

// Redundant relay network for high availability
const CONSUMET_INSTANCES = [
  'https://consumet-api-one.vercel.app',
  'https://consumet-jade-zeta.vercel.app',
  'https://c.delusionz.xyz',
  'https://api.consumet.org',
  'https://consumet.vercel.app',
  'https://consumet-jade.vercel.app',
  'https://api.amvstr.me/anime'
];

/**
 * Deep Normalization Protocol
 */
const deepNormalize = (title: string): string => {
  if (!title) return "";
  return title
    .toLowerCase()
    .replace(/['’":\-!?.,/\\_]/g, ' ') 
    .replace(/\b(season|part|cour|special|ova|ona|tv|series|dub|sub)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const getMappedProviderId = (anilistId: string, provider: string): string | null => {
  try {
    const cache = JSON.parse(localStorage.getItem('anilust_neural_mappings') || '{}');
    return cache[`${anilistId}_${provider}`] || null;
  } catch { return null; }
};

const saveProviderMapping = (anilistId: string, provider: string, providerId: string) => {
  try {
    const cache = JSON.parse(localStorage.getItem('anilust_neural_mappings') || '{}');
    cache[`${anilistId}_${provider}`] = providerId;
    localStorage.setItem('anilust_neural_mappings', JSON.stringify(cache));
  } catch (e) { }
};

const fetchRelay = async (path: string, timeout = 12000): Promise<any> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`/api${path}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(id);
    if (response.ok) return await response.json();
    throw new Error(`Relay node responded with ${response.status}`);
  } catch (e) {
    throw new Error('Environment restriction: Stream resolution requires a live backend proxy.');
  }
};

const mapAnilistToAnime = (media: any): Anime => ({
  id: media.id.toString(),
  title: {
    english: media.title.english || media.title.romaji,
    romaji: media.title.romaji,
    native: media.title.native
  },
  synonyms: media.synonyms || [],
  image: media.coverImage.extraLarge || media.coverImage.large,
  cover: media.bannerImage || media.coverImage.extraLarge,
  description: media.description,
  status: media.status,
  releaseDate: media.seasonYear ? `${media.seasonYear}` : undefined,
  genres: media.genres,
  rating: media.averageScore,
  type: media.format,
  trailer: media.trailer ? {
    id: media.trailer.id,
    site: media.trailer.site,
    thumbnail: media.trailer.thumbnail
  } : undefined
});

async function queryAnilist(query: string, variables: any = {}) {
  const response = await fetch(ANILIST_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  return json.data;
}

export const consumetService = {
  getTrending: async (page = 1): Promise<SearchResult> => {
    try {
      const query = `query ($page: Int) { Page(page: $page, perPage: 20) { pageInfo { hasNextPage } media(sort: TRENDING_DESC, type: ANIME, isAdult: false) { id title { english romaji native } synonyms coverImage { extraLarge large } bannerImage description status genres averageScore format seasonYear trailer { id site thumbnail } } } }`;
      const data = await queryAnilist(query, { page });
      return { 
        currentPage: page, 
        hasNextPage: data.Page.pageInfo.hasNextPage, 
        results: data.Page.media.map(mapAnilistToAnime) 
      };
    } catch {
      return fetchRelay(`/meta/anilist/trending?page=${page}`);
    }
  },

  getRecent: async (page = 1): Promise<SearchResult> => {
    return fetchRelay(`/meta/anilist/recent-episodes?page=${page}`);
  },

  search: async (queryStr: string, page = 1): Promise<SearchResult> => {
    try {
      const query = `query ($page: Int, $search: String) { Page(page: $page, perPage: 20) { pageInfo { hasNextPage } media(search: $search, type: ANIME, isAdult: false) { id title { english romaji native } synonyms coverImage { extraLarge large } bannerImage description status genres averageScore format seasonYear trailer { id site thumbnail } } } }`;
      const data = await queryAnilist(query, { page, search: queryStr });
      return { 
        currentPage: page, 
        hasNextPage: data.Page.pageInfo.hasNextPage, 
        results: data.Page.media.map(mapAnilistToAnime) 
      };
    } catch {
      return fetchRelay(`/meta/anilist/${encodeURIComponent(queryStr)}?page=${page}`);
    }
  },

  getByGenre: async (genre: string, page = 1): Promise<SearchResult> => {
    return fetchRelay(`/meta/anilist/advanced-search?genres=["${genre}"]&page=${page}`);
  },

  getInfo: async (id: string): Promise<Anime> => {
    try {
      const query = `query ($id: Int) { Media(id: $id, type: ANIME) { id title { english romaji native } synonyms coverImage { extraLarge large } bannerImage description status genres averageScore format seasonYear trailer { id site thumbnail } } }`;
      const anilistData = await queryAnilist(query, { id: parseInt(id) });
      const baseAnime = mapAnilistToAnime(anilistData.Media);

      const titleVariants = (typeof baseAnime.title === 'object' && baseAnime.title !== null
        ? [baseAnime.title.romaji, baseAnime.title.native, baseAnime.title.english]
        : [baseAnime.title]
      ).concat(baseAnime.synonyms || []).filter(Boolean) as string[];

      const providers = ['gogoanime', 'zoro'];
      
      for (const provider of providers) {
        let providerId = getMappedProviderId(id, provider);

        if (!providerId) {
          for (const variant of titleVariants) {
            try {
              const searchRes = await fetchRelay(`/anime/${provider}/${encodeURIComponent(deepNormalize(variant))}`);
              if (searchRes?.results?.length > 0) {
                providerId = searchRes.results[0].id;
                saveProviderMapping(id, provider, providerId!);
                break;
              }
            } catch { continue; }
          }
        }

        if (providerId) {
          try {
            const info = await fetchRelay(`/anime/${provider}/info/${providerId}`);
            if (info?.episodes?.length > 0) return { ...baseAnime, episodes: info.episodes };
          } catch { }
        }
      }

      try {
        const metaInfo = await fetchRelay(`/meta/anilist/info/${id}`, 5000);
        if (metaInfo?.episodes?.length > 0) return { ...baseAnime, episodes: metaInfo.episodes };
      } catch { }

      return baseAnime;
    } catch (e) {
      throw new Error("Relay Sync Restricted: Real-time manifest resolution requires a live backend runtime.");
    }
  },

  getStream: async (episodeId: string, server?: string): Promise<StreamData> => {
    const providers = ['gogoanime', 'zoro'];
    const cleanId = episodeId.includes('$') ? episodeId.split('$').pop()! : episodeId;

    for (const provider of providers) {
      try {
        const stream = await fetchRelay(`/anime/${provider}/watch/${cleanId}${server ? `?server=${server}` : ''}`, 10000);
        if (stream?.sources?.length > 0) return stream;
      } catch { continue; }
    }

    try {
      return await fetchRelay(`/meta/anilist/watch/${episodeId}${server ? `?server=${server}` : ''}`, 15000);
    } catch {
      throw new Error("Stream resolution blocked by provider firewall. Deploy a dedicated proxy server to bypass.");
    }
  },

  getServers: async (episodeId: string): Promise<EpisodeServer[]> => {
    const cleanId = episodeId.includes('$') ? episodeId.split('$').pop()! : episodeId;
    try {
      const res = await fetchRelay(`/anime/gogoanime/servers/${cleanId}`);
      return res || [];
    } catch {
      try {
        const res = await fetchRelay(`/meta/anilist/servers/${episodeId}`);
        return res || [];
      } catch {
        return [];
      }
    }
  }
};
