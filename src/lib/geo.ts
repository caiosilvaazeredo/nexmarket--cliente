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

export function isValidGeo(p?: GeoPoint | { lat?: number; lng?: number } | null): p is GeoPoint {
  return !!p && typeof p.lat === 'number' && typeof p.lng === 'number';
}

/** Open external maps directions to a destination. */
export async function openDirections(
  dest: { lat: number; lng: number },
  label?: string,
) {
  const { lat, lng } = dest;
  const q = label ? encodeURIComponent(label) : `${lat},${lng}`;
  const candidates: string[] = [];
  if (Platform.OS === 'ios') {
    candidates.push(`comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`);
  } else {
    candidates.push(`google.navigation:q=${lat},${lng}`);
  }
  candidates.push(
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${q}`,
  );
  for (const url of candidates) {
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return;
      }
    } catch {}
  }
  await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
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

/** A region that comfortably contains two points (driver + destination). */
export function regionForBounds(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const minLat = Math.min(a.lat, b.lat);
  const maxLat = Math.max(a.lat, b.lat);
  const minLng = Math.min(a.lng, b.lng);
  const maxLng = Math.max(a.lng, b.lng);
  const latPad = Math.max((maxLat - minLat) * 0.6, 0.008);
  const lngPad = Math.max((maxLng - minLng) * 0.6, 0.008);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: maxLat - minLat + latPad * 2,
    longitudeDelta: maxLng - minLng + lngPad * 2,
  };
}
