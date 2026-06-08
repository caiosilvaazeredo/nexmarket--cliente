import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import {
  ArrowLeft,
  Bike,
  Store,
  MapPin,
  Clock,
  CreditCard,
  QrCode,
  Banknote,
  Ticket,
  Check,
  ChevronRight,
  Copy,
  ShieldCheck,
  Plus,
} from 'lucide-react-native';

import { Button } from '../src/components/ui/Button';
import { Input } from '../src/components/ui/Input';
import { useColors } from '../src/hooks/useColors';
import { font, fontSize, radius, spacing, shadow } from '../src/lib/theme';
import { brl, fullAddress } from '../src/lib/format';
import { useAppStore } from '../src/store/useAppStore';
import { useCartStore } from '../src/store/useCartStore';
import { lineTotal, effectiveUnitPrice, applyCoupon } from '../src/lib/promotions';
import { computeDeliveryFee, meetsMinimum } from '../src/lib/storeHours';
import { placeOrder, markPaid, subscribeOrder } from '../src/lib/orders';
import { maskCardNumber, maskExpiry, tokenizeCard } from '../src/lib/payments';
import { successHaptic, warnHaptic } from '../src/lib/notifications';
import type { PaymentMethod, FulfillmentType, Order } from '../src/lib/types';

export default function Checkout() {
  const { colors } = useColors();
  const router = useRouter();

  const authUser = useAppStore((s) => s.authUser);
  const customer = useAppStore((s) => s.customer);
  const currentSmId = useAppStore((s) => s.currentSmId);
  const promotions = useAppStore((s) => s.promotions);
  const deliveryConfig = useAppStore((s) => s.deliveryConfig);
  const storeInfo = useAppStore((s) => s.storeInfo);
  const brandName = useAppStore((s) => s.brand.name);

  const lines = useCartStore((s) => s.lines);
  const couponCode = useCartStore((s) => s.couponCode);
  const couponDiscount = useCartStore((s) => s.couponDiscount);
  const clear = useCartStore((s) => s.clear);

  const [fulfillment, setFulfillment] = useState<FulfillmentType>('delivery');
  const [addressId, setAddressId] = useState<string | null>(customer?.defaultAddressId || customer?.addresses?.[0]?.id || null);
  const [schedule, setSchedule] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [changeFor, setChangeFor] = useState('');
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [payModal, setPayModal] = useState<{ orderId: string } | null>(null);

  // Require login for checkout (RNF11 — orders tied to a real account).
  useEffect(() => {
    if (authUser === null) {
      router.replace('/(auth)/login?next=/checkout');
    }
  }, [authUser]);

  const myOrders = useAppStore((s) => s.myOrders);
  const subtotal = useMemo(() => lines.reduce((a, l) => a + lineTotal(l.product, l.quantity, promotions), 0), [lines, promotions]);
  const deliveryFee = fulfillment === 'delivery' ? computeDeliveryFee(deliveryConfig) : 0;
  // Re-evaluate the coupon against the chosen fulfillment so a free-shipping
  // coupon doesn't grant a phantom discount on a pickup order.
  const discount = useMemo(() => {
    if (!couponCode) return 0;
    const res = applyCoupon(couponCode, subtotal, promotions, { isFirstOrder: myOrders.length === 0, deliveryFee });
    return res.ok ? res.discount : couponDiscount || 0;
  }, [couponCode, subtotal, promotions, deliveryFee, myOrders.length, couponDiscount]);
  const total = Math.max(0, subtotal + deliveryFee - discount);
  const min = meetsMinimum(deliveryConfig, subtotal);

  const address = customer?.addresses?.find((a) => a.id === addressId) || null;

  const paymentOptions = useMemo(() => buildPaymentOptions(storeInfo?.paymentMethods), [storeInfo]);

  useEffect(() => {
    if (!payment && paymentOptions.length) setPayment(paymentOptions[0].method);
  }, [paymentOptions]);

  const scheduleSlots = useMemo(() => buildScheduleSlots(), []);

  if (!lines.length) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Text style={{ color: colors.textMuted, fontWeight: font.bold }}>Seu carrinho está vazio.</Text>
        <Button label="Voltar" variant="ghost" fullWidth={false} onPress={() => router.replace('/(tabs)')} />
      </SafeAreaView>
    );
  }

  const finalize = async () => {
    if (fulfillment === 'delivery' && !address) {
      Alert.alert('Endereço', 'Adicione um endereço de entrega para continuar.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Adicionar', onPress: () => router.push('/address-edit') },
      ]);
      return;
    }
    if (!min.ok) {
      Alert.alert('Pedido mínimo', `Faltam ${brl(min.missing)} para o pedido mínimo.`);
      return;
    }
    if (!payment) return;

    setPlacing(true);
    try {
      const items = lines.map((l) => ({
        productId: l.product.id,
        name: l.product.name,
        quantity: l.quantity,
        price: effectiveUnitPrice(l.product, promotions),
        imageUrl: l.product.imageUrl,
        unit: l.product.unit,
      }));
      const orderId = await placeOrder({
        supermarketId: currentSmId!,
        items,
        subtotal,
        deliveryFee,
        discount,
        total,
        couponCode: couponCode || undefined,
        fulfillment,
        paymentMethod: payment,
        customerName: customer?.name || 'Cliente',
        customerPhone: customer?.phone || '',
        deliveryAddress:
          fulfillment === 'delivery' && address
            ? {
                street: address.street,
                number: address.number,
                complement: address.complement,
                neighborhood: address.neighborhood,
                city: address.city,
                state: address.state,
                reference: address.reference,
                ...(typeof address.lat === 'number' && typeof address.lng === 'number' ? { lat: address.lat, lng: address.lng } : {}),
              }
            : undefined,
        scheduledFor: schedule,
        changeFor: payment === 'cash_delivery' && changeFor ? Number(changeFor.replace(',', '.')) : null,
        notes,
      });
      successHaptic();

      if (payment === 'pix' || payment === 'card_online') {
        setPayModal({ orderId });
      } else {
        clear();
        router.replace(`/order/${orderId}?sm=${currentSmId}&new=1`);
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível criar o pedido. Tente novamente.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 6 }}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={{ flex: 1, color: colors.text, fontWeight: font.black, fontSize: fontSize['2xl'] }}>Finalizar pedido</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 180, gap: spacing.lg }} showsVerticalScrollIndicator={false}>
        {/* 1. Fulfillment */}
        <Section title="Como você quer receber?" colors={colors}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <OptionBig active={fulfillment === 'delivery'} onPress={() => setFulfillment('delivery')} icon={<Bike size={22} color={fulfillment === 'delivery' ? colors.primary : colors.textMuted} />} title="Entrega" subtitle={deliveryFee > 0 ? brl(deliveryFee) : 'Grátis'} colors={colors} />
            <OptionBig active={fulfillment === 'pickup'} onPress={() => setFulfillment('pickup')} icon={<Store size={22} color={fulfillment === 'pickup' ? colors.primary : colors.textMuted} />} title="Retirar na loja" subtitle="Sem frete" colors={colors} />
          </View>
        </Section>

        {/* 2. Address (delivery) */}
        {fulfillment === 'delivery' ? (
          <Section title="Endereço de entrega" colors={colors}>
            {customer?.addresses?.length ? (
              customer.addresses.map((a) => (
                <Pressable key={a.id} onPress={() => setAddressId(a.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, borderWidth: 2, borderColor: addressId === a.id ? colors.primary : colors.border, backgroundColor: addressId === a.id ? colors.primarySoft : colors.card, padding: spacing.md }}>
                  <MapPin size={20} color={addressId === a.id ? colors.primary : colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: font.black, textTransform: 'capitalize' }}>{a.nickname || a.label}</Text>
                    <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{fullAddress(a)}</Text>
                  </View>
                  {addressId === a.id ? <Check size={20} color={colors.primary} /> : null}
                </Pressable>
              ))
            ) : null}
            <Button label="Adicionar endereço" variant="secondary" icon={<Plus size={18} color={colors.text} />} onPress={() => router.push('/address-edit')} />
          </Section>
        ) : (
          <Section title="Retirada na loja" colors={colors}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, padding: spacing.md }}>
              <Store size={20} color={colors.primary} />
              <Text style={{ flex: 1, color: colors.textMuted, fontSize: fontSize.sm }}>{storeInfo?.storeLocation?.address || `Retire seu pedido em ${brandName}`}</Text>
            </View>
          </Section>
        )}

        {/* 3. Schedule */}
        <Section title="Quando?" colors={colors}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <SlotChip label="Assim que possível" active={!schedule} onPress={() => setSchedule(null)} colors={colors} icon={<Clock size={14} color={!schedule ? '#fff' : colors.textMuted} />} />
            {scheduleSlots.map((s) => (
              <SlotChip key={s.value} label={s.label} active={schedule === s.value} onPress={() => setSchedule(s.value)} colors={colors} />
            ))}
          </ScrollView>
        </Section>

        {/* 4. Payment */}
        <Section title="Pagamento" colors={colors}>
          {paymentOptions.map((opt) => (
            <Pressable key={opt.method} onPress={() => setPayment(opt.method)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, borderWidth: 2, borderColor: payment === opt.method ? colors.primary : colors.border, backgroundColor: payment === opt.method ? colors.primarySoft : colors.card, padding: spacing.md }}>
              {opt.icon(payment === opt.method ? colors.primary : colors.textMuted)}
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: font.bold }}>{opt.label}</Text>
                {opt.hint ? <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs }}>{opt.hint}</Text> : null}
              </View>
              {payment === opt.method ? <Check size={20} color={colors.primary} /> : null}
            </Pressable>
          ))}
          {payment === 'cash_delivery' ? (
            <Input label="Troco para quanto? (opcional)" placeholder="Ex: 100,00" keyboardType="numeric" value={changeFor} onChangeText={setChangeFor} icon={<Banknote size={18} color={colors.textSubtle} />} />
          ) : null}
        </Section>

        {/* 5. Notes */}
        <Section title="Observações (opcional)" colors={colors}>
          <Input placeholder="Ex: tocar a campainha, deixar na portaria…" value={notes} onChangeText={setNotes} />
        </Section>

        {/* 6. Review */}
        <Section title="Resumo" colors={colors}>
          <View style={{ borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, padding: spacing.md, gap: 6 }}>
            {lines.map((l) => (
              <View key={l.product.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text numberOfLines={1} style={{ color: colors.textMuted, flex: 1, marginRight: 8 }}>{l.quantity}x {l.product.name}</Text>
                <Text style={{ color: colors.text, fontWeight: font.semibold }}>{brl(effectiveUnitPrice(l.product, promotions) * l.quantity)}</Text>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
            <Row label="Subtotal" value={brl(subtotal)} colors={colors} />
            {discount > 0 ? <Row label="Desconto" value={`- ${brl(discount)}`} colors={colors} /> : null}
            <Row label="Frete" value={deliveryFee > 0 ? brl(deliveryFee) : 'Grátis'} colors={colors} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
              <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.base }}>Total</Text>
              <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl }}>{brl(total)}</Text>
            </View>
          </View>
        </Section>
      </ScrollView>

      <View style={[{ padding: spacing.lg, backgroundColor: colors.card, borderTopWidth: 2, borderTopColor: colors.border, gap: 6 }, shadow.raised]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.textMuted, fontWeight: font.bold }}>Total a pagar</Text>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl }}>{brl(total)}</Text>
        </View>
        <Button label="Confirmar pedido" size="lg" loading={placing} onPress={finalize} />
      </View>

      {/* Payment modal (PIX / online card) */}
      <PaymentModal
        info={payModal}
        method={payment}
        total={total}
        smId={currentSmId}
        colors={colors}
        onDone={(orderId, paid) => {
          setPayModal(null);
          clear();
          router.replace(`/order/${orderId}?sm=${currentSmId}&new=1${paid ? '&paid=1' : ''}`);
        }}
      />
    </SafeAreaView>
  );
}

