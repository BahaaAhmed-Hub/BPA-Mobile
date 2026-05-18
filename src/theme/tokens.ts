// Design tokens for The Professor / BPA mobile
// Source of truth: BPA Mobile Build.html design spec (canonical)
// Mirrors src/lib/themes.ts on the web app but flattened for RN.

export const C = {
  // Surfaces
  bg: '#F4F5F8',
  card: '#FFFFFF',
  hairline: 'rgba(15,23,42,0.07)',

  // Ink
  ink: '#0B1220',
  ink2: '#5B6478',
  ink3: '#8B95A8',

  // Brand
  red: '#B23A36',
  indigo: '#2A3FD9',
  indigoSoft: '#EEF0FF',

  // Eisenhower quadrants
  violet: '#6F45D6',
  violetSoft: '#F0EBFF',
  blue: '#2F6ED6',
  blueSoft: '#E7EFFD',
  green: '#1D9E72',
  greenSoft: '#E1F3EC',
  orange: '#D88431',
  orangeSoft: '#FBEEDD',
  slate: '#8B95A8',
  slateSoft: '#EEF1F6',

  // Dark variants (AI surfaces render dark)
  bgDark: '#0A0E1F',
  cardDark: 'rgba(255,255,255,0.05)',
  hairlineDark: 'rgba(255,255,255,0.1)',
  inkDark: '#FFFFFF',
  ink2Dark: 'rgba(255,255,255,0.7)',
  ink3Dark: 'rgba(255,255,255,0.5)',
} as const;

export const Radii = {
  xs: 10,
  sm: 14,
  md: 18,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Shadows = {
  card: {
    shadowColor: '#0F1538',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pop: {
    shadowColor: '#0F1538',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;

// Quadrant metadata used across Today, Tasks, Add Task screens
export const Quadrants = {
  urgent_important:       { label: 'Do',       color: C.violet, soft: C.violetSoft },
  important_not_urgent:   { label: 'Schedule', color: C.blue,   soft: C.blueSoft   },
  urgent_not_important:   { label: 'Delegate', color: C.green,  soft: C.greenSoft  },
  neither:                { label: 'Eliminate',color: C.slate,  soft: C.slateSoft  },
} as const;

export type QuadrantId = keyof typeof Quadrants;
