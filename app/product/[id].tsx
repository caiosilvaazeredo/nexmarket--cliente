import React, { useState } from 'react';
import { View, Text, ScrollView, Image, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Heart, Package, Plus, Minus, ShoppingCart, Leaf, Star } from 'lucide-react-native';

import { Button } from '../../src/components/ui/Button';
import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing, shadow } from '../../src/lib/theme';
import { brl } from '../../src/lib/format';
import { useAppStore } from '../../src/store/useAppStore';
import { useCartStore } from '../../src/store/useCartStore';
import { effectiveUnitPrice, promoBadge, getRulePromotion } from '../../src/lib/promotions';
import { availableStock } from '../../src/lib/catalog';
import { toggleFavorite } from '../../src/lib/customers';
import { warnHaptic } from '../../src/lib/notifications';

export default function ProductDetail() {
  const { colors } = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const product = useAppStore((s) => s.products.find((p) => p.id === id));
  const promotions = useAppStore((s) => s.promotions);
  const gondolas = useAppStore((s) => s.gondolas);
  const authUser = useAppStore((s) => s.authUser);
  const customer = useAppStore((s) => s.customer);

  const qty = useCartStore((s) => s.lines.find((l) => l.product.id === id)?.quantity || 0);
  const { addItem, tryAddItem, replaceWith, totalCount } = useCartStore();

  const [localQty, setLocalQty] = useState(1);

  if (!product) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Package size={48} color={colors.textSubtle} />
        <Text style={{ color: colors.textMuted, fontWeight: font.bold }}>Produto não encontrado.</Text>
        <Button label="Voltar" variant="ghost" fullWidth={false} onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const unitPrice = effectiveUnitPrice(product, promotions);
  const badge = promoBadge(product, promotions);
  const rule = getRulePromotion(product, promotions);
  const hasPromo = unitPrice < product.price - 0.001;
  const gondola = gondolas.find((g) => g.id === product.gondolaId);
  const stock = availableStock(product);
  const outOfStock = typeof stock === 'number' && stock <= 0;
  const isFav = customer?.favorites?.includes(product.id);

  const add = () => {
    if (outOfStock) return;
    if (typeof stock === 'number' && qty + localQty > stock) {
      warnHaptic();
      Alert.alert('Estoque máximo', `Só temos ${stock} unidade(s) disponível.`);
      return;
    }
    const ok = tryAddItem(product, localQty);
    if (!ok) {
      Alert.alert('Trocar de loja?', 'Seu carrinho tem itens de outra loja. Esvaziar e começar um novo carrinho?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Trocar', style: 'destructive', onPress: () => replaceWith(product, localQty) },
      ]);
    }
  };

  const fav = () => {
    if (!authUser || !customer) {
      Alert.alert('Entrar', 'Faça login para salvar favoritos.', [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Entrar', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    toggleFavorite(authUser.uid, customer, product.id).catch(() => {});
  };

  const nutrition = product.nutrition && Object.keys(product.nutrition).length ? product.nutrition : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={fav} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Heart size={20} color={isFav ? colors.danger : colors.text} fill={isFav ? colors.danger : 'transparent'} />
          </Pressable>
          <Pressable onPress={() => router.push('/cart')} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingCart size={20} color={colors.text} />
            {totalCount() > 0 ? (
              <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: font.black }}>{totalCount()}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, gap: spacing.md }} showsVerticalScrollIndicator={false}>
        {/* Image */}
        <View style={{ height: 260, borderRadius: radius['2xl'], backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          ) : (
            <Package size={64} color={colors.textSubtle} />
          )}
          {badge ? (
            <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: colors.danger, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full }}>
              <Text style={{ color: '#fff', fontWeight: font.black, fontSize: fontSize.sm }}>{badge.label}</Text>
            </View>
          ) : null}
        </View>

        {/* Tags */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {gondola ? <Tag label={gondola.name} colors={colors} /> : null}
          {product.brand ? <Tag label={product.brand} colors={colors} /> : null}
          {(product.tags || []).map((t) => (
            <Tag key={t} label={t} colors={colors} leaf />
          ))}
        </View>

        {/* Name + price */}
        <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize['2xl'] }}>{product.name}</Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
          {product.unit || '1 unidade'}{product.ean ? ` • EAN ${product.ean}` : ''}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <Text style={{ color: hasPromo ? colors.danger : colors.text, fontWeight: font.black, fontSize: fontSize['3xl'] }}>{brl(unitPrice)}</Text>
          {hasPromo ? <Text style={{ color: colors.textSubtle, fontSize: fontSize.base, textDecorationLine: 'line-through' }}>{brl(product.price)}</Text> : null}
        </View>
        {rule && rule.type === 'quantity' && rule.requiredQuantity ? (
          <View style={{ backgroundColor: colors.amberSoft, borderRadius: radius.md, padding: spacing.md }}>
            <Text style={{ color: '#92400E', fontWeight: font.bold }}>
              Leve {rule.requiredQuantity} por {brl(rule.value)}!
            </Text>
          </View>
        ) : null}
        {hasPromo && typeof product.lowestPrice30Days === 'number' ? (
          <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs }}>
            Menor preço nos últimos 30 dias: {brl(product.lowestPrice30Days)}
          </Text>
        ) : null}

        {/* Description */}
        {product.description ? (
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.base }}>Descrição</Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 21 }}>{product.description}</Text>
          </View>
        ) : null}

        {/* Nutrition */}
        {nutrition ? (
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.base }}>Informação nutricional</Text>
            <View style={{ borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, overflow: 'hidden' }}>
              {Object.entries(nutrition).map(([k, v], i) => (
                <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: spacing.sm, backgroundColor: i % 2 ? colors.cardMuted : colors.card }}>
                  <Text style={{ color: colors.textMuted, fontWeight: font.medium }}>{k}</Text>
                  <Text style={{ color: colors.text, fontWeight: font.bold }}>{v}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky add bar */}
      <View style={[{ flexDirection: 'row', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.card, borderTopWidth: 2, borderTopColor: colors.border, alignItems: 'center' }, shadow.raised]}>
        {outOfStock ? (
          <Button label="Produto esgotado" disabled style={{ flex: 1 }} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, overflow: 'hidden' }}>
              <Pressable onPress={() => setLocalQty((q) => Math.max(1, q - 1))} style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
                <Minus size={18} color={colors.text} />
              </Pressable>
              <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg, minWidth: 28, textAlign: 'center' }}>{localQty}</Text>
              <Pressable onPress={() => setLocalQty((q) => q + 1)} style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
                <Plus size={18} color={colors.text} />
              </Pressable>
            </View>
            <Button
              label={`Adicionar • ${brl(unitPrice * localQty)}`}
              icon={<Plus size={18} color="#fff" strokeWidth={3} />}
              style={{ flex: 1 }}
              onPress={add}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function Tag({ label, colors, leaf }: { label: string; colors: any; leaf?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.cardMuted, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full }}>
      {leaf ? <Leaf size={12} color={colors.primary} /> : null}
      <Text style={{ color: colors.textMuted, fontWeight: font.bold, fontSize: fontSize.xs }}>{label}</Text>
    </View>
  );
}