/* --------------------------- Payment modal --------------------------- */

function PaymentModal({
  info,
  method,
  total,
  smId,
  colors,
  onDone,
}: {
  info: { orderId: string } | null;
  method: PaymentMethod | null;
  total: number;
  smId: string | null;
  colors: any;
  onDone: (orderId: string, paid: boolean) => void;
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '' });
  const pixCode = useMemo(
    () => (info ? `00020126BR.GOV.BCB.PIX${info.orderId}5204000053039865802BR6009NEXMARKET${Math.round(total * 100)}6304NEX1` : ''),
    [info, total],
  );

  useEffect(() => {
    if (info && smId) {
      const unsub = subscribeOrder(smId, info.orderId, setOrder);
      return unsub;
    }
  }, [info?.orderId, smId]);

  if (!info) return null;
  const isPix = method === 'pix';

  const confirm = async () => {
    if (!order) return;
    setBusy(true);
    try {
      // RNF10: card data is tokenized by the gateway and NEVER stored in our DB.
      if (!isPix) {
        await tokenizeCard(card);
      }
      await markPaid(order);
      onDone(info.orderId, true);
    } catch (e: any) {
      warnHaptic();
      Alert.alert('Pagamento não autorizado', e?.message || 'Tente outro cartão ou pague com PIX. Seu pedido foi mantido.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'], padding: spacing.lg, gap: spacing.md }}>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl }}>{isPix ? 'Pague com PIX' : 'Pagamento online'}</Text>
          <Text style={{ color: colors.textMuted }}>{isPix ? 'Escaneie o QR Code ou use o PIX copia e cola. O pagamento expira em 15 minutos.' : 'Pagamento processado com segurança pela provedora. Não armazenamos os dados do seu cartão.'}</Text>

          {isPix ? (
            <>
              <View style={{ alignSelf: 'center', width: 180, height: 180, borderRadius: radius.lg, backgroundColor: '#fff', borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <QrCode size={120} color="#0F172A" />
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
            </>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Input label="Número do cartão" placeholder="0000 0000 0000 0000" keyboardType="number-pad" value={card.number} onChangeText={(t) => setCard((c) => ({ ...c, number: maskCardNumber(t) }))} />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}><Input label="Validade" placeholder="MM/AA" keyboardType="number-pad" value={card.expiry} onChangeText={(t) => setCard((c) => ({ ...c, expiry: maskExpiry(t) }))} /></View>
                <View style={{ flex: 1 }}><Input label="CVV" placeholder="123" keyboardType="number-pad" secureTextEntry value={card.cvv} onChangeText={(t) => setCard((c) => ({ ...c, cvv: t.replace(/\D/g, '').slice(0, 4) }))} /></View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={14} color={colors.primary} />
                <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, flex: 1 }}>Dados protegidos e tokenizados pela provedora de pagamento (RNF10).</Text>
              </View>
            </View>
          )}

          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg, textAlign: 'center' }}>{brl(total)}</Text>
          <Button label={isPix ? 'Já fiz o pagamento' : 'Pagar agora'} size="lg" loading={busy} onPress={confirm} />
          <Button label="Pagar depois" variant="ghost" onPress={() => onDone(info.orderId, false)} />
        </View>
      </View>
    </Modal>
  );
}

