import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Package, ArrowDownUp } from 'lucide-react-native';

import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing } from '../../src/lib/theme';
import { ProductCard } from '../../src/components/ProductCard';
import { CartBar } from '../../src/components/CartBar';
import { EmptyState } from '../../src/components/EmptyState';
import { useAppStore } from '../../src/store/useAppStore';

type Sort = 'relevance' | 'price_asc' | 'price_desc' | 'name';

const SORTS: { key: Sort; label: string }[] = [
  { key: 'relevance', label: 'Relevância' },
  { key: 'price_asc', label: 'Menor preço' },
  { key: 'price_desc', label: 'Maior preço' },
  { key: 'name', label: 'A-Z' },
];

export default function CategoryScreen() {
  const { colors } = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const gondola = useAppStore((s) => s.gondolas.find((g) => g.id === id));
  const products = useAppStore((s) => s.products);
  const [sort, setSort] = useState<Sort>('relevance');

  const items = useMemo(() => {
    let list = products.filter((p) => p.gondolaId === id && p.active !== false);
    if (sort === 'price_asc') list = list.slice().sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') list = list.slice().sort((a, b) => b.price - a.price);
    else if (sort === 'name') list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [products, id, sort]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 6 }}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl }}>{gondola?.name || 'Categoria'}</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{items.length} produto{items.length === 1 ? '' : 's'}</Text>
        </View>
      </View>

      {/* Sort chips */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <ArrowDownUp size={16} color={colors.textMuted} />
        {SORTS.map((s) => (
          <Pressable key={s.key} onPress={() => setSort(s.key)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, backgroundColor: sort === s.key ? colors.primary : colors.card, borderWidth: 2, borderColor: sort === s.key ? colors.primary : colors.border }}>
            <Text style={{ color: sort === s.key ? '#fff' : colors.textMuted, fontWeight: font.bold, fontSize: fontSize.xs }}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: 120, paddingTop: spacing.xs }}
        renderItem={({ item }) => (
          <View style={{ flex: 1, maxWidth: '48%' }}>
            <ProductCard product={item} onPress={() => router.push(`/product/${item.id}`)} />
          </View>
        )}
        ListEmptyComponent={<EmptyState icon={<Package size={40} color={colors.textSubtle} />} title="Categoria vazia" subtitle="Esta categoria ainda não tem produtos disponíveis." />}
      />

      <CartBar />
    </SafeAreaView>
  );
}
