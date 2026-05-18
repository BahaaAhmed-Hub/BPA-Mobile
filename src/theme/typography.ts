import { C } from './tokens';

export const Type = {
  // Body
  body:   { fontFamily: 'Inter_400Regular', fontSize: 15, color: C.ink,  lineHeight: 22 },
  bodyM:  { fontFamily: 'Inter_500Medium',  fontSize: 15, color: C.ink,  lineHeight: 22 },
  bodyB:  { fontFamily: 'Inter_600SemiBold',fontSize: 15, color: C.ink,  lineHeight: 22 },
  sub:    { fontFamily: 'Inter_400Regular', fontSize: 13, color: C.ink2, lineHeight: 18 },
  subM:   { fontFamily: 'Inter_500Medium',  fontSize: 13, color: C.ink2, lineHeight: 18 },
  caption:{ fontFamily: 'Inter_500Medium',  fontSize: 12, color: C.ink3, lineHeight: 16 },
  micro:  { fontFamily: 'Inter_600SemiBold',fontSize: 11, color: C.ink3, lineHeight: 14, letterSpacing: 0.6 },

  // Headlines
  h1: { fontFamily: 'Inter_700Bold',    fontSize: 28, color: C.ink, letterSpacing: -0.5, lineHeight: 34 },
  h2: { fontFamily: 'Inter_700Bold',    fontSize: 22, color: C.ink, letterSpacing: -0.3, lineHeight: 28 },
  h3: { fontFamily: 'Inter_600SemiBold',fontSize: 17, color: C.ink, letterSpacing: -0.2, lineHeight: 22 },

  // Stats (tabular)
  stat:    { fontFamily: 'JetBrainsMono_500Medium', fontSize: 28, color: C.ink, letterSpacing: -0.5 },
  statSm:  { fontFamily: 'JetBrainsMono_500Medium', fontSize: 15, color: C.ink },
} as const;
