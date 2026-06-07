import * as Location from 'expo-location';

/**
 * Address auto-complete & validation (RF04, RNF09).
 *
 * - CEP lookup uses the free, keyless ViaCEP API (BR postal codes).
 * - GPS reverse/forward geocoding uses expo-location (which routes through the
 *   platform geocoder, or Google Maps when an API key is set in app.json).
 *
 * No third-party SDK or key is required for CEP; Google Maps key only improves
 * geocoding precision.
 */

export interface CepAddress {
  cep: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export function maskCep(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function isValidCep(cep: string): boolean {
  return /^\d{8}$/.test(cep.replace(/\D/g, ''));
}

export async function lookupCep(cepRaw: string): Promise<CepAddress | null> {
  const cep = cepRaw.replace(/\D/g, '');
  if (!isValidCep(cep)) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return {
      cep: maskCep(cep),
      street: data.logradouro || '',
      neighborhood: data.bairro || '',
      city: data.localidade || '',
      state: data.uf || '',
    };
  } catch (e) {
    console.warn('lookupCep failed', e);
    return null;
  }
}

/** Resolve lat/lng for a full address string (best-effort, for delivery routing). */
export async function geocodeAddress(addressLine: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const results = await Location.geocodeAsync(addressLine);
    if (results.length) {
      return { lat: results[0].latitude, lng: results[0].longitude };
    }
  } catch (e) {
    console.warn('geocodeAddress failed', e);
  }
  return null;
}

/** Use the device GPS to fill an address (RF04 "via GPS"). */
export async function addressFromCurrentLocation(): Promise<{
  lat: number;
  lng: number;
  cep?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
} | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const { latitude, longitude } = pos.coords;
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const p = places[0];
    return {
      lat: latitude,
      lng: longitude,
      cep: p?.postalCode ? maskCep(p.postalCode) : undefined,
      street: p?.street || p?.name || undefined,
      number: p?.streetNumber || undefined,
      neighborhood: p?.district || p?.subregion || undefined,
      city: p?.city || undefined,
      state: p?.region || undefined,
    };
  } catch (e) {
    console.warn('addressFromCurrentLocation failed', e);
    return null;
  }
}
