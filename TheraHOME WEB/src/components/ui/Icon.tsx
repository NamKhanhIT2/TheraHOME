// Ported from .design-reference/icons-extra.jsx (IconX) + the design-system
// bundle's base Icon.jsx (_ds_bundle.js) — icons-extra's names take priority,
// falling back to the base set, matching the original's window.IconX ->
// window.TheraHOMEDesignSystem_787051.Icon chain. Keep path data identical
// to the source; only the wrapping (name -> JSX) changed for TypeScript.
export type IconProps = {
  name: string;
  size?: number;
  color?: string;
};

const STROKE_PROPS = {
  fill: "none",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function Icon({ name, size = 24, color = "currentColor" }: IconProps) {
  const p = { width: size, height: size, viewBox: "0 0 24 24" };

  switch (name) {
    // icons-extra.jsx
    case "chevron-left":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M15 5l-7 7 7 7" /></svg>;
    case "play":
      return <svg {...p} fill={color} stroke="none"><path d="M8 5.5v13l11-6.5z" /></svg>;
    case "lock":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" /></svg>;
    case "activity":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M3 12h4l2-7 4 14 2-7h6" /></svg>;
    case "book":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 0 4 23.5z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5a2.5 2.5 0 0 1 2.5 2.5" /></svg>;
    case "sun":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>;
    case "moon":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" /></svg>;
    case "chevron-right":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M9 5l7 7-7 7" /></svg>;
    case "log-out":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M9 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3" /><path d="M14 8l4 4-4 4M18 12H9" /></svg>;
    case "droplet":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z" /></svg>;
    case "minus":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M4 12h16" /></svg>;
    case "external-link":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M14 5h5v5" /><path d="M19 5 10 14" /><path d="M9 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" /></svg>;
    case "message-circle":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M4 12a8 8 0 1 1 3.2 6.4L4 20l1.1-3.6A7.9 7.9 0 0 1 4 12z" /></svg>;
    case "chevron-down":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M5 8l7 7 7-7" /></svg>;
    case "shopping-bag":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M6 8h12l-1 12H7z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>;
    case "x":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case "image":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 16l-5.5-5.5L4 21" /></svg>;
    case "smile":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></svg>;
    case "map-pin":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
    case "phone":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M4 4h4l2 5-2.5 1.5a12 12 0 0 0 6 6L15 14l5 2v4a2 2 0 0 1-2 2C9.5 22 2 14.5 2 6a2 2 0 0 1 2-2z" /></svg>;
    case "more-horizontal":
      return <svg {...p} fill={color} stroke="none"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>;
    case "user-plus":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" /><path d="M18 8v5M15.5 10.5h5" /></svg>;
    case "send":
      return <svg {...p} fill={color} stroke="none"><path d="M3 11l18-8-8 18-2.5-7.5z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" fill="none" /></svg>;
    case "heart":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M12 20.5s-7.5-4.6-10-9.3C.4 7.8 2.3 4.5 5.7 4c2.2-.3 4.2.8 6.3 3 2.1-2.2 4.1-3.3 6.3-3 3.4.5 5.3 3.8 3.7 7.2-2.5 4.7-10 9.3-10 9.3z" /></svg>;
    case "keyboard":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M6.5 11h.01M10 11h.01M14 11h.01M17.5 11h.01M6.5 15h11" /></svg>;
    case "camera":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></svg>;
    case "square":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><rect x="4" y="4" width="16" height="16" rx="4" /></svg>;
    case "check-square":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8.5 12.5l2.3 2.3L15.5 10" /></svg>;
    case "bookmark":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4z" /></svg>;
    case "clock":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>;
    case "file-text":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" /><path d="M14 3.5V8h4M8 12h8M8 15.5h8M8 19h5" /></svg>;
    case "shield":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6z" /></svg>;
    case "clipboard-check":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9z" /><path d="M9 13l2 2 4-4.5" /></svg>;
    case "link":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M9.5 14.5l5-5" /><path d="M8 16.5l-1.5 1.5a3.2 3.2 0 0 1-4.5-4.5L5.5 10a3.2 3.2 0 0 1 4.5 0" /><path d="M16 7.5l1.5-1.5a3.2 3.2 0 0 1 4.5 4.5L18.5 14a3.2 3.2 0 0 1-4.5 0" /></svg>;
    case "sparkles":
      return <svg {...p} fill={color} stroke="none"><path d="M12 2.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-6.2-5.2-1.8 5.2-1.8z" /><path d="M19 15l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" /></svg>;
    case "users":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c0-3.3 2.5-5.7 5.5-5.7s5.5 2.4 5.5 5.7" /><path d="M15.5 8.3a2.9 2.9 0 1 1 0-5.8" /><path d="M16 14.5c2.6.3 4.5 2.5 4.5 5.5" /></svg>;
    case "grid":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" /><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" /><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" /><rect x="13" y="13" width="7.5" height="7.5" rx="1.5" /></svg>;
    case "dumbbell":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M4 10v4M6.5 8v8M17.5 8v8M20 10v4M6.5 12h11" /></svg>;
    case "smartphone":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M11 18.5h2" /></svg>;
    case "brain":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M9 4.5a2.7 2.7 0 0 0-2.7 2.7 2.7 2.7 0 0 0-1.8 4.6 2.9 2.9 0 0 0 1.6 5A2.8 2.8 0 0 0 9 19.5V4.5z" /><path d="M15 4.5a2.7 2.7 0 0 1 2.7 2.7 2.7 2.7 0 0 1 1.8 4.6 2.9 2.9 0 0 1-1.6 5A2.8 2.8 0 0 1 15 19.5V4.5z" /></svg>;
    case "library":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M4 20V4M9 20V4M13 20l2.5-16M20 20l-3.5-16" /></svg>;
    case "accessibility":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><circle cx="12" cy="4.5" r="1.8" /><path d="M12 8v6M6 10.5h12M9 20l3-6 3 6" /></svg>;
    case "message-square":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v10a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5V17H5.5A1.5 1.5 0 0 1 4 15.5z" /></svg>;
    case "film":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M3 15h18M8 4v16M16 4v16" /></svg>;
    case "qr-code":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" /><rect x="14" y="3.5" width="6.5" height="6.5" rx="1" /><rect x="3.5" y="14" width="6.5" height="6.5" rx="1" /><path d="M14 14h3v3h-3zM19.5 14v3M14 19.5h3M19.5 19.5v.01" /></svg>;
    case "box":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4.5 7.5 12 12l7.5-4.5M12 12v9" /></svg>;
    case "star":
      return <svg {...p} fill={color} stroke="none"><path d="M12 3l2.7 6 6.3.7-4.7 4.4 1.3 6.4L12 17.3 6.4 20.5l1.3-6.4L3 9.7l6.3-.7z" /></svg>;
    case "search":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.8-4.8" /></svg>;
    case "trash-2":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /><path d="M10 11v6M14 11v6" /></svg>;
    case "eye":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></svg>;
    case "eye-off":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M3 3l18 18" /><path d="M10.6 5.7A10.7 10.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a13.4 13.4 0 0 1-3.2 3.9M6.6 6.6C4 8.3 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9.9 9.9 0 0 0 3.4-.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>;
    case "filter":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M4 5h16l-6 8v6l-4-2v-4z" /></svg>;
    case "download":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M12 3v12M7.5 11l4.5 4.5L16.5 11" /><path d="M4 18v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" /></svg>;
    case "trending-up":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 6h6v6" /></svg>;
    case "megaphone":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M3 10v4a1 1 0 0 0 1 1h2l1 5h3l-1-5h1l9 4V6l-9 4H4a1 1 0 0 0-1 1z" /><path d="M20 9.5a3.5 3.5 0 0 1 0 5" /></svg>;
    case "flag":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M5 3v18" /><path d="M5 4h11l-2.5 4L16 12H5" /></svg>;

    // base Icon.jsx fallback set
    case "home":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /></svg>;
    case "calendar":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M8 3v4M16 3v4" /></svg>;
    case "link-2":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><circle cx="8" cy="12" r="3.5" /><circle cx="16" cy="12" r="3.5" /><path d="M11 12h2" /></svg>;
    case "settings":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M4.2 6.2l1.4 1.4M18.4 16.4l1.4 1.4M3 12h2M19 12h2M4.2 17.8l1.4-1.4M18.4 7.6l1.4-1.4" /></svg>;
    case "plus":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M12 4v16M4 12h16" /></svg>;
    case "bell":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M6 10a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0" /></svg>;
    case "check":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M4 12.5 9.5 18 20 6" /></svg>;
    case "triangle-alert":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M12 4 2 20h20L12 4Z" /><path d="M12 11v3.5M12 17.5h.01" /></svg>;
    case "circle":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><circle cx="12" cy="12" r="7" /></svg>;
    case "pencil":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M4 20l1-4L16 5l3 3L8 19l-4 1ZM14 6l3 3" /></svg>;
    case "user":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c1-4 4-6 7-6s6 2 7 6" /></svg>;
    case "menu":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case "pill":
      return <svg {...p} {...STROKE_PROPS} stroke={color}><rect x="4" y="9.5" width="16" height="5" rx="2.5" /><path d="M12 9.5v5" /></svg>;

    default:
      return <svg {...p} {...STROKE_PROPS} stroke={color}><circle cx="12" cy="12" r="8" /></svg>;
  }
}
