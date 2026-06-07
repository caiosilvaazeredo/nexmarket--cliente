/**
 * Design tokens ported 1:1 from the Nexmarket (loja) web app so the driver
 * app keeps the exact same "Duolingo-style" identity:
 *  - Bright green primary (#58CC02) with darker bottom borders for 3D buttons
 *  - Generous radii, bold typography, slate neutrals
 * High-contrast values are used everywhere for outdoor/sunlight legibility.
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
