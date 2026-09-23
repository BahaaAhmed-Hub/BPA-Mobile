// Theme-aware screen palette.
// Light base = Sunlit Bento. Behavioral modes darken the background
// and shift the accent while screens are being migrated to the new design.
// Once all screens are redesigned, dark-mode behavior will be accent-only.

import { useBehavioralStore, MODES } from '../store/behavioralStore';
import { SB, GD, C, MODE_ACCENTS } from './tokens';

export interface ScreenPalette {
  bg: string;
  surface: string;     // card / panel background
  field: string;       // input background
  hairline: string;    // divider / border
  ink: string;         // primary text
  ink2: string;        // secondary text
  ink3: string;        // tertiary / disabled text
  ink4: string;        // eyebrow / label text
  accent: string;      // brand accent (mode-overridable)
  accentInk: string;   // text on accent fill
  accentTint: string;  // pale accent fill
  accentBorder: string;// accent outline
  accentDeep: string;  // dark accent (links, deep fills)
  positive: string;
  positiveTint: string;
  negative: string;
  negativeTint: string;
  isDark: boolean;
}

// Sunlit Bento light palette — used when no behavioral mode is active
const LIGHT: ScreenPalette = {
  bg:           SB.page,
  surface:      SB.card,
  field:        SB.field,
  hairline:     SB.border,
  ink:          SB.ink1,
  ink2:         SB.ink2,
  ink3:         SB.ink3,
  ink4:         SB.ink4,
  accent:       SB.accent,
  accentInk:    SB.accentInk,
  accentTint:   SB.accentTint,
  accentBorder: SB.accentBorder,
  accentDeep:   SB.accentDeep,
  positive:     SB.positive,
  positiveTint: SB.positiveTint,
  negative:     SB.negative,
  negativeTint: SB.negativeTint,
  isDark:       false,
};

// Build a dark palette from Glass Depth + the mode's accent override
function darkPalette(accentKey: keyof typeof MODE_ACCENTS): ScreenPalette {
  const a = MODE_ACCENTS[accentKey];
  return {
    bg:           GD.page,
    surface:      GD.card,
    field:        GD.field,
    hairline:     GD.hairline,
    ink:          GD.ink1,
    ink2:         GD.ink2,
    ink3:         GD.ink3,
    ink4:         GD.ink4,
    accent:       a.accent,
    accentInk:    a.accentInk,
    accentTint:   `${a.accent}30`,
    accentBorder: `${a.accent}55`,
    accentDeep:   a.accentDeep,
    positive:     GD.positive,
    positiveTint: GD.positiveTint,
    negative:     GD.negative,
    negativeTint: GD.negativeTint,
    isDark:       true,
  };
}

const DARK_PALETTES: Record<'samurai' | 'pharaoh' | 'astral', ScreenPalette> = {
  samurai: darkPalette('samurai'),
  pharaoh: darkPalette('pharaoh'),
  astral:  darkPalette('astral'),
};

export function useScreenPalette(): ScreenPalette {
  const enabled = useBehavioralStore(s => s.enabled);
  const mode    = useBehavioralStore(s => s.mode);
  if (!enabled || mode === 'default') return LIGHT;
  return DARK_PALETTES[mode as 'samurai' | 'pharaoh' | 'astral'] ?? LIGHT;
}

// Convenience: static palette without a hook (for non-component contexts)
export function getScreenPalette(): ScreenPalette {
  const { enabled, mode } = useBehavioralStore.getState();
  if (!enabled || mode === 'default') return LIGHT;
  return DARK_PALETTES[mode as 'samurai' | 'pharaoh' | 'astral'] ?? LIGHT;
}
