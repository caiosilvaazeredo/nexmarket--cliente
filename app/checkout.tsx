import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  Bike,
  Store,
  MapPin,
  Clock,
  CreditCard,
  Banknote,
  QrCode,
  Check,
  Plus,
} from 'lucide-react-native';

import { useColors } from '../src/hooks/useColors';
import { font, fontSize, radius, spacing, shadow } from '../src/lib/theme';
import { brl } from '../src/lib/format';
import { distanceMeters } from '../src/lib/geo';
import { Button } from '../src/components/ui/Button';
import { Input } from '../src/components/ui/Input';
import { useStore, selectSelectedAddress, selectCartSubtotal } from '../src/store/useStore';
import { computeTotals, clearCart } from '../src/lib/cart';
import { applyCoupon } from '../src/lib/coupons';
import { placeOrder } from '../src/lib/orders';
import { PAYMENT_LABELS, tokenizeCard, maskCardNumber } from '../src/lib/payments';
import type { DeliveryMethod, PaymentMethod, DeliveryAddress } from '../src/lib/types';

export default function Checkout() {
  const { colors } = useColors();
  const router = useRouter();
  const cart = useStore((s) => s.cart);
  const subtotal = useStore(selectCartSubtotal);
  const supermarket = useStore((s) => s.supermarket);
  const config = useStore((s) => s.deliveryConfig);
  const customer = useStore((s) => s.customer);
  const authUser = useStore((s) => s.authUser);
  const address = useStore(selectSelectedAddress);
  const couponCode = useStore((s) => s.couponCode);
  const orders = useStore((s) => s.orders);

  const [step, setStep] = useState(1);
  const [method, setMethod] = useState<DeliveryMethod>(config?.deliveryEnabled ? 'delivery' : 'pickup');
  const [payment, setPayment] = useState<PaymentMethod>('pix');
  const [slot, setSlot] = useState<string | null>(null);
  const [changeFor, setChangeFor] = useState('');
  const [placing, setPlacing] = useState(false);

  // Inline card capture for card_online.
  const [card, setCard] = useState({ number: '', holderName: '', expMonth: '', expYear: '', cvv: '' });

  const distanceKm = useMemo(() => {
    if (method !== 'delivery') return 0;
    if (supermarket?.location && address?.lat && address?.lng) {
      return distanceMeters(supermarket.location, { lat: address.lat, lng: address.lng }) / 1000;
    }
    return 2;
  }, [method, supermarket, address]);

  // Recompute coupon discount against the live subtotal.
  const [discount, setDiscount] = useState(0);
  const [freeShip, setFreeShip] = useState(false);
  React.useEffect(() => {
    if (couponCode && supermarket) {
      applyCoupon(supermarket.id, couponCode, subtotal, orders.length === 0).then((r) => {
        setDiscount(r.ok ? r.discount || 0 : 0);
        setFreeShip(!!r.ok && !!r.freeShipping);
      });
    }
  }, [couponCode, subtotal, supermarket]);

  const totals = useMemo(
    () => computeTotals({ items: cart, config, method, distanceKm, discount, freeShippingCoupon: freeShip, minOrder: supermarket?.minOrder }),
    [cart, config, method, distanceKm, discount, freeShip, supermarket],
  );

  // Login firewall (RNF03 — only blocks at the very end of the funnel).
  const requireLogin = authUser?.isAnonymous;

  const canContinueStep1 =
    (method === 'pickup' || (method === 'delivery' && !!address)) &&
    (payment !== 'card_online' || !!card.number);

  const confirm = async () => {
    if (requireLogin) {
      Alert.alert('Quase lá!', 'Entre ou crie sua conta para finalizar o pedido.', [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Entrar', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    if (!customer || !supermarket) return;
    if (method === 'delivery' && !address) {
      Alert.alert('Endereço', 'Selecione um endereço de entrega.');
      return;
    }
    setPlacing(true);
    try {
      let paymentTokenId: string | undefined;
      if (payment === 'card_online') {
        const token = await tokenizeCard(card);
        paymentTokenId = token.id;
      }
      const deliveryAddress: DeliveryAddress | undefined =
        method === 'delivery' && address
          ? {
              street: address.street,
              number: address.number,
              complement: address.complement,
              neighborhood: address.neighborhood,
              city: address.city,
              state: address.state,
              reference: address.reference,
              lat: address.lat,
              lng: address.lng,
            }
          : undefined;

      const orderId = await placeOrder({
        supermarketId: supermarket.id,
        customer,
        items: cart,
        subtotal: totals.subtotal,
        deliveryFee: totals.deliveryFee,
        discount: totals.discount,
        total: totals.total,
        couponCode,
        deliveryMethod: method,
        deliveryAddress,
        scheduledFor: slot,
        paymentMethod: payment,
        paymentTokenId,
        changeFor: payment === 'cash_delivery' && changeFor ? Number(changeFor.replace(',', '.')) : undefined,
        storeName: supermarket.name,
        storeLogoUrl: supermarket.logoUrl,
        storeLocation: supermarket.location,
      });
      clearCart();
      router.replace(`/order/${orderId}?sm=${supermarket.id}&new=1`);
    } catch (e: any) {
      Alert.alert('Não foi possível finalizar', e?.message || 'Tente outro método de pagamento.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* Header + step indicator */}
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => (step === 1 ? router.back() : setStep(1))} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize['2xl'] }}>{step === 1 ? 'Entrega e pagamento' : 'Revisar pedido'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[1, 2].map((s) => (
            <View key={s} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: s <= step ? colors.primary : colors.border }} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160, gap: spacing.lg }} showsVerticalScrollIndicator={false}>
        {step === 1 ? (
          <>
            {/* Delivery method (RF14) */}
            <Section title="Como você quer receber?" colors={colors}>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <MethodCard active={method === 'delivery'} disabled={!config?.deliveryEnabled} icon={<Bike size={22} color={method === 'delivery' ? '#FFFFFF' : colors.primary} />} title="Delivery" subtitle={`~${config?.estimatedMinutes ?? 40} min`} onPress={() => setMethod('delivery')} colors={colors} />
                <MethodCard active={method === 'pickup'} disabled={!config?.pickupEnabled} icon={<Store size={22} color={method === 'pickup' ? '#FFFFFF' : colors.primary} />} title="Retirar na loja" subtitle="Sem frete" onPress={() => setMethod('pickup')} colors={colors} />
              </View>
            </Section>

            {/* Address (RF03/RF04) */}
            {method === 'delivery' && (
              <Section title="Endereço de entrega" colors={colors}>
                <Pressable onPress={() => router.push('/address')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, padding: 14 }}>
                  <MapPin size={22} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    {address ? (
                      <>
                        <Text style={{ color: colors.text, fontWeight: font.bold }}>{[address.street, address.number].filter(Boolean).join(', ')}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{[address.neighborhood, address.city].filter(Boolean).join(' - ')}</Text>
                      </>
                    ) : (
                      <Text style={{ color: colors.textMuted, fontWeight: font.semibold }}>Selecionar endereço</Text>
                    )}
                  </View>
                  <Text style={{ color: colors.primary, fontWeight: font.bold }}>Trocar</Text>
                </Pressable>
              </Section>
            )}

            {/* Schedule (RF16) */}
            {config?.scheduleEnabled && config.scheduleSlots?.length ? (
              <Section title="Agendar entrega (opcional)" colors={colors}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  <Chip label="Assim que possível" active={!slot} onPress={() => setSlot(null)} colors={colors} icon={<Clock size={14} color={!slot ? '#FFFFFF' : colors.textMuted} />} />
                  {config.scheduleSlots.map((s) => (
                    <Chip key={s} label={s} active={slot === s} onPress={() => setSlot(s)} colors={colors} />
                  ))}
                </ScrollView>
              </Section>
            ) : null}

            {/* Payment (RF15) */}
            <Section title="Pagamento" colors={colors}>
              <View style={{ gap: 8 }}>
                <PayOption method="pix" icon={<QrCode size={20} color={colors.text} />} active={payment === 'pix'} onPress={() => setPayment('pix')} colors={colors} />
                <PayOption method="card_online" icon={<CreditCard size={20} color={colors.text} />} active={payment === 'card_online'} onPress={() => setPayment('card_online')} colors={colors} />
                <PayOption method="card_delivery" icon={<CreditCard size={20} color={colors.text} />} active={payment === 'card_delivery'} onPress={() => setPayment('card_delivery')} colors={colors} />
                <PayOption method="cash_delivery" icon={<Banknote size={20} color={colors.text} />} active={payment === 'cash_delivery'} onPress={() => setPayment('cash_delivery')} colors={colors} />
              </View>

              {payment === 'card_online' && (
                <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                  <Input placeholder="Número do cartão" keyboardType="number-pad" value={card.number} onChangeText={(v) => setCard({ ...card, number: maskCardNumber(v) })} icon={<CreditCard size={20} color={colors.textSubtle} />} />
                  <Input placeholder="Nome impresso no cartão" autoCapitalize="characters" value={card.holderName} onChangeText={(v) => setCard({ ...card, holderName: v })} />
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Input containerStyle={{ flex: 1 }} placeholder="MM" keyboardType="number-pad" maxLength={2} value={card.expMonth} onChangeText={(v) => setCard({ ...card, expMonth: v })} />
                    <Input containerStyle={{ flex: 1 }} placeholder="AA" keyboardType="number-pad" maxLength={4} value={card.expYear} onChangeText={(v) => setCard({ ...card, expYear: v })} />
                    <Input containerStyle={{ flex: 1 }} placeholder="CVV" keyboardType="number-pad" maxLength={4} secureTextEntry value={card.cvv} onChangeText={(v) => setCard({ ...card, cvv: v })} />
                  </View>
                  <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, fontWeight: font.medium }}>
                    🔒 Seus dados vão tokenizados direto para o provedor de pagamento. Nunca salvamos seu cartão.
                  </Text>
                </View>
              )}
              {payment === 'cash_delivery' && (
                <Input containerStyle={{ marginTop: spacing.md }} placeholder="Troco para quanto? (opcional)" keyboardType="number-pad" value={changeFor} onChangeText={setChangeFor} icon={<Banknote size={20} color={colors.textSubtle} />} />
              )}
            </Section>
          </>
        ) : (
          <>
            {/* Review (RF17) */}
            <Section title={`${cart.length} ${cart.length === 1 ? 'item' : 'itens'}`} colors={colors}>
              {cart.map((i) => (
                <View key={i.key} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: font.medium, flex: 1 }} numberOfLines={1}>{i.quantity}× {i.name}</Text>
                  <Text style={{ color: colors.text, fontWeight: font.bold }}>{brl(i.price * i.quantity)}</Text>
                </View>
              ))}
            </Section>

            <Section title="Entrega" colors={colors}>
              <Row label={method === 'delivery' ? 'Delivery' : 'Retirada na loja'} value={method === 'delivery' ? `~${config?.estimatedMinutes ?? 40} min` : 'Na loja'} colors={colors} />
              {method === 'delivery' && address && <Row label="Endereço" value={[address.street, address.number].filter(Boolean).join(', ')} colors={colors} />}
              <Row label="Quando" value={slot || 'Assim que possível'} colors={colors} />
              <Row label="Pagamento" value={PAYMENT_LABELS[payment]} colors={colors} />
            </Section>

            <Section title="Resumo de valores" colors={colors}>
              <Row label="Subtotal" value={brl(totals.subtotal)} colors={colors} />
              {totals.discount > 0 && <Row label={`Desconto ${couponCode ? `(${couponCode})` : ''}`} value={`− ${brl(totals.discount)}`} colors={colors} accent={colors.primaryDark} />}
              <Row label="Frete" value={totals.freeShipping ? 'Grátis' : brl(totals.deliveryFee)} colors={colors} />
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>Total</Text>
                <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl }}>{brl(totals.total)}</Text>
              </View>
            </Section>
          </>
        )}
      </ScrollView>

      {/* Footer action */}
      <View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, borderTopWidth: 2, borderColor: colors.border, padding: spacing.lg }, shadow.raised]}>
        {step === 1 ? (
          <Button label={`Continuar • ${brl(totals.total)}`} size="lg" disabled={!canContinueStep1} onPress={() => setStep(2)} />
        ) : (
          <Button label={requireLogin ? 'Entrar e finalizar' : 'Confirmar pedido'} size="lg" loading={placing} onPress={confirm} />
        )}
      </View>
    </SafeAreaView>
  );
}

