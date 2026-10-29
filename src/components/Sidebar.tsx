
import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import Logo from './Logo';
import { User } from '../types';

interface SidebarProps {
  currentUser: User | null;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentUser, onLogout }) => {
  const location = useLocation();

  const navItems = [
    { name: 'Home', icon: 'home', path: '/' },
    { name: 'Trending', icon: 'trending_up', path: '/trending' },
    { name: 'My List', icon: 'add_box', path: '/watchlist' },
    { name: 'Favorites', icon: 'favorite', path: '/favorites' },
  ];

  const authItems = [
    { name: 'Login', icon: 'login', path: '/login' },
    { name: 'Sign Up', icon: 'person_add', path: '/signup' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Desktop & Smart TV Sidebar */}
      <aside className="hidden md:flex w-20 lg:w-64 flex-shrink-0 bg-background-dark border-r border-white/5 flex-col h-screen sticky top-0 z-50 transition-all overflow-y-auto hide-scrollbar">
        <div className="p-4 lg:p-8 flex flex-col items-center justify-center border-b border-white/5">
          <Link to="/" aria-label="Anilust Home">
            <Logo size="md" className="hidden lg:flex" />
            <Logo size="sm" showText={false} className="lg:hidden" />
          </Link>
        </div>

        <nav className="flex-1 px-3 lg:px-4 space-y-2 mt-8">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-4 lg:py-3 rounded-2xl transition-all group ${
                isActive(item.path)
                  ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-105'
                  : 'text-slate-500 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className={`material-symbols-outlined transition-transform group-hover:scale-110 ${isActive(item.path) ? 'fill-1' : ''}`}>
                {item.icon}
              </span>
              <p className="hidden lg:block text-sm font-black tracking-wide uppercase">{item.name}</p>
            </Link>
          ))}
        </nav>

        <div className="p-4 mt-auto space-y-4">
          {currentUser ? (
            <>
              <div className="hidden lg:block bg-gradient-to-br from-primary/20 to-transparent rounded-3xl p-6 border border-primary/20 relative overflow-hidden group">
                <div className="relative z-10">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Elite Node</p>
                  <p className="text-[11px] text-slate-400 mb-4 leading-relaxed font-bold">Access 4K Neural Streams</p>
                  <button className="w-full bg-primary text-white text-[10px] font-black py-3 rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 uppercase tracking-widest">Upgrade</button>
                </div>
              </div>

              <div className="flex items-center gap-3 px-3 py-3 bg-white/5 rounded-2xl border border-white/5 group cursor-pointer hover:bg-white/10 transition-colors">
                <div className="size-10 rounded-xl bg-slate-800 overflow-hidden border border-white/10 shrink-0 shadow-lg">
                  <img src={currentUser.avatar || "https://picsum.photos/seed/user/100/100"} alt="User" className="w-full h-full object-cover" />
                </div>
                <div className="hidden lg:block flex-1 min-w-0">
                  <p className="text-xs font-black truncate text-white">{currentUser.username}</p>
                  <p className="text-[9px] text-slate-500 truncate uppercase tracking-widest font-bold">{currentUser.role || 'Member'}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="hidden lg:block text-slate-500 hover:text-white transition-colors"
                  title="Logout"
                >
                  <span className="material-symbols-outlined !text-lg">logout</span>
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {authItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-3 rounded-2xl transition-all group ${
                    isActive(item.path)
                      ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-105'
                      : 'text-slate-500 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className={`material-symbols-outlined transition-transform group-hover:scale-110 ${isActive(item.path) ? 'fill-1' : ''}`}>
                    {item.icon}
                  </span>
                  <p className="hidden lg:block text-sm font-black tracking-wide uppercase">{item.name}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] glass-effect border-t border-white/10 px-6 pb-[var(--safe-area-inset-bottom)] pt-3 flex items-center justify-between">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center gap-1.5 px-3 py-2 transition-all ${
              isActive(item.path) ? 'text-primary scale-110' : 'text-slate-500'
            }`}
          >
            <span className={`material-symbols-outlined !text-2xl ${isActive(item.path) ? 'fill-1' : ''}`}>
              {item.icon}
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest">{item.name}</span>
            {isActive(item.path) && (
              <div className="size-1 bg-primary rounded-full animate-pulse mt-0.5"></div>
            )}
          </Link>
        ))}
      </nav>
    </>
  );
};

export default Sidebar;