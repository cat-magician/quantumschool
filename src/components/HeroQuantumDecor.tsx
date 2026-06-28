export default function HeroQuantumDecor() {
  return (
    <div className="hero-quantum-decor absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* ── LEFT ── */}

      {/* Phase arc */}
      <div className="absolute top-[18%] left-[4%] hidden lg:block w-24 h-24 opacity-[0.27]">
        <svg viewBox="0 0 96 96" fill="none" className="w-full h-full animate-quantum-wobble [animation-duration:13s]">
          <path
            d="M48 78 A34 34 0 0 1 48 18"
            stroke="#60a5fa"
            strokeWidth="0.75"
            strokeDasharray="3 5"
            opacity="0.55"
          />
        </svg>
        <div className="absolute top-[18%] left-1/2 w-1.5 h-1.5 -translate-x-1/2 rounded-full bg-cyan-300 animate-quantum-lissajous-slow" />
      </div>

      {/* Superposition bracket */}
      <div className="absolute top-[12%] left-[7%] hidden md:block opacity-[0.24] animate-quantum-wobble [animation-duration:14s]">
        <svg width="52" height="38" viewBox="0 0 56 40" fill="none">
          <path d="M8 8 C8 20 8 20 8 32" stroke="#818cf8" strokeWidth="1" opacity="0.6" />
          <path d="M48 8 C48 20 48 20 48 32" stroke="#818cf8" strokeWidth="1" opacity="0.6" />
          <circle cx="28" cy="20" r="2" fill="#93c5fd" className="animate-quantum-lissajous [animation-duration:11s]" />
        </svg>
      </div>

      {/* Small hex — left upper-mid */}
      <div className="absolute top-[46%] left-[3%] hidden md:block w-14 h-14 opacity-[0.26] animate-quantum-spin-ease [animation-duration:24s]">
        <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
          <polygon
            points="50,8 88,28 88,72 50,92 12,72 12,28"
            stroke="#67e8f9"
            strokeWidth="1.2"
            opacity="0.55"
          />
        </svg>
      </div>

      {/* Vertical entangled pair */}
      <div className="absolute top-[38%] left-[5%] hidden sm:flex flex-col items-center gap-2 opacity-[0.32]">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-quantum-bob-a" />
        <div className="w-px h-9 bg-gradient-to-b from-cyan-400/55 to-purple-400/45 animate-quantum-link-pulse" />
        <div className="w-2 h-2 rounded-full bg-purple-400 animate-quantum-bob-b" />
      </div>

      {/* Interference fringes — left */}
      <div className="absolute top-[54%] left-[8%] hidden md:block w-28 h-14 opacity-[0.28]">
        <div className="absolute left-0 top-1/2 w-1.5 h-1.5 -translate-y-1/2 rounded-full bg-cyan-400 animate-quantum-wave-c" />
        <div className="absolute left-1/2 top-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400 animate-quantum-wave-b" />
        <div className="absolute right-0 top-1/2 w-1.5 h-1.5 -translate-y-1/2 rounded-full bg-violet-400 animate-quantum-wave-a" />
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 112 56" fill="none" opacity="0.4">
          <path
            d="M0 28 Q28 14 56 28 T112 28"
            stroke="#67e8f9"
            strokeWidth="0.75"
            strokeDasharray="4 6"
            className="animate-quantum-wobble [animation-duration:11s]"
          />
        </svg>
      </div>

      {/* Entanglement triangle */}
      <div className="absolute top-[66%] left-[4%] hidden lg:block w-16 h-14 opacity-[0.22]">
        <svg viewBox="0 0 64 56" className="w-full h-full" fill="none">
          <path d="M32 6 L8 50 L56 50 Z" stroke="#818cf8" strokeWidth="0.5" opacity="0.45" />
        </svg>
        <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-blue-400 animate-quantum-bob-a" />
        <div className="absolute bottom-0 left-0.5 w-1.5 h-1.5 rounded-full bg-violet-400 animate-quantum-bob-b [animation-delay:500ms]" />
        <div className="absolute bottom-0 right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-quantum-wave-a [animation-duration:5.5s]" />
      </div>

      {/* Hadamard gate hint — rotating diamond */}
      <div className="absolute top-[72%] left-[12%] hidden sm:block w-11 h-11 opacity-[0.23]">
        <div className="relative w-full h-full animate-quantum-spin-ease [animation-duration:28s]">
          <div className="absolute inset-1 border border-blue-400/45 rotate-45 animate-quantum-wobble [animation-duration:9s]" />
          <div className="absolute top-0 left-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-300 animate-quantum-lissajous [animation-duration:13s]" />
        </div>
      </div>

      {/* Bloch rings */}
      <div className="absolute bottom-[22%] left-[6%] hidden sm:block w-28 h-28 opacity-[0.3]">
        <div className="absolute inset-0 rounded-full border border-blue-400/45 animate-quantum-ring-pulse" />
        <div className="absolute inset-[18%] rounded-full border border-cyan-400/35 animate-quantum-ring-pulse [animation-delay:900ms]" />
        <div className="absolute inset-[36%] rounded-full border border-violet-400/30 animate-quantum-ring-pulse [animation-delay:1800ms]" />
        <div className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-300/90 animate-quantum-lissajous-slow" />
      </div>

      {/* Measurement axis — left edge */}
      <div className="absolute top-[44%] left-[2%] hidden xl:flex flex-col items-center gap-2.5 opacity-[0.24]">
        <div className="w-px h-12 bg-gradient-to-b from-transparent via-cyan-400/45 to-transparent animate-quantum-link-pulse" />
        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-quantum-bob-a" />
        <div className="w-px h-8 bg-gradient-to-b from-purple-400/35 to-transparent" />
      </div>

      {/* ── RIGHT ── */}

      {/* Entangled pair — horizontal */}
      <div className="absolute top-[20%] right-[18%] hidden lg:flex items-center gap-2.5 opacity-[0.38]">
        <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-quantum-bob-a" />
        <div className="relative w-10 h-px">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400/50 via-cyan-300/40 to-purple-400/50 animate-quantum-link-pulse" />
        </div>
        <div className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-quantum-bob-b" />
      </div>

      {/* RQC-style hex */}
      <div className="absolute top-[24%] right-[7%] hidden md:block w-20 h-20 opacity-[0.28] animate-quantum-spin-ease">
        <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
          <polygon
            points="50,8 88,28 88,72 50,92 12,72 12,28"
            stroke="url(#heroHexGrad)"
            strokeWidth="1"
            opacity="0.7"
          />
          <circle cx="50" cy="50" r="3" fill="#67e8f9" opacity="0.85" className="animate-quantum-lissajous" />
          <defs>
            <linearGradient id="heroHexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Interference fringes — right */}
      <div className="absolute top-[58%] right-[12%] hidden md:block w-32 h-16 opacity-[0.3]">
        <div className="absolute left-0 top-1/2 w-1.5 h-1.5 -translate-y-1/2 rounded-full bg-cyan-400 animate-quantum-wave-a" />
        <div className="absolute left-1/2 top-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400 animate-quantum-wave-b" />
        <div className="absolute right-0 top-1/2 w-1.5 h-1.5 -translate-y-1/2 rounded-full bg-violet-400 animate-quantum-wave-c" />
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 128 64" fill="none" opacity="0.45">
          <path
            d="M0 32 Q32 18 64 32 T128 32"
            stroke="#67e8f9"
            strokeWidth="0.75"
            strokeDasharray="4 6"
            className="animate-quantum-wobble"
          />
        </svg>
      </div>

      {/* Vertical measurement axis — right edge */}
      <div className="absolute top-[38%] right-[4%] hidden xl:flex flex-col items-center gap-3 opacity-[0.26]">
        <div className="w-px h-16 bg-gradient-to-b from-transparent via-blue-400/50 to-transparent animate-quantum-link-pulse" />
        <div className="w-2 h-2 rotate-45 border border-cyan-400/60 animate-quantum-bob-a" />
        <div className="w-px h-10 bg-gradient-to-b from-purple-400/40 to-transparent" />
      </div>
    </div>
  );
}
