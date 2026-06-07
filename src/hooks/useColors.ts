import { useColorScheme } from 'react-native';
import { useStore } from '../store/useStore';
import { ThemeColors } from '../lib/theme';
import { resolvedColors } from '../lib/branding';

/**
 * Resolve the active palette. Theme preference (dark/light/system) comes from
 * the customer profile; the store's white-label branding is layered on top so
 * the whole app re-skins to the supermarket's identity (RNF01).
 */
export function useColors(): { colors: ThemeColors; dark: boolean } {
  const scheme = useColorScheme();
  const pref = useStore((s) => s.customer?.preferences?.darkMode);
  const branding = useStore((s) => s.branding);
  const dark = pref === undefined || pref === null ? scheme === 'dark' : pref;
  return { colors: resolvedColors(dark, branding), dark };
}
