
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import { consumetService } from '../services/consumet';
import { EpisodeServer, Anime, StreamData } from '../types';

const Watch: React.FC = () => {
  const { episodeId } = useParams<{ episodeId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const animeId = searchParams.get('animeId');
  
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [servers, setServers] = useState<EpisodeServer[]>([]);
  const [activeServer, setActiveServer] = useState<string | null>(null);
  const [anime, setAnime] = useState<Anime | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [useIframe, setUseIframe] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [error, setError] = useState<{ message: string; type: 'fatal' | 'environment' | null }>({ message: '', type: null });
  const [showSidebar, setShowSidebar] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [autoSyncTimer, setAutoSyncTimer] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsInitTimeoutRef = useRef<number | null>(null);

  const fetchContent = useCallback(async (isRetry = false, serverName?: string) => {
    if (!episodeId) return;
    try {
      if (isRetry) setIsRetrying(true);
      else setLoading(true);
      
      setError({ message: '', type: null });
      setUseIframe(false);
      setIframeLoading(true);

      const [streamRes, serverRes, animeData] = await Promise.allSettled([
        consumetService.getStream(episodeId, serverName),
        consumetService.getServers(episodeId),
        animeId ? consumetService.getInfo(animeId) : Promise.resolve(null)
      ]);

      if (animeData.status === 'fulfilled' && animeData.value) {
        setAnime(animeData.value);
        const history = JSON.parse(localStorage.getItem('anime_history') || '{}');
        const watched = history[animeData.value.id] || [];
        if (!watched.includes(episodeId)) {
          history[animeData.value.id] = [...watched, episodeId];
          localStorage.setItem('anime_history', JSON.stringify(history));
        }
      }

      if (serverRes.status === 'fulfilled') setServers(serverRes.value);

      if (streamRes.status === 'fulfilled' && streamRes.value?.sources?.length > 0) {
        setStreamData(streamRes.value);
        const hasHls = streamRes.value.sources.some(s => s.url.includes('.m3u8') || s.isM3U8);
        if (!hasHls) {
           setUseIframe(true);
           if (serverRes.status === 'fulfilled' && serverRes.value.length > 0) {
             setActiveServer(serverRes.value[0].name);
           }
        }
      } else {
        // Handle environment blockage explicitly
        if (streamRes.status === 'rejected') {
          setError({ 
            message: streamRes.reason.message || 'Stream resolution requires a live backend proxy.', 
            type: 'environment' 
          });
        } else {
          setUseIframe(true);
          if (serverRes.status === 'fulfilled' && serverRes.value.length > 0) {
            setActiveServer(serverName || serverRes.value[0].name);
          } else {
            setError({ message: 'No active stream signals were detected in this sector.', type: 'fatal' });
          }
        }
      }
    } catch (err) {
      setError({ message: 'Neural link failed. Environment restricts manifest extraction.', type: 'environment' });
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  }, [episodeId, animeId]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  useEffect(() => {
    if (streamData && videoRef.current && !useIframe) {
      const hlsSource = streamData.sources.find(s => s.url.includes('.m3u8')) || streamData.sources[0];
      
      hlsInitTimeoutRef.current = window.setTimeout(() => {
        if (!isPlaying && !useIframe) {
          setUseIframe(true);
          if (servers.length > 0) setActiveServer(servers[0].name);
        }
      }, 7000);

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          xhrSetup: (xhr) => {
            if (streamData.headers) {
              Object.keys(streamData.headers).forEach(key => {
                if (!['referer', 'user-agent'].includes(key.toLowerCase())) {
                  xhr.setRequestHeader(key, streamData.headers[key]);
                }
              });
            }
          }
        });
        hlsRef.current = hls;
        hls.loadSource(hlsSource.url);
        hls.attachMedia(videoRef.current);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (hlsInitTimeoutRef.current) clearTimeout(hlsInitTimeoutRef.current);
          videoRef.current?.play().catch(() => setIsPlaying(false));
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
               setUseIframe(true);
               if (servers.length > 0) setActiveServer(servers[0].name);
               hls.destroy();
            } else {
               hls.recoverMediaError();
            }
          }
        });
      }

      return () => {
        if (hlsRef.current) hlsRef.current.destroy();
        if (hlsInitTimeoutRef.current) clearTimeout(hlsInitTimeoutRef.current);
      };
    }
  }, [streamData, useIframe, servers, isPlaying]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      const dur = videoRef.current.duration;
      setProgress((cur / (dur || 1)) * 100);
      setDuration(dur);
      if (dur > 0 && dur - cur < 15 && !autoSyncTimer && anime?.episodes) {
        const curIdx = anime.episodes.findIndex(e => e.id === episodeId);
        if (curIdx !== -1 && curIdx < anime.episodes.length - 1) setAutoSyncTimer(15);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading || isRetrying) return (
    <div className="bg-black h-screen flex flex-col items-center justify-center p-8">
      <div className="animate-spin rounded-full h-20 w-20 border-[6px] border-white/5 border-t-primary shadow-[0_0_60px_rgba(168,85,247,0.3)]"></div>
      <p className="mt-8 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">Syncing Stream Signal...</p>
    </div>
  );

  if (error.message) return (
    <div className="bg-black h-screen flex flex-col items-center justify-center p-8 text-center">
      <div className="size-24 bg-red-500/10 rounded-full flex items-center justify-center mb-8 border border-red-500/20">
        <span className="material-symbols-outlined text-red-500 text-5xl">{error.type === 'environment' ? 'dns' : 'sensors_off'}</span>
      </div>
      <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">
        {error.type === 'environment' ? 'Environment Restricted' : 'Playback Gated'}
      </h2>
      <p className="text-slate-500 max-w-sm mx-auto mb-12 text-sm leading-relaxed font-bold uppercase tracking-widest">
        {error.message}
      </p>
      <div className="flex gap-4">
        <button onClick={() => fetchContent(true)} className="bg-primary text-white font-black px-10 py-5 rounded-[2rem] shadow-xl hover:bg-primary/90 transition-all uppercase tracking-[0.2em] text-[10px]">Retry Uplink</button>
        <button onClick={() => navigate(-1)} className="bg-white/5 text-slate-400 font-black px-10 py-5 rounded-[2rem] border border-white/10 uppercase tracking-[0.2em] text-[10px]">Abort</button>
      </div>
    </div>
  );

  const titleText = typeof anime?.title === 'string' ? anime.title : anime?.title?.english || anime?.title?.romaji || 'Episode';
  const currentEp = anime?.episodes?.find(e => e.id === episodeId);

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-black flex flex-col group overflow-hidden select-none">
      <div className={`absolute top-0 left-0 right-0 p-10 flex justify-between items-start bg-gradient-to-b from-black via-black/60 to-transparent z-[100] transition-all duration-700 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}`}>
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(-1)} className="p-4 bg-white/5 hover:bg-primary/20 backdrop-blur-3xl rounded-2xl border border-white/10 transition-all"><span className="material-symbols-outlined text-white">arrow_back</span></button>
          <div className="flex flex-col">
            <span className={`px-3 py-1 mb-1 w-fit rounded-full text-[8px] font-black uppercase tracking-widest text-white shadow-lg ${useIframe ? 'bg-amber-600' : 'bg-primary'}`}>{useIframe ? 'RELAY' : 'DIRECT'}</span>
            <h1 className="text-xl font-black text-white tracking-tighter line-clamp-1">{titleText} <span className="text-primary/60 ml-2">EP {currentEp?.number || '?'}</span></h1>
          </div>
        </div>
        <button onClick={() => setShowSidebar(true)} className="p-4 bg-white/5 hover:bg-white/10 backdrop-blur-3xl rounded-2xl border border-white/10 transition-all"><span className="material-symbols-outlined text-white">grid_view</span></button>
      </div>

      <main className="flex-1 relative bg-black flex items-center justify-center">
        {useIframe ? (
          <div className="w-full h-full relative">
            {iframeLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary mb-4"></div>
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Bridging Relay Server...</p>
              </div>
            )}
            <iframe 
               src={servers.find(s => s.name === activeServer)?.url || servers[0]?.url}
               className="w-full h-full border-none"
               allowFullScreen
               referrerPolicy="no-referrer"
               onLoad={() => setIframeLoading(false)}
               allow="autoplay; fullscreen"
            ></iframe>
          </div>
        ) : (
          <video 
            ref={videoRef} className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate} onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
            onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onClick={togglePlay}
          />
        )}

        {!useIframe && (
          <div className={`absolute bottom-0 left-0 right-0 p-8 pt-24 bg-gradient-to-t from-black via-black/70 to-transparent z-[100] transition-all duration-700 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
             <div className="relative w-full h-1.5 bg-white/10 rounded-full mb-8 group/seek flex items-center">
                <div className="absolute h-full bg-primary rounded-full shadow-[0_0_20px_rgba(168,85,247,0.8)]" style={{ width: `${progress}%` }}></div>
             </div>
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-10">
                  <button onClick={togglePlay} className="text-white hover:text-primary transition-all active:scale-90"><span className="material-symbols-outlined !text-4xl">{isPlaying ? 'pause_circle' : 'play_circle'}</span></button>
                  <div className="text-[10px] font-black text-slate-400 tracking-widest uppercase flex items-center gap-2">
                    <span className="text-white">{formatTime(videoRef.current?.currentTime || 0)}</span><span className="opacity-30">/</span><span>{formatTime(duration)}</span>
                  </div>
                </div>
                <button onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen(); else document.exitFullscreen(); }} className="text-white hover:text-primary transition-all"><span className="material-symbols-outlined !text-3xl">fullscreen</span></button>
             </div>
          </div>
        )}
      </main>

      <div className={`fixed right-0 top-0 h-full w-[380px] z-[200] bg-background-dark/98 backdrop-blur-3xl border-l border-white/10 transition-transform duration-700 p-10 flex flex-col shadow-[-40px_0_100px_rgba(0,0,0,0.8)] ${showSidebar ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between mb-12">
          <h3 className="text-2xl font-black text-white tracking-tighter uppercase">Episodes</h3>
          <button onClick={() => setShowSidebar(false)} className="size-10 flex items-center justify-center bg-white/5 rounded-xl border border-white/10 text-slate-500 hover:text-white transition-all"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="flex-1 overflow-y-auto hide-scrollbar space-y-3">
          {anime?.episodes?.map(ep => (
            <button
              key={ep.id} onClick={() => { navigate(`/watch/${ep.id}?animeId=${animeId}`); setShowSidebar(false); }}
              className={`w-full flex items-center gap-5 p-5 rounded-2xl transition-all border ${ep.id === episodeId ? 'bg-primary border-primary text-white shadow-xl' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:border-white/20'}`}
            >
              <div className={`size-8 rounded-lg flex items-center justify-center font-black ${ep.id === episodeId ? 'bg-white/20' : 'bg-white/10'}`}>{ep.number}</div>
              <p className="font-black text-xs text-left line-clamp-1 flex-1 uppercase tracking-tight">{ep.title || `Episode ${ep.number}`}</p>
            </button>
          ))}
        </div>
        <div className="mt-8 pt-8 border-t border-white/5">
           <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-4">Neural Relay Nodes</p>
           <div className="grid grid-cols-2 gap-2">
              {servers.map(s => (
                <button key={s.name} onClick={() => { setUseIframe(true); setActiveServer(s.name); fetchContent(true, s.name); }} className={`px-4 py-3 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all ${activeServer === s.name ? 'bg-primary/20 border-primary text-primary shadow-lg shadow-primary/10' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}>{s.name}</button>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Watch;
