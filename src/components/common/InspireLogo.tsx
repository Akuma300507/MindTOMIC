import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

interface InspireLogoProps {
  size?: number; // Approximate height in pixels (default 76)
  className?: string;
  showGlow?: boolean;
}

export const InspireLogo: React.FC<InspireLogoProps> = ({
  size = 76,
  className = '',
  showGlow = true,
}) => {
  const { db } = useApp();
  const customInspireUrl = db?.settings?.event?.inspireLogoUrl || '/uploads/inspire-logo.svg';
  const [hasImgError, setHasImgError] = useState(false);

  // Aspect ratio is approx 3.125 : 1 (1000 x 320)
  const width = Math.round(size * 3.125);

  if (customInspireUrl && !hasImgError) {
    return (
      <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
        {showGlow && (
          <div
            className="absolute rounded-full pointer-events-none opacity-60 blur-2xl bg-gradient-to-r from-amber-500/35 via-orange-500/25 to-yellow-500/35 -z-10"
            style={{ width: width * 1.15, height: size * 1.35 }}
          />
        )}
        <img
          src={customInspireUrl}
          alt="Inspire 2K26 - The Arcade Archives"
          referrerPolicy="no-referrer"
          onError={() => setHasImgError(true)}
          style={{ height: size, width: 'auto', maxHeight: size }}
          className="object-contain drop-shadow-[0_8px_24px_rgba(245,158,11,0.45)] transition-all duration-300"
        />
      </div>
    );
  }

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      {showGlow && (
        <div
          className="absolute rounded-full pointer-events-none opacity-60 blur-2xl bg-gradient-to-r from-amber-600/30 via-orange-500/25 to-yellow-500/30 -z-10"
          style={{ width: width * 1.05, height: size * 1.25 }}
        />
      )}

      <svg
        viewBox="0 0 960 300"
        style={{ height: size, width: width, maxHeight: size }}
        className="object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.85)] filter"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Metallic Industrial Gradients */}
          <linearGradient id="inspire-brass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="25%" stopColor="#eab308" />
            <stop offset="60%" stopColor="#ca8a04" />
            <stop offset="100%" stopColor="#854d0e" />
          </linearGradient>

          <linearGradient id="inspire-crane" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fdba74" />
            <stop offset="40%" stopColor="#ea580c" />
            <stop offset="80%" stopColor="#c2410c" />
            <stop offset="100%" stopColor="#7c2d12" />
          </linearGradient>

          <linearGradient id="inspire-pipe" x1="0%" y1="0%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#fed7aa" />
            <stop offset="30%" stopColor="#f59e0b" />
            <stop offset="70%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#451a03" />
          </linearGradient>

          <linearGradient id="inspire-monitor-casing" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="40%" stopColor="#eab308" />
            <stop offset="85%" stopColor="#a16207" />
            <stop offset="100%" stopColor="#713f12" />
          </linearGradient>

          <linearGradient id="inspire-screen" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#022c22" />
            <stop offset="50%" stopColor="#064e3b" />
            <stop offset="100%" stopColor="#022c22" />
          </linearGradient>

          <linearGradient id="inspire-gold-border" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="35%" stopColor="#f59e0b" />
            <stop offset="70%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#fde047" />
          </linearGradient>

          <linearGradient id="inspire-dark-chassis" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#27272a" />
            <stop offset="50%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#09090b" />
          </linearGradient>

          {/* Glow Filters */}
          <filter id="green-terminal-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="bulb-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ------------------------------------------------------------- */}
        {/* LETTER I: Industrial 026 Digital Gauge with Brass Bolted Rim */}
        {/* ------------------------------------------------------------- */}
        <g id="letter-I-gauge">
          {/* Main vertical plate */}
          <rect x="25" y="20" width="85" height="175" rx="16" fill="url(#inspire-brass)" stroke="#451a03" strokeWidth="4" />
          <rect x="33" y="28" width="69" height="159" rx="12" fill="#18181b" stroke="#78350f" strokeWidth="2" />
          
          {/* Screws / rivets */}
          <circle cx="35" cy="30" r="3" fill="#fef08a" stroke="#451a03" />
          <circle cx="99" cy="30" r="3" fill="#fef08a" stroke="#451a03" />
          <circle cx="35" cy="185" r="3" fill="#fef08a" stroke="#451a03" />
          <circle cx="99" cy="185" r="3" fill="#fef08a" stroke="#451a03" />

          {/* 3 Digital LED segment cells: '0', '2', '6' */}
          <g transform="translate(42, 38)">
            {/* Box 1: '0' */}
            <rect x="0" y="0" width="51" height="34" rx="4" fill="#052e16" stroke="#22c55e" strokeWidth="1.5" />
            <text x="25" y="26" fill="#4ade80" fontFamily="JetBrains Mono, monospace" fontSize="24" fontWeight="bold" textAnchor="middle" filter="url(#green-terminal-glow)">
              0
            </text>

            {/* Box 2: '2' */}
            <rect x="0" y="42" width="51" height="34" rx="4" fill="#052e16" stroke="#22c55e" strokeWidth="1.5" />
            <text x="25" y="68" fill="#4ade80" fontFamily="JetBrains Mono, monospace" fontSize="24" fontWeight="bold" textAnchor="middle" filter="url(#green-terminal-glow)">
              2
            </text>

            {/* Box 3: '6' */}
            <rect x="0" y="84" width="51" height="34" rx="4" fill="#052e16" stroke="#22c55e" strokeWidth="1.5" />
            <text x="25" y="110" fill="#4ade80" fontFamily="JetBrains Mono, monospace" fontSize="24" fontWeight="bold" textAnchor="middle" filter="url(#green-terminal-glow)">
              6
            </text>
          </g>

          {/* Amber indicator button at bottom of gauge */}
          <circle cx="67" cy="165" r="12" fill="#d97706" stroke="#78350f" strokeWidth="2" />
          <circle cx="67" cy="165" r="8" fill="#f59e0b" />
          <circle cx="65" cy="163" r="3" fill="#fef08a" />
        </g>

        {/* ------------------------------------------------------------- */}
        {/* LETTER N: Industrial Steel Construction Crane Tower */}
        {/* ------------------------------------------------------------- */}
        <g id="letter-N-crane">
          {/* Left Vertical Truss Column */}
          <rect x="135" y="30" width="28" height="165" fill="url(#inspire-crane)" stroke="#431407" strokeWidth="3" />
          {/* Diagonal girder lines */}
          <line x1="135" y1="35" x2="163" y2="60" stroke="#fef08a" strokeWidth="2.5" />
          <line x1="163" y1="60" x2="135" y2="85" stroke="#fef08a" strokeWidth="2.5" />
          <line x1="135" y1="85" x2="163" y2="110" stroke="#fef08a" strokeWidth="2.5" />
          <line x1="163" y1="110" x2="135" y2="135" stroke="#fef08a" strokeWidth="2.5" />
          <line x1="135" y1="135" x2="163" y2="160" stroke="#fef08a" strokeWidth="2.5" />
          <line x1="163" y1="160" x2="135" y2="185" stroke="#fef08a" strokeWidth="2.5" />

          {/* Right Leg */}
          <rect x="235" y="80" width="28" height="115" fill="url(#inspire-crane)" stroke="#431407" strokeWidth="3" />
          <line x1="235" y1="85" x2="263" y2="110" stroke="#fef08a" strokeWidth="2.5" />
          <line x1="263" y1="110" x2="235" y2="135" stroke="#fef08a" strokeWidth="2.5" />
          <line x1="235" y1="135" x2="263" y2="160" stroke="#fef08a" strokeWidth="2.5" />
          <line x1="263" y1="160" x2="235" y2="185" stroke="#fef08a" strokeWidth="2.5" />

          {/* Diagonal Strut forming N */}
          <path d="M 158 35 L 240 185 L 260 180 L 175 30 Z" fill="url(#inspire-crane)" stroke="#431407" strokeWidth="3" />
          <line x1="165" y1="45" x2="245" y2="175" stroke="#fef08a" strokeWidth="3" strokeDasharray="6 4" />

          {/* Top Crane Horizontal Boom & Cabin */}
          <rect x="125" y="14" width="135" height="18" rx="3" fill="url(#inspire-crane)" stroke="#431407" strokeWidth="2" />
          <line x1="130" y1="23" x2="255" y2="23" stroke="#fef08a" strokeWidth="2" />
          {/* Hoist Pulley & Hook */}
          <circle cx="215" cy="36" r="5" fill="#f59e0b" stroke="#78350f" />
          <line x1="215" y1="41" x2="215" y2="60" stroke="#94a3b8" strokeWidth="2" />
          <path d="M 210 60 C 210 70, 222 70, 220 62" fill="none" stroke="#f59e0b" strokeWidth="3" />
        </g>

        {/* ------------------------------------------------------------- */}
        {/* LETTER S: Steampunk Curved Brass Pressure Pipes & Valve */}
        {/* ------------------------------------------------------------- */}
        <g id="letter-S-pipes">
          {/* S-shaped sweeping pipe paths */}
          <path
            d="M 395 55 C 395 20, 310 20, 310 75 C 310 120, 405 95, 405 145 C 405 195, 305 195, 305 155"
            fill="none"
            stroke="url(#inspire-pipe)"
            strokeWidth="38"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Inner core highlights */}
          <path
            d="M 395 55 C 395 20, 310 20, 310 75 C 310 120, 405 95, 405 145 C 405 195, 305 195, 305 155"
            fill="none"
            stroke="#fef08a"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.75"
          />

          {/* Bolted Flange Collars */}
          <rect x="365" y="22" width="12" height="42" rx="2" fill="#78350f" stroke="#fef08a" strokeWidth="1.5" />
          <rect x="295" y="65" width="12" height="42" rx="2" fill="#78350f" stroke="#fef08a" strokeWidth="1.5" />
          <rect x="355" y="105" width="42" height="12" rx="2" fill="#78350f" stroke="#fef08a" strokeWidth="1.5" />
          <rect x="305" y="145" width="12" height="42" rx="2" fill="#78350f" stroke="#fef08a" strokeWidth="1.5" />

          {/* Brass Spoke Valve Wheel */}
          <g transform="translate(390, 140)">
            <circle cx="0" cy="0" r="22" fill="none" stroke="#eab308" strokeWidth="4" />
            <circle cx="0" cy="0" r="19" fill="none" stroke="#78350f" strokeWidth="2" />
            <circle cx="0" cy="0" r="6" fill="#fef08a" stroke="#451a03" strokeWidth="2" />
            <line x1="-18" y1="0" x2="18" y2="0" stroke="#fef08a" strokeWidth="3" />
            <line x1="0" y1="-18" x2="0" y2="18" stroke="#fef08a" strokeWidth="3" />
            <line x1="-13" y1="-13" x2="13" y2="13" stroke="#fef08a" strokeWidth="3" />
            <line x1="-13" y1="13" x2="13" y2="-13" stroke="#fef08a" strokeWidth="3" />
          </g>
        </g>

        {/* ------------------------------------------------------------- */}
        {/* LETTER P: Yellow Retro CRT Monitor & Circuit Board */}
        {/* ------------------------------------------------------------- */}
        <g id="letter-P-monitor">
          {/* Main Monitor Housing */}
          <rect x="440" y="24" width="145" height="125" rx="20" fill="url(#inspire-monitor-casing)" stroke="#713f12" strokeWidth="4" />
          
          {/* CRT Screen Bezel & Screen */}
          <rect x="458" y="40" width="110" height="85" rx="14" fill="#022c22" stroke="#451a03" strokeWidth="3" />
          <rect x="462" y="44" width="102" height="77" rx="10" fill="url(#inspire-screen)" />

          {/* Phosphor Terminal Scanlines & Text */}
          <line x1="465" y1="52" x2="560" y2="52" stroke="#052e16" strokeWidth="1" />
          <line x1="465" y1="62" x2="560" y2="62" stroke="#052e16" strokeWidth="1" />
          <line x1="465" y1="72" x2="560" y2="72" stroke="#052e16" strokeWidth="1" />
          <line x1="465" y1="82" x2="560" y2="82" stroke="#052e16" strokeWidth="1" />
          <line x1="465" y1="92" x2="560" y2="92" stroke="#052e16" strokeWidth="1" />

          <text x="470" y="64" fill="#4ade80" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="bold" filter="url(#green-terminal-glow)">
            &gt; SYSTEM
          </text>
          <text x="480" y="80" fill="#4ade80" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="bold" filter="url(#green-terminal-glow)">
            INSPIRE
          </text>
          <text x="480" y="96" fill="#4ade80" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="bold" filter="url(#green-terminal-glow)">
            READY.
          </text>

          {/* Under-Monitor Green PCB Motherboard with Microchips */}
          <rect x="446" y="152" width="75" height="60" rx="6" fill="#065f46" stroke="#047857" strokeWidth="2" />
          {/* Microchip */}
          <rect x="460" y="162" width="28" height="28" rx="3" fill="#18181b" stroke="#facc15" strokeWidth="1.5" />
          <line x1="474" y1="166" x2="474" y2="186" stroke="#facc15" strokeWidth="1.5" />
          <line x1="464" y1="176" x2="484" y2="176" stroke="#facc15" strokeWidth="1.5" />
          {/* Gold PCB Traces */}
          <line x1="492" y1="168" x2="515" y2="168" stroke="#facc15" strokeWidth="1.5" />
          <line x1="492" y1="176" x2="515" y2="176" stroke="#facc15" strokeWidth="1.5" />
          <line x1="492" y1="184" x2="515" y2="184" stroke="#facc15" strokeWidth="1.5" />

          {/* Conduit cable bracket connecting to next module */}
          <path d="M 521 176 L 555 176 L 555 190 L 590 190" fill="none" stroke="#f59e0b" strokeWidth="3" />
        </g>

        {/* ------------------------------------------------------------- */}
        {/* LETTER I: High-Voltage Coil with Glowing Edison Bulb & Lightning */}
        {/* ------------------------------------------------------------- */}
        <g id="letter-I-coil">
          {/* Glowing Edison Bulb on Top */}
          <circle cx="638" cy="40" r="17" fill="#fef08a" opacity="0.9" filter="url(#bulb-glow)" />
          <circle cx="638" cy="40" r="12" fill="#fff" opacity="0.95" />
          {/* Filament inside bulb */}
          <path d="M 633 46 L 636 34 L 640 34 L 643 46" fill="none" stroke="#ea580c" strokeWidth="1.5" />

          {/* Coil Insulator Ribs */}
          <rect x="620" y="58" width="36" height="8" rx="2" fill="#d97706" stroke="#78350f" strokeWidth="1.5" />
          <rect x="622" y="68" width="32" height="8" rx="2" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" />
          <rect x="620" y="78" width="36" height="8" rx="2" fill="#d97706" stroke="#78350f" strokeWidth="1.5" />
          <rect x="622" y="88" width="32" height="8" rx="2" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" />
          <rect x="620" y="98" width="36" height="8" rx="2" fill="#d97706" stroke="#78350f" strokeWidth="1.5" />

          {/* Lower Transformer Bronze Base with Lightning Bolt */}
          <rect x="605" y="112" width="66" height="82" rx="8" fill="url(#inspire-brass)" stroke="#451a03" strokeWidth="3" />
          <rect x="613" y="120" width="50" height="66" rx="4" fill="#18181b" stroke="#78350f" strokeWidth="1.5" />

          {/* Lightning Bolt Emblem */}
          <path
            d="M 641 128 L 629 152 L 638 152 L 632 174 L 648 147 L 639 147 Z"
            fill="#facc15"
            stroke="#eab308"
            strokeWidth="1"
            filter="url(#bulb-glow)"
          />
        </g>

        {/* ------------------------------------------------------------- */}
        {/* LETTER R: Steampunk Gearbox & Mechanical Pinions */}
        {/* ------------------------------------------------------------- */}
        <g id="letter-R-gears">
          {/* Main Top Large Gear */}
          <g transform="translate(735, 75)">
            <circle cx="0" cy="0" r="42" fill="url(#inspire-pipe)" stroke="#451a03" strokeWidth="3" />
            <circle cx="0" cy="0" r="30" fill="#18181b" stroke="#eab308" strokeWidth="2" />
            <circle cx="0" cy="0" r="14" fill="url(#inspire-brass)" stroke="#451a03" strokeWidth="2" />
            
            {/* Gear teeth */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
              <rect
                key={deg}
                x="-5"
                y="-48"
                width="10"
                height="10"
                rx="1"
                fill="#f59e0b"
                stroke="#451a03"
                transform={`rotate(${deg})`}
              />
            ))}
          </g>

          {/* Interlocking Secondary Cog */}
          <g transform="translate(710, 135)">
            <circle cx="0" cy="0" r="24" fill="url(#inspire-brass)" stroke="#451a03" strokeWidth="2" />
            <circle cx="0" cy="0" r="10" fill="#18181b" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <rect
                key={deg}
                x="-4"
                y="-28"
                width="8"
                height="7"
                fill="#eab308"
                stroke="#78350f"
                transform={`rotate(${deg})`}
              />
            ))}
          </g>

          {/* Right Leg of R (Mechanical Linkage Arm) */}
          <path d="M 735 90 L 778 185 L 755 190 L 715 110 Z" fill="url(#inspire-pipe)" stroke="#451a03" strokeWidth="3" />
          <circle cx="765" cy="180" r="9" fill="#fef08a" stroke="#451a03" strokeWidth="2" />
        </g>

        {/* ------------------------------------------------------------- */}
        {/* LETTER E: Concrete Wall, Rebar Cage, Theodolite & Cement Mixer */}
        {/* ------------------------------------------------------------- */}
        <g id="letter-E-engineering">
          {/* Main Stone / Concrete Pillar with Reinforcement */}
          <rect x="825" y="24" width="105" height="170" rx="8" fill="#71717a" stroke="#27272a" strokeWidth="3" />
          {/* Stone block cracks and lines */}
          <line x1="825" y1="75" x2="930" y2="75" stroke="#3f3f46" strokeWidth="2" />
          <line x1="825" y1="125" x2="930" y2="125" stroke="#3f3f46" strokeWidth="2" />
          <line x1="875" y1="24" x2="875" y2="75" stroke="#3f3f46" strokeWidth="1.5" />
          <line x1="860" y1="75" x2="860" y2="125" stroke="#3f3f46" strokeWidth="1.5" />
          <line x1="895" y1="125" x2="895" y2="194" stroke="#3f3f46" strokeWidth="1.5" />

          {/* Rebar Steel Cage Outer Bars */}
          <line x1="835" y1="24" x2="835" y2="194" stroke="#eab308" strokeWidth="3" />
          <line x1="845" y1="24" x2="845" y2="194" stroke="#eab308" strokeWidth="2" strokeDasharray="6 3" />
          <line x1="920" y1="24" x2="920" y2="194" stroke="#eab308" strokeWidth="3" />

          {/* Surveyor Tripod & Optical Theodolite */}
          <g transform="translate(835, 110)">
            {/* Optical Theodolite head */}
            <rect x="-8" y="-20" width="16" height="14" rx="2" fill="#facc15" stroke="#451a03" strokeWidth="1.5" />
            <line x1="-12" y1="-14" x2="12" y2="-14" stroke="#451a03" strokeWidth="2" />
            <circle cx="0" cy="-14" r="3" fill="#0284c7" />
            {/* Tripod legs */}
            <line x1="-3" y1="-6" x2="-14" y2="55" stroke="#e2e8f0" strokeWidth="2.5" />
            <line x1="0" y1="-6" x2="0" y2="55" stroke="#e2e8f0" strokeWidth="2.5" />
            <line x1="3" y1="-6" x2="14" y2="55" stroke="#e2e8f0" strokeWidth="2.5" />
          </g>

          {/* Yellow Vintage Cement Mixer Barrel at Bottom Right */}
          <g transform="translate(895, 155)">
            <ellipse cx="0" cy="0" rx="22" ry="18" fill="#facc15" stroke="#713f12" strokeWidth="3" transform="rotate(-25)" />
            <line x1="-10" y1="-8" x2="12" y2="-8" stroke="#713f12" strokeWidth="2" transform="rotate(-25)" />
            {/* Mixer stand and wheels */}
            <line x1="-12" y1="12" x2="-18" y2="28" stroke="#18181b" strokeWidth="3" />
            <line x1="10" y1="14" x2="14" y2="28" stroke="#18181b" strokeWidth="3" />
            <circle cx="-18" cy="28" r="6" fill="#f59e0b" stroke="#18181b" strokeWidth="2" />
            <circle cx="14" cy="28" r="6" fill="#f59e0b" stroke="#18181b" strokeWidth="2" />
          </g>
        </g>

        {/* ============================================================= */}
        {/* LOWER INDUSTRIAL CHASSIS, 2K26 BADGE & THE ARCADE ARCHIVES */}
        {/* ============================================================= */}
        {/* Heavy Pipeline linking from the bottom of letters */}
        <path
          d="M 60 195 L 60 225 L 375 225 L 415 200 L 585 200 L 625 225 L 910 225 L 910 195"
          fill="none"
          stroke="url(#inspire-pipe)"
          strokeWidth="14"
          strokeLinejoin="round"
        />
        <path
          d="M 60 195 L 60 225 L 375 225 L 415 200 L 585 200 L 625 225 L 910 225 L 910 195"
          fill="none"
          stroke="#fef08a"
          strokeWidth="2.5"
          strokeLinejoin="round"
          opacity="0.8"
        />

        {/* Main Central Chamfered Plaque */}
        <g id="center-2k26-plaque">
          {/* Heavy Beveled Bronze Outer Frame */}
          <polygon
            points="240,240 270,215 720,215 750,240 700,285 290,285"
            fill="url(#inspire-dark-chassis)"
            stroke="url(#inspire-gold-border)"
            strokeWidth="5"
          />

          {/* Top '2K26' Stencil Plaque */}
          <polygon
            points="420,200 440,188 560,188 580,200 570,226 430,226"
            fill="#18181b"
            stroke="url(#inspire-gold-border)"
            strokeWidth="3.5"
          />
          <text
            x="500"
            y="218"
            fill="url(#inspire-brass)"
            fontFamily="Outfit, JetBrains Mono, sans-serif"
            fontSize="26"
            fontWeight="900"
            letterSpacing="3"
            textAnchor="middle"
          >
            2K26
          </text>

          {/* 'THE ARCADE ARCHIVES' Title */}
          <text
            x="500"
            y="254"
            fill="url(#inspire-brass)"
            fontFamily="Outfit, sans-serif"
            fontSize="22"
            fontWeight="900"
            letterSpacing="6"
            textAnchor="middle"
          >
            THE ARCADE ARCHIVES
          </text>

          {/* Subtitle Pill Banner: 'UNEARTH THE EXTRAORDINARY' */}
          <g transform="translate(500, 272)">
            <rect x="-140" y="-10" width="280" height="18" rx="9" fill="#09090b" stroke="#78350f" strokeWidth="1.5" />
            <circle cx="-130" cy="-1" r="2.5" fill="#facc15" />
            <circle cx="130" cy="-1" r="2.5" fill="#facc15" />
            <text
              x="0"
              y="3"
              fill="#fde047"
              fontFamily="Outfit, monospace, sans-serif"
              fontSize="10"
              fontWeight="800"
              letterSpacing="2.5"
              textAnchor="middle"
            >
              UNEARTH THE EXTRAORDINARY
            </text>
          </g>

          {/* Right Side LED VU Bar Meter on Conduit */}
          <g transform="translate(775, 230)">
            <rect x="0" y="0" width="95" height="12" rx="3" fill="#09090b" stroke="#3f3f46" strokeWidth="1" />
            {/* Green LEDs */}
            <rect x="5" y="3" width="7" height="6" rx="1" fill="#22c55e" />
            <rect x="15" y="3" width="7" height="6" rx="1" fill="#22c55e" />
            <rect x="25" y="3" width="7" height="6" rx="1" fill="#22c55e" />
            <rect x="35" y="3" width="7" height="6" rx="1" fill="#22c55e" />
            {/* Yellow / Amber LEDs */}
            <rect x="45" y="3" width="7" height="6" rx="1" fill="#eab308" />
            <rect x="55" y="3" width="7" height="6" rx="1" fill="#eab308" />
            <rect x="65" y="3" width="7" height="6" rx="1" fill="#f97316" />
            {/* Red Peak LEDs */}
            <rect x="75" y="3" width="7" height="6" rx="1" fill="#ef4444" />
            <rect x="85" y="3" width="7" height="6" rx="1" fill="#ef4444" />
          </g>
        </g>
      </svg>
    </div>
  );
};
