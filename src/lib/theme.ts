/**
 * Design tokens ported 1:1 from the Nexmarket (loja) web app and the
 * entregador app so the three apps share the exact same "Duolingo-style"
 * identity:
 *  - Bright green primary (#58CC02) with darker bottom borders for 3D buttons
 *  - Generous radii, bold typography, slate neutrals
 *
 * The primary color is overridable at runtime by the store's white-label
 * config (see lib/whitelabel.ts + hooks/useColors.ts) so each supermarket
 * keeps its own brand identity (RNF01).
 */

export const palette = {
  green: '#58CC02',
  greenDark: '#58A700',
  greenHover: '#46A302',
  greenSoft: '#E8F9D9',

  red: '#FF4B4B',
  redDark: '#EA2B2B',
  redSoft: '#FEE2E2',

  amber: '#F59E0B',
  amberSoft: '#FEF3C7',
  blue: '#3B82F6',
  blueSoft: '#DBEAFE',
  indigo: '#6366F1',
  indigoSoft: '#EEF2FF',
  yellow: '#EAB308',
  yellowSoft: '#FEF9C3',

  white: '#FFFFFF',
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',
  black: '#000000',
};

export type ThemeColors = {
  primary: string;
  primaryDark: string;
  primaryHover: string;
  primarySoft: string;
  danger: string;
  dangerDark: string;
  dangerSoft: string;
  accent: string;
  accentSoft: string;
  bg: string;
  card: string;
  cardMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  textInverse: string;
  amber: string;
  amberSoft: string;
  blue: string;
  blueSoft: string;
  overlay: string;
};

export const lightColors: ThemeColors = {
  primary: palette.green,
  primaryDark: palette.greenDark,
  primaryHover: palette.greenHover,
  primarySoft: palette.greenSoft,
  danger: palette.red,
  dangerDark: palette.redDark,
  dangerSoft: palette.redSoft,
  accent: palette.indigo,
  accentSoft: palette.indigoSoft,
  bg: palette.slate50,
  card: palette.white,
  cardMuted: palette.slate50,
  border: palette.slate200,
  borderStrong: palette.slate300,
  text: palette.slate800,
  textMuted: palette.slate500,
  textSubtle: palette.slate400,
  textInverse: palette.white,
  amber: palette.amber,
  amberSoft: palette.amberSoft,
  blue: palette.blue,
  blueSoft: palette.blueSoft,
  overlay: 'rgba(15,23,42,0.55)',
};

export const darkColors: ThemeColors = {
  primary: palette.green,
  primaryDark: palette.greenDark,
  primaryHover: palette.greenHover,
  primarySoft: 'rgba(88,204,2,0.15)',
  danger: palette.red,
  dangerDark: palette.redDark,
  dangerSoft: 'rgba(255,75,75,0.15)',
  accent: '#818CF8',
  accentSoft: 'rgba(99,102,241,0.18)',
  bg: '#0B1120',
  card: '#111827',
  cardMuted: '#0F172A',
  border: '#1F2937',
  borderStrong: '#334155',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  textSubtle: '#64748B',
  textInverse: '#0B1120',
  amber: palette.amber,
  amberSoft: 'rgba(245,158,11,0.18)',
  blue: palette.blue,
  blueSoft: 'rgba(59,130,246,0.18)',
  overlay: 'rgba(0,0,0,0.6)',
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16, // rounded-2xl
  xl: 20,
  '2xl': 24, // rounded-3xl
  full: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
};

export const font = {
  // Bold/black weights mirror the loja's heavy typographic style.
  black: '800' as const,
  bold: '700' as const,
  semibold: '600' as const,
  medium: '500' as const,
  regular: '400' as const,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
};

export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  raised: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
};

/** Lighten/transparentize a hex color into an rgba "soft" tint. */
export function softColor(hex: string, alpha = 0.15): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(88,204,2,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Darken a hex color by a factor (for the 3D button bottom border). */
export function darkenColor(hex: string, factor = 0.82): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#58A700';
  const r = Math.round(parseInt(h.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(h.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(h.slice(4, 6), 16) * factor);
  const to2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}
