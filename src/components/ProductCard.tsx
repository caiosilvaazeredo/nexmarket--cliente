import React from 'react';
import { View, Text, Pressable, Image, ToastAndroid, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, ImageOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '../hooks/useColors';
import { radius, font, fontSize, shadow, spacing } from '../lib/theme';
import { brl } from '../lib/format';
import { Badge } from './ui/Badge';
import { QuantityStepper } from './QuantityStepper';
import { useStore } from '../store/useStore';
import { addToCart, increment, decrement, quantityInCart } from '../lib/cart';
import { onSale, inStock } from '../lib/catalog';
import type { Product } from '../lib/types';

export function toast(msg: string) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert('', msg);
}

interface Props {
  product: Product;
  /** "grid" (2-col) or "row" (full-width horizontal). */
  variant?: 'grid' | 'row';
}

export function ProductCard({ product, variant = 'grid' }: Props) {
  const { colors } = useColors();
  const router = useRouter();
  // Subscribe to cart so the stepper reflects live quantity.
  const cart = useStore((s) => s.cart);
  const qty = cart.filter((i) => i.productId === product.id).reduce((n, i) => n + i.quantity, 0);

  const available = inStock(product);
  const sale = onSale(product);
  const needsDetail = !!product.options?.length || product.ageRestricted;

  const openDetail = () => router.push(`/product/${product.id}`);

  const handleAdd = () => {
    if (!available) {
      toast('Produto esgotado. Toque para ser avisado.');
      openDetail();
      return;
    }
    if (needsDetail) {
      openDetail();
      return;
    }
    const res = addToCart(product, { quantity: 1 });
    if (!res.ok && res.reason === 'stock') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      toast('Você atingiu o estoque máximo deste item.');
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const isRow = variant === 'row';

  const ImageBlock = (
    <View
      style={{
        width: isRow ? 88 : '100%',
        height: isRow ? 88 : 120,
        borderRadius: radius.lg,
        backgroundColor: colors.cardMuted,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {product.imageUrl ? (
        <Image source={{ uri: product.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <ImageOff size={28} color={colors.textSubtle} />
      )}
      {!available && (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' }}>
          <Badge label="Esgotado" fg={colors.danger} bg={colors.dangerSoft} small />
        </View>
      )}
      {sale && available && (
        <View style={{ position: 'absolute', top: 6, left: 6 }}>
          <Badge label={`${product.discountPercent ?? 0}% OFF`} fg="#FFFFFF" bg={colors.danger} small />
        </View>
      )}
    </View>
  );

  return (
    <Pressable
      onPress={openDetail}
      style={[
        {
          flexDirection: isRow ? 'row' : 'column',
          gap: spacing.sm,
          backgroundColor: colors.card,
          borderRadius: radius['2xl'],
          borderWidth: 2,
          borderColor: colors.border,
          padding: spacing.sm,
          flex: isRow ? undefined : 1,
        },
        shadow.card,
      ]}
    >
      {ImageBlock}
      <View style={{ flex: 1, justifyContent: 'space-between', gap: 6 }}>
        <View style={{ gap: 2 }}>
          {product.brand ? (
            <Text style={{ color: colors.textSubtle, fontWeight: font.bold, fontSize: 10, textTransform: 'uppercase' }} numberOfLines={1}>
              {product.brand}
            </Text>
          ) : null}
          <Text style={{ color: colors.text, fontWeight: font.bold, fontSize: fontSize.sm }} numberOfLines={2}>
            {product.name}
          </Text>
          <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, fontWeight: font.medium }}>{product.unit}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            {sale && (
              <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, textDecorationLine: 'line-through', fontWeight: font.medium }}>
                {brl(product.originalPrice)}
              </Text>
            )}
            <Text style={{ color: sale ? colors.danger : colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>
              {brl(product.price)}
            </Text>
          </View>

          {qty > 0 ? (
            <QuantityStepper
              value={qty}
              size="sm"
              max={product.stock}
              onInc={() => {
                const lines = useStore.getState().cart.filter((i) => i.productId === product.id);
                if (lines.length === 1) {
                  const r = increment(lines[0].key);
                  if (!r.ok) toast('Estoque máximo atingido.');
                } else openDetail();
              }}
              onDec={() => {
                const lines = useStore.getState().cart.filter((i) => i.productId === product.id);
                if (lines.length === 1) decrement(lines[0].key);
                else openDetail();
              }}
            />
          ) : (
            <Pressable
              onPress={handleAdd}
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.full,
                backgroundColor: available ? colors.primary : colors.cardMuted,
                borderBottomWidth: 3,
                borderColor: available ? colors.primaryDark : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={22} color={available ? '#FFFFFF' : colors.textSubtle} strokeWidth={3} />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}
