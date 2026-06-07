import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Image, FlatList, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Tag, X, ShoppingCart, Truck, Check } from 'lucide-react-native';

import { useColors } from '../src/hooks/useColors';
import { font, fontSize, radius, spacing, shadow } from '../src/lib/theme';
import { brl } from '../src/lib/format';
import { Button } from '../src/components/ui/Button';
import { Input } from '../src/components/ui/Input';
import { EmptyState } from '../src/components/EmptyState';
import { QuantityStepper } from '../src/components/QuantityStepper';
import { ProductCard, toast } from '../src/components/ProductCard';
import { useStore, selectCartSubtotal } from '../src/store/useStore';
import { useCatalog } from '../src/hooks/useCatalog';
import { increment, decrement, removeFromCart, setCoupon, computeTotals } from '../src/lib/cart';
import { applyCoupon } from '../src/lib/coupons';
import type { CartItem } from '../src/lib/types';

export default function Cart() {
  const { colors } = useColors();
  const router = useRouter();
  const cart = useStore((s) => s.cart);
  const subtotal = useStore(selectCartSubtotal);
  const supermarket = useStore((s) => s.supermarket);
  const config = useStore((s) => s.deliveryConfig);
  const couponCode = useStore((s) => s.couponCode);
  const orders = useStore((s) => s.orders);
  const { products } = useCatalog();

  const [coupon, setCouponInput] = useState(couponCode || '');
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [discount, setDiscount] = useState(0);
  const [freeShip, setFreeShip] = useState(false);
  const [applying, setApplying] = useState(false);

  const isFirstOrder = orders.length === 0;

  const totals = useMemo(
    () =>
      computeTotals({
        items: cart,
        config,
        method: 'delivery',
        distanceKm: 2,
        discount,
        freeShippingCoupon: freeShip,
        minOrder: supermarket?.minOrder,
      }),
    [cart, config, discount, freeShip, supermarket],
  );

  // Cross-sell ("Leve também") — cheap items not already in the cart.
  const crossSell = useMemo(
    () => products.filter((p) => !cart.some((c) => c.productId === p.id) && p.price <= 15).slice(0, 8),
    [products, cart],
  );

  const handleApplyCoupon = async () => {
    if (!coupon.trim() || !supermarket) return;
    setApplying(true);
    setCouponMsg(null);
    const res = await applyCoupon(supermarket.id, coupon, subtotal, isFirstOrder);
    setApplying(false);
    if (res.ok) {
      setDiscount(res.discount || 0);
      setFreeShip(!!res.freeShipping);
      setCoupon(coupon.trim().toUpperCase());
      setCouponMsg({ ok: true, text: res.freeShipping ? 'Frete grátis aplicado! 🎉' : `Cupom aplicado: −${brl(res.discount)}` });
    } else {
      setDiscount(0);
      setFreeShip(false);
      setCoupon(null);
      setCouponMsg({ ok: false, text: res.error || 'Cupom inválido.' });
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
    setCouponInput('');
    setDiscount(0);
    setFreeShip(false);
    setCouponMsg(null);
  };

  if (cart.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <Header colors={colors} onBack={() => router.back()} title="Carrinho" />
        <EmptyState
          icon={<ShoppingCart size={40} color={colors.primary} />}
          title="Seu carrinho está vazio"
          subtitle="Adicione produtos e eles aparecem aqui."
          action={<Button label="Explorar produtos" onPress={() => router.replace('/(tabs)')} style={{ marginTop: spacing.md }} />}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header colors={colors} onBack={() => router.back()} title="Carrinho" subtitle={supermarket?.name} />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 200, gap: spacing.md }} showsVerticalScrollIndicator={false}>
        {/* Items */}
        {cart.map((item) => (
          <CartRow key={item.key} item={item} colors={colors} />
        ))}

        {/* Coupon (RF12) */}
        <View style={{ gap: 8 }}>
          {couponCode ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 14 }}>
              <Tag size={20} color={colors.primaryDark} />
              <Text style={{ flex: 1, color: colors.primaryDark, fontWeight: font.black }}>{couponCode}</Text>
              <Pressable onPress={removeCoupon} hitSlop={8}><X size={18} color={colors.primaryDark} /></Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Input containerStyle={{ flex: 1 }} placeholder="Código promocional" autoCapitalize="characters" value={coupon} onChangeText={setCouponInput} icon={<Tag size={20} color={colors.textSubtle} />} />
              <Button label="Aplicar" variant="secondary" fullWidth={false} loading={applying} onPress={handleApplyCoupon} />
            </View>
          )}
          {couponMsg ? (
            <Text style={{ color: couponMsg.ok ? colors.primaryDark : colors.danger, fontWeight: font.semibold, fontSize: fontSize.sm }}>{couponMsg.text}</Text>
          ) : null}
        </View>

        {/* Free-shipping / min-order hints (RF13) */}
        {totals.remainingForFreeShipping > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.blueSoft, borderRadius: radius.md, padding: 14 }}>
            <Truck size={20} color={colors.blue} />
            <Text style={{ flex: 1, color: colors.blue, fontWeight: font.semibold, fontSize: fontSize.sm }}>
              Faltam {brl(totals.remainingForFreeShipping)} para <Text style={{ fontWeight: font.black }}>frete grátis</Text>!
            </Text>
          </View>
        )}
        {totals.remainingForMinOrder > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.amberSoft, borderRadius: radius.md, padding: 14 }}>
            <Text style={{ flex: 1, color: '#92400E', fontWeight: font.semibold, fontSize: fontSize.sm }}>
              Pedido mínimo {brl(supermarket?.minOrder)} — faltam {brl(totals.remainingForMinOrder)}.
            </Text>
          </View>
        )}

        {/* Cross-sell */}
        {crossSell.length > 0 && (
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>Leve também</Text>
            <FlatList horizontal data={crossSell} keyExtractor={(p) => p.id} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }} renderItem={({ item }) => <View style={{ width: 140 }}><ProductCard product={item} /></View>} />
          </View>
        )}
      </ScrollView>

      {/* Sticky summary */}
      <View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, borderTopWidth: 2, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm }, shadow.raised]}>
        <SummaryLine label="Subtotal" value={brl(totals.subtotal)} colors={colors} />
        {totals.discount > 0 && <SummaryLine label="Desconto" value={`− ${brl(totals.discount)}`} colors={colors} accent={colors.primaryDark} />}
        <SummaryLine label="Frete estimado" value={totals.freeShipping ? 'Grátis' : brl(totals.deliveryFee)} colors={colors} accent={totals.freeShipping ? colors.primaryDark : undefined} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>Total</Text>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl }}>{brl(totals.total)}</Text>
        </View>
        <Button
          label="Ir para o pagamento"
          size="lg"
          disabled={totals.remainingForMinOrder > 0}
          onPress={() => router.push('/checkout')}
        />
      </View>
    </SafeAreaView>
  );
}

