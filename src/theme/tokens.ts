// Design tokens — Sunlit Bento design system
// Source: BPA - All Screens.dc.html (Claude Design export)
// Four themes defined; Sunlit Bento is the default light theme.

// ─────────────────────────────────────────────────────────────
// Sunlit Bento — default light theme
// ─────────────────────────────────────────────────────────────
export const SB = {
  page:         '#F7F4EA',
  header:       '#FCFAF4',
  card:         '#FFFFFF',
  field:        '#FAF7EC',
  border:       '#E8E1CE',
  hairline:     '#F0EBDC',
  overlay:      '#FFFFFF',
  scrim:        'rgba(25,23,18,0.45)',
  calGround:    '#F4F0E4',
  calLive:      '#E4572E',

  ink1:         '#191712',
  ink2:         '#4A4438',
  ink3:         '#6C6553',
  ink4:         '#6E6759',
  inkOnDark:    '#FDF8E7',
  inkOnFill:    '#FFFFFF',

  accent:       '#F5D14E',
  accentInk:    '#191712',
  accentTint:   '#FEF7DE',
  accentTint2:  '#FDF6DE',
  accentBorder: '#EFE1B4',
  accentDeep:   '#7A5F09',

  positive:      '#0C8140',
  positiveDeep:  '#0A6B36',
  positiveTint:  '#E2F0E7',
  negative:      '#C62828',
  negativeDeep:  '#A31C1C',
  negativeTint:  '#FAE3E3',

  cat1: '#685FD7',
  cat2: '#177C5B',
  cat3: '#C77A3E',
  cat4: '#3E6FA3',
  cat5: '#8B5FA8',
  cat6: '#2F8C6E',

  info:        '#645BCE',
  infoTint:    '#EDEBFA',
  warning:     '#B26A00',
  warningTint: '#FBEEDC',

  rChip:  8,
  rSm:    9,
  rNav:   10,
  rCard:  18,
  rFrame: 24,
} as const;

// ─────────────────────────────────────────────────────────────
// Glass Depth — dark theme (used for AI/dark surfaces & dark modes)
// ─────────────────────────────────────────────────────────────
export const GD = {
  page:         '#0B0A12',
  header:       'rgba(255,255,255,0.035)',
  card:         'rgba(255,255,255,0.05)',
  field:        'rgba(255,255,255,0.035)',
  border:       'rgba(255,255,255,0.08)',
  hairline:     'rgba(255,255,255,0.045)',
  overlay:      '#1C1B26',
  scrim:        'rgba(5,4,10,0.62)',

  ink1:         '#EDEBF5',
  ink2:         '#D6D2EA',
  ink3:         '#A5A1BC',
  ink4:         '#9A97B3',
  inkOnDark:    '#12101C',
  inkOnFill:    '#12101C',

  accent:       '#A78BFA',
  accentInk:    '#1B1330',
  accentTint:   'rgba(167,139,250,0.20)',
  accentTint2:  'rgba(167,139,250,0.13)',
  accentBorder: 'rgba(167,139,250,0.32)',
  accentDeep:   '#C4B5FD',

  positive:      '#4ADE80',
  positiveDeep:  '#22C55E',
  positiveTint:  'rgba(74,222,128,0.16)',
  negative:      '#E9A23B',
  negativeDeep:  '#F0B65C',
  negativeTint:  'rgba(233,162,59,0.18)',

  rChip:  10,
  rSm:    12,
  rNav:   12,
  rCard:  22,
  rFrame: 28,
} as const;

// ─────────────────────────────────────────────────────────────
// Warm Minimal — alternate warm light theme
// ─────────────────────────────────────────────────────────────
export const WM = {
  page:         '#F4F1EA',
  header:       '#FAF8F3',
  card:         '#FFFFFF',
  field:        '#FBFAF6',
  border:       '#E7E2D8',
  hairline:     '#EFEBE1',

  ink1:         '#1A1814',
  ink2:         '#54503F',
  ink3:         '#6E6656',
  ink4:         '#6E665A',

  accent:       '#B05939',
  accentInk:    '#FFF6F0',
  accentTint:   '#F6E3D8',
  accentBorder: '#E5DBCF',
  accentDeep:   '#8E4227',

  positive:     '#3C5A46',
  negative:     '#9A4A2E',

  rChip:  3,
  rSm:    4,
  rNav:   4,
  rCard:  6,
  rFrame: 8,
} as const;

// ─────────────────────────────────────────────────────────────
// Evergreen — nature-toned light theme
// ─────────────────────────────────────────────────────────────
export const EV = {
  page:         '#F5F7F6',
  header:       '#FBFCFB',
  card:         '#FFFFFF',
  field:        '#F1F4F2',
  border:       '#DCE7E3',
  hairline:     '#EDF1EF',

  ink1:         '#131A17',
  ink2:         '#3E4842',
  ink3:         '#5D675F',
  ink4:         '#636B64',

  accent:       '#155E4B',
  accentInk:    '#EAF6F0',
  accentTint:   '#E4EFE8',
  accentBorder: '#C9DCD4',
  accentDeep:   '#0E4437',

  positive:     '#1F4A3A',
  negative:     '#B4574A',

  rChip:  4,
  rSm:    7,
  rNav:   8,
  rCard:  10,
  rFrame: 16,
} as const;

