
import React, { useEffect, useState, useCallback } from 'react';
import { consumetService } from '../services/consumet';
import { Anime } from '../types';
import AnimeCard from '../components/AnimeCard';
import { Link } from 'react-router-dom';

interface HomeProps {
  showToast: (msg: string) => void;
}

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", 
  "Horror", "Mystery", "Psychological", "Romance", 
  "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"
];

const Home: React.FC<HomeProps> = ({ showToast }) => {
  const [trending, setTrending] = useState<Anime[]>([]);
  const [recent, setRecent] = useState<Anime[]>([]);
  const [genreResults, setGenreResults] = useState<Anime[]>([]);
  const [continueWatching, setContinueWatching] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [genreLoading, setGenreLoading] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  useEffect(() => {
    const cachedTrending = localStorage.getItem('cache_trending_v2');
    const cachedRecent = localStorage.getItem('cache_recent_v2');
    if (cachedTrending) setTrending(JSON.parse(cachedTrending));
    if (cachedRecent) setRecent(JSON.parse(cachedRecent));
  }, []);

  const fetchData = useCallback(async () => {
    try {
      if (trending.length === 0) setLoading(true);
      
      const history = JSON.parse(localStorage.getItem('anime_history') || '{}');
      const historyIds = Object.keys(history).reverse().slice(0, 8);
      
      const [trendingRes, recentRes] = await Promise.allSettled([
        consumetService.getTrending(1),
        consumetService.getRecent(1)
      ]);

      if (trendingRes.status === 'fulfilled' && trendingRes.value.results.length > 0) {
        setTrending(trendingRes.value.results);
        localStorage.setItem('cache_trending_v2', JSON.stringify(trendingRes.value.results));
      }
      
      if (recentRes.status === 'fulfilled' && recentRes.value.results.length > 0) {
        setRecent(recentRes.value.results);
        localStorage.setItem('cache_recent_v2', JSON.stringify(recentRes.value.results));
      }

      if (historyIds.length > 0) {
        const historyDetails = await Promise.allSettled(historyIds.map(id => consumetService.getInfo(id)));
        const watchedData = historyDetails
          .filter(res => res.status === 'fulfilled')
          .map((res: any) => {
            const anime = res.value;
            const eps = history[anime.id] || [];
            const lastEpId = eps[eps.length - 1];
            const lastEp = anime.episodes?.find((e: any) => e.id === lastEpId);
            return { ...anime, lastEp };
          });
        setContinueWatching(watchedData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [trending.length]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const fetchGenre = async () => {
      if (!selectedGenre) return;
      setGenreLoading(true);
      try {
        const data = await consumetService.getByGenre(selectedGenre, 1);
        setGenreResults(data.results || []);
      } catch (err) {
        console.error(err);
      } finally {
        setGenreLoading(false);
      }
    };
    fetchGenre();
  }, [selectedGenre]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-white/5 border-t-primary"></div>
        <p className="text-slate-500 font-black tracking-widest uppercase text-[10px]">Syncing Multiverse...</p>
      </div>
    );
  }

  const featured = trending.length > 0 ? trending[0] : null;
  const featuredTitle = featured ? (typeof featured.title === 'string' ? featured.title : featured.title.english || featured.title.romaji) : '';

  return (
    <div className="pb-12 md:pb-20">
      {featured && !selectedGenre && (
        <section className="relative h-[450px] md:h-[600px] w-full group overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center transition-transform duration-[10s] ease-linear group-hover:scale-110"
            style={{ 
              backgroundImage: `linear-gradient(to right, rgba(5, 5, 5, 1) 5%, rgba(5, 5, 5, 0.4) 50%, rgba(5, 5, 5, 0) 100%), url(${featured.cover || featured.image})` 
            }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-transparent to-transparent"></div>
          
          <div className="relative h-full flex flex-col justify-end md:justify-center px-6 md:px-16 max-w-5xl z-10 animate-fade-in pb-12 md:pb-0">
            <span className="text-primary font-black uppercase tracking-[0.3em] text-[10px] mb-3">Trending Sector</span>
            <h1 className="text-white text-3xl md:text-6xl font-black leading-tight tracking-tighter mb-6 md:mb-8 drop-shadow-2xl line-clamp-2">
              {featuredTitle}
            </h1>
            <div className="flex flex-wrap gap-4">
              <Link 
                to={`/info/${featured.id}`}
                className="bg-primary hover:bg-primary/90 text-white px-8 md:px-10 py-4 md:py-5 rounded-2xl font-black flex items-center gap-3 transition-all active:scale-95 shadow-xl text-sm md:text-lg focus:ring-4 focus:ring-primary/50 outline-none"
              >
                <span className="material-symbols-outlined !text-2xl md:!text-3xl">play_circle</span> WATCH NOW
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Genre Filter */}
      <section className={`px-4 md:px-12 relative z-40 ${selectedGenre ? 'mt-8' : 'mt-[-30px] md:mt-[-40px] mb-12'}`}>
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-2">
          <button 
            onClick={() => setSelectedGenre(null)}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all whitespace-nowrap border focus:ring-4 focus:ring-primary/20 outline-none ${!selectedGenre ? 'bg-primary border-primary text-white' : 'bg-card-dark border-white/10 text-slate-400'}`}
          >
            All
          </button>
          {GENRES.map(genre => (
            <button 
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all whitespace-nowrap border focus:ring-4 focus:ring-primary/20 outline-none ${selectedGenre === genre ? 'bg-primary border-primary text-white' : 'bg-card-dark border-white/10 text-slate-400'}`}
            >
              {genre}
            </button>
          ))}
        </div>
      </section>

      <div className="px-4 md:px-12 space-y-16 mt-8">
        {continueWatching.length > 0 && !selectedGenre && (
          <section className="animate-fade-in">
            <h2 className="text-lg font-black tracking-tight uppercase mb-6 text-slate-400">Continue Watching</h2>
            <div className="flex gap-4 md:gap-6 overflow-x-auto hide-scrollbar pb-4">
              {continueWatching.map(anime => (
                <Link 
                  key={anime.id} 
                  to={anime.lastEp ? `/watch/${anime.lastEp.id}?animeId=${anime.id}` : `/info/${anime.id}`}
                  className="flex-none w-64 md:w-72 group relative overflow-hidden rounded-2xl border border-white/5 bg-card-dark focus:ring-4 focus:ring-primary outline-none"
                >
                  <div className="aspect-video relative overflow-hidden">
                    <img src={anime.image} className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700" loading="lazy" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="size-12 rounded-full bg-primary/20 backdrop-blur-md border border-primary/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="material-symbols-outlined text-white !text-2xl">play_arrow</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 md:p-4">
                    <h4 className="text-white font-black truncate text-xs md:text-sm">{typeof anime.title === 'string' ? anime.title : anime.title.english || anime.title.romaji}</h4>
                    <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">Episode {anime.lastEp?.number || '?'}</p>
                  </div>
                  <div className="absolute bottom-0 left-0 h-1 bg-primary w-[65%]"></div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {selectedGenre ? (
          <section className="animate-fade-in">
            <h2 className="text-2xl font-black tracking-tighter uppercase mb-10">{selectedGenre} Sector</h2>
            {genreLoading ? (
              <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-8 gap-x-4 md:gap-x-8 gap-y-10 md:gap-y-12">
                {genreResults.map(anime => (<AnimeCard key={anime.id} anime={anime} />))}
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="animate-fade-in">
              <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase mb-8">Trending Now</h2>
              <div className="flex gap-4 md:gap-8 overflow-x-auto hide-scrollbar pb-8">
                {trending.slice(featured ? 1 : 0, 15).map(anime => (
                  <AnimeCard key={anime.id} anime={anime} />
                ))}
              </div>
            </section>

            <section className="animate-fade-in">
              <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase mb-8">Latest Episodes</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-8">
                {recent.slice(0, 12).map(anime => (<AnimeCard key={anime.id} anime={anime} variant="horizontal" />))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default Home;
