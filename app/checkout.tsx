import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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
  Plus,
  Wallet,
} from 'lucide-react-native';

import { Button } from '../src/components/ui/Button';
import { Input } from '../src/components/ui/Input';
import { PayOnlineSheet } from '../src/components/PayOnlineSheet';
import { useColors } from '../src/hooks/useColors';
import { font, fontSize, radius, spacing, shadow } from '../src/lib/theme';
import { brl, fullAddress } from '../src/lib/format';
import { useAppStore } from '../src/store/useAppStore';
import { useCartStore } from '../src/store/useCartStore';
import { lineTotal, effectiveUnitPrice, applyCoupon } from '../src/lib/promotions';
import { computeDeliveryFee, meetsMinimum, surgeActive } from '../src/lib/storeHours';
import { placeOrder, markPaid } from '../src/lib/orders';
import { spendWallet } from '../src/lib/wallet';
import { getGatewayConfig, type GatewayPublicConfig } from '../src/lib/payments';
import { successHaptic, getExpoPushToken } from '../src/lib/notifications';
import type { PaymentMethod, FulfillmentType, Order } from '../src/lib/types';

/** Métodos cobrados online (abrem a folha de pagamento após criar o pedido). */
const ONLINE_METHODS: PaymentMethod[] = ['pix', 'card_online', 'picpay', 'nupay'];

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
  const [tip, setTip] = useState(0);
  const [tipCustom, setTipCustom] = useState('');
  const [useWallet, setUseWallet] = useState(false);
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
  // Gorjeta: 100% vai para o entregador; só em pedidos com entrega.
  const tipValue = fulfillment === 'delivery' ? tip : 0;
  const totalBeforeWallet = Math.max(0, subtotal + deliveryFee - discount) + tipValue;
  // Carteira (cashback): saldo pode abater até o valor total do pedido.
  const walletBalance = Number(customer?.walletBalance || 0);
  const walletUsed = useWallet ? Math.min(walletBalance, totalBeforeWallet) : 0;
  const total = Number(Math.max(0, totalBeforeWallet - walletUsed).toFixed(2));
  const surge = surgeActive(deliveryConfig);
  const min = meetsMinimum(deliveryConfig, subtotal);

  const address = customer?.addresses?.find((a) => a.id === addressId) || null;

  // Carteiras extras (PicPay/NuPay) aparecem apenas quando o servidor habilita.
  const [gwConfig, setGwConfig] = useState<GatewayPublicConfig>({});
  useEffect(() => {
    getGatewayConfig().then(setGwConfig).catch(() => {});
  }, []);

  const paymentOptions = useMemo(
    () => buildPaymentOptions(storeInfo?.paymentMethods, gwConfig.wallets),
    [storeInfo, gwConfig],
  );

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
      const pushToken = await getExpoPushToken();
      const orderId = await placeOrder({
        supermarketId: currentSmId!,
        items,
        subtotal,
        deliveryFee,
        discount,
        total,
        tip: tipValue,
        walletUsed,
        pushToken,
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

      // Debita o saldo da carteira usado neste pedido.
      if (walletUsed > 0 && authUser) {
        spendWallet(authUser.uid, walletUsed).catch(() => {});
      }

      if (ONLINE_METHODS.includes(payment) && total > 0) {
        setPayModal({ orderId });
      } else if (ONLINE_METHODS.includes(payment) && total === 0) {
        // Carteira cobriu tudo — nada a cobrar online.
        await markPaid({ supermarketId: currentSmId!, id: orderId } as Order).catch(() => {});
        clear();
        router.replace(`/order/${orderId}?sm=${currentSmId}&new=1&paid=1`);
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

          {/* Carteira (cashback) como desconto */}
          {walletBalance > 0 ? (
            <Pressable
              onPress={() => setUseWallet((v) => !v)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, borderWidth: 2, borderColor: useWallet ? colors.primary : colors.border, backgroundColor: useWallet ? colors.primarySoft : colors.card, padding: spacing.md }}
            >
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: useWallet ? colors.primary : colors.border, backgroundColor: useWallet ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {useWallet ? <Check size={14} color="#fff" /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: font.bold }}>Usar saldo da carteira</Text>
                <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs }}>
                  Você tem {brl(walletBalance)} de cashback disponível
                </Text>
              </View>
              {useWallet ? <Text style={{ color: colors.primary, fontWeight: font.black }}>- {brl(walletUsed)}</Text> : null}
            </Pressable>
          ) : null}
        </Section>

        {/* 5. Tip (delivery only) — 100% para o entregador */}
        {fulfillment === 'delivery' ? (
          <Section title="Gorjeta para o entregador" colors={colors}>
            <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, marginTop: -4 }}>
              100% do valor vai para quem faz a sua entrega. Você também pode dar gorjeta depois.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {[0, 2, 5, 10].map((v) => (
                <SlotChip
                  key={v}
                  label={v === 0 ? 'Sem gorjeta' : brl(v)}
                  active={tip === v && !tipCustom}
                  onPress={() => {
                    setTip(v);
                    setTipCustom('');
                  }}
                  colors={colors}
                />
              ))}
            </ScrollView>
            <Input
              label="Outro valor (opcional)"
              placeholder="Ex: 7,50"
              keyboardType="numeric"
              value={tipCustom}
              onChangeText={(t) => {
                setTipCustom(t);
                const v = Number(t.replace(',', '.'));
                setTip(Number.isFinite(v) && v > 0 ? Math.min(v, 200) : 0);
              }}
            />
          </Section>
        ) : null}

        {/* 6. Notes */}
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
            <Row label={surge ? 'Frete (alta demanda ⚡)' : 'Frete'} value={deliveryFee > 0 ? brl(deliveryFee) : 'Grátis'} colors={colors} />
            {tipValue > 0 ? <Row label="Gorjeta do entregador" value={brl(tipValue)} colors={colors} /> : null}
            {walletUsed > 0 ? <Row label="Saldo da carteira" value={`- ${brl(walletUsed)}`} colors={colors} /> : null}
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

      {/* Pagamento online (PIX / cartão) — Stripe real quando o servidor de
          pagamentos está configurado; demonstração caso contrário. */}
      {payModal ? (
        <PayOnlineSheet
          visible
          method={payment}
          smId={currentSmId!}
          orderId={payModal.orderId}
          total={total}
          storeName={brandName}
          onDone={async (paid, info) => {
            const orderId = payModal.orderId;
            setPayModal(null);
            if (paid) {
              try {
                await markPaid({ supermarketId: currentSmId!, id: orderId } as Order, info);
              } catch {
                // webhook do servidor já pode ter gravado o status
              }
            }
            clear();
            router.replace(`/order/${orderId}?sm=${currentSmId}&new=1${paid ? '&paid=1' : ''}`);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

/* --------------------------- helpers --------------------------- */

interface PayOpt {
  method: PaymentMethod;
  label: string;
  hint?: string;
  icon: (color: string) => React.ReactNode;
}

function buildPaymentOptions(pm?: any, wallets?: { picpay?: boolean; nupay?: boolean }): PayOpt[] {
  const opts: PayOpt[] = [];
  if (!pm || pm.pix) opts.push({ method: 'pix', label: 'PIX', hint: 'Aprovação na hora', icon: (c) => <QrCode size={22} color={c} /> });
  if (!pm || pm.creditCardOnline) opts.push({ method: 'card_online', label: 'Cartão de crédito (online)', hint: 'Pague agora pelo app', icon: (c) => <CreditCard size={22} color={c} /> });
  // Carteiras BR habilitadas no servidor de pagamentos (GET /config).
  if (wallets?.picpay) opts.push({ method: 'picpay', label: 'PicPay', hint: 'Pague pelo app do PicPay', icon: (c) => <Wallet size={22} color={c} /> });
  if (wallets?.nupay) opts.push({ method: 'nupay', label: 'NuPay (Nubank)', hint: 'Pague pelo app do Nubank', icon: (c) => <Wallet size={22} color={c} /> });
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
