import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, Alert, Image, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { QrCode, Copy, ShieldCheck, CreditCard, RefreshCw } from 'lucide-react-native';

import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useColors } from '../hooks/useColors';
import { font, fontSize, radius, spacing } from '../lib/theme';
import { brl } from '../lib/format';
import { subscribeOrder } from '../lib/orders';
import {
  paymentsConfigured,
  createCheckoutSession,
  createPixPayment,
  getPaymentStatus,
  getSavedMethods,
  chargeSaved,
  tokenizeCard,
  maskCardNumber,
  maskExpiry,
  type PixPayment,
  type SavedCard,
} from '../lib/payments';
import { warnHaptic, successHaptic } from '../lib/notifications';
import type { PaymentMethod } from '../lib/types';

export interface PaidInfo {
  paymentIntentId?: string;
  checkoutSessionId?: string;
}

interface Props {
  visible: boolean;
  method: PaymentMethod | null; // 'pix' | 'card_online'
  smId: string;
  orderId: string;
  total: number;
  storeName?: string;
  /** paid=true → pagamento confirmado; paid=false → “pagar depois”. */
  onDone: (paid: boolean, info?: PaidInfo) => void;
}

/**
 * Folha de pagamento online usada no checkout e na retomada de pagamento da
 * tela do pedido. Com o servidor de pagamentos configurado
 * (EXPO_PUBLIC_PAYMENTS_API_URL) cobra de verdade via Stripe:
 *   • PIX  → QR code + copia-e-cola reais, com verificação automática;
 *   • Cartão → Stripe Checkout no navegador (dados nunca passam pelo app).
 * Sem servidor configurado cai no modo demonstração antigo.
 */
