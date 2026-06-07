/**
 * White-label theming (RNF01).
 *
 * The supermarket parametrizes its identity (primary color, name, logo) through
 * the GondolaAppBuilder in the manager panel. Those values live on the
 * /supermarkets/{smId} document under `branding`. Here we merge them over the
 * base "Duolingo green" theme so the customer app re-skins itself per store
 * without a rebuild. When no branding is set we fall back to the Nexmarket
 * defaults, keeping visual parity with the entregador app.
 */
import { lightColors, darkColors, ThemeColors, palette } from './theme';
import type { Branding } from './types';

export const DEFAULT_BRANDING: Branding = {
  primaryColor: palette.green,
  primaryDark: palette.greenDark,
  accentColor: palette.indigo,
  appName: 'Nexmarket',
};

/** Darken a hex color by a factor (0–1) for the 3D button bottom-border. */
export function darken(hex: string, amount = 0.18): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const num = parseInt(h, 16);
  const r = Math.max(0, Math.round(((num >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 255) * (1 - amount)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Add an alpha channel to a hex color -> rgba() string. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const num = parseInt(h, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

/** Apply a store's branding over the base palette for the given scheme. */
export function applyBranding(base: ThemeColors, branding?: Branding | null): ThemeColors {
  if (!branding?.primaryColor) return base;
  const primary = branding.primaryColor;
  const primaryDark = branding.primaryDark || darken(primary, 0.22);
  return {
    ...base,
    primary,
    primaryDark,
    primaryHover: darken(primary, 0.1),
    primarySoft: withAlpha(primary, base === darkColors ? 0.16 : 0.12),
    accent: branding.accentColor || base.accent,
  };
}

export function resolvedColors(dark: boolean, branding?: Branding | null): ThemeColors {
  return applyBranding(dark ? darkColors : lightColors, branding);
}

export function appName(branding?: Branding | null): string {
  return branding?.appName || DEFAULT_BRANDING.appName!;
}
