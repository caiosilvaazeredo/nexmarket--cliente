import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, Alert, Image, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useColors } from '../hooks/useColors';
import { font, fontSize, radius, spacing } from '../lib/theme';
import { brl } from '../lib/format';
import { subscribeOrder } from '../lib/orders';
import {
  paymentsConfigured,
  checkout,
  getPaymentStatus,
  getSavedMethods,
  tokenizeCard,
  maskCardNumber,
  maskExpiry,
  type PixInfo,
  type SavedCard,
} from '../lib/payments';
import { warnHaptic, successHaptic } from '../lib/notifications';
import { QrCode, Copy, ShieldCheck, CreditCard } from 'lucide-react-native';
import type { PaymentMethod } from '../lib/types';

export interface PaidInfo {
  paymentIntentId?: string;
  provider?: string;
}

interface Props {
  visible: boolean;
  method: PaymentMethod | null; // 'pix' | 'card_online'
  smId: string;
  orderId: string;
  total: number;
  storeName?: string;
  /** 'tip' cobra uma gorjeta avulsa pós-entrega em vez do pedido em si. */
  kind?: 'order' | 'tip';
  driverName?: string;
  /** paid=true → pagamento confirmado; paid=false → "pagar depois". */
  onDone: (paid: boolean, info?: PaidInfo) => void;
}

/**
 * Folha de pagamento online (PIX/cartão) via Pagar.me. Com o servidor de
 * pagamentos configurado (EXPO_PUBLIC_PAYMENTS_API_URL) cobra de verdade:
 *   • PIX    → QR code + copia-e-cola reais, com verificação automática;
 *   • Cartão → tokenizado direto com a chave pública da Pagar.me (o número
 *     nunca passa pelo nosso servidor) e cobrado com split para a loja.
 * Sem servidor configurado cai no modo demonstração (não cobra de verdade).
 */
