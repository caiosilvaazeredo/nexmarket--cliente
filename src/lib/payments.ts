import type { PaymentMethod } from './types';

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: 'PIX',
  card_online: 'Cartão de crédito (online)',
  card_delivery: 'Cartão na entrega',
  cash_delivery: 'Dinheiro na entrega',
  voucher_delivery: 'Vale-refeição na entrega',
};

export const PAYMENT_SHORT: Record<PaymentMethod, string> = {
  pix: 'PIX',
  card_online: 'Cartão online',
  card_delivery: 'Cartão na entrega',
  cash_delivery: 'Dinheiro',
  voucher_delivery: 'Vale',
};

/** Format a card number as groups of 4 digits while typing. */
export function maskCardNumber(raw: string): string {
  return (raw || '')
    .replace(/\D/g, '')
    .slice(0, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

export function maskExpiry(raw: string): string {
  const d = (raw || '').replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** Detect the card brand from the leading digits (display-only). */
export function cardBrand(raw: string): string {
  const n = (raw || '').replace(/\D/g, '');
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  if (/^(606282|3841|50)/.test(n)) return 'Elo';
  return 'Cartão';
}

export function last4(raw: string): string {
  const n = (raw || '').replace(/\D/g, '');
  return n.slice(-4);
}

export interface CardToken {
  token: string;
  brand: string;
  last4: string;
}

/**
 * Tokenize a card. This is a gateway-ready stub: in production it calls the
 * payment provider SDK (Stripe / Mercado Pago / Pagar.me) which returns an
 * opaque token. The raw card number / CVV are NEVER sent to or stored in our
 * own database (RNF10) — only the token (or nothing, for PIX/on-delivery).
 */
export async function tokenizeCard(card: { number: string; cvv: string; expiry: string }): Promise<CardToken> {
  // Simulated latency + token. Replace with the provider SDK call.
  await new Promise((r) => setTimeout(r, 600));
  const digits = card.number.replace(/\D/g, '');
  if (digits.length < 13) throw new Error('Número de cartão inválido.');
  return {
    token: `tok_${Math.random().toString(36).slice(2, 14)}`,
    brand: cardBrand(card.number),
    last4: last4(card.number),
  };
}
