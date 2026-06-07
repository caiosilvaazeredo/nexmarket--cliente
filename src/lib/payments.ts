import type { SavedPaymentToken, PaymentMethod } from './types';

/**
 * Payment tokenization (RNF10).
 *
 * Raw card data (PAN, CVV) is NEVER persisted in our database. In production
 * the card fields are sent straight to the PSP's SDK (Stripe / MercadoPago /
 * Pagar.me), which returns an opaque token; only that token + the brand/last4
 * are stored on the customer profile.
 *
 * This module is the seam where that SDK call happens. Here it's stubbed with a
 * local "tokenizer" so the checkout flow works end-to-end in development; swap
 * `tokenizeCard` for the real PSP call (e.g. mercadopago.createCardToken) when
 * wiring a live account.
 */

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: 'PIX',
  card_online: 'Cartão (online)',
  card_delivery: 'Cartão na entrega',
  cash_delivery: 'Dinheiro na entrega',
};

export interface CardInput {
  number: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
}

function detectBrand(number: string): string {
  const n = number.replace(/\D/g, '');
  if (/^4/.test(n)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'master';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^(636368|438935|504175|451416|5067|4576|4011|506699)/.test(n)) return 'elo';
  if (/^606282/.test(n)) return 'hipercard';
  return 'card';
}

export function validateCard(card: CardInput): string | null {
  const n = card.number.replace(/\D/g, '');
  if (n.length < 13) return 'Número do cartão inválido.';
  if (!card.holderName.trim()) return 'Informe o nome impresso no cartão.';
  if (!/^\d{2}$/.test(card.expMonth) || Number(card.expMonth) > 12) return 'Mês de validade inválido.';
  if (!/^\d{2,4}$/.test(card.expYear)) return 'Ano de validade inválido.';
  if (!/^\d{3,4}$/.test(card.cvv)) return 'CVV inválido.';
  return null;
}

/**
 * Exchange card data for a provider token. PRODUCTION: replace the body with
 * the PSP SDK call. The plaintext card object never leaves this function.
 */
export async function tokenizeCard(
  card: CardInput,
  provider: 'stripe' | 'mercadopago' | 'pagarme' = 'mercadopago',
): Promise<SavedPaymentToken> {
  const error = validateCard(card);
  if (error) throw new Error(error);
  const n = card.number.replace(/\D/g, '');
  // Simulated tokenization — DO NOT ship this; call the PSP instead.
  await new Promise((r) => setTimeout(r, 600));
  return {
    id: `tok_${Date.now()}`,
    brand: detectBrand(n),
    last4: n.slice(-4),
    holderName: card.holderName.trim(),
    token: `tok_${provider}_${Math.random().toString(36).slice(2)}`,
    provider,
  };
}

export function maskCardNumber(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 19);
  return d.replace(/(.{4})/g, '$1 ').trim();
}
