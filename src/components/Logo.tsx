
import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const Logo: React.FC<LogoProps> = ({ className = '', showText = true, size = 'md' }) => {
  const dimensions = {
    sm: { icon: 'w-8 h-8', text: 'text-lg' },
    md: { icon: 'w-10 h-10', text: 'text-xl' },
    lg: { icon: 'w-24 h-24', text: 'text-4xl' },
  }[size];

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {/* Stylized AL Mark */}
      <div className={`${dimensions.icon} relative flex items-center justify-center`}>
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]">
          {/* Main A Structure */}
          <path d="M35 85L50 45L65 85" stroke="#444" strokeWidth="12" strokeLinecap="round" />
          <path d="M50 15L75 65H25L50 15Z" fill="url(#al_purple_grad)" />
          
          {/* Overlapping L Structure */}
          <path d="M55 35V85H90" stroke="#222" strokeWidth="14" strokeLinecap="square" />
          <path d="M55 35V85H90" stroke="#333" strokeWidth="10" strokeLinecap="square" />
          
          <defs>
            <linearGradient id="al_purple_grad" x1="50" y1="15" x2="50" y2="65" gradientUnits="userSpaceOnUse">
              <stop stopColor="#a855f7" />
              <stop offset="1" stopColor="#6b21a8" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* ANILUST Logotype */}
      {showText && (
        <div className={`font-black tracking-[0.2em] uppercase flex items-center ${dimensions.text}`}>
          <div className="relative">
            <span className="text-white/80">A</span>
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-yellow-500"></div>
          </div>
          <span className="text-white/80">NI</span>
          <span className="text-primary">L</span>
          <span className="text-white/80">UST</span>
        </div>
      )}
    </div>
  );
};

export default Logo;
