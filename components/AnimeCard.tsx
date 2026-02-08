
import React from 'react';
import { Link } from 'react-router-dom';
import { Anime } from '../types';

interface AnimeCardProps {
  anime: Anime;
  variant?: 'vertical' | 'horizontal';
  progress?: { 
    watched: number; 
    total: number; 
    lastWatchedNumber?: number;
    percent?: number;
  };
}

const AnimeCard: React.FC<AnimeCardProps> = ({ anime, variant = 'vertical', progress }) => {
  const title = typeof anime.title === 'string' ? anime.title : anime.title.english || anime.title.romaji || 'Unknown Title';
  const isFinished = progress && progress.percent === 100;

  if (variant === 'horizontal') {
    return (
      <Link to={`/info/${anime.id}`} className="group bg-card-dark rounded-2xl p-3 md:p-4 flex gap-4 md:gap-5 hover:bg-accent-dark transition-all duration-300 border border-white/5 hover:border-white/10 relative overflow-hidden focus-visible:ring-4 focus-visible:ring-primary outline-none">
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden flex-shrink-0 relative shadow-2xl">
          <img 
            src={anime.image} 
            alt={title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="flex-1 py-1 min-w-0 flex flex-col justify-center">
          <h4 className="font-black text-sm text-white truncate mb-1 group-hover:text-primary transition-colors">{title}</h4>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] text-primary font-black uppercase tracking-widest bg-primary/10 px-1.5 py-0.5 rounded">
              {anime.type || 'TV'}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 line-clamp-1 uppercase font-bold tracking-widest">{anime.status}</p>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/info/${anime.id}`} className="flex-none w-[160px] sm:w-48 group cursor-pointer animate-fade-in focus-visible:ring-4 focus-visible:ring-primary outline-none rounded-3xl">
      <div className="relative aspect-[3/4.2] rounded-[1.5rem] sm:rounded-[1.8rem] overflow-hidden mb-3 md:mb-4 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)] transition-all duration-500 lg:group-hover:-translate-y-2 lg:group-hover:shadow-[0_30px_60px_-15px_rgba(168,85,247,0.3)] border border-white/5">
        <img 
          src={anime.image} 
          alt={title} 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 lg:group-hover:scale-110" 
          loading="lazy"
          decoding="async"
        />
        
        {/* Rating Overlay */}
        <div className="absolute top-2 left-2 md:top-3 md:left-3 px-2 py-0.5 md:px-2.5 md:py-1 bg-black/60 backdrop-blur-xl rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black text-white flex items-center gap-1 border border-white/10">
          <span className="material-symbols-outlined text-[12px] md:text-[14px] text-yellow-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span> 
          {anime.rating ? (anime.rating / 10).toFixed(1) : '8.5'}
        </div>

        {/* Play Icon for TV/Hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 lg:group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="size-12 md:size-14 rounded-full bg-primary/20 backdrop-blur-md border border-primary/40 flex items-center justify-center scale-75 group-hover:scale-100 transition-transform">
                <span className="material-symbols-outlined !text-3xl text-white">play_arrow</span>
            </div>
        </div>
      </div>

      <div className="px-1">
        <h4 className="font-black text-xs md:text-sm truncate text-white group-hover:text-primary transition-colors mb-0.5 md:mb-1">{title}</h4>
        <div className="flex items-center justify-between">
           <p className="text-[9px] text-slate-500 font-bold tracking-widest uppercase">{anime.type || 'TV Series'}</p>
        </div>
        
        {progress && progress.total > 0 && (
          <div className="mt-2 md:mt-3 pt-1 md:pt-2 border-t border-white/5">
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${isFinished ? 'bg-green-500' : 'bg-primary'}`} 
                style={{ width: `${Math.min(100, progress.percent || 0)}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
};

export default AnimeCard;