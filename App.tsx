
import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, Link } from 'react-router-dom';
import Sidebar from './components/Sidebar';
// Fix: Added missing import for Logo component
import Logo from './components/Logo';
import { consumetService } from './services/consumet';
import { Anime, User } from './types';

// Lazy load pages for code splitting
const Home = lazy(() => import('./pages/Home'));
const AnimeDetails = lazy(() => import('./pages/AnimeDetails'));
const Watch = lazy(() => import('./pages/Watch'));
const Watchlist = lazy(() => import('./pages/Watchlist'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Trending = lazy(() => import('./pages/Trending'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));

export const Toast: React.FC<{ message: string; show: boolean; onClose: () => void }> = ({ message, show, onClose }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[200] animate-bounce-in">
      <div className="glass-effect border border-primary/30 text-white px-6 py-3 rounded-2xl shadow-2xl shadow-primary/20 flex items-center gap-3">
        <span className="material-symbols-outlined text-primary">check_circle</span>
        <span className="font-bold text-sm tracking-tight">{message}</span>
      </div>
    </div>
  );
};

const HeaderSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isExpandedMobile, setIsExpandedMobile] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsExpandedMobile(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setLoading(true);
        setIsOpen(true);
        try {
          const data = await consumetService.search(query);
          setResults(data.results.slice(0, 6));
        } catch (err) {
          setResults([]);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
        if (query.length === 0) setIsOpen(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const handleResultClick = (id: string) => {
    navigate(`/info/${id}`);
    setIsOpen(false);
    setIsExpandedMobile(false);
    setQuery('');
  };

  return (
    <div className={`relative transition-all duration-300 ${isExpandedMobile ? 'fixed inset-x-0 top-0 bg-background-dark p-4 z-[110]' : 'w-full max-w-md'}`} ref={searchRef}>
      <div className="relative group flex items-center">
        {isExpandedMobile && (
          <button onClick={() => setIsExpandedMobile(false)} className="mr-3 text-slate-400">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        )}
        <div className="relative flex-1">
          <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${loading ? 'text-primary animate-pulse' : 'text-slate-500 group-focus-within:text-primary'}`}>
            {loading ? 'sync' : 'search'}
          </span>
          <input 
            type="text"
            className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-12 pr-6 text-sm text-white focus:ring-2 focus:ring-primary focus:bg-white/10 outline-none transition-all placeholder:text-slate-500"
            placeholder="Search Multiverse..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (query.length >= 2) setIsOpen(true);
              setIsExpandedMobile(true);
            }}
          />
        </div>
      </div>

      {isOpen && (query.length >= 2) && (
        <div className="absolute top-full mt-3 w-full bg-[#0a0a0a]/98 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden z-[110] animate-fade-in max-h-[70vh] overflow-y-auto">
          <div className="p-2">
            {loading && results.length === 0 ? (
              <div className="p-8 text-center">
                <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Scanning Nodes</p>
              </div>
            ) : results.length > 0 ? (
              <>
                {results.map((anime) => (
                  <button
                    key={anime.id}
                    onClick={() => handleResultClick(anime.id)}
                    className="w-full flex items-center gap-4 p-3 hover:bg-white/5 rounded-2xl transition-all group text-left"
                  >
                    <div className="size-14 rounded-xl overflow-hidden shrink-0 border border-white/5">
                      <img src={anime.image} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-white truncate group-hover:text-primary transition-colors">
                        {typeof anime.title === 'string' ? anime.title : anime.title.english || anime.title.romaji}
                      </h4>
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">{anime.type || 'TV'}</p>
                    </div>
                  </button>
                ))}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

const MainLayout: React.FC<{ children: React.ReactNode; currentUser: User | null; onLogout: () => void }> = ({ children, currentUser, onLogout }) => {
  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar currentUser={currentUser} onLogout={onLogout} />
      <div className="flex-1 flex flex-col relative h-screen overflow-hidden">
        <header className="sticky top-0 right-0 px-4 md:px-8 py-4 md:py-6 flex items-center justify-between gap-4 z-40 bg-gradient-to-b from-background-dark via-background-dark/90 to-transparent backdrop-blur-md">
          <div className="md:hidden">
            <Link to="/"><Logo size="sm" showText={false} /></Link>
          </div>
          <div className="flex-1 flex justify-center md:justify-start">
            <HeaderSearch />
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            <button className="size-10 md:size-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
              <span className="material-symbols-outlined !text-xl md:!text-2xl">notifications</span>
            </button>
            <div className="size-10 rounded-xl bg-slate-800 border border-primary/20 overflow-hidden shrink-0 hidden sm:block">
              <img src="https://picsum.photos/seed/user1/100/100" alt="Profile" className="w-full h-full object-cover" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto hide-scrollbar pb-24 md:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [toast, setToast] = useState({ show: false, message: '' });
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('anilust_current_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const showToast = (message: string) => setToast({ show: true, message });

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    showToast(`Welcome back, ${user.username}!`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('anilust_current_user');
    showToast('Logged out successfully');
  };

  return (
    <Router>
      <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary"></div></div>}>
        <Routes>
          <Route path="/" element={<MainLayout><Home showToast={showToast} /></MainLayout>} />
          <Route path="/info/:id" element={<MainLayout><AnimeDetails showToast={showToast} /></MainLayout>} />
          <Route path="/watchlist" element={<MainLayout><Watchlist showToast={showToast} /></MainLayout>} />
          <Route path="/favorites" element={<MainLayout><Favorites showToast={showToast} /></MainLayout>} />
          <Route path="/trending" element={<MainLayout><Trending /></MainLayout>} />
          <Route path="/watch/:episodeId" element={<MainLayout currentUser={currentUser} onLogout={handleLogout}><Watch /></MainLayout>} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/signup" element={<Signup onLogin={handleLogin} />} />
        </Routes>
      </Suspense>
      <Toast show={toast.show} message={toast.message} onClose={() => setToast({ ...toast, show: false })} />
    </Router>
  );
};

export default App;
