
export interface Anime {
  id: string;
  title: string | { english?: string; native?: string; romaji?: string };
  synonyms?: string[];
  image: string;
  cover?: string;
  description?: string;
  status?: string;
  releaseDate?: string;
  genres?: string[];
  rating?: number;
  type?: string;
  episodes?: Episode[];
  trailer?: {
    id: string;
    site: string;
    thumbnail: string;
  };
}

export interface Episode {
  id: string;
  number: number;
  title?: string;
  image?: string;
  description?: string;
  url?: string;
}

export interface SearchResult {
  currentPage: number;
  hasNextPage: boolean;
  results: Anime[];
}

export interface StreamSource {
  url: string;
  isM3U8: boolean;
  quality: string;
}

export interface StreamData {
  headers: Record<string, string>;
  sources: StreamSource[];
  download: string;
}

export interface EpisodeServer {
  name: string;
  url: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role?: string;
}
