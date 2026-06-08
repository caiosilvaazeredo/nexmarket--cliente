import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Image, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Minus, Plus, Trash2, Package, Tag, Check, X, Bike, ShoppingBag } from 'lucide-react-native';

import { Button } from '../src/components/ui/Button';
import { Input } from '../src/components/ui/Input';
import { useColors } from '../src/hooks/useColors';
import { font, fontSize, radius, spacing, shadow } from '../src/lib/theme';
import { brl } from '../src/lib/format';
import { useAppStore } from '../src/store/useAppStore';
import { useCartStore } from '../src/store/useCartStore';
import { lineTotal, effectiveUnitPrice, applyCoupon } from '../src/lib/promotions';
import { computeDeliveryFee, meetsMinimum, freeShippingHint } from '../src/lib/storeHours';
import { ProductCard } from '../src/components/ProductCard';

export default function Cart() {
  const { colors } = useColors();
  const router = useRouter();

  const lines = useCartStore((s) => s.lines);
  const couponCode = useCartStore((s) => s.couponCode);
  const couponDiscount = useCartStore((s) => s.couponDiscount);
  const { addItem, removeItem, setCoupon, clear } = useCartStore();

  const products = useAppStore((s) => s.products);
  const promotions = useAppStore((s) => s.promotions);
  const deliveryConfig = useAppStore((s) => s.deliveryConfig);
  const myOrders = useAppStore((s) => s.myOrders);
  const brandName = useAppStore((s) => s.brand.name);

  const [coupon, setCouponText] = useState(couponCode || '');
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const subtotal = useMemo(() => lines.reduce((a, l) => a + lineTotal(l.product, l.quantity, promotions), 0), [lines, promotions]);
  const deliveryFee = computeDeliveryFee(deliveryConfig);
  const min = meetsMinimum(deliveryConfig, subtotal);
  const discount = couponDiscount || 0;
  const total = Math.max(0, subtotal + deliveryFee - discount);
  const shipHint = freeShippingHint(deliveryConfig, subtotal);

  const crossSell = useMemo(() => {
    const inCart = new Set(lines.map((l) => l.product.id));
    return products.filter((p) => p.active !== false && !inCart.has(p.id)).slice(0, 8);
  }, [products, lines]);

  const onApplyCoupon = () => {
    const res = applyCoupon(coupon, subtotal, promotions, {
      isFirstOrder: myOrders.length === 0,
      deliveryFee,
    });
    setCouponMsg({ ok: res.ok, text: res.message });
    if (res.ok) setCoupon(res.code, res.discount);
    else setCoupon(null, 0);
  };

  const removeCoupon = () => {
    setCoupon(null, 0);
    setCouponText('');
    setCouponMsg(null);
  };

  const goCheckout = () => {
    if (!min.ok) {
      Alert.alert('Pedido mínimo', `Faltam ${brl(min.missing)} para atingir o pedido mínimo de ${brl(min.min)}.`);
      return;
    }
    router.push('/checkout');
  };

  if (lines.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <Header colors={colors} onBack={() => router.back()} title="Carrinho" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl }}>
          <ShoppingBag size={56} color={colors.textSubtle} />
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl }}>Seu carrinho está vazio</Text>
          <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Adicione produtos para continuar.</Text>
          <Button label="Voltar às compras" onPress={() => router.replace('/(tabs)')} style={{ marginTop: 8 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header
        colors={colors}
        onBack={() => router.back()}
        title="Carrinho"
        right={
          <Pressable onPress={() => Alert.alert('Esvaziar carrinho', 'Remover todos os itens?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Esvaziar', style: 'destructive', onPress: clear }])} hitSlop={10}>
            <Trash2 size={20} color={colors.danger} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 200, gap: spacing.md }} showsVerticalScrollIndicator={false}>
        {/* Items */}
        {lines.map((l) => {
          const unit = effectiveUnitPrice(l.product, promotions);
          return (
            <View key={l.product.id} style={{ flexDirection: 'row', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, padding: spacing.md }}>
              <View style={{ width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.cardMuted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {l.product.imageUrl ? <Image source={{ uri: l.product.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Package size={26} color={colors.textSubtle} />}
              </View>
              <View style={{ flex: 1, justifyContent: 'space-between' }}>
                <Text numberOfLines={2} style={{ color: colors.text, fontWeight: font.bold, fontSize: fontSize.sm }}>{l.product.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, overflow: 'hidden' }}>
                    <Pressable onPress={() => addItem(l.product, -1)} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Minus size={16} color={colors.text} />
                    </Pressable>
                    <Text style={{ color: colors.text, fontWeight: font.black, minWidth: 24, textAlign: 'center' }}>{l.quantity}</Text>
                    <Pressable onPress={() => addItem(l.product, 1)} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Plus size={16} color={colors.text} />
                    </Pressable>
                  </View>
                  <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.base }}>{brl(unit * l.quantity)}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {/* Coupon */}
        <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, padding: spacing.md, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Tag size={18} color={colors.primary} />
            <Text style={{ color: colors.text, fontWeight: font.black }}>Cupom de desconto</Text>
          </View>
          {couponCode ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Check size={18} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontWeight: font.black }}>{couponCode} • -{brl(discount)}</Text>
              </View>
              <Pressable onPress={removeCoupon} hitSlop={8}><X size={18} color={colors.primaryDark} /></Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Input placeholder="Digite o cupom" autoCapitalize="characters" value={coupon} onChangeText={setCouponText} />
              </View>
              <Button label="Aplicar" fullWidth={false} onPress={onApplyCoupon} />
            </View>
          )}
          {couponMsg && !couponCode ? (
            <Text style={{ color: couponMsg.ok ? colors.primaryDark : colors.danger, fontWeight: font.semibold, fontSize: fontSize.sm }}>{couponMsg.text}</Text>
          ) : null}
        </View>

        {/* Free shipping hint / minimum */}
        {shipHint ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.blueSoft, borderRadius: radius.md, padding: spacing.md }}>
            <Bike size={18} color={colors.blue} />
            <Text style={{ color: colors.blue, fontWeight: font.bold, flex: 1 }}>{shipHint}</Text>
          </View>
        ) : null}

        {/* Cross-sell to reach minimum / boost basket */}
        {crossSell.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.base }}>
              {!min.ok ? 'Leve também para fechar o pedido' : 'Leve também'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
              {crossSell.map((p) => (
                <View key={p.id} style={{ width: 140 }}>
                  <ProductCard product={p} onPress={() => router.push(`/product/${p.id}`)} />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      {/* Summary + CTA */}
      <View style={[{ padding: spacing.lg, backgroundColor: colors.card, borderTopWidth: 2, borderTopColor: colors.border, gap: spacing.sm }, shadow.raised]}>
        <Row label="Subtotal" value={brl(subtotal)} colors={colors} />
        {discount > 0 ? <Row label="Desconto" value={`- ${brl(discount)}`} colors={colors} positive /> : null}
        <Row label="Frete" value={deliveryFee > 0 ? brl(deliveryFee) : 'Grátis'} colors={colors} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.base }}>Total</Text>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize['2xl'] }}>{brl(total)}</Text>
        </View>
        {!min.ok ? (
          <Text style={{ color: colors.danger, fontWeight: font.bold, fontSize: fontSize.sm, textAlign: 'center' }}>
            Faltam {brl(min.missing)} para o pedido mínimo de {brl(min.min)}
          </Text>
        ) : null}
        <Button label="Ir para o pagamento" size="lg" disabled={!min.ok} onPress={goCheckout} />
      </View>
    </SafeAreaView>
  );
}

function Header({ colors, onBack, title, right }: { colors: any; onBack: () => void; title: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
      <Pressable onPress={onBack} hitSlop={10} style={{ padding: 6 }}>
        <ArrowLeft size={24} color={colors.text} />
      </Pressable>
      <Text style={{ flex: 1, color: colors.text, fontWeight: font.black, fontSize: fontSize['2xl'] }}>{title}</Text>
      {right}
    </View>
  );
}

function Row({ label, value, colors, positive }: { label: string; value: string; colors: any; positive?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: colors.textMuted, fontWeight: font.medium }}>{label}</Text>
      <Text style={{ color: positive ? colors.primaryDark : colors.textMuted, fontWeight: font.bold }}>{value}</Text>
    </View>
  );
}
