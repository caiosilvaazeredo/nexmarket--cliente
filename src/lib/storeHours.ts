import type { StoreInfo, DeliveryConfig } from './types';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABELS: Record<string, string> = {
  sun: 'Domingo',
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
  sat: 'Sábado',
};

function minutesNow(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function toMinutes(hhmm?: string): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  if (isNaN(h)) return null;
  return h * 60 + (isNaN(m) ? 0 : m);
}

/** Whether the store is open right now based on its opening hours. */
export function isStoreOpenNow(info: StoreInfo | null): boolean {
  const hours = info?.openingHours;
  if (!hours) return true; // assume open if not configured
  const key = DAY_KEYS[new Date().getDay()];
  const today = hours[key];
  if (!today || !today.isOpen) return false;
  const open = toMinutes(today.openTime);
  const close = toMinutes(today.closeTime);
  if (open == null || close == null) return true;
  const now = minutesNow();
  if (close <= open) return now >= open; // crosses midnight (best-effort)
  return now >= open && now <= close;
}

/** Today's "08:00 às 20:00" string, or "Fechado". */
export function todayHoursLabel(info: StoreInfo | null): string {
  const hours = info?.openingHours;
  if (!hours) return '';
  const key = DAY_KEYS[new Date().getDay()];
  const today = hours[key];
  if (!today || !today.isOpen) return 'Fechado hoje';
  return `Hoje: ${today.openTime} às ${today.closeTime}`;
}

export function weeklyHours(info: StoreInfo | null): { day: string; label: string }[] {
  const hours = info?.openingHours;
  if (!hours) return [];
  return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((k) => ({
    day: DAY_LABELS[k],
    label: hours[k]?.isOpen ? `${hours[k].openTime} - ${hours[k].closeTime}` : 'Fechado',
  }));
}

/**
 * Free-shipping / minimum-order hint for the home + cart (RF13). Returns a
 * short message or null when there's nothing to nudge.
 */
export function freeShippingHint(config: DeliveryConfig | null, subtotal: number): string | null {
  if (!config) return null;
  if (config.shippingType === 'free_diluted') {
    const min = Number(config.minimumOrderValue || 0);
    if (min > 0 && subtotal < min) {
      const falta = (min - subtotal).toFixed(2).replace('.', ',');
      return `Faltam R$ ${falta} para o pedido mínimo`;
    }
    if (min > 0) return 'Frete grátis liberado! 🎉';
    return 'Frete grátis';
  }
  return null;
}

/** The delivery fee that applies to a subtotal under the store's policy. */
export function computeDeliveryFee(config: DeliveryConfig | null): number {
  if (!config) return 0;
  if (config.shippingType === 'transparent') return Number(config.flatFeeValue || 0);
  return 0; // free_diluted
}

/** Whether the subtotal meets the minimum required to checkout (RF13). */
export function meetsMinimum(config: DeliveryConfig | null, subtotal: number): { ok: boolean; min: number; missing: number } {
  const min = config?.shippingType === 'free_diluted' ? Number(config?.minimumOrderValue || 0) : 0;
  const missing = Math.max(0, min - subtotal);
  return { ok: missing <= 0, min, missing };
}
