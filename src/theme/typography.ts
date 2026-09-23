// Typography — Instrument Sans (UI) + Outfit (numbers/headings)
// Per Sunlit Bento design spec from BPA - All Screens.dc.html
// Inter remains available as fallback while screens are being migrated.

import { SB } from './tokens';

// ─────────────────────────────────────────────────────────────
// Font family name constants
// Load these in App.tsx via useFonts()
// ─────────────────────────────────────────────────────────────
export const UIFont = {
  regular:  'InstrumentSans_400Regular',
  medium:   'InstrumentSans_500Medium',
  semiBold: 'InstrumentSans_600SemiBold',
  bold:     'InstrumentSans_700Bold',
} as const;

export const NumFont = {
  regular:   'Outfit_400Regular',
  medium:    'Outfit_500Medium',
  semiBold:  'Outfit_600SemiBold',
  bold:      'Outfit_700Bold',
  extraBold: 'Outfit_800ExtraBold',
} as const;

// ─────────────────────────────────────────────────────────────
// Type scale — inherits Sunlit Bento ink colours.
// Screens that used Type.body etc. will pick up the new fonts
// and the new ink colours automatically on the next render.
// ─────────────────────────────────────────────────────────────
export const Type = {
  // UI body copy
  body:    { fontFamily: UIFont.regular,  fontSize: 15, color: SB.ink1, lineHeight: 22 },
  bodyM:   { fontFamily: UIFont.medium,   fontSize: 15, color: SB.ink1, lineHeight: 22 },
  bodyB:   { fontFamily: UIFont.semiBold, fontSize: 15, color: SB.ink1, lineHeight: 22 },

  // Secondary / metadata
  sub:     { fontFamily: UIFont.regular,  fontSize: 13, color: SB.ink2, lineHeight: 18 },
  subM:    { fontFamily: UIFont.medium,   fontSize: 13, color: SB.ink2, lineHeight: 18 },
  subB:    { fontFamily: UIFont.semiBold, fontSize: 13, color: SB.ink2, lineHeight: 18 },

  // Captions & micro labels
  caption: { fontFamily: UIFont.medium,   fontSize: 12, color: SB.ink3, lineHeight: 16 },
  micro:   { fontFamily: UIFont.semiBold, fontSize: 11, color: SB.ink4, lineHeight: 14, letterSpacing: 1.4 },
  eyebrow: { fontFamily: UIFont.semiBold, fontSize: 11, color: SB.ink4, lineHeight: 14, letterSpacing: 1.6 },

  // Headlines (Outfit — number/display font)
  h1:   { fontFamily: NumFont.bold,      fontSize: 28, color: SB.ink1, letterSpacing: -1,   lineHeight: 34 },
  h2:   { fontFamily: NumFont.bold,      fontSize: 22, color: SB.ink1, letterSpacing: -0.5, lineHeight: 28 },
  h3:   { fontFamily: NumFont.semiBold,  fontSize: 19, color: SB.ink1, letterSpacing: -0.4, lineHeight: 24 },
  h4:   { fontFamily: NumFont.semiBold,  fontSize: 17, color: SB.ink1, letterSpacing: -0.2, lineHeight: 22 },

  // Stats / numeric display (Outfit tabular)
  stat:   { fontFamily: NumFont.bold,      fontSize: 28, color: SB.ink1, letterSpacing: -1 },
  statMd: { fontFamily: NumFont.semiBold,  fontSize: 20, color: SB.ink1, letterSpacing: -0.5 },
  statSm: { fontFamily: NumFont.medium,    fontSize: 15, color: SB.ink1 },

  // Legacy Inter aliases — used by atoms not yet redesigned
  Inter_400Regular: 'Inter_400Regular',
  Inter_500Medium:  'Inter_500Medium',
  Inter_600SemiBold:'Inter_600SemiBold',
  Inter_700Bold:    'Inter_700Bold',
} as const;