function Section({ title, children, colors }: any) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>{title}</Text>
      {children}
    </View>
  );
}
function Row({ label, value, colors, accent }: any) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={{ color: colors.textMuted, fontWeight: font.medium }}>{label}</Text>
      <Text style={{ color: accent || colors.text, fontWeight: font.bold }}>{value}</Text>
    </View>
  );
}
function MethodCard({ active, disabled, icon, title, subtitle, onPress, colors }: any) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} style={{ flex: 1, opacity: disabled ? 0.4 : 1, alignItems: 'center', gap: 6, padding: spacing.md, borderRadius: radius.lg, borderWidth: 2, borderColor: active ? colors.primaryDark : colors.border, backgroundColor: active ? colors.primary : colors.card }}>
      {icon}
      <Text style={{ color: active ? '#FFFFFF' : colors.text, fontWeight: font.black }}>{title}</Text>
      <Text style={{ color: active ? 'rgba(255,255,255,0.85)' : colors.textMuted, fontWeight: font.semibold, fontSize: fontSize.xs }}>{subtitle}</Text>
    </Pressable>
  );
}
function PayOption({ method, icon, active, onPress, colors }: any) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 2, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.card }}>
      {icon}
      <Text style={{ flex: 1, color: colors.text, fontWeight: font.bold }}>{PAYMENT_LABELS[method as PaymentMethod]}</Text>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: active ? colors.primary : colors.borderStrong, backgroundColor: active ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {active && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
      </View>
    </Pressable>
  );
}
function Chip({ label, active, onPress, colors, icon }: any) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.full, borderWidth: 2, borderColor: active ? colors.primaryDark : colors.border, backgroundColor: active ? colors.primary : colors.card }}>
      {icon}
      <Text style={{ color: active ? '#FFFFFF' : colors.text, fontWeight: font.bold, fontSize: fontSize.sm }}>{label}</Text>
    </Pressable>
  );
}