/* --------------------------- helpers --------------------------- */

interface PayOpt {
  method: PaymentMethod;
  label: string;
  hint?: string;
  icon: (color: string) => React.ReactNode;
}

function buildPaymentOptions(pm?: any): PayOpt[] {
  const opts: PayOpt[] = [];
  const has = (k: string) => !pm || pm[k];
  if (!pm || pm.pix) opts.push({ method: 'pix', label: 'PIX', hint: 'Aprovação na hora', icon: (c) => <QrCode size={22} color={c} /> });
  if (!pm || pm.creditCardOnline) opts.push({ method: 'card_online', label: 'Cartão de crédito (online)', hint: 'Pague agora pelo app', icon: (c) => <CreditCard size={22} color={c} /> });
  if (!pm || pm.creditCardDelivery || pm.debitCardDelivery)
    opts.push({ method: 'card_delivery', label: 'Cartão na entrega', hint: 'Crédito ou débito na maquininha', icon: (c) => <CreditCard size={22} color={c} /> });
  opts.push({ method: 'cash_delivery', label: 'Dinheiro na entrega', hint: 'Informe o troco', icon: (c) => <Banknote size={22} color={c} /> });
  if (pm?.vouchers?.length) opts.push({ method: 'voucher_delivery', label: 'Vale-refeição na entrega', hint: pm.vouchers.slice(0, 3).join(', '), icon: (c) => <Ticket size={22} color={c} /> });
  return opts;
}

