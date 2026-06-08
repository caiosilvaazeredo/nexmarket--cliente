import { useColorScheme } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { lightColors, darkColors, ThemeColors } from '../lib/theme';

/**
 * Resolve the active palette. The store's white-label brand color (RNF01)
 * overrides the green primary, and the customer's explicit dark-mode choice (if
 * any) overrides the OS appearance.
 */
export function useColors(): { colors: ThemeColors; dark: boolean } {
  const scheme = useColorScheme();
  const pref = useAppStore((s) => s.customer?.preferences?.darkMode);
  const brand = useAppStore((s) => s.brand);

  const dark = pref === undefined || pref === null ? scheme === 'dark' : pref;
  const base = dark ? darkColors : lightColors;

  const colors: ThemeColors = {
    ...base,
    primary: brand.color,
    primaryDark: brand.colorDark,
    primaryHover: brand.colorDark,
    primarySoft: brand.colorSoft,
  };
  return { colors, dark };
}

/** Convenience hook for the resolved brand (name, logo, font). */
export function useBrand() {
  return useAppStore((s) => s.brand);
}
