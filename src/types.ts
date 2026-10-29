
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
  totalEpisodes?: number;
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
  isFiller?: boolean;
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
  subtitles?: Array<{
    url: string;
    lang: string;
    kind: string;
  }>;
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
  passwordHash?: string;
}

// Auth-related types
export interface AuthResponse {
  message: string;
  user?: {
    id: string;
    username: string;
    email: string;
    avatar?: string;
    role: string;
  };
  token?: string;
  expiresIn?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
}

export interface TokenResponse {
  valid: boolean;
  user?: {
    id: string;
    email: string;
    username: string;
    role: string;
  };
  expiresAt?: string;
}