function buildScheduleSlots(): { value: string; label: string }[] {
  const slots: { value: string; label: string }[] = [];
  const now = new Date();
  for (let d = 0; d < 2; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);
    const dayLabel = d === 0 ? 'Hoje' : 'Amanhã';
    for (let h = 8; h <= 20; h += 2) {
      if (d === 0 && h <= now.getHours() + 1) continue;
      const label = `${dayLabel} ${String(h).padStart(2, '0')}:00-${String(h + 2).padStart(2, '0')}:00`;
      slots.push({ value: `${day.toDateString()} ${h}`, label });
    }
  }
  return slots.slice(0, 8);
}

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>{title}</Text>
      {children}
    </View>
  );
}

function OptionBig({ active, onPress, icon, title, subtitle, colors }: { active: boolean; onPress: () => void; icon: React.ReactNode; title: string; subtitle: string; colors: any }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center', gap: 6, borderRadius: radius.lg, borderWidth: 2, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.card, paddingVertical: spacing.lg }}>
      {icon}
      <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.base }}>{title}</Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{subtitle}</Text>
    </Pressable>
  );
}

function SlotChip({ label, active, onPress, colors, icon }: { label: string; active: boolean; onPress: () => void; colors: any; icon?: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.full, backgroundColor: active ? colors.primary : colors.card, borderWidth: 2, borderColor: active ? colors.primary : colors.border }}>
      {icon}
      <Text style={{ color: active ? '#fff' : colors.textMuted, fontWeight: font.bold, fontSize: fontSize.sm }}>{label}</Text>
    </Pressable>
  );
}

function Row({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: colors.textMuted, fontWeight: font.medium }}>{label}</Text>
      <Text style={{ color: colors.textMuted, fontWeight: font.bold }}>{value}</Text>
    </View>
  );
}
