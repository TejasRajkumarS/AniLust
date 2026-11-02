import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import { anirakuService } from '../services/anirakuService';
import { Anime, StreamData } from '../types';

const Watch: React.FC = () => {
  const { episodeId } = useParams<{ episodeId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const animeIdParam = searchParams.get('animeId');

  const animeId = animeIdParam ? parseInt(animeIdParam, 10) : 0;
  const episodeMatch = episodeId?.match(/-ep-(\d+)$/);
  const episodeNumber = episodeMatch ? parseInt(episodeMatch[1], 10) : parseInt(episodeId || '1', 10);

  const [anime, setAnime] = useState<Anime | null>(null);
  const [stream, setStream] = useState<StreamData | null>(null);
  const [lang, setLang] = useState<'sub' | 'dub'>('sub');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Load anime info + episode list (non-fatal: the player only needs the stream)
  useEffect(() => {
    if (!animeId) return;
    anirakuService.getInfo(animeId.toString())
      .then(setAnime)
      .catch(err => console.error('[Watch] Info failed:', err));
  }, [animeId]);

  // Resolve the actual video stream for the current episode via Aniraku
  const loadStream = useCallback(async () => {
    if (!animeId) return;
    try {
      setLoading(true);
      setError('');
      const data = await anirakuService.getStream(animeId, episodeNumber, lang);
      if (!data.sources.length) throw new Error('No playable sources returned');
      setStream(data);

      // Save to watch history
      const history = JSON.parse(localStorage.getItem('anime_history') || '{}');
      const watched = history[animeId] || [];
      if (!watched.includes(episodeId)) {
        history[animeId] = [...watched, episodeId];
        localStorage.setItem('anime_history', JSON.stringify(history));
      }
    } catch (err) {
      console.error('[Watch] Stream failed:', err);
      setStream(null);
      setError('Unable to resolve stream. The streaming provider may be temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, [animeId, episodeNumber, lang, episodeId]);

  useEffect(() => {
    loadStream();
  }, [loadStream]);

  // Attach HLS to the video element when a new stream resolves
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    hlsRef.current?.destroy();
    hlsRef.current = null;

    const source = stream.sources[0];
    if (source.isM3U8 && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(source.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) console.error('[Watch] HLS fatal error:', data.type, data.details);
      });
      hlsRef.current = hls;
    } else {
      video.src = source.url;
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [stream]);

  if (loading) return (
    <div className="bg-black h-screen flex flex-col items-center justify-center p-8">
      <div className="animate-spin rounded-full h-20 w-20 border-[6px] border-white/5 border-t-primary shadow-[0_0_60px_rgba(168,85,247,0.3)]"></div>
      <p className="mt-8 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">Resolving Stream...</p>
    </div>
  );

  if (error) return (
    <div className="bg-black h-screen flex flex-col items-center justify-center p-8 text-center">
      <div className="size-24 bg-red-500/10 rounded-full flex items-center justify-center mb-8 border border-red-500/20">
        <span className="material-symbols-outlined text-red-500 text-5xl">sensors_off</span>
      </div>
      <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Playback Unavailable</h2>
      <p className="text-slate-500 max-w-sm mx-auto mb-12 text-sm leading-relaxed font-bold uppercase tracking-widest">
        {error}
      </p>
      <div className="flex gap-4">
        <button onClick={loadStream} className="bg-primary text-white font-black px-10 py-5 rounded-[2rem] shadow-xl hover:bg-primary/90 transition-all uppercase tracking-[0.2em] text-[10px]">Retry</button>
        <button onClick={() => navigate(-1)} className="bg-white/5 text-slate-400 font-black px-10 py-5 rounded-[2rem] border border-white/10 uppercase tracking-[0.2em] text-[10px]">Back</button>
      </div>
    </div>
  );

  const titleText = typeof anime?.title === 'string' ? anime.title : anime?.title?.english || anime?.title?.romaji || 'Episode';
  const currentEp = anime?.episodes?.find(e => e.id === episodeId);

  return (
    <div className="relative w-full h-screen bg-black flex flex-col group overflow-hidden select-none">
      <div className="absolute top-0 left-0 right-0 p-10 flex justify-between items-start bg-gradient-to-b from-black via-black/60 to-transparent z-[100] transition-all duration-700">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(-1)} className="p-4 bg-white/5 hover:bg-primary/20 backdrop-blur-3xl rounded-2xl border border-white/10 transition-all"><span className="material-symbols-outlined text-white">arrow_back</span></button>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-white tracking-tighter line-clamp-1">{titleText} <span className="text-primary/60 ml-2">EP {currentEp?.number || episodeNumber}</span></h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/5 backdrop-blur-3xl rounded-2xl border border-white/10 overflow-hidden">
            {(['sub', 'dub'] as const).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${lang === l ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <button onClick={() => setShowSidebar(true)} className="p-4 bg-white/5 hover:bg-white/10 backdrop-blur-3xl rounded-2xl border border-white/10 transition-all"><span className="material-symbols-outlined text-white">grid_view</span></button>
        </div>
      </div>

      <main className="flex-1 relative bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          className="w-full h-full object-contain bg-black"
          controls
          playsInline
          controlsList="nodownload"
        >
          {stream?.subtitles?.map((sub, i) => (
            <track
              key={`${sub.url}-${i}`}
              kind="captions"
              src={sub.url}
              label={sub.lang || `Track ${i + 1}`}
              srcLang={sub.lang || 'en'}
              default={i === 0}
            />
          ))}
        </video>
      </main>

      <div className={`fixed right-0 top-0 h-full w-[380px] z-[200] bg-background-dark/98 backdrop-blur-3xl border-l border-white/10 transition-transform duration-700 p-10 flex flex-col shadow-[-40px_0_100px_rgba(0,0,0,0.8)] ${showSidebar ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between mb-12">
          <h3 className="text-2xl font-black text-white tracking-tighter uppercase">Episodes</h3>
          <button onClick={() => setShowSidebar(false)} className="size-10 flex items-center justify-center bg-white/5 rounded-xl border border-white/10 text-slate-500 hover:text-white transition-all"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="flex-1 overflow-y-auto hide-scrollbar space-y-3">
          {anime?.episodes?.map(ep => (
            <button
              key={ep.id} onClick={() => { navigate(`/watch/${encodeURIComponent(ep.id)}?animeId=${animeId}`); setShowSidebar(false); }}
              className={`w-full flex items-center gap-5 p-5 rounded-2xl transition-all border ${ep.id === episodeId ? 'bg-primary border-primary text-white shadow-xl' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:border-white/20'}`}
            >
              <div className={`size-8 rounded-lg flex items-center justify-center font-black ${ep.id === episodeId ? 'bg-white/20' : 'bg-white/10'}`}>{ep.number}</div>
              <p className="font-black text-xs text-left line-clamp-1 flex-1 uppercase tracking-tight">{ep.title || `Episode ${ep.number}`}</p>
            </button>
          ))}
          {!anime?.episodes?.length && (
            <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest text-center py-8">Episode list unavailable</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Watch;