// ─────────────────────────────────────────────────────────────
// Behavioral mode accent overrides
// A mode changes --sb-accent (and nothing else) per design spec.
// The dark bg/text are kept for backward compat while screens are migrated.
// ─────────────────────────────────────────────────────────────
export const MODE_ACCENTS = {
  samurai: { accent: '#A32320', accentInk: '#FFFFFF', accentDeep: '#7A1A18' },
  pharaoh: { accent: '#C89B25', accentInk: '#191712', accentDeep: '#7A5F09' },
  astral:  { accent: '#6659D8', accentInk: '#FFFFFF', accentDeep: '#4A3FB8' },
} as const;

// ─────────────────────────────────────────────────────────────
// C — flat token map; screens reference these directly.
// Values come from Sunlit Bento; dark variants from Glass Depth.
// ─────────────────────────────────────────────────────────────
export const C = {
  // Surfaces
  bg:           SB.page,
  card:         SB.card,
  field:        SB.field,
  header:       SB.header,
  hairline:     SB.border,
  hairlineFine: SB.hairline,
  overlay:      SB.overlay,

  // Ink
  ink:   SB.ink1,
  ink2:  SB.ink2,
  ink3:  SB.ink3,
  ink4:  SB.ink4,

  // Accent (Sunlit Bento default; overridden by behavioral mode in palette)
  accent:       SB.accent,
  accentInk:    SB.accentInk,
  accentTint:   SB.accentTint,
  accentTint2:  SB.accentTint2,
  accentBorder: SB.accentBorder,
  accentDeep:   SB.accentDeep,

  // Semantic
  positive:     SB.positive,
  positiveDeep: SB.positiveDeep,
  positiveTint: SB.positiveTint,
  negative:     SB.negative,
  negativeDeep: SB.negativeDeep,
  negativeTint: SB.negativeTint,

  // Category colors (mail, calendar, charts)
  cat1: SB.cat1,
  cat2: SB.cat2,
  cat3: SB.cat3,
  cat4: SB.cat4,
  cat5: SB.cat5,
  cat6: SB.cat6,

  info:        SB.info,
  infoTint:    SB.infoTint,
  warning:     SB.warning,
  warningTint: SB.warningTint,

  // Quadrant accent colors (functional — not from theme)
  red:       '#B23A36',
  indigo:    '#4B56D2',
  indigoSoft:'#ECEEFF',
  violet:    SB.cat1,
  violetSoft:'rgba(104,95,215,0.12)',
  blue:      SB.cat4,
  blueSoft:  'rgba(62,111,163,0.12)',
  green:     SB.cat2,
  greenSoft: 'rgba(23,124,91,0.12)',
  orange:    SB.cat3,
  orangeSoft:'rgba(199,122,62,0.12)',
  slate:     SB.ink3,
  slateSoft: 'rgba(108,101,83,0.10)',

  // Dark surfaces (AI/Planning Assistant — always dark)
  bgDark:       GD.page,
  cardDark:     GD.card,
  hairlineDark: GD.hairline,
  inkDark:      GD.ink1,
  ink2Dark:     GD.ink2,
  ink3Dark:     GD.ink3,
} as const;

// ─────────────────────────────────────────────────────────────
// Radii — from Sunlit Bento spec
// ─────────────────────────────────────────────────────────────
export const Radii = {
  chip: SB.rChip,   // 8  — tags, badges, small chips
  sm:   SB.rSm,     // 9  — buttons, small cards
  nav:  SB.rNav,    // 10 — nav pills, tab items
  md:   SB.rCard,   // 18 — standard cards
  lg:   SB.rFrame,  // 24 — bottom sheets, modals
  xl:   32,
  pill: 999,
  // Legacy aliases
  xs: SB.rChip,
} as const;

export const Spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
} as const;

// ─────────────────────────────────────────────────────────────
// Shadows — from Sunlit Bento shadow tokens
// ─────────────────────────────────────────────────────────────
export const Shadows = {
  control: {
    shadowColor: '#191712',
    shadowOpacity: 0.14,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  card: {
    shadowColor: '#302814',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pop: {
    shadowColor: '#302814',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  frame: {
    shadowColor: '#302814',
    shadowOpacity: 0.5,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 26 },
    elevation: 12,
  },
} as const;

// ─────────────────────────────────────────────────────────────
// Quadrant metadata — Eisenhower matrix
// ─────────────────────────────────────────────────────────────
export const Quadrants = {
  urgent_important:       { label: 'Do',        color: C.violet, soft: C.violetSoft },
  important_not_urgent:   { label: 'Schedule',  color: C.blue,   soft: C.blueSoft   },
  urgent_not_important:   { label: 'Delegate',  color: C.green,  soft: C.greenSoft  },
  neither:                { label: 'Eliminate', color: C.slate,  soft: C.slateSoft  },
} as const;

export type QuadrantId = keyof typeof Quadrants;
