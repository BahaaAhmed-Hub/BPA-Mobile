import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type BehavioralMode = 'default' | 'samurai' | 'pharaoh' | 'astral';

export interface ModeMeta {
  id: BehavioralMode;
  name: string;
  emoji: string;
  tagline: string;
  badge: string | null;
  available: boolean;
  bg: string;
  accent: string;
  accentBright: string;
  text: string;
  textDim: string;
  glow: string;
}

export const MODES: Record<BehavioralMode, ModeMeta> = {
  default: {
    id: 'default', name: 'Navy Night', emoji: '🌃',
    tagline: 'Your AI Executive Operating System.',
    badge: null, available: true,
    bg: '#0D0F1A', accent: '#1E40AF', accentBright: '#60A5FA',
    text: '#E8EAF6', textDim: '#94A3B8', glow: 'rgba(30,64,175,0.18)',
  },
  samurai: {
    id: 'samurai', name: 'Samurai', emoji: '⚔️',
    tagline: 'Walk the path. Execute without hesitation. Rise.',
    badge: 'SAMURAI MODE', available: true,
    bg: '#0A0804', accent: '#8B1A1A', accentBright: '#C0392B',
    text: '#EDE4D3', textDim: '#7A6E5E', glow: 'rgba(139,26,26,0.18)',
  },
  pharaoh: {
    id: 'pharaoh', name: 'Pharaoh', emoji: '𓂀',
    tagline: 'Your empire begins with systems. Command time. Shape history.',
    badge: 'PHARAOH MODE', available: false,
    bg: '#090700', accent: '#C9A227', accentBright: '#F5D060',
    text: '#F5E6C8', textDim: '#9B8B6A', glow: 'rgba(201,162,39,0.16)',
  },
  astral: {
    id: 'astral', name: 'Astral', emoji: '✦',
    tagline: 'Clarity at the cosmic scale. Operate from vision, not reaction.',
    badge: 'ASTRAL MODE', available: false,
    bg: '#04020E', accent: '#7C3AED', accentBright: '#A78BFA',
    text: '#EDE9FE', textDim: '#8B83C4', glow: 'rgba(124,58,237,0.16)',
  },
};

interface BehavioralState {
  enabled: boolean;
  mode: BehavioralMode;
  setEnabled: (v: boolean) => void;
  setMode: (m: BehavioralMode) => void;
}

export const useBehavioralStore = create<BehavioralState>()(
  persist(
    set => ({
      enabled: false,
      mode: 'default',
      setEnabled: v => set({ enabled: v }),
      setMode:    m => set({ mode: m }),
    }),
    {
      name: 'bpa-behavioral',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** The active visual mode — falls back to default when disabled. */
export function currentModeMeta(): ModeMeta {
  const { enabled, mode } = useBehavioralStore.getState();
  return enabled ? MODES[mode] : MODES.default;
}