export function PayOnlineSheet({ visible, method, smId, orderId, total, storeName, onDone }: Props) {
  const { colors } = useColors();
  const stripeMode = paymentsConfigured();
  const isPix = method === 'pix';

  const [busy, setBusy] = useState(false);
  const [pix, setPix] = useState<PixPayment | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [awaitingCard, setAwaitingCard] = useState(false);
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '' });
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [saveCard, setSaveCard] = useState(true);
  const doneRef = useRef(false);

  const finish = (paid: boolean, info?: PaidInfo) => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (paid) successHaptic();
    onDone(paid, info);
  };

  // Reset interno sempre que a folha abre para um novo pagamento.
  useEffect(() => {
    if (visible) {
      doneRef.current = false;
      setPix(null);
      setPixError(null);
      setSessionId(null);
      setAwaitingCard(false);
    }
  }, [visible, orderId]);

  // O webhook do servidor pode marcar o pedido como pago antes do app —
  // acompanha o documento e fecha sozinho.
  useEffect(() => {
    if (!visible || !smId || !orderId) return;
    const unsub = subscribeOrder(smId, orderId, (o) => {
      if (o?.paymentStatus === 'paid') finish(true);
    });
    return unsub;
  }, [visible, smId, orderId]);

  // Cartões salvos (pagamento em 1 toque).
  useEffect(() => {
    if (!visible || !stripeMode || isPix) return;
    getSavedMethods()
      .then(setSavedCards)
      .catch(() => setSavedCards([]));
  }, [visible, stripeMode, isPix]);

  // PIX (Stripe): cria a cobrança ao abrir.
  useEffect(() => {
    if (!visible || !stripeMode || !isPix || pix || pixError) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await createPixPayment({ smId, orderId, amount: total });
        if (!cancelled) setPix(p);
      } catch (e: any) {
        if (!cancelled) {
          setPixError(
            e?.pixUnavailable
              ? 'O PIX ainda não está habilitado na conta de pagamentos. Você pode pagar com cartão ou deixar para depois.'
              : e?.message || 'Não foi possível gerar o PIX agora.',
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, stripeMode, isPix, smId, orderId]);

  // Verificação automática do PIX a cada 4s.
  useEffect(() => {
    if (!visible || !pix?.paymentIntentId) return;
    const t = setInterval(async () => {
      try {
        const s = await getPaymentStatus({ paymentIntentId: pix.paymentIntentId, smId, orderId });
        if (s.paid) finish(true, { paymentIntentId: pix.paymentIntentId });
      } catch {
        // silencioso: tenta de novo no próximo tick
      }
    }, 4000);
    return () => clearInterval(t);
  }, [visible, pix?.paymentIntentId, smId, orderId]);

  const redirect = useMemo(() => Linking.createURL('payment-result'), []);

  /** Cartão via Stripe Checkout no navegador. */
  const payWithCard = async () => {
    setBusy(true);
    try {
      const session = await createCheckoutSession({ smId, orderId, amount: total, storeName, next: redirect, saveCard });
      setSessionId(session.sessionId);
      setAwaitingCard(true);
      await WebBrowser.openAuthSessionAsync(session.url, redirect);
      await verifyCard(session.sessionId, true);
    } catch (e: any) {
      warnHaptic();
      Alert.alert('Pagamento', e?.message || 'Não foi possível iniciar o pagamento.');
    } finally {
      setBusy(false);
    }
  };

  /** Pagamento em 1 toque com cartão salvo (off_session). */
  const payWithSaved = async (pm: SavedCard) => {
    setBusy(true);
    try {
      const res = await chargeSaved({ smId, orderId, amount: total, paymentMethodId: pm.id });
      if (res.ok) {
        finish(true, { paymentIntentId: res.paymentIntentId });
      } else {
        Alert.alert('Pagamento', 'A cobrança não foi concluída. Tente outro cartão.');
      }
    } catch (e: any) {
      warnHaptic();
      if (e?.requiresAction) {
        Alert.alert('Autenticação necessária', 'Este cartão pede confirmação do banco. Vamos abrir o pagamento seguro no navegador.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Continuar', onPress: payWithCard },
        ]);
      } else {
        Alert.alert('Pagamento não autorizado', e?.message || 'Tente outro cartão.');
      }
    } finally {
      setBusy(false);
    }
  };

  const verifyCard = async (sid?: string | null, silent = false) => {
    const id = sid || sessionId;
    if (!id) return;
    setBusy(true);
    try {
      const s = await getPaymentStatus({ sessionId: id, smId, orderId });
      if (s.paid) {
        finish(true, { checkoutSessionId: id, paymentIntentId: s.paymentIntentId || undefined });
      } else if (!silent) {
        Alert.alert('Ainda não recebemos a confirmação', 'Se você concluiu o pagamento, aguarde alguns segundos e toque em "Verificar pagamento" novamente.');
      }
    } catch (e: any) {
      if (!silent) Alert.alert('Pagamento', e?.message || 'Não foi possível verificar o pagamento.');
    } finally {
      setBusy(false);
    }
  };

  /** Modo demonstração (sem servidor configurado). */
  const confirmDemo = async () => {
    setBusy(true);
    try {
      if (!isPix) await tokenizeCard(card);
      finish(true);
    } catch (e: any) {
      warnHaptic();
      Alert.alert('Pagamento não autorizado', e?.message || 'Tente outro cartão ou pague com PIX.');
    } finally {
      setBusy(false);
    }
  };

  if (!visible || !method) return null;

  const demoPixCode = `00020126BR.GOV.BCB.PIX${orderId}5204000053039865802BR6009NEXMARKET${Math.round(total * 100)}6304NEX1`;
  const pixCode = stripeMode ? pix?.qrData || '' : demoPixCode;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => finish(false)}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'], padding: spacing.lg, gap: spacing.md }}>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl }}>
            {isPix ? 'Pague com PIX' : 'Pagamento com cartão'}
          </Text>

          {/* ---------------------------- PIX ---------------------------- */}
          {isPix ? (
            stripeMode ? (
              pixError ? (
                <>
                  <Text style={{ color: colors.textMuted }}>{pixError}</Text>
                  <Button label="Pagar com cartão" size="lg" loading={busy} icon={<CreditCard size={18} color="#fff" />} onPress={payWithCard} />
                </>
              ) : !pix ? (
                <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: 10 }}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={{ color: colors.textMuted }}>Gerando cobrança PIX…</Text>
                </View>
              ) : (
                <>
                  <Text style={{ color: colors.textMuted }}>
                    Escaneie o QR Code ou use o copia-e-cola no app do seu banco. A confirmação é automática.
                  </Text>
                  <View style={{ alignSelf: 'center', width: 190, height: 190, borderRadius: radius.lg, backgroundColor: '#fff', borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {pix.qrImageUrl ? (
                      <Image source={{ uri: pix.qrImageUrl }} style={{ width: 182, height: 182 }} resizeMode="contain" />
                    ) : (
                      <QrCode size={120} color="#0F172A" />
                    )}
                  </View>
                  <Pressable
                    onPress={async () => {
                      await Clipboard.setStringAsync(pixCode);
                      Alert.alert('Copiado!', 'Código PIX copiado. Cole no app do seu banco.');
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, padding: spacing.md }}
                  >
                    <Copy size={18} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontWeight: font.bold }}>Copiar código PIX</Text>
                  </Pressable>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs }}>Aguardando pagamento…</Text>
                  </View>
                </>
              )
            ) : (
              /* PIX demo */
              <>
                <Text style={{ color: colors.textMuted }}>Modo demonstração — configure o servidor de pagamentos para cobranças PIX reais.</Text>
                <View style={{ alignSelf: 'center', width: 180, height: 180, borderRadius: radius.lg, backgroundColor: '#fff', borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <QrCode size={120} color="#0F172A" />
                </View>
                <Pressable
                  onPress={async () => {
                    await Clipboard.setStringAsync(pixCode);
                    Alert.alert('Copiado!', 'Código PIX copiado.');
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, padding: spacing.md }}
                >
                  <Copy size={18} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: font.bold }}>Copiar código PIX</Text>
                </Pressable>
              </>
            )
          ) : /* --------------------------- Cartão --------------------------- */
          stripeMode ? (
            <>
              {/* Cartões salvos → pagamento em 1 toque */}
              {savedCards.length > 0 && !awaitingCard ? (
                <View style={{ gap: spacing.sm }}>
                  {savedCards.map((pm) => (
                    <Pressable
                      key={pm.id}
                      disabled={busy}
                      onPress={() => payWithSaved(pm)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primarySoft, padding: spacing.md }}
                    >
                      <CreditCard size={22} color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: font.black, textTransform: 'capitalize' }}>
                          {pm.brand} •••• {pm.last4}
                        </Text>
                        <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs }}>Pagar em 1 toque</Text>
                      </View>
                      {busy ? <ActivityIndicator size="small" color={colors.primary} /> : null}
                    </Pressable>
                  ))}
                  <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, textAlign: 'center' }}>ou pague com outro cartão abaixo</Text>
                </View>
              ) : null}

              <Text style={{ color: colors.textMuted }}>
                Você será levado à página segura da Stripe para digitar os dados do cartão. Nada fica salvo no app ou em nossos servidores.
              </Text>
              {!awaitingCard ? (
                <Pressable onPress={() => setSaveCard((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: saveCard ? colors.primary : colors.border, backgroundColor: saveCard ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {saveCard ? <Text style={{ color: '#fff', fontWeight: font.black, fontSize: 13 }}>✓</Text> : null}
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, flex: 1 }}>Salvar cartão para pagar em 1 toque nas próximas compras</Text>
                </Pressable>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={14} color={colors.primary} />
                <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, flex: 1 }}>
                  Pagamento processado pela Stripe (PCI-DSS). Apple Pay/Google Pay aparecem automaticamente quando disponíveis. RNF10: nenhum dado de cartão é armazenado.
                </Text>
              </View>
              {awaitingCard ? (
                <Button label="Verificar pagamento" size="lg" loading={busy} icon={<RefreshCw size={18} color="#fff" />} onPress={() => verifyCard()} />
              ) : null}
            </>
          ) : (
            /* Cartão demo */
            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Modo demonstração — configure o servidor de pagamentos para cobrar de verdade via Stripe.</Text>
              <Input label="Número do cartão" placeholder="0000 0000 0000 0000" keyboardType="number-pad" value={card.number} onChangeText={(t) => setCard((c) => ({ ...c, number: maskCardNumber(t) }))} />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Input label="Validade" placeholder="MM/AA" keyboardType="number-pad" value={card.expiry} onChangeText={(t) => setCard((c) => ({ ...c, expiry: maskExpiry(t) }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="CVV" placeholder="123" keyboardType="number-pad" secureTextEntry value={card.cvv} onChangeText={(t) => setCard((c) => ({ ...c, cvv: t.replace(/\D/g, '').slice(0, 4) }))} />
                </View>
              </View>
            </View>
          )}

          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg, textAlign: 'center' }}>{brl(total)}</Text>

          {stripeMode ? (
            !isPix && !awaitingCard ? (
              <Button
                label={savedCards.length > 0 ? 'Pagar com outro cartão' : 'Pagar com cartão (Stripe)'}
                size="lg"
                loading={busy}
                icon={<CreditCard size={18} color="#fff" />}
                onPress={payWithCard}
              />
            ) : null
          ) : (
            <Button label={isPix ? 'Já fiz o pagamento' : 'Pagar agora'} size="lg" loading={busy} onPress={confirmDemo} />
          )}
          <Button label="Pagar depois" variant="ghost" onPress={() => finish(false)} />
        </View>
      </View>
    </Modal>
  );
}
