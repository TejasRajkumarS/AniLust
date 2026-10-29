
import React, { useState, useEffect } from 'react';
import { Anime } from '../types';
import AnimeCard from '../components/AnimeCard';

interface FavoritesProps {
  showToast: (msg: string) => void;
}

const Favorites: React.FC<FavoritesProps> = ({ showToast }) => {
  const [list, setList] = useState<Anime[]>([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('favorites') || '[]');
    setList(saved);
  }, []);

  const clearFavorites = () => {
    if (window.confirm("Are you sure you want to clear your favorites?")) {
      localStorage.setItem('favorites', '[]');
      setList([]);
      showToast("Favorites cleared");
    }
  };

  return (
    <div className="p-8 md:p-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div className="flex items-center gap-4">
          <div className="size-14 bg-yellow-500/10 rounded-[1.5rem] flex items-center justify-center border border-yellow-500/20">
            <span className="material-symbols-outlined !text-3xl text-yellow-500" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
          </div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight">Favorite Realm</h1>
            <p className="text-slate-500 font-medium">Your absolute top tier anime selection.</p>
          </div>
        </div>
        
        {list.length > 0 && (
          <button 
            onClick={clearFavorites}
            className="text-xs font-bold text-red-500 hover:text-red-400 flex items-center gap-2 bg-red-500/10 px-5 py-2.5 rounded-xl border border-red-500/20 transition-all"
          >
            <span className="material-symbols-outlined text-sm">heart_broken</span>
            CLEAR ALL
          </button>
        )}
      </div>

      <div className="mt-12">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="size-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mb-8 border border-white/10 relative">
              <div className="absolute inset-0 bg-yellow-500/5 blur-2xl rounded-full"></div>
              <span className="material-symbols-outlined text-5xl text-slate-700 relative z-10">favorite</span>
            </div>
            <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Heart is Empty</h2>
            <p className="text-slate-500 max-w-xs mx-auto mb-10">You haven't marked any series as favorites yet. Give some love to your top shows!</p>
            <button 
              onClick={() => window.location.hash = '#/'}
              className="bg-primary hover:bg-primary/90 text-white font-black px-12 py-5 rounded-2xl shadow-2xl shadow-primary/40 transition-all active:scale-95 text-xs tracking-widest uppercase"
            >
              Start Exploring
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-x-8 gap-y-12 animate-fade-in">
            {list.map(anime => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Favorites;
