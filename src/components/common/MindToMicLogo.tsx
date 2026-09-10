import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

interface MindToMicLogoProps {
  size?: number;
  className?: string;
  variant?: 'emblem' | 'full' | 'compact' | 'svg';
  showGlow?: boolean;
}

export const MindToMicLogo: React.FC<MindToMicLogoProps> = ({
  size = 48,
  className = '',
  variant = 'emblem',
  showGlow = false,
}) => {
  const { db } = useApp();
  const [imgError, setImgError] = useState(false);

  // Exact official logo: user custom uploaded logo if configured, or the official /logo.svg asset
  const logoSrc = db?.settings?.event?.customLogoUrl || '/logo.svg';

  return (
    <div className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}>
      {showGlow && (
        <div
          className="absolute rounded-full pointer-events-none opacity-40 blur-xl bg-gradient-to-tr from-cyan-500 via-purple-600 to-pink-500 -z-10"
          style={{ width: size * 1.3, height: size * 0.9 }}
        />
      )}
      <img
        src={imgError ? '/logo.svg' : logoSrc}
        alt="Mind to Mic"
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        style={{
          height: size,
          width: 'auto',
          maxHeight: size,
        }}
        className="object-contain drop-shadow-[0_4px_16px_rgba(147,51,234,0.45)] transition-transform duration-200"
      />

      {variant === 'full' && (
        <div className="flex flex-col items-center text-center mt-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-['Outfit'] font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 text-sm sm:text-base uppercase">
              MIND
            </span>
            <span className="text-purple-400 text-xs sm:text-sm font-bold opacity-80">―</span>
            <span className="font-['Outfit'] font-black tracking-wider text-amber-300 text-xs sm:text-sm uppercase">
              TO
            </span>
            <span className="text-purple-400 text-xs sm:text-sm font-bold opacity-80">―</span>
            <span className="font-['Outfit'] font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 text-sm sm:text-base uppercase">
              MIC
            </span>
          </div>
          <p className="font-mono text-[9px] sm:text-[10px] tracking-[0.22em] text-cyan-200/85 uppercase mt-0.5 font-bold">
            WHERE THOUGHTS FIND THEIR VOICE
          </p>
        </div>
      )}
    </div>
  );
};
