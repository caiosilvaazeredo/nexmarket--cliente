/**
 * Apple Pay / Google Pay DENTRO do app (PlatformPay do
 * @stripe/stripe-react-native).
 *
 * O módulo é nativo: funciona em dev build / EAS Build (`npx expo prebuild`),
 * mas NÃO existe no Expo Go — por isso todo o acesso é dinâmico e guardado:
 * sem o módulo nativo o app continua normal e as carteiras seguem aparecendo
 * na página do Stripe Checkout (fluxo do navegador).
 *
 * Requisitos de produção:
 *  • Apple Pay: Merchant ID `merchant.com.nexmarket.cliente` criado no Apple
 *    Developer + certificado registrado no dashboard Stripe (Settings →
 *    Payment methods → Apple Pay).
 *  • Google Pay: ativado no dashboard Stripe; em teste usa `testEnv`.
 */
import { NativeModules, Platform } from 'react-native';
import { createPaymentIntent, paymentsConfigured } from './payments';

type StripeRN = typeof import('@stripe/stripe-react-native');

// Módulo nativo presente? (Expo Go → não; dev build/EAS → sim)
function loadStripe(): StripeRN | null {
  if (!(NativeModules as any).StripeSdk) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@stripe/stripe-react-native') as StripeRN;
  } catch {
    return null;
  }
}

const stripeRN = loadStripe();
let initialized = false;

async function ensureInit(publishableKey: string): Promise<void> {
  if (!stripeRN || initialized) return;
  await stripeRN.initStripe({
    publishableKey,
    merchantIdentifier: 'merchant.com.nexmarket.cliente',
  });
  initialized = true;
}

/** Nome da carteira da plataforma atual (para o rótulo do botão). */
export function nativeWalletLabel(): string {
  return Platform.OS === 'ios' ? 'Apple Pay' : 'Google Pay';
}

/**
 * Carteira nativa disponível neste aparelho/build?
 * Retorna false no Expo Go, na web e quando o aparelho não suporta.
 */
export async function isNativeWalletAvailable(): Promise<boolean> {
  if (!stripeRN || !paymentsConfigured() || Platform.OS === 'web') return false;
  try {
    return await stripeRN.isPlatformPaySupported(
      Platform.OS === 'android' ? { googlePay: { testEnv: true } } : undefined,
    );
  } catch {
    return false;
  }
}

/**
 * Cobra o pedido com Apple Pay/Google Pay. Lança erro com `canceled=true`
 * quando o usuário fecha a folha da carteira sem pagar.
 */
export async function payWithNativeWallet(input: {
  smId: string;
  orderId: string;
  amount: number;
  storeName?: string;
}): Promise<{ paymentIntentId: string }> {
  if (!stripeRN) throw new Error('Carteira nativa indisponível neste build.');

  const intent = await createPaymentIntent(input);
  await ensureInit(intent.publishableKey);

  const { error } = await stripeRN.confirmPlatformPayPayment(intent.clientSecret, {
    applePay: {
      cartItems: [
        {
          label: input.storeName || 'Nexmarket',
          amount: intent.amount.toFixed(2),
          paymentType: stripeRN.PlatformPay.PaymentType.Immediate,
        },
      ],
      merchantCountryCode: 'BR',
      currencyCode: 'BRL',
    },
    googlePay: {
      testEnv: intent.testEnv,
      merchantCountryCode: 'BR',
      currencyCode: 'BRL',
      merchantName: input.storeName || 'Nexmarket',
    },
  });

  if (error) {
    const err: any = new Error(
      error.code === 'Canceled' ? 'Pagamento cancelado.' : error.message || 'Pagamento não concluído.',
    );
    err.canceled = error.code === 'Canceled';
    throw err;
  }
  return { paymentIntentId: intent.paymentIntentId };
}
