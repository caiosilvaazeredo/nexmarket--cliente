import React from 'react';
import { View, Text, Image, Pressable, Alert } from 'react-native';
import { Plus, Minus, Package, Bell } from 'lucide-react-native';
import { useColors } from '../hooks/useColors';
import { radius, font, fontSize, spacing, shadow } from '../lib/theme';
import { brl } from '../lib/format';
import { useAppStore } from '../store/useAppStore';
import { useCartStore } from '../store/useCartStore';
import { effectiveUnitPrice, promoBadge } from '../lib/promotions';
import { availableStock } from '../lib/catalog';
import { warnHaptic } from '../lib/notifications';
import type { Product } from '../lib/types';

interface ProductCardProps {
  product: Product;
  onPress?: () => void;
  width?: number | string;
}

export function ProductCard({ product, onPress, width = '100%' }: ProductCardProps) {
  const { colors } = useColors();
  const promotions = useAppStore((s) => s.promotions);
  const qty = useCartStore((s) => s.lines.find((l) => l.product.id === product.id)?.quantity || 0);
  const cartSmId = useCartStore((s) => s.smId);
  const tryAddItem = useCartStore((s) => s.tryAddItem);
  const addItem = useCartStore((s) => s.addItem);
  const replaceWith = useCartStore((s) => s.replaceWith);

  const unitPrice = effectiveUnitPrice(product, promotions);
  const badge = promoBadge(product, promotions);
  const hasPromo = unitPrice < product.price - 0.001;
  const stock = availableStock(product);
  const outOfStock = typeof stock === 'number' && stock <= 0;
  const atStockLimit = typeof stock === 'number' && qty >= stock;

  const add = () => {
    if (outOfStock) return;
    if (atStockLimit) {
      warnHaptic();
      Alert.alert('Estoque máximo', `Só temos ${stock} unidade(s) deste item disponível.`);
      return;
    }
    const ok = tryAddItem(product, 1);
    if (!ok) {
      Alert.alert(
        'Trocar de loja?',
        'Seu carrinho tem itens de outra loja. Deseja esvaziar e começar um novo carrinho com este item?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Trocar', style: 'destructive', onPress: () => replaceWith(product, 1) },
        ],
      );
    }
  };

  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          width: width as any,
          backgroundColor: colors.card,
          borderRadius: radius['2xl'],
          borderWidth: 2,
          borderColor: hasPromo ? colors.danger : colors.border,
          padding: spacing.md,
        },
        shadow.card,
      ]}
    >
      {/* Image */}
      <View
        style={{
          height: 110,
          borderRadius: radius.lg,
          backgroundColor: colors.cardMuted,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          marginBottom: spacing.sm,
        }}
      >
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        ) : (
          <Package size={36} color={colors.textSubtle} />
        )}
        {badge ? (
          <View
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              backgroundColor: colors.danger,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: radius.full,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: font.black, fontSize: 10, letterSpacing: 0.4 }}>{badge.label}</Text>
          </View>
        ) : null}
        {outOfStock ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: colors.overlay,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: font.black, fontSize: fontSize.sm }}>ESGOTADO</Text>
          </View>
        ) : null}
      </View>

      {/* Name + unit */}
      <Text numberOfLines={2} style={{ color: colors.text, fontWeight: font.bold, fontSize: fontSize.sm, minHeight: 36 }}>
        {product.name}
      </Text>
      <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, marginTop: 2, marginBottom: spacing.sm }}>
        {product.unit || (product.ean ? '1 unidade' : '1 unidade')}
      </Text>

      {/* Price */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: spacing.sm }}>
        <Text style={{ color: hasPromo ? colors.danger : colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>
          {brl(unitPrice)}
        </Text>
        {hasPromo ? (
          <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, textDecorationLine: 'line-through' }}>
            {brl(product.price)}
          </Text>
        ) : null}
      </View>

      {/* Action */}
      {outOfStock ? (
        <Pressable
          onPress={() => Alert.alert('Avisar', 'Você será avisado quando este produto voltar ao estoque.')}
          style={{
            height: 44,
            borderRadius: radius.md,
            borderWidth: 2,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
          }}
        >
          <Bell size={16} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontWeight: font.bold, fontSize: fontSize.sm }}>Avise-me</Text>
        </Pressable>
      ) : qty === 0 ? (
        <Pressable
          onPress={add}
          style={{
            height: 44,
            borderRadius: radius.md,
            backgroundColor: colors.primary,
            borderBottomWidth: 3,
            borderBottomColor: colors.primaryDark,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
          }}
        >
          <Plus size={18} color="#fff" strokeWidth={3} />
          <Text style={{ color: '#fff', fontWeight: font.black, fontSize: fontSize.sm }}>Adicionar</Text>
        </Pressable>
      ) : (
        <View
          style={{
            height: 44,
            borderRadius: radius.md,
            backgroundColor: colors.primary,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            overflow: 'hidden',
          }}
        >
          <Pressable onPress={() => addItem(product, -1)} style={{ paddingHorizontal: 14, height: '100%', justifyContent: 'center' }} hitSlop={6}>
            <Minus size={18} color="#fff" strokeWidth={3} />
          </Pressable>
          <Text style={{ color: '#fff', fontWeight: font.black, fontSize: fontSize.base }}>{qty}</Text>
          <Pressable onPress={add} style={{ paddingHorizontal: 14, height: '100%', justifyContent: 'center' }} hitSlop={6}>
            <Plus size={18} color="#fff" strokeWidth={3} />
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}
