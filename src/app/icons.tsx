/** Petites icônes en ligne (traits 2 px, style « lucide »). */
type P = { className?: string };
const base = (className = "h-4 w-4") => ({
  className,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconExplore = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><path d="m12 8 1.5 2.5L16 12l-2.5 1.5L12 16l-1.5-2.5L8 12l2.5-1.5z" /></svg>
);
export const IconBookmark = ({ className }: P) => (
  <svg {...base(className)}><path d="M6 3h12v18l-6-4-6 4z" /></svg>
);
export const IconBrand = ({ className }: P) => (
  <svg {...base(className)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2" /></svg>
);
export const IconSettings = ({ className }: P) => (
  <svg {...base(className)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
);
export const IconSearch = ({ className }: P) => (
  <svg {...base(className)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const IconExternal = ({ className }: P) => (
  <svg {...base(className)}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
export const IconLayers = ({ className }: P) => (
  <svg {...base(className)}><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></svg>
);
export const IconPulse = ({ className }: P) => (
  <svg {...base(className)}><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>
);
export const IconChevron = ({ className }: P) => (
  <svg {...base(className ?? "h-3.5 w-3.5")}><path d="m6 9 6 6 6-6" /></svg>
);
export const IconX = ({ className }: P) => (
  <svg {...base(className ?? "h-3 w-3")}><path d="M18 6 6 18M6 6l12 12" /></svg>
);
export const IconReset = ({ className }: P) => (
  <svg {...base(className ?? "h-3.5 w-3.5")}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
);
export const IconHourglass = ({ className }: P) => (
  <svg {...base(className)}><path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" /></svg>
);
export const IconBars = ({ className }: P) => (
  <svg {...base(className)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
);
export const IconLimit = ({ className }: P) => (
  <svg {...base(className)}><path d="M4 6h16M4 12h10M4 18h6M17 15l4 4M21 15l-4 4" /></svg>
);
export const IconFlag = ({ className }: P) => (
  <svg {...base(className)}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
);
export const IconLanguage = ({ className }: P) => (
  <svg {...base(className)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 15l2.5-6 2.5 6M8 13h3M14 9h4M16 9v6" /></svg>
);
export const IconTarget = ({ className }: P) => (
  <svg {...base(className)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
);
export const IconMegaphone = ({ className }: P) => (
  <svg {...base(className)}><path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM17 9a4 4 0 0 1 0 6M8 14l1 5" /></svg>
);
export const IconPage = ({ className }: P) => (
  <svg {...base(className)}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>
);
export const IconStatus = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></svg>
);
export const IconSort = ({ className }: P) => (
  <svg {...base(className)}><path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" /></svg>
);
export const IconEye = ({ className }: P) => (
  <svg {...base(className)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconStar = ({ className }: P) => (
  <svg className={className ?? "h-3.5 w-3.5"} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
  </svg>
);
export const IconPlay = ({ className }: P) => (
  <svg className={className ?? "h-6 w-6"} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5.5v13l11-6.5z" /></svg>
);
export const IconBolt = ({ className }: P) => (
  <svg {...base(className)}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
);
export const IconTag = ({ className }: P) => (
  <svg {...base(className)}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.2" /></svg>
);
export const IconFolder = ({ className }: P) => (
  <svg {...base(className)}><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
);
export const IconFolderPlus = ({ className }: P) => (
  <svg {...base(className)}><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M12 10v6M9 13h6" /></svg>
);
export const IconAd = ({ className }: P) => (
  <svg {...base(className)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m7 15 2-6 2 6M7.7 13h2.6M14 9v6h1.5a2.5 2.5 0 0 0 0-5H14" /></svg>
);
export const IconPlus = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconCheck = ({ className }: P) => (
  <svg {...base(className)}><path d="m5 12 5 5L20 7" /></svg>
);
export const IconTrendUp = ({ className }: P) => (
  <svg {...base(className)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
);