export function PayOnlineSheet({ visible, method, smId, orderId, total, storeName, kind = 'order', driverName, onDone }: Props) {
  const { colors } = useColors();
  const pagarmeMode = paymentsConfigured();
  const isPix = method === 'pix';

  const [busy, setBusy] = useState(false);
  const [pix, setPix] = useState<PixInfo | null>(null);
  const [pixOrderId, setPixOrderId] = useState<string | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [card, setCard] = useState({ number: '', holderName: '', expiry: '', cvv: '' });
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [showNewCard, setShowNewCard] = useState(false);
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
      setPixOrderId(null);
      setPixError(null);
      setShowNewCard(false);
      setCard({ number: '', holderName: '', expiry: '', cvv: '' });
    }
  }, [visible, orderId]);

  // O webhook do servidor pode marcar o pedido como pago antes do app —
  // acompanha o documento e fecha sozinho (apenas para kind='order').
  useEffect(() => {
    if (!visible || !smId || !orderId || kind !== 'order') return;
    const unsub = subscribeOrder(smId, orderId, (o) => {
      if (o?.paymentStatus === 'paid') finish(true);
    });
    return unsub;
  }, [visible, smId, orderId, kind]);

  // Cartões salvos (pagamento em 1 toque).
  useEffect(() => {
    if (!visible || !pagarmeMode || isPix) return;
    getSavedMethods()
      .then(setSavedCards)
      .catch(() => setSavedCards([]));
  }, [visible, pagarmeMode, isPix]);

  // PIX: cria a cobrança ao abrir.
  useEffect(() => {
    if (!visible || !isPix || pix || pixError) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await checkout({ smId, orderId, paymentMethod: 'pix', kind, amount: kind === 'tip' ? total : undefined, driverName });
        if (cancelled) return;
        if (res.status === 'paid') {
          finish(true, { paymentIntentId: res.pagarmeOrderId, provider: 'pagarme' });
          return;
        }
        setPixOrderId(res.pagarmeOrderId);
        setPix(res.pix || null);
      } catch (e: any) {
        if (!cancelled) setPixError(e?.message || 'Não foi possível gerar o PIX agora.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, isPix, smId, orderId]);

  // Verificação automática do PIX a cada 4s.
  useEffect(() => {
    if (!visible || !pixOrderId) return;
    const t = setInterval(async () => {
      try {
        const s = await getPaymentStatus({ pagarmeOrderId: pixOrderId, smId, orderId });
        if (s.paid) finish(true, { paymentIntentId: pixOrderId, provider: 'pagarme' });
      } catch {
        // silencioso: tenta de novo no próximo tick
      }
    }, 4000);
    return () => clearInterval(t);
  }, [visible, pixOrderId, smId, orderId]);

  /** Pagamento em 1 toque com cartão salvo. */
  const payWithSaved = async (pm: SavedCard) => {
    setBusy(true);
    try {
      const res = await checkout({ smId, orderId, paymentMethod: 'card', cardId: pm.id, kind, amount: kind === 'tip' ? total : undefined, driverName });
      if (res.status === 'paid') {
        finish(true, { paymentIntentId: res.pagarmeOrderId, provider: 'pagarme' });
      } else {
        Alert.alert('Pagamento não autorizado', 'A cobrança não foi concluída. Tente outro cartão.');
      }
    } catch (e: any) {
      warnHaptic();
      Alert.alert('Pagamento não autorizado', e?.message || 'Tente outro cartão.');
    } finally {
      setBusy(false);
    }
  };

  /** Cartão novo: tokeniza (chave pública) e cobra. */
  const payWithNewCard = async () => {
    if (!card.holderName.trim()) {
      Alert.alert('Cartão', 'Informe o nome impresso no cartão.');
      return;
    }
    setBusy(true);
    try {
      const token = await tokenizeCard(card);
      const res = await checkout({
        smId,
        orderId,
        paymentMethod: 'card',
        cardToken: token.token,
        saveCard,
        kind,
        amount: kind === 'tip' ? total : undefined,
        driverName,
      });
      if (res.status === 'paid') {
        finish(true, { paymentIntentId: res.pagarmeOrderId, provider: 'pagarme' });
      } else {
        Alert.alert('Pagamento não autorizado', 'O cartão foi recusado. Confira os dados ou tente outro cartão.');
      }
    } catch (e: any) {
      warnHaptic();
      Alert.alert('Pagamento não autorizado', e?.message || 'Tente novamente ou use outro cartão.');
    } finally {
      setBusy(false);
    }
  };

  if (!visible || !method) return null;

  const demoPixCode = `00020126BR.GOV.BCB.PIX${orderId}5204000053039865802BR6009NEXMARKET${Math.round(total * 100)}6304NEX1`;
  const pixCode = pix?.qrData || demoPixCode;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => finish(false)}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'], padding: spacing.lg, gap: spacing.md }}>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl }}>
            {isPix ? 'Pague com PIX' : 'Pagamento com cartão'}
          </Text>

          {/* ---------------------------- PIX ---------------------------- */}
          {isPix ? (
            !pagarmeMode ? (
              <>
                <Text style={{ color: colors.textMuted }}>Modo demonstração — configure o servidor de pagamentos para cobranças PIX reais.</Text>
                <View style={{ alignSelf: 'center', width: 180, height: 180, borderRadius: radius.lg, backgroundColor: '#fff', borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <QrCode size={120} color="#0F172A" />
                </View>
              </>
            ) : pixError ? (
              <>
                <Text style={{ color: colors.textMuted }}>{pixError}</Text>
                <Button label="Pagar com cartão" size="lg" onPress={() => finish(false)} />
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
          ) : /* --------------------------- Cartão --------------------------- */
          !pagarmeMode ? (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Modo demonstração — configure o servidor de pagamentos para cobrar de verdade via Pagar.me.</Text>
          ) : (
            <>
              {savedCards.length > 0 && !showNewCard ? (
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
                  <Pressable onPress={() => setShowNewCard(true)}>
                    <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, textAlign: 'center' }}>ou pague com outro cartão</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  <Input label="Nome no cartão" placeholder="Como está impresso no cartão" autoCapitalize="words" value={card.holderName} onChangeText={(t) => setCard((c) => ({ ...c, holderName: t }))} />
                  <Input label="Número do cartão" placeholder="0000 0000 0000 0000" keyboardType="number-pad" value={card.number} onChangeText={(t) => setCard((c) => ({ ...c, number: maskCardNumber(t) }))} />
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Input label="Validade" placeholder="MM/AA" keyboardType="number-pad" value={card.expiry} onChangeText={(t) => setCard((c) => ({ ...c, expiry: maskExpiry(t) }))} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input label="CVV" placeholder="123" keyboardType="number-pad" secureTextEntry value={card.cvv} onChangeText={(t) => setCard((c) => ({ ...c, cvv: t.replace(/\D/g, '').slice(0, 4) }))} />
                    </View>
                  </View>
                  <Pressable onPress={() => setSaveCard((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: saveCard ? colors.primary : colors.border, backgroundColor: saveCard ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {saveCard ? <Text style={{ color: '#fff', fontWeight: font.black, fontSize: 13 }}>✓</Text> : null}
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, flex: 1 }}>Salvar cartão para pagar em 1 toque nas próximas compras</Text>
                  </Pressable>
                  {savedCards.length > 0 ? (
                    <Pressable onPress={() => setShowNewCard(false)}>
                      <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, textAlign: 'center' }}>usar um cartão salvo</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={14} color={colors.primary} />
                <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, flex: 1 }}>
                  Pagamento processado pela Pagar.me. RNF10: o número do cartão não é armazenado em nossos servidores.
                </Text>
              </View>
            </>
          )}

          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg, textAlign: 'center' }}>{brl(total)}</Text>

          {isPix ? null : pagarmeMode && (showNewCard || savedCards.length === 0) ? (
            <Button label="Pagar com cartão" size="lg" loading={busy} icon={<CreditCard size={18} color="#fff" />} onPress={payWithNewCard} />
          ) : null}
          <Button label="Pagar depois" variant="ghost" onPress={() => finish(false)} />
        </View>
      </View>
    </Modal>
  );
}
