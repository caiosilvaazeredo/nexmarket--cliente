import { auth } from './firebase';
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
 * Tokenize a card — DEMO fallback only, used when the Stripe payments server
 * (EXPO_PUBLIC_PAYMENTS_API_URL) is not configured. With Stripe the card data
 * is typed directly on the Stripe Checkout page and never touches our code
 * (RNF10).
 */
export async function tokenizeCard(card: { number: string; cvv: string; expiry: string }): Promise<CardToken> {
  await new Promise((r) => setTimeout(r, 600));
  const digits = card.number.replace(/\D/g, '');
  if (digits.length < 13) throw new Error('Número de cartão inválido.');
  return {
    token: `tok_${Math.random().toString(36).slice(2, 14)}`,
    brand: cardBrand(card.number),
    last4: last4(card.number),
  };
}

/* ===================== Stripe (servidor de pagamentos) ===================== */
/**
 * Os apps NUNCA falam com a Stripe usando a chave secreta: todo pagamento
 * online passa pelo servidor de pagamentos da plataforma (repo
 * nexmarket--Empresa, pasta server/), que valida o token Firebase do usuário
 * e cria as cobranças. Aqui só existe o client HTTP desse servidor.
 */

export function paymentsApiUrl(): string {
  return (process.env.EXPO_PUBLIC_PAYMENTS_API_URL || '').trim().replace(/\/$/, '');
}

/** Whether real (Stripe) payments are configured; otherwise the demo flow runs. */
export function paymentsConfigured(): boolean {
  return paymentsApiUrl().length > 0;
}

async function api<T>(path: string, init?: RequestInit & { query?: Record<string, string> }): Promise<T> {
  const base = paymentsApiUrl();
  if (!base) throw new Error('Servidor de pagamentos não configurado.');
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('É necessário estar logado para pagar online.');
  const qs = init?.query ? `?${new URLSearchParams(init.query).toString()}` : '';
  const res = await fetch(`${base}${path}${qs}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(body?.error || `Falha no servidor de pagamentos (${res.status}).`);
    err.pixUnavailable = !!body?.pixUnavailable;
    err.status = res.status;
    throw err;
  }
  return body as T;
}

export interface CheckoutSession {
  url: string;
  sessionId: string;
  amount: number;
}

/** Stripe Checkout (cartão): retorna a URL hospedada para abrir no navegador. */
export function createCheckoutSession(input: {
  smId: string;
  orderId: string;
  amount: number;
  storeName?: string;
  next?: string;
}): Promise<CheckoutSession> {
  return api<CheckoutSession>('/api/payments/checkout-session', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface PixPayment {
  paymentIntentId: string;
  status: string;
  amount: number;
  qrData: string | null;
  qrImageUrl: string | null;
  hostedUrl: string | null;
  expiresAt: number | null;
}

/** PIX real via Stripe: QR code + copia-e-cola. Lança erro com
 * `pixUnavailable=true` se o método não estiver ativado na conta Stripe. */
export function createPixPayment(input: { smId: string; orderId: string; amount: number }): Promise<PixPayment> {
  return api<PixPayment>('/api/payments/pix-intent', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface PaymentStatus {
  status: string;
  paid: boolean;
  paymentIntentId: string | null;
}

export function getPaymentStatus(input: {
  sessionId?: string;
  paymentIntentId?: string;
  smId: string;
  orderId: string;
}): Promise<PaymentStatus> {
  const query: Record<string, string> = { smId: input.smId, orderId: input.orderId };
  if (input.sessionId) query.sessionId = input.sessionId;
  if (input.paymentIntentId) query.paymentIntentId = input.paymentIntentId;
  return api<PaymentStatus>('/api/payments/status', { query });
}
