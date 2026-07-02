import { auth } from './firebase';
import type { PaymentMethod } from './types';

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: 'PIX',
  card_online: 'Cartão de crédito (online)',
  picpay: 'PicPay',
  nupay: 'NuPay (Nubank)',
  card_delivery: 'Cartão na entrega',
  cash_delivery: 'Dinheiro na entrega',
  voucher_delivery: 'Vale-refeição na entrega',
};

export const PAYMENT_SHORT: Record<PaymentMethod, string> = {
  pix: 'PIX',
  card_online: 'Cartão online',
  picpay: 'PicPay',
  nupay: 'NuPay',
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
  /** Salvar o cartão no Customer da Stripe para pagar em 1 toque depois. */
  saveCard?: boolean;
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

/* ------------------------ Config pública do gateway ----------------------- */

export interface GatewayPublicConfig {
  publishableKey?: string;
  currency?: string;
  /** Carteiras extras habilitadas no servidor (PicPay/NuPay). */
  wallets?: { picpay?: boolean; nupay?: boolean };
}

let gwConfig: GatewayPublicConfig | null = null;
let gwConfigAt = 0;

/** GET /config (público, cache 5 min) — decide quais opções o checkout mostra. */
export async function getGatewayConfig(): Promise<GatewayPublicConfig> {
  const base = paymentsApiUrl();
  if (!base) return {};
  if (gwConfig && Date.now() - gwConfigAt < 5 * 60 * 1000) return gwConfig;
  try {
    const res = await fetch(`${base}/config`);
    gwConfig = res.ok ? await res.json() : {};
  } catch {
    gwConfig = {};
  }
  gwConfigAt = Date.now();
  return gwConfig || {};
}

/* -------------------- Carteiras BR: PicPay e NuPay ------------------------- */

export type WalletProvider = 'picpay' | 'nupay';

export interface WalletCharge {
  provider: WalletProvider;
  paymentUrl: string | null;
  qrContent: string | null;
  qrBase64: string | null;
  expiresAt: string | null;
}

/** Cria a cobrança na carteira (PicPay exige CPF do comprador). */
export async function createWalletPayment(
  provider: WalletProvider,
  input: {
    smId: string;
    orderId: string;
    amount: number;
    buyer?: { firstName?: string; lastName?: string; document?: string; email?: string; phone?: string };
  },
): Promise<WalletCharge> {
  try {
    return await api<WalletCharge>(`/api/payments/wallet/${provider}`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch (e: any) {
    e.cpfRequired = e?.status === 400 && /CPF/i.test(e?.message || '');
    e.walletUnavailable = e?.status === 501;
    throw e;
  }
}

export function getWalletStatus(
  provider: WalletProvider,
  input: { smId: string; orderId: string },
): Promise<{ status: string; paid: boolean }> {
  return api(`/api/payments/wallet/${provider}/status`, {
    query: { smId: input.smId, orderId: input.orderId },
  });
}

/* ------------------- Apple Pay / Google Pay (in-app) ------------------- */

export interface NativePayIntent {
  clientSecret: string;
  paymentIntentId: string;
  publishableKey: string;
  amount: number;
  testEnv: boolean;
}

/** PaymentIntent para confirmar com a carteira nativa (PlatformPay). */
export function createPaymentIntent(input: {
  smId: string;
  orderId: string;
  amount: number;
}): Promise<NativePayIntent> {
  return api<NativePayIntent>('/api/payments/payment-intent', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/* ------------------------ Cartões salvos (1 toque) ------------------------ */

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
}

export async function getSavedMethods(): Promise<SavedCard[]> {
  const res = await api<{ methods: SavedCard[] }>('/api/payments/saved-methods');
  return res.methods || [];
}

export function deleteSavedMethod(id: string): Promise<{ ok: boolean }> {
  return api(`/api/payments/saved-methods/${id}`, { method: 'DELETE' });
}

export interface ChargeResult {
  ok: boolean;
  status: string;
  paymentIntentId: string;
  amount: number;
}

/** Pagamento em 1 toque com cartão salvo. Lança erro com `requiresAction=true`
 * quando o cartão exige 3DS — aí o app cai para o Stripe Checkout. */
export async function chargeSaved(input: {
  smId: string;
  orderId: string;
  amount: number;
  paymentMethodId: string;
  kind?: 'order' | 'tip';
}): Promise<ChargeResult> {
  try {
    return await api<ChargeResult>('/api/payments/charge-saved', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch (e: any) {
    if (e?.status === 402) e.requiresAction = true;
    throw e;
  }
}

/** Gorjeta pós-entrega via Stripe Checkout (sem cartão salvo). */
export function createTipCheckout(input: {
  smId: string;
  orderId: string;
  amount: number;
  driverName?: string;
  next?: string;
}): Promise<CheckoutSession> {
  return api<CheckoutSession>('/api/payments/tip-checkout', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/* --------------------- Reembolso self-service por item --------------------- */

/** Estorno parcial automático de itens com problema. Erros esperados:
 * `needsReview=true` (acima do teto → vira chamado) e `notOnline=true`
 * (pedido sem pagamento online). */
export async function requestItemRefund(input: {
  smId: string;
  orderId: string;
  amount: number;
  reason: string;
}): Promise<{ ok: boolean; refundId: string; amount: number }> {
  try {
    return await api('/api/payments/item-refund', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch (e: any) {
    e.needsReview = e?.status === 422;
    throw e;
  }
}