function CartRow({ item, colors }: { item: CartItem; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, padding: spacing.sm }}>
      <View style={{ width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.cardMuted, overflow: 'hidden' }}>
        {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} /> : null}
      </View>
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: colors.text, fontWeight: font.bold }} numberOfLines={2}>{item.name}</Text>
          {item.options?.length ? <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, fontWeight: font.medium }}>{item.options.map((o) => o.choiceName).join(', ')}</Text> : null}
          <Text style={{ color: colors.text, fontWeight: font.black, marginTop: 2 }}>{brl(item.price)}</Text>
        </View>
      </View>
      <View style={{ justifyContent: 'center' }}>
        <QuantityStepper value={item.quantity} size="sm" max={item.stock} onInc={() => { const r = increment(item.key); if (!r.ok) toast('Estoque máximo atingido.'); }} onDec={() => decrement(item.key)} />
      </View>
    </View>
  );
}

function SummaryLine({ label, value, colors, accent }: any) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: colors.textMuted, fontWeight: font.medium }}>{label}</Text>
      <Text style={{ color: accent || colors.text, fontWeight: font.bold }}>{value}</Text>
    </View>
  );
}

function Header({ colors, onBack, title, subtitle }: any) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
      <Pressable onPress={onBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
        <ChevronLeft size={24} color={colors.text} />
      </Pressable>
      <View>
        <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize['2xl'] }}>{title}</Text>
        {subtitle ? <Text style={{ color: colors.textMuted, fontWeight: font.medium, fontSize: fontSize.sm }}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}
