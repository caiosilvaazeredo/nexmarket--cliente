import { palette, darkenColor, softColor } from './theme';
import type { Supermarket, AppConfig } from './types';

/**
 * Resolve the white-label brand identity for a store (RNF01). Priority for the
 * accent/brand color: appConfig.accentColor (GondolaAppBuilder) > supermarket
 * themeColor > Nexmarket green. Name: appConfig.storeName > supermarket.name.
 */
export interface Brand {
  color: string;
  colorDark: string;
  colorSoft: string;
  name: string;
  logoUrl?: string;
  fontFamily: 'sans' | 'serif' | 'mono';
}

const HEX = /^#([0-9a-f]{6})$/i;

function safeColor(c?: string): string | null {
  if (!c) return null;
  const v = c.trim();
  return HEX.test(v) ? v : null;
}

export function resolveBrand(sm: Supermarket | null, appConfig: AppConfig | null): Brand {
  const color =
    safeColor(appConfig?.accentColor) || safeColor(sm?.themeColor) || palette.green;
  return {
    color,
    colorDark: darkenColor(color, 0.82),
    colorSoft: softColor(color, 0.14),
    name: appConfig?.storeName || sm?.name || 'Nexmarket',
    logoUrl: sm?.logoUrl,
    fontFamily: appConfig?.fontFamily || 'sans',
  };
}

export const defaultBrand: Brand = {
  color: palette.green,
  colorDark: palette.greenDark,
  colorSoft: palette.greenSoft,
  name: 'Nexmarket',
  fontFamily: 'sans',
};
