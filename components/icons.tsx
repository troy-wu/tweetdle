const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const HelpIcon = () => (
  <svg {...base}>
    <path d="M9 9.2a3 3 0 1 1 4.6 2.5c-.9.6-1.6 1.2-1.6 2.3" />
    <path d="M12 18h.01" />
  </svg>
);

export const StatsIcon = () => (
  <svg {...base}>
    <path d="M5 20v-6M12 20V4M19 20v-10" />
  </svg>
);

export const TrophyIcon = () => (
  <svg {...base}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
    <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7" />
  </svg>
);

export const CloseIcon = () => (
  <svg {...base}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const UserIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </svg>
);

export const LockIcon = () => (
  <svg {...base} width={14} height={14}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const ShareIcon = () => (
  <svg {...base}>
    <path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
  </svg>
);

export const ExternalIcon = () => (
  <svg {...base} width={16} height={16}>
    <path d="M10 6H6v12h12v-4M14 4h6v6M20 4l-9 9" />
  </svg>
);
