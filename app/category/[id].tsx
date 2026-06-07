import React, { useMemo } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, PackageSearch } from 'lucide-react-native';

import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, spacing, radius } from '../../src/lib/theme';
import { useCatalog } from '../../src/hooks/useCatalog';
import { onSale } from '../../src/lib/catalog';
import { ProductCard } from '../../src/components/ProductCard';
import { EmptyState } from '../../src/components/EmptyState';
import type { Product } from '../../src/lib/types';

export default function CategoryScreen() {
  const { colors } = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products, categories } = useCatalog();

  const isPromo = id === 'promocao';
  const category = categories.find((c) => c.id === id);
  const title = isPromo ? 'Ofertas do dia' : category?.name || 'Categoria';

  const items = useMemo(
    () => (isPromo ? products.filter(onSale) : products.filter((p) => p.categoryId === id)),
    [products, id, isPromo],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
        <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <View>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize['2xl'] }}>{title}</Text>
          <Text style={{ color: colors.textMuted, fontWeight: font.medium, fontSize: fontSize.sm }}>{items.length} produtos</Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(p: Product) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md, paddingBottom: 120 }}
        renderItem={({ item }) => <ProductCard product={item} />}
        ListEmptyComponent={<EmptyState icon={<PackageSearch size={40} color={colors.primary} />} title="Sem produtos aqui" subtitle="Volte mais tarde — o estoque muda o tempo todo." />}
      />
    </SafeAreaView>
  );
}
