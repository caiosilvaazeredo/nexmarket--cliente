import * as Location from 'expo-location';

/**
 * Lightweight foreground-only location for the customer app: used to find
 * nearby stores and to drop a precise pin on a delivery address (RF04, RNF09).
 * No background tracking — the customer never shares continuous location.
 */

export async function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      const r = await Location.requestForegroundPermissionsAsync();
      if (r.status !== 'granted') return null;
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

export async function hasLocationPermission(): Promise<boolean> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    return fg.status === 'granted';
  } catch {
    return false;
  }
}

/** Reverse-geocode coordinates into a partial address (best-effort). */
export async function reverseGeocode(lat: number, lng: number) {
  try {
    const res = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const a = res?.[0];
    if (!a) return null;
    return {
      street: a.street || a.name || '',
      neighborhood: (a as any).district || a.subregion || '',
      city: a.city || a.subregion || '',
      state: a.region || '',
      cep: (a.postalCode || '').replace(/\D/g, ''),
    };
  } catch {
    return null;
  }
}
