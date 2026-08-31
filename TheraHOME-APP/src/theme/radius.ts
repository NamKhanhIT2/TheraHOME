// Ported from tokens/radius-shadow.css — rounded everywhere, radius scales with size.
export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
} as const;

// Soft diffuse shadows only — never a hard border on a top-level card.
// RN needs both the iOS shadow* props and Android `elevation`.
export const shadows = {
  card: {
    shadowColor: '#16213A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  fab: {
    shadowColor: '#007FD9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
  nav: {
    shadowColor: '#16213A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;
