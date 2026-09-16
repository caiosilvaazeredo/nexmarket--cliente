/**
 * Regras comerciais da fase piloto — espelha server/lib/fees.js (repo
 * nexmarket--Empresa) para exibir estimativas de frete/taxa de serviço
 * instantaneamente no checkout, sem round-trip ao servidor. O valor final
 * cobrado é sempre recalculado no servidor.
 */

export const MIN_ORDER_BRL = 40;
/** Comissão retida da loja sobre o subtotal de produtos — loja fica com 90%. */
export const COMMISSION_PCT = 0.1;

const DELIVERY_BASE_KM = 4;
const DELIVERY_BASE_CHARGED = 10.0;
const DELIVERY_BASE_PAID = 7.5;
const MOTO_MAX_KM = 8;
const MOTO_PER_KM_CHARGED = 1.7;
const MOTO_PER_KM_PAID = 1.5;
const CARRO_PER_KM_CHARGED = 2.8;
const CARRO_PER_KM_PAID = 2.4;

const SERVICE_FEE_FLOOR = 1.49;
const SERVICE_FEE_FLOOR_MAX_SUBTOTAL = 60;
const SERVICE_FEE_PCT = 0.025;
const SERVICE_FEE_CEIL = 3.49;
const SERVICE_FEE_CEIL_MIN_SUBTOTAL = 140;

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface DeliveryFeeBreakdown {
  charged: number;
  paid: number;
  platformMargin: number;
}

/**
 * Frete por distância (km em linha reta loja → cliente):
 *  · até 4km: R$10,00 cobrado / R$7,50 repassado ao entregador
 *  · 4-8km (moto): +R$1,70/km cobrado / +R$1,50/km repassado
 *  · acima de 8km (carro): +R$2,80/km cobrado / +R$2,40/km repassado
 */
export function calcDeliveryFee(distanceKm: number): DeliveryFeeBreakdown {
  const km = Math.max(0, Number(distanceKm) || 0);
  let charged = DELIVERY_BASE_CHARGED;
  let paid = DELIVERY_BASE_PAID;
  if (km > DELIVERY_BASE_KM) {
    const motoKm = Math.min(km, MOTO_MAX_KM) - DELIVERY_BASE_KM;
    charged += motoKm * MOTO_PER_KM_CHARGED;
    paid += motoKm * MOTO_PER_KM_PAID;
  }
  if (km > MOTO_MAX_KM) {
    const carroKm = km - MOTO_MAX_KM;
    charged += carroKm * CARRO_PER_KM_CHARGED;
    paid += carroKm * CARRO_PER_KM_PAID;
  }
  charged = round2(charged);
  paid = round2(paid);
  return { charged, paid, platformMargin: round2(charged - paid) };
}

/** Taxa de serviço: piso R$1,49 (carrinho ≤R$60) · 2,5% (R$60-140) · teto
 * R$3,49 (≥R$140) — 100% retida pela plataforma. */
export function calcServiceFee(subtotal: number): number {
  const s = Math.max(0, Number(subtotal) || 0);
  if (s <= SERVICE_FEE_FLOOR_MAX_SUBTOTAL) return SERVICE_FEE_FLOOR;
  if (s >= SERVICE_FEE_CEIL_MIN_SUBTOTAL) return SERVICE_FEE_CEIL;
  return round2(s * SERVICE_FEE_PCT);
}

export function calcCommission(subtotal: number): number {
  return round2(Number(subtotal || 0) * COMMISSION_PCT);
}

export function meetsMinimumOrder(subtotal: number): boolean {
  return Number(subtotal || 0) >= MIN_ORDER_BRL;
}

export interface OrderBreakdown {
  subtotal: number;
  deliveryFee: number;
  deliveryPaidToDriver: number;
  serviceFee: number;
  total: number;
  storeCommission: number;
  storeNet: number;
  meetsMinimum: boolean;
}

export function calcOrderBreakdown({
  subtotal,
  distanceKm = 0,
  fulfillment = 'delivery',
}: {
  subtotal: number;
  distanceKm?: number;
  fulfillment?: 'delivery' | 'pickup';
}): OrderBreakdown {
  const sub = round2(Number(subtotal || 0));
  const isDelivery = fulfillment !== 'pickup';
  const delivery = isDelivery ? calcDeliveryFee(distanceKm) : { charged: 0, paid: 0, platformMargin: 0 };
  const serviceFee = calcServiceFee(sub);
  const commission = calcCommission(sub);
  const total = round2(sub + delivery.charged + serviceFee);
  return {
    subtotal: sub,
    deliveryFee: delivery.charged,
    deliveryPaidToDriver: delivery.paid,
    serviceFee,
    total,
    storeCommission: commission,
    storeNet: round2(sub - commission),
    meetsMinimum: meetsMinimumOrder(sub),
  };
}
