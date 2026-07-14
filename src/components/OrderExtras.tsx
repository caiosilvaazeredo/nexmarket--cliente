import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, Pressable, Alert, ScrollView } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { KeyRound, HandCoins, PackageX, Check, CreditCard } from 'lucide-react-native';

import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useColors } from '../hooks/useColors';
import { font, fontSize, radius, spacing } from '../lib/theme';
import { brl } from '../lib/format';
import { addTip, reportItemsProblem } from '../lib/orders';
import {
  getSavedMethods,
  chargeSaved,
  createTipCheckout,
  getPaymentStatus,
  requestItemRefund,
  paymentsConfigured,
  type SavedCard,
} from '../lib/payments';
import { successHaptic, warnHaptic } from '../lib/notifications';
import type { Order } from '../lib/types';

/* ------------------------- PIN de confirmação ------------------------- */

/** Código que o cliente informa ao entregador na porta (anti-fraude, RF13). */
export function DeliveryPinBanner({ order }: { order: Order }) {
  const { colors } = useColors();
  if (!order.deliveryPin) return null;
  const show =
    order.deliveryStatus === 'going_to_customer' ||
    order.deliveryStatus === 'picked_up' ||
    order.deliveryStatus === 'arrived_store';
  if (!show) return null;
  return (
    <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: colors.primary }}>
      <KeyRound size={22} color={colors.primaryDark} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.primaryDark, fontWeight: font.black }}>Código de entrega</Text>
        <Text style={{ color: colors.primaryDark, fontSize: fontSize.sm }}>Informe ao entregador ao receber o pedido.</Text>
      </View>
      <Text style={{ color: colors.primaryDark, fontWeight: font.black, fontSize: 26, letterSpacing: 4 }}>{order.deliveryPin}</Text>
    </View>
  );
}

/* ------------------------- Gorjeta pós-entrega ------------------------- */

const TIP_OPTIONS = [2, 5, 10];

export function TipSheet({ visible, order, onClose }: { visible: boolean; order: Order; onClose: () => void }) {
  const { colors } = useColors();
  const [amount, setAmount] = useState(5);
  const [custom, setCustom] = useState('');
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [busy, setBusy] = useState(false);
  const redirect = useMemo(() => Linking.createURL('payment-result'), []);

  useEffect(() => {
    if (visible && paymentsConfigured()) {
      getSavedMethods().then(setSavedCards).catch(() => setSavedCards([]));
    }
  }, [visible]);

  if (!visible) return null;

  const finishOk = async () => {
    await addTip(order, amount).catch(() => {});
    successHaptic();
    onClose();
    Alert.alert('Gorjeta enviada! 💚', `${brl(amount)} vão direto para ${order.driverName || 'o entregador'}. Obrigado!`);
  };

  const payViaCheckout = async () => {
    const session = await createTipCheckout({
      smId: order.supermarketId,
      orderId: order.id,
      amount,
      driverName: order.driverName,
      next: redirect,
    });
    await WebBrowser.openAuthSessionAsync(session.url, redirect);
    const s = await getPaymentStatus({ sessionId: session.sessionId, smId: order.supermarketId, orderId: order.id });
    if (s.paid) await finishOk();
    else Alert.alert('Gorjeta', 'O pagamento da gorjeta não foi concluído.');
  };

  const pay = async () => {
    if (!(amount > 0)) return;
    if (!paymentsConfigured()) {
      Alert.alert('Gorjeta', 'Pagamentos online não estão configurados neste ambiente.');
      return;
    }
    setBusy(true);
    try {
      const pm = savedCards[0];
      if (pm) {
        try {
          const res = await chargeSaved({ smId: order.supermarketId, orderId: order.id, amount, paymentMethodId: pm.id, kind: 'tip' });
          if (res.ok) return await finishOk();
        } catch (e: any) {
          if (!e?.requiresAction) throw e;
          // 3DS exigido → cai para o Checkout no navegador
        }
      }
      await payViaCheckout();
    } catch (e: any) {
      warnHaptic();
      Alert.alert('Gorjeta', e?.message || 'Não foi possível processar a gorjeta.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'], padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <HandCoins size={22} color={colors.primary} />
            <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl, flex: 1 }}>
              Gorjeta para {order.driverName || 'o entregador'}
            </Text>
          </View>
          <Text style={{ color: colors.textMuted }}>100% do valor vai para quem fez a sua entrega.</Text>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {TIP_OPTIONS.map((v) => (
              <Pressable
                key={v}
                onPress={() => {
                  setAmount(v);
                  setCustom('');
                }}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: radius.lg, borderWidth: 2, borderColor: amount === v && !custom ? colors.primary : colors.border, backgroundColor: amount === v && !custom ? colors.primarySoft : colors.card }}
              >
                <Text style={{ color: colors.text, fontWeight: font.black }}>{brl(v)}</Text>
              </Pressable>
            ))}
          </View>
          <Input
            label="Outro valor"
            placeholder="Ex: 7,50"
            keyboardType="numeric"
            value={custom}
            onChangeText={(t) => {
              setCustom(t);
              const v = Number(t.replace(',', '.'));
              if (Number.isFinite(v) && v > 0) setAmount(Math.min(v, 200));
            }}
          />

          {savedCards[0] ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <CreditCard size={16} color={colors.textSubtle} />
              <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, textTransform: 'capitalize' }}>
                {savedCards[0].brand} •••• {savedCards[0].last4} — 1 toque
              </Text>
            </View>
          ) : null}

          <Button label={`Enviar ${brl(amount)}`} size="lg" loading={busy} onPress={pay} />
          <Button label="Agora não" variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

