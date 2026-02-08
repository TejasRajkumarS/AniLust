
import React, { useEffect, useState } from 'react';
import { consumetService } from '../services/consumet';
import { Anime } from '../types';
import AnimeCard from '../components/AnimeCard';

const SkeletonCard: React.FC = () => (
  <div className="flex-none w-48 animate-pulse">
    <div className="aspect-[3/4] rounded-xl bg-slate-800/50 mb-3 shadow-lg border border-white/5"></div>
    <div className="h-4 bg-slate-800/50 rounded-md w-3/4 mb-2"></div>
    <div className="h-3 bg-slate-800/30 rounded-md w-1/2"></div>
  </div>
);

const Trending: React.FC = () => {
  const [list, setList] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  const fetchTrending = async (pageNum: number) => {
    try {
      setLoading(true);
      const data = await consumetService.getTrending(pageNum);
      if (pageNum === 1) {
        setList(data.results);
      } else {
        setList(prev => [...prev, ...data.results]);
      }
      setHasNextPage(data.hasNextPage);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrending(1);
  }, []);

  const loadMore = () => {
    if (loading) return;
    const next = page + 1;
    setPage(next);
    fetchTrending(next);
  };

  return (
    <div className="p-8 md:p-12 pb-32">
      <div className="flex items-center gap-4 mb-12">
        <div className="size-14 bg-primary rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-primary/40">
          <span className="material-symbols-outlined !text-3xl">trending_up</span>
        </div>
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Trending multiverse</h1>
          <p className="text-slate-500 font-medium">Currently the most watched and talked about titles.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-x-8 gap-y-12 animate-fade-in">
        {/* Initial Loading Skeletons */}
        {loading && list.length === 0 && Array.from({ length: 14 }).map((_, i) => (
          <SkeletonCard key={`skeleton-${i}`} />
        ))}

        {/* Real Anime Cards */}
        {list.map(anime => (
          <AnimeCard key={anime.id} anime={anime} />
        ))}

        {/* Load More Skeletons */}
        {loading && list.length > 0 && Array.from({ length: 7 }).map((_, i) => (
          <SkeletonCard key={`more-skeleton-${i}`} />
        ))}
      </div>

      {!loading && hasNextPage && (
        <div className="flex justify-center mt-20">
          <button 
            onClick={loadMore}
            className="bg-white/5 hover:bg-white/10 text-white font-black px-12 py-5 rounded-[2rem] border border-white/10 transition-all active:scale-95 tracking-widest uppercase text-sm flex items-center gap-3"
          >
            LOAD MORE RESULTS
            <span className="material-symbols-outlined text-sm">expand_more</span>
          </button>
        </div>
      )}

      {!loading && !hasNextPage && list.length > 0 && (
        <div className="text-center mt-20 text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">
          End of the Multiverse Reached
        </div>
      )}
    </div>
  );
};

export default Trending;
