import { Linking, Platform } from 'react-native';
import type { GeoPoint } from './types';

/** Haversine distance in meters between two coordinates. */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function isValidGeo(p?: GeoPoint | null): p is GeoPoint {
  return !!p && typeof p.lat === 'number' && typeof p.lng === 'number';
}

/**
 * Opens turn-by-turn navigation in the driver's preferred external app
 * (Google Maps or Waze). Falls back to a generic geo/maps URL.
 */
export async function openNavigation(
  dest: { lat: number; lng: number },
  app: 'google' | 'waze' = 'google',
  label?: string,
) {
  const { lat, lng } = dest;
  const candidates: string[] = [];

  if (app === 'waze') {
    candidates.push(`waze://?ll=${lat},${lng}&navigate=yes`);
    candidates.push(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`);
  }

  // Google Maps (native scheme on iOS, geo intent on Android) + web fallback
  if (Platform.OS === 'ios') {
    candidates.push(`comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`);
  } else {
    candidates.push(`google.navigation:q=${lat},${lng}`);
  }
  const q = label ? encodeURIComponent(label) : `${lat},${lng}`;
  candidates.push(
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${q}`,
  );

  for (const url of candidates) {
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // try next
    }
  }
  // last resort
  await Linking.openURL(
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  );
}

/** Open navigation to a free-text address/place query (no coordinates). */
export async function openNavigationQuery(query: string, app: 'google' | 'waze' = 'google') {
  const q = encodeURIComponent(query);
  const candidates =
    app === 'waze'
      ? [`waze://?q=${q}&navigate=yes`, `https://waze.com/ul?q=${q}&navigate=yes`]
      : [];
  candidates.push(`https://www.google.com/maps/dir/?api=1&destination=${q}`);
  for (const url of candidates) {
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return;
      }
    } catch {}
  }
  await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
}

/** Default map region centered on a point with a small zoom delta. */
export function regionFor(p: { lat: number; lng: number }, delta = 0.02) {
  return {
    latitude: p.lat,
    longitude: p.lng,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}