/* --------------------- Problema com itens (reembolso) --------------------- */

export function ItemIssueSheet({ visible, order, onClose }: { visible: boolean; order: Order; onClose: () => void }) {
  const { colors } = useColors();
  const [selected, setSelected] = useState<number[]>([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelected([]);
      setReason('');
    }
  }, [visible]);

  if (!visible) return null;

  const itemValue = (idx: number) => {
    const it = order.items[idx];
    const unit = it.substituted && typeof it.substitutePrice === 'number' ? it.substitutePrice : it.price;
    return unit * it.quantity;
  };
  const refundAmount = Number(selected.reduce((a, i) => a + itemValue(i), 0).toFixed(2));
  const alreadyRefunded = !!order.payment?.selfRefunded;

  const submit = async () => {
    if (!selected.length || !reason.trim()) {
      Alert.alert('Quase lá', 'Selecione os itens e conte o que aconteceu.');
      return;
    }
    setBusy(true);
    try {
      await requestItemRefund({
        smId: order.supermarketId,
        orderId: order.id,
        amount: refundAmount,
        reason: reason.trim(),
      });
      await reportItemsProblem(order, selected, reason.trim()).catch(() => {});
      successHaptic();
      onClose();
      Alert.alert('Reembolso a caminho 💚', `${brl(refundAmount)} serão devolvidos para a forma de pagamento original em até 5 dias úteis.`);
    } catch (e: any) {
      await reportItemsProblem(order, selected, reason.trim()).catch(() => {});
      onClose();
      if (e?.needsReview) {
        Alert.alert('Enviado para análise', 'O valor passa do limite de reembolso automático. Nossa equipe vai analisar e responder em breve.');
      } else if (e?.status === 409) {
        Alert.alert('Já reembolsado', 'Este pedido já recebeu um reembolso automático. Fale com o suporte para novos casos.');
      } else {
        Alert.alert('Registrado', e?.message || 'Seu relato foi registrado e o suporte fará a devolução.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'], padding: spacing.lg, gap: spacing.md, maxHeight: '85%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <PackageX size={22} color={colors.danger} />
            <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl, flex: 1 }}>Problema com itens</Text>
          </View>
          {alreadyRefunded ? (
            <Text style={{ color: colors.textMuted }}>
              Este pedido já recebeu um reembolso automático. Para novos casos, fale com o suporte.
            </Text>
          ) : (
            <>
              <Text style={{ color: colors.textMuted }}>
                Marque os itens que chegaram errados, faltando ou danificados. O reembolso é automático até o limite da plataforma.
              </Text>
              <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ gap: 8 }}>
                {order.items.map((it, idx) => {
                  const on = selected.includes(idx);
                  return (
                    <Pressable
                      key={idx}
                      onPress={() => setSelected((s) => (on ? s.filter((i) => i !== idx) : [...s, idx]))}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.lg, borderWidth: 2, borderColor: on ? colors.danger : colors.border, backgroundColor: on ? colors.dangerSoft : colors.card, padding: spacing.md }}
                    >
                      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: on ? colors.danger : colors.border, backgroundColor: on ? colors.danger : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        {on ? <Check size={14} color="#fff" /> : null}
                      </View>
                      <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontWeight: font.semibold }}>
                        {it.quantity}x {it.substituted ? it.substituteName : it.name}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontWeight: font.bold }}>{brl(itemValue(idx))}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Input
                placeholder="O que aconteceu? (obrigatório)"
                value={reason}
                onChangeText={setReason}
                multiline
                style={{ height: 70, textAlignVertical: 'top' }}
              />
              {refundAmount > 0 ? (
                <Text style={{ color: colors.text, fontWeight: font.black, textAlign: 'center' }}>
                  Reembolso estimado: {brl(refundAmount)}
                </Text>
              ) : null}
              <Button label="Solicitar reembolso" size="lg" loading={busy} onPress={submit} />
            </>
          )}
          <Button label="Fechar" variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
