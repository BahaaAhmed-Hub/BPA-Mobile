// Theme-aware screen palette. Reads the active behavioral mode and returns
// text/surface colors that contrast against the active background.
//
// For light/default mode this returns the standard tokens. When the user
// switches to a dark behavioral mode (samurai/pharaoh/astral) screens that
// use these values flip their ink to a light variant so labels stay legible.

import { useBehavioralStore, MODES } from '../store/behavioralStore';
import { C } from './tokens';

export interface ScreenPalette {
  bg: string;
  surface: string;
  hairline: string;
  ink: string;
  ink2: string;
  ink3: string;
  accent: string;
  isDark: boolean;
}

const LIGHT: ScreenPalette = {
  bg: C.bg,
  surface: C.card,
  hairline: C.hairline,
  ink: C.ink,
  ink2: C.ink2,
  ink3: C.ink3,
  accent: C.indigo,
  isDark: false,
};

export function useScreenPalette(): ScreenPalette {
  const enabled = useBehavioralStore(s => s.enabled);
  const mode    = useBehavioralStore(s => s.mode);
  if (!enabled || mode === 'default') return LIGHT;
  const m = MODES[mode];
  return {
    bg: m.bg,
    surface: 'rgba(255,255,255,0.06)',
    hairline: 'rgba(255,255,255,0.12)',
    ink: m.text,
    ink2: m.textDim,
    ink3: `${m.text}80`,
    accent: m.accentBright,
    isDark: true,
  };
}
