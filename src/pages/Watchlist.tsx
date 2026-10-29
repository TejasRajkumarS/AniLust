
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Anime, Episode } from '../types';
import AnimeCard from '../components/AnimeCard';
import { consumetService } from '../services/consumet';

interface WatchlistProps {
  showToast: (msg: string) => void;
}

interface AnimeMeta {
  totalEpisodes: number;
  episodes: Episode[];
  lastUpdated: number; // Unix timestamp
  status?: string;
}

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", 
  "Horror", "Mystery", "Psychological", "Romance", 
  "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"
];

const STALE_THRESHOLD_RELEASING = 1000 * 60 * 60 * 4; // 4 hours
const STALE_THRESHOLD_COMPLETED = 1000 * 60 * 60 * 24 * 7; // 7 days

const Watchlist: React.FC<WatchlistProps> = ({ showToast }) => {
  const [list, setList] = useState<Anime[]>([]);
  const [history, setHistory] = useState<Record<string, string[]>>({});
  const [metaCache, setMetaCache] = useState<Record<string, AnimeMeta>>({});
  const [isFetchingCounts, setIsFetchingCounts] = useState(false);
  const [isDeepSyncing, setIsDeepSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('watchlist') || '[]');
    const watchedHistory = JSON.parse(localStorage.getItem('anime_history') || '{}');
    const savedMeta = JSON.parse(localStorage.getItem('watchlist_meta_cache') || '{}');
    
    setList(saved);
    setHistory(watchedHistory);
    setMetaCache(savedMeta);
  }, []);

  const filteredList = useMemo(() => {
    if (!selectedGenre) return list;
    return list.filter(anime => anime.genres?.some(g => g.toLowerCase().includes(selectedGenre.toLowerCase())));
  }, [list, selectedGenre]);

  const fetchTotalEpisodes = useCallback(async (animeList: Anime[], force = false) => {
    if (animeList.length === 0) return;
    
    if (force) {
      setIsDeepSyncing(true);
      setSyncProgress(0);
    } else {
      setIsFetchingCounts(true);
    }

    const now = Date.now();
    const updatedMeta: Record<string, AnimeMeta> = { ...metaCache };
    let newEpisodesFoundCount = 0;
    
    const itemsToFetch = animeList.filter(anime => {
      const cached = updatedMeta[anime.id];
      if (!cached) return true;
      if (!force) return false;

      const age = now - cached.lastUpdated;
      const status = (cached.status || anime.status || '').toUpperCase();
      
      if (status === 'COMPLETED' || status === 'FINISHED') {
        return age > STALE_THRESHOLD_COMPLETED;
      }
      return age > STALE_THRESHOLD_RELEASING;
    });
    
    if (itemsToFetch.length === 0) {
      setIsFetchingCounts(false);
      setIsDeepSyncing(false);
      if (force) showToast("Archive is already up to date.");
      return;
    }

    const batchSize = 3;
    for (let i = 0; i < itemsToFetch.length; i += batchSize) {
      const batch = itemsToFetch.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (anime) => {
        try {
          const info = await consumetService.getInfo(anime.id);
          if (info && info.episodes) {
            const currentTotal = info.episodes.length;
            const oldTotal = updatedMeta[anime.id]?.totalEpisodes || 0;
            
            if (oldTotal > 0 && currentTotal > oldTotal) {
              newEpisodesFoundCount++;
            }

            updatedMeta[anime.id] = {
              totalEpisodes: currentTotal,
              episodes: info.episodes,
              lastUpdated: Date.now(),
              status: info.status || anime.status
            };
            
            setMetaCache(prev => ({ ...prev, [anime.id]: updatedMeta[anime.id] }));
          }
        } catch (err) {
          console.error(`Sync error:`, err);
        }
      }));

      if (force) {
        setSyncProgress(Math.round(((i + batch.length) / itemsToFetch.length) * 100));
      }
    }
    
    localStorage.setItem('watchlist_meta_cache', JSON.stringify(updatedMeta));
    setIsFetchingCounts(false);
    setIsDeepSyncing(false);

    if (force) {
      if (newEpisodesFoundCount > 0) {
        showToast(`Found ${newEpisodesFoundCount} new episode updates!`);
      } else {
        showToast("Synchronized with master database.");
      }
    }
  }, [metaCache, showToast]);

  useEffect(() => {
    if (list.length > 0) {
      const needsInitialFetch = list.some(a => !metaCache[a.id]);
      if (needsInitialFetch) fetchTotalEpisodes(list, false);
    }
  }, [list, fetchTotalEpisodes, metaCache]);

  const clearList = () => {
    if (window.confirm("Purge collection database? All tracking for saved titles will be removed.")) {
      localStorage.setItem('watchlist', '[]');
      localStorage.removeItem('watchlist_meta_cache');
      setList([]);
      setMetaCache({});
      showToast("Watchlist purged");
    }
  };

  const getProgressData = (anime: Anime) => {
    const watchedIds = history[anime.id] || [];
    const meta = metaCache[anime.id];
    
    const total = meta?.totalEpisodes || anime.episodes?.length || 0;
    const watchedCount = watchedIds.length;
    
    let lastWatchedNumber = undefined;
    if (watchedIds.length > 0 && meta?.episodes) {
      const watchedMeta = meta.episodes.filter(ep => watchedIds.includes(ep.id));
      if (watchedMeta.length > 0) {
        lastWatchedNumber = Math.max(...watchedMeta.map(ep => ep.number));
      }
    }

    const percent = total > 0 ? Math.round((watchedCount / total) * 100) : 0;
    return { watched: watchedCount, total, lastWatchedNumber, percent };
  };

  return (
    <div className="p-8 md:p-12 pb-32">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-16 gap-8">
        <div>
          <div className="flex items-center gap-4 mb-4">
             <div className="size-14 bg-primary/20 rounded-[1.5rem] flex items-center justify-center border border-primary/30 shadow-[0_0_30px_rgba(168,85,247,0.1)]">
                <span className="material-symbols-outlined !text-3xl text-primary">bookmark</span>
             </div>
             <h1 className="text-5xl font-black text-white tracking-tighter">My Archive</h1>
          </div>
          <div className="flex flex-wrap items-center gap-6 pl-1">
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Tracking {list.length} active links</p>
            
            {(isFetchingCounts || isDeepSyncing) ? (
              <div className="flex items-center gap-4 bg-primary/5 px-4 py-2 rounded-2xl border border-primary/20 animate-pulse">
                <div className="flex items-center gap-2 text-primary">
                  <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {isDeepSyncing ? `Neural Sync ${syncProgress}%` : 'Verifying Signal...'}
                  </span>
                </div>
              </div>
            ) : list.length > 0 ? (
              <button 
                onClick={() => fetchTotalEpisodes(list, true)}
                className="flex items-center gap-2 bg-white/5 hover:bg-primary/20 text-slate-400 hover:text-primary px-4 py-2 rounded-2xl border border-white/10 hover:border-primary/40 transition-all group"
              >
                <span className="material-symbols-outlined text-sm group-hover:rotate-180 transition-transform duration-700">sync</span>
                <span className="text-[10px] font-black uppercase tracking-widest">Update Archive</span>
              </button>
            ) : null}
          </div>
        </div>
        
        {list.length > 0 && (
          <button 
            onClick={clearList}
            className="text-[10px] font-black text-red-500/60 hover:text-red-500 flex items-center gap-2 bg-red-500/5 px-6 py-3 rounded-2xl border border-red-500/10 hover:border-red-500/30 transition-all uppercase tracking-[0.2em]"
          >
            <span className="material-symbols-outlined text-base">delete_sweep</span>
            Purge Collection
          </button>
        )}
      </div>

      {list.length > 0 && (
        <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar pb-8 mb-8 border-b border-white/5">
          <button 
            onClick={() => setSelectedGenre(null)}
            className={`px-8 py-3 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all whitespace-nowrap border ${!selectedGenre ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}
          >
            All Series
          </button>
          {GENRES.map(genre => (
            <button 
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-8 py-3 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all whitespace-nowrap border ${selectedGenre === genre ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}
            >
              {genre}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="size-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mb-8 border border-white/10 relative group">
              <div className="absolute inset-0 bg-primary/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="material-symbols-outlined text-5xl text-slate-700 relative z-10">bookmark_add</span>
            </div>
            <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Archive Empty</h2>
            <p className="text-slate-500 max-w-xs mx-auto mb-10 text-sm font-medium leading-relaxed">Your neural archive is awaiting content. Discovery mode is active.</p>
            <button 
              onClick={() => window.location.hash = '#/'}
              className="bg-primary hover:bg-primary/90 text-white font-black px-12 py-5 rounded-[2rem] shadow-2xl shadow-primary/40 transition-all active:scale-95 text-[11px] tracking-[0.2em] uppercase"
            >
              Enter Multiverse
            </button>
          </div>
        ) : filteredList.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-x-10 gap-y-16 animate-fade-in">
            {filteredList.map(anime => (
              <AnimeCard 
                key={anime.id} 
                anime={anime} 
                progress={getProgressData(anime)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <span className="material-symbols-outlined text-slate-700 text-6xl mb-6">filter_list_off</span>
            <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs">No matching nodes in this sector.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Watchlist;
