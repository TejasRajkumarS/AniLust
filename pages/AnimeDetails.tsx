
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { consumetService } from '../services/consumet';
import { geminiService, GroundingSource } from '../services/gemini';
import { Anime } from '../types';

const CinematicVisualizer: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const [bars, setBars] = useState<number[]>(Array(60).fill(10));
  const [intensity, setIntensity] = useState(0);
  const requestRef = useRef<number>(null);
  const timeRef = useRef<number>(0);
  const intensityRef = useRef<number>(0);

  const animate = (time: number) => {
    timeRef.current = time / 1000;
    const targetIntensity = isActive ? 1 : 0.15;
    intensityRef.current += (targetIntensity - intensityRef.current) * 0.05;
    const currentInt = intensityRef.current;

    const newBars = Array.from({ length: 60 }, (_, i) => {
      const freq = (i / 60) * 8;
      const base = Math.sin(timeRef.current * 2 + freq) * 10;
      const noise = Math.sin(timeRef.current * 8 + i * 0.5) * 20 * currentInt;
      const spikes = Math.sin(timeRef.current * 15 + i) > 0.8 ? (Math.random() * 40 * currentInt) : 0;
      const val = 10 + (base + noise + spikes);
      return Math.max(5, Math.min(100, val));
    });

    setBars(newBars);
    setIntensity(currentInt);
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isActive]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[160px] bg-primary/30 transition-all duration-1000" style={{ width: `${500 + intensity * 600}px`, height: `${500 + intensity * 600}px`, opacity: 0.05 + intensity * 0.2 }}></div>
      <div className="absolute bottom-0 left-0 w-full h-64 flex items-end justify-center gap-[4px] px-12 opacity-30">
        {bars.map((height, i) => (
          <div key={i} className="flex-1 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent rounded-t-full transition-all duration-75" style={{ height: `${height}%`, opacity: 0.3 + (height / 100) * 0.7 }}></div>
        ))}
      </div>
    </div>
  );
};

