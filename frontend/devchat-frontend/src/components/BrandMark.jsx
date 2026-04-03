export function BrandMark({ className = "", title = "DevChat" }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[24%] shadow-[0_16px_44px_rgba(6,182,212,0.18)] ${className}`}
      aria-label={title}
      title={title}
    >
      <svg viewBox="0 0 64 64" className="h-full w-full" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="devchat-bg" x1="8" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0E1324" />
            <stop offset="0.52" stopColor="#111827" />
            <stop offset="1" stopColor="#07111B" />
          </linearGradient>
          <linearGradient id="devchat-rim" x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#5865F2" />
            <stop offset="0.52" stopColor="#06B6D4" />
            <stop offset="1" stopColor="#10B981" />
          </linearGradient>
          <linearGradient id="devchat-glass" x1="18" y1="14" x2="47" y2="49" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.02)" />
          </linearGradient>
          <linearGradient id="devchat-chat" x1="18" y1="18" x2="48" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#5B6CFF" />
            <stop offset="0.54" stopColor="#06B6D4" />
            <stop offset="1" stopColor="#10B981" />
          </linearGradient>
        </defs>

        <rect width="64" height="64" rx="18" fill="url(#devchat-bg)" />
        <rect x="1.25" y="1.25" width="61.5" height="61.5" rx="17" stroke="url(#devchat-rim)" strokeOpacity="0.7" strokeWidth="1.5" />
        <path d="M11 15C11 12.7909 12.7909 11 15 11H49C51.2091 11 53 12.7909 53 15V25H11V15Z" fill="rgba(255,255,255,0.04)" />
        <circle cx="17" cy="18" r="1.7" fill="#F87171" />
        <circle cx="23" cy="18" r="1.7" fill="#FBBF24" />
        <circle cx="29" cy="18" r="1.7" fill="#34D399" />

        <rect x="12" y="13" width="40" height="38" rx="13" fill="rgba(2,6,23,0.9)" />
        <rect x="12" y="13" width="40" height="38" rx="13" fill="url(#devchat-glass)" />

        <path
          d="M20 24.5C20 21.4624 22.4624 19 25.5 19H38.5C41.5376 19 44 21.4624 44 24.5V31.5C44 34.5376 41.5376 37 38.5 37H31.8L26.2 41.8C25.1852 42.6701 23.6 41.9488 23.6 40.612V37.4C21.4723 36.6543 20 34.6286 20 32.3V24.5Z"
          fill="url(#devchat-chat)"
        />

        <path d="M27.5 25.5L23.8 29.2L27.5 32.9" stroke="#F8FAFC" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M36.5 25.5L40.2 29.2L36.5 32.9" stroke="#F8FAFC" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M33.5 24.3L30.9 34.2" stroke="#E2E8F0" strokeWidth="2.2" strokeLinecap="round" />

        <rect x="38" y="41.5" width="8.5" height="2.4" rx="1.2" fill="#34D399" />
        <circle cx="46.5" cy="18.5" r="2.4" fill="#10B981" />
      </svg>
    </div>
  );
}

export function BrandWordmark({ markClassName = "h-9 w-9", textClassName = "text-lg" }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark className={markClassName} />
      <span className={`font-bold tracking-tight text-white ${textClassName}`}>
        Dev<span className="gradient-text">Chat</span>
      </span>
    </div>
  );
}
