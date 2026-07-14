/**
 * Variante web de nativePay. O @stripe/stripe-react-native é um módulo
 * exclusivamente nativo (o Metro nem consegue bundlá-lo para web), então no
 * navegador as carteiras nativas ficam indisponíveis — o checkout segue pelo
 * fluxo do Stripe Checkout no navegador, onde Apple Pay/Google Pay já
 * aparecem automaticamente quando suportados.
 */

/** Nome da carteira da plataforma atual (para o rótulo do botão). */
export function nativeWalletLabel(): string {
  return 'Google Pay';
}

/** Carteira nativa nunca está disponível na web. */
export async function isNativeWalletAvailable(): Promise<boolean> {
  return false;
}

/** Nunca deve ser chamado na web (isNativeWalletAvailable retorna false). */
export async function payWithNativeWallet(_input: {
  smId: string;
  orderId: string;
  amount: number;
  storeName?: string;
}): Promise<{ paymentIntentId: string }> {
  throw new Error('Carteira nativa indisponível no navegador. Use o pagamento pelo Stripe Checkout.');
}
