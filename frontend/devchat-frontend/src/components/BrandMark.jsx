export function BrandMark({ className = "", title = "DevChat" }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[22%] gradient-animated shadow-[0_10px_30px_rgba(88,101,242,0.35)] ${className}`}
      aria-label={title}
      title={title}
    >
      <svg viewBox="0 0 64 64" className="h-full w-full" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="devchat-panel" x1="12" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.05)" />
          </linearGradient>
        </defs>
        <rect x="8.5" y="8.5" width="47" height="47" rx="16" fill="#0b1020" fillOpacity="0.82" />
        <rect x="8.5" y="8.5" width="47" height="47" rx="16" fill="url(#devchat-panel)" />
        <path
          d="M18 23.5c0-3.59 2.91-6.5 6.5-6.5h15c3.59 0 6.5 2.91 6.5 6.5v9c0 3.59-2.91 6.5-6.5 6.5H31l-7.2 6.1c-.87.74-2.2.12-2.2-1.02v-5.08A6.5 6.5 0 0 1 18 32.5z"
          fill="#0b1020"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1.3"
        />
        <path d="M29 25.5l-5.5 5.5 5.5 5.5" stroke="#8ea0ff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M35 25.5l5.5 5.5-5.5 5.5" stroke="#63dcff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M33.5 23.5l-3 15" stroke="#ffffff" strokeOpacity="0.88" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="46.5" cy="18.5" r="3" fill="#10b981" fillOpacity="0.95" />
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