const AnimeDetails: React.FC<{ showToast: (msg: string) => void }> = ({ showToast }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [anime, setAnime] = useState<Anime | null>(null);
  const [aiInsight, setAiInsight] = useState<{ hook: string, similar: string[] } | null>(null);
  const [aiSources, setAiSources] = useState<GroundingSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [watchHistory, setWatchHistory] = useState<string[]>([]);
  const [showTrailer, setShowTrailer] = useState(false);
  const [isSyncingEpisodes, setIsSyncingEpisodes] = useState(false);

  const [player, setPlayer] = useState<any>(null);
  const [isTrailerPlaying, setIsTrailerPlaying] = useState(false);
  const [trailerProgress, setTrailerProgress] = useState(0);
  const [trailerDuration, setTrailerDuration] = useState(0);
  const [trailerVolume, setTrailerVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<number | null>(null);

  const fetchInfo = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await consumetService.getInfo(id);
      setAnime(data);
      const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
      setInWatchlist(watchlist.some((item: any) => item.id === id));
      const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
      setIsFavorite(favorites.some((item: any) => item.id === id));
      const history = JSON.parse(localStorage.getItem('anime_history') || '{}');
      setWatchHistory(history[id] || []);
      const groundedTitle = typeof data.title === 'string' ? data.title : data.title.english || '';
      geminiService.getAnimeInsight(groundedTitle, data.description || '').then(result => {
        if (result) { setAiInsight(result.data); setAiSources(result.sources); }
      });
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchInfo(); }, [id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showTrailer) return;
      setShowControls(true);
      resetControlsTimeout();
      if (e.code === 'Space') { e.preventDefault(); if (isTrailerPlaying) player?.pauseVideo(); else player?.playVideo(); }
      if (e.code === 'Escape') setShowTrailer(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTrailer, player, isTrailerPlaying]);

  useEffect(() => {
    if (showTrailer && anime?.trailer?.id) {
      const initializeYT = () => {
        if (!player) {
          new (window as any).YT.Player('trailer-player', {
            videoId: anime.trailer!.id,
            playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, enablejsapi: 1 },
            events: {
              onReady: (e: any) => { setPlayer(e.target); setTrailerDuration(e.target.getDuration()); setTrailerVolume(e.target.getVolume()); },
              onStateChange: (e: any) => { setIsTrailerPlaying(e.data === (window as any).YT.PlayerState.PLAYING); if (e.data === (window as any).YT.PlayerState.ENDED) setShowTrailer(false); }
            }
          });
        }
      };
      if (!(window as any).YT) {
        const tag = document.createElement('script'); tag.src = 'https://www.youtube.com/iframe_api';
        const first = document.getElementsByTagName('script')[0]; first.parentNode?.insertBefore(tag, first);
        (window as any).onYouTubeIframeAPIReady = initializeYT;
      } else initializeYT();
    }
    return () => player?.destroy();
  }, [showTrailer, anime]);

  useEffect(() => {
    let interval: number;
    if (isTrailerPlaying && player) { interval = window.setInterval(() => { setTrailerProgress(player.getCurrentTime()); }, 200); }
    return () => clearInterval(interval);
  }, [isTrailerPlaying, player]);

  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => { if (isTrailerPlaying) setShowControls(false); }, 4000);
  };

  const handleWatchNow = async () => {
    if (!anime) return;
    setIsSyncingEpisodes(true);
    try {
      const refreshed = await consumetService.getInfo(anime.id);
      setAnime(refreshed);
      if (refreshed.episodes && refreshed.episodes.length > 0) {
        const nextEp = refreshed.episodes.find(ep => !watchHistory.includes(ep.id)) || refreshed.episodes[0];
        navigate(`/watch/${nextEp.id}?animeId=${anime.id}`);
      } else { showToast("No active stream signal found."); }
    } catch (err) { showToast("Sync error."); } finally { setIsSyncingEpisodes(false); }
  };

  const toggleWatchlist = () => {
    if (!anime) return;
    const current = JSON.parse(localStorage.getItem('watchlist') || '[]');
    let updated = inWatchlist ? current.filter((item: any) => item.id !== anime.id) : [...current, anime];
    localStorage.setItem('watchlist', JSON.stringify(updated));
    setInWatchlist(!inWatchlist);
    showToast(inWatchlist ? "Removed from list" : "Added to list");
  };

  const progressData = useMemo(() => {
    if (!anime || !anime.episodes) return { count: 0, percent: 0 };
    const watched = anime.episodes.filter(ep => watchHistory.includes(ep.id)).length;
    return { count: watched, total: anime.episodes.length, percent: (watched / anime.episodes.length) * 100 };
  }, [anime, watchHistory]);

  if (loading) return <div className="flex items-center justify-center h-[80vh]"><div className="animate-spin rounded-full h-12 w-12 border-4 border-white/5 border-t-primary"></div></div>;
  if (!anime) return null;

  const titleText = typeof anime.title === 'string' ? anime.title : anime.title.english || anime.title.romaji;

  return (
    <div className="pb-20">
      {showTrailer && anime.trailer && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-12 animate-fade-in" onMouseMove={() => { setShowControls(true); resetControlsTimeout(); }}>
          <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={() => setShowTrailer(false)}></div>
          <CinematicVisualizer isActive={isTrailerPlaying} />
          <div className="relative w-full max-w-7xl aspect-video bg-black rounded-[3rem] overflow-hidden shadow-2xl border border-white/10 z-10">
            <div id="trailer-player" className="w-full h-full scale-105"></div>
            <div className={`absolute inset-0 z-20 flex flex-col justify-between transition-opacity duration-700 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
               <div className="p-10 flex justify-between bg-gradient-to-b from-black/80 to-transparent">
                  <h2 className="text-3xl font-black text-white">{titleText}</h2>
                  <button onClick={() => setShowTrailer(false)} className="p-4 bg-white/5 rounded-2xl text-white hover:bg-red-500/20 transition-all border border-white/10"><span className="material-symbols-outlined">close</span></button>
               </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative w-full h-[70vh] flex items-end overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/40 to-transparent z-10"></div>
        <img src={anime.image} className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-20 scale-125" />
        <div className="relative z-20 w-full max-w-7xl mx-auto px-6 pb-16">
          <div className="flex flex-col md:flex-row gap-12 items-end">
            <div className="w-64 aspect-[3/4.5] rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 group cursor-pointer" onClick={handleWatchNow}>
              <img src={anime.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
            </div>
            <div className="flex-1 flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <span className="px-4 py-1.5 bg-primary/20 text-primary border border-primary/30 text-[10px] font-black rounded-full uppercase">{anime.type}</span>
                <span className="text-yellow-500 font-black">★ {(anime.rating || 0) / 10}</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter drop-shadow-2xl">{titleText}</h1>
              <div className="flex flex-wrap gap-2">
                {anime.genres?.map(g => <span key={g} className="px-5 py-2 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold text-slate-300">{g}</span>)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-16 grid grid-cols-1 lg:grid-cols-12 gap-16">
        <div className="lg:col-span-8 space-y-16">
          {aiInsight && (
            <div className="bg-card-dark/80 p-8 md:p-12 rounded-[2.5rem] border border-white/5 shadow-2xl animate-fade-in">
              <span className="text-primary font-black uppercase text-[10px] tracking-widest mb-4 block">Neural Insight</span>
              <p className="text-white text-3xl font-black italic leading-tight pl-6 border-l-4 border-primary/40 mb-8">{aiInsight.hook}</p>
              {aiSources.length > 0 && (
                <div className="flex flex-wrap gap-4 pt-6 border-t border-white/5">
                  {aiSources.map((s, i) => <a key={i} href={s.uri} target="_blank" className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10 transition-colors"><span className="material-symbols-outlined text-xs">link</span>{s.title}</a>)}
                </div>
              )}
            </div>
          )}

          <section>
            <h2 className="text-3xl font-black text-white mb-8">Synopsis</h2>
            <div className="text-slate-300 text-lg leading-relaxed prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: anime.description || '' }}></div>
          </section>

          <section>
            <div className="flex justify-between items-end mb-10">
              <h2 className="text-3xl font-black text-white">Episodes</h2>
              <div className="flex flex-col items-end gap-2">
                <span className="text-[10px] font-black text-slate-500 uppercase">{progressData.count} / {progressData.total} WATCHED</span>
                <div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-primary transition-all duration-1000" style={{ width: `${progressData.percent}%` }}></div></div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {anime.episodes?.map((ep, i) => (
                <Link key={ep.id} to={`/watch/${ep.id}?animeId=${anime.id}`} className="group relative flex gap-6 bg-card-dark/40 border border-white/5 rounded-[2.2rem] p-5 hover:border-primary/40 hover:-translate-y-2 transition-all animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="relative w-32 aspect-video rounded-2xl overflow-hidden bg-slate-800 border border-white/5">
                    <img src={ep.image || anime.image} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all" />
                    {watchHistory.includes(ep.id) && <div className="absolute top-2 right-2 size-6 rounded-lg bg-primary text-white flex items-center justify-center shadow-lg border border-white/10"><span className="material-symbols-outlined !text-base">check</span></div>}
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <span className="text-[9px] font-black text-primary uppercase mb-1">EP {ep.number}</span>
                    <h4 className="text-white font-black text-base line-clamp-1">{ep.title || `Episode ${ep.number}`}</h4>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-card-dark rounded-[2.5rem] p-10 border border-white/5 sticky top-28 shadow-2xl space-y-8">
            <h3 className="text-2xl font-black text-white pb-4 border-b border-white/5 uppercase">Status Matrix</h3>
            <div className="space-y-4">
              <div className="flex justify-between"><span className="text-slate-500 uppercase text-[10px] font-black">Status</span><span className="text-white font-black">{anime.status}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 uppercase text-[10px] font-black">Type</span><span className="text-white font-black">{anime.type}</span></div>
            </div>
            <button onClick={handleWatchNow} disabled={isSyncingEpisodes} className="w-full bg-primary py-6 rounded-[2rem] text-white font-black text-sm tracking-widest hover:bg-primary/90 transition-all flex items-center justify-center gap-3">
              <span className="material-symbols-outlined !text-3xl">{isSyncingEpisodes ? 'sync' : 'play_circle'}</span>
              {isSyncingEpisodes ? 'SYNCING...' : 'WATCH NOW'}
            </button>
            <button onClick={toggleWatchlist} className={`w-full py-5 rounded-2xl font-black text-[11px] border transition-all ${inWatchlist ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-white/5 border-white/10 text-white'}`}>{inWatchlist ? 'SAVED' : 'MY LIST'}</button>
            {anime.trailer && <button onClick={() => setShowTrailer(true)} className="w-full py-5 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-[11px] hover:bg-white/10">TRAILER</button>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimeDetails;
