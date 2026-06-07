import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Heart, Minus, Plus, ImageOff, Leaf, Check } from 'lucide-react-native';

import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing, shadow } from '../../src/lib/theme';
import { brl } from '../../src/lib/format';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { useStore } from '../../src/store/useStore';
import { useCatalog } from '../../src/hooks/useCatalog';
import { getProduct, onSale, inStock } from '../../src/lib/catalog';
import { addToCart } from '../../src/lib/cart';
import { toggleFavorite } from '../../src/lib/customers';
import { toast } from '../../src/components/ProductCard';
import type { Product, CartOption } from '../../src/lib/types';

export default function ProductDetail() {
  const { colors } = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const supermarket = useStore((s) => s.supermarket);
  const customer = useStore((s) => s.customer);
  const { products } = useCatalog();

  const [product, setProduct] = useState<Product | null>(products.find((p) => p.id === id) || null);
  const [qty, setQty] = useState(1);
  const [selected, setSelected] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!product && id && supermarket) getProduct(supermarket.id, id).then(setProduct);
  }, [id, supermarket?.id]);

  if (!product) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textMuted, fontWeight: font.semibold }}>Carregando produto…</Text>
      </SafeAreaView>
    );
  }

  const sale = onSale(product);
  const available = inStock(product);
  const isFav = customer?.favorites?.includes(product.id) ?? false;

  const optionDelta = (product.options || []).reduce((sum, g) => {
    const choiceId = selected[g.id];
    const choice = g.choices.find((c) => c.id === choiceId);
    return sum + (choice?.priceDelta || 0);
  }, 0);
  const unitPrice = product.price + optionDelta;

  const requiredMissing = (product.options || []).some((g) => g.required && !selected[g.id]);

  const handleAdd = () => {
    if (requiredMissing) {
      toast('Escolha as opções obrigatórias.');
      return;
    }
    const doAdd = () => {
      const options: CartOption[] = (product.options || [])
        .map((g) => {
          const choice = g.choices.find((c) => c.id === selected[g.id]);
          if (!choice) return null;
          return { groupId: g.id, groupName: g.name, choiceId: choice.id, choiceName: choice.name, priceDelta: choice.priceDelta || 0 };
        })
        .filter(Boolean) as CartOption[];
      const res = addToCart(product, { quantity: qty, options });
      if (!res.ok && res.reason === 'stock') {
        toast('Quantidade acima do estoque disponível.');
      } else {
        toast('Adicionado ao carrinho ✓');
        router.back();
      }
    };
    if (product.ageRestricted) {
      Alert.alert('Confirmação de idade', 'Este produto é destinado a maiores de 18 anos. Você confirma ter 18 anos ou mais?', [
        { text: 'Não', style: 'cancel' },
        { text: 'Sim, tenho 18+', onPress: doAdd },
      ]);
    } else {
      doAdd();
    }
  };

  const notifyMe = () => toast('Avisaremos quando este produto voltar ao estoque. 🔔');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* Top bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
        <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        {!useStore.getState().authUser?.isAnonymous && (
          <Pressable onPress={() => toggleFavorite(customer!.uid, product.id, !isFav)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Heart size={20} color={isFav ? colors.danger : colors.textMuted} fill={isFav ? colors.danger : 'transparent'} />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160, gap: spacing.lg }} showsVerticalScrollIndicator={false}>
        {/* Image */}
        <View style={{ height: 280, borderRadius: radius['2xl'], backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <ImageOff size={48} color={colors.textSubtle} />
          )}
          {sale && (
            <View style={{ position: 'absolute', top: 12, left: 12 }}>
              <Badge label={`${product.discountPercent ?? 0}% OFF`} fg="#FFFFFF" bg={colors.danger} />
            </View>
          )}
        </View>

        {/* Title + price */}
        <View style={{ gap: 6 }}>
          {product.brand ? <Text style={{ color: colors.textSubtle, fontWeight: font.bold, fontSize: fontSize.xs, textTransform: 'uppercase' }}>{product.brand}</Text> : null}
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize['2xl'] }}>{product.name}</Text>
          <Text style={{ color: colors.textMuted, fontWeight: font.medium }}>{product.unit}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
            {(product.tags || []).map((t) => (
              <Badge key={t} label={t} fg={colors.primaryDark} bg={colors.primarySoft} small icon={t === 'vegano' ? <Leaf size={11} color={colors.primaryDark} /> : undefined} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 6 }}>
            <Text style={{ color: sale ? colors.danger : colors.text, fontWeight: font.black, fontSize: fontSize['3xl'] }}>{brl(unitPrice)}</Text>
            {sale && <Text style={{ color: colors.textSubtle, fontSize: fontSize.lg, textDecorationLine: 'line-through', fontWeight: font.medium, marginBottom: 4 }}>{brl(product.originalPrice)}</Text>}
          </View>
        </View>

        {/* Description */}
        {product.description ? (
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>Descrição</Text>
            <Text style={{ color: colors.textMuted, fontWeight: font.medium, lineHeight: 22 }}>{product.description}</Text>
          </View>
        ) : null}

        {/* Options (RF: customization) */}
        {(product.options || []).map((g) => (
          <View key={g.id} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.base }}>{g.name}</Text>
              {g.required ? <Badge label="Obrigatório" fg={colors.danger} bg={colors.dangerSoft} small /> : null}
            </View>
            {g.choices.map((c) => {
              const active = selected[g.id] === c.id;
              return (
                <Pressable key={c.id} onPress={() => setSelected((s) => ({ ...s, [g.id]: c.id }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 2, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.card }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: active ? colors.primary : colors.borderStrong, backgroundColor: active ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {active && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  <Text style={{ flex: 1, color: colors.text, fontWeight: font.semibold }}>{c.name}</Text>
                  {c.priceDelta ? <Text style={{ color: colors.textMuted, fontWeight: font.bold }}>+ {brl(c.priceDelta)}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ))}

        {/* Nutrition (RF08) */}
        {product.nutrition?.table?.length ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>Tabela nutricional</Text>
            {product.nutrition.servingSize ? <Text style={{ color: colors.textSubtle, fontWeight: font.medium, fontSize: fontSize.sm }}>Porção: {product.nutrition.servingSize} • {product.nutrition.calories}</Text> : null}
            <View style={{ borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, overflow: 'hidden' }}>
              {product.nutrition.table.map((row, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: i % 2 ? colors.cardMuted : colors.card }}>
                  <Text style={{ color: colors.textMuted, fontWeight: font.medium }}>{row.label}</Text>
                  <Text style={{ color: colors.text, fontWeight: font.bold }}>{row.value}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky add bar */}
      <View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, borderTopWidth: 2, borderColor: colors.border, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, shadow.raised]}>
        {available ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardMuted, borderRadius: radius.full, borderWidth: 2, borderColor: colors.border }}>
              <Pressable onPress={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Minus size={20} color={colors.text} strokeWidth={3} />
              </Pressable>
              <Text style={{ minWidth: 28, textAlign: 'center', color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>{qty}</Text>
              <Pressable onPress={() => setQty((q) => (product.stock !== undefined ? Math.min(product.stock, q + 1) : q + 1))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={20} color={colors.text} strokeWidth={3} />
              </Pressable>
            </View>
            <Button label={`Adicionar • ${brl(unitPrice * qty)}`} size="lg" onPress={handleAdd} style={{ flex: 1 }} />
          </>
        ) : (
          <Button label="Avise-me quando chegar" variant="secondary" size="lg" onPress={notifyMe} style={{ flex: 1 }} />
        )}
      </View>
    </SafeAreaView>
  );
}
