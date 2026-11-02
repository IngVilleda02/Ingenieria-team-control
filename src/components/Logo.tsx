/** Logo de Ingeniería Team Control: engrane (ingeniería) con palomita (cumplimiento). */
export function Logo({ className = "h-7 w-7", title = "Ingeniería Team Control" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label={title}>
      <rect width="32" height="32" rx="7" fill="#102542" />
      <path d="M14.07 8.24 L14.48 5.91 L17.52 5.91 L17.93 8.24 L20.13 9.15 L22.06 7.80 L24.20 9.94 L22.85 11.87 L23.76 14.07 L26.09 14.48 L26.09 17.52 L23.76 17.93 L22.85 20.13 L24.20 22.06 L22.06 24.20 L20.13 22.85 L17.93 23.76 L17.52 26.09 L14.48 26.09 L14.07 23.76 L11.87 22.85 L9.94 24.20 L7.80 22.06 L9.15 20.13 L8.24 17.93 L5.91 17.52 L5.91 14.48 L8.24 14.07 L9.15 11.87 L7.80 9.94 L9.94 7.80 L11.87 9.15 Z" fill="none" stroke="#2b8fe0" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M11.6 16.3l3.1 3.1 5.9-6.4" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
