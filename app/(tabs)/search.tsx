import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search as SearchIcon, X, SlidersHorizontal, PackageSearch } from 'lucide-react-native';

import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing } from '../../src/lib/theme';
import { useCatalog } from '../../src/hooks/useCatalog';
import { searchProducts, didYouMean } from '../../src/lib/search';
import { onSale } from '../../src/lib/catalog';
import { ProductCard } from '../../src/components/ProductCard';
import { EmptyState } from '../../src/components/EmptyState';
import type { Product } from '../../src/lib/types';

type DietFilter = 'vegano' | 'diet' | 'promocao';
type SortKey = 'relevance' | 'price_asc' | 'price_desc';

export default function SearchScreen() {
  const { colors } = useColors();
  const { products, categories } = useCatalog();

  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [diet, setDiet] = useState<DietFilter[]>([]);
  const [sort, setSort] = useState<SortKey>('relevance');
  const [showFilters, setShowFilters] = useState(false);

  const toggleDiet = (d: DietFilter) =>
    setDiet((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  const results = useMemo(() => {
    let list = q.trim() ? searchProducts(q, products) : products;
    if (cat) list = list.filter((p) => p.categoryId === cat);
    if (diet.length) {
      list = list.filter((p) =>
        diet.every((d) => (d === 'promocao' ? onSale(p) : p.tags?.includes(d))),
      );
    }
    if (sort === 'price_asc') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price_desc') list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [q, products, cat, diet, sort]);

  const suggestion = useMemo(
    () => (q.trim() && results.length === 0 ? didYouMean(q, products) : null),
    [q, results, products],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm }}>
        {/* Search field */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 14, height: 50 }}>
          <SearchIcon size={20} color={colors.textSubtle} />
          <TextInput
            autoFocus
            placeholder="Buscar produtos, marcas…"
            placeholderTextColor={colors.textSubtle}
            value={q}
            onChangeText={setQ}
            style={{ flex: 1, color: colors.text, fontSize: fontSize.base, fontWeight: font.medium }}
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <X size={20} color={colors.textSubtle} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => setShowFilters((v) => !v)} hitSlop={8}>
            <SlidersHorizontal size={20} color={showFilters || cat || diet.length ? colors.primary : colors.textSubtle} />
          </Pressable>
        </View>

        {/* Filters (RF07) */}
        {showFilters && (
          <View style={{ gap: spacing.sm }}>
            <FlatList
              horizontal
              data={[{ id: null, name: 'Todas' }, ...categories]}
              keyExtractor={(c) => c.id ?? 'all'}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
              renderItem={({ item }) => {
                const active = cat === item.id;
                return (
                  <Pressable onPress={() => setCat(item.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, backgroundColor: active ? colors.primary : colors.card, borderWidth: 2, borderColor: active ? colors.primaryDark : colors.border }}>
                    <Text style={{ color: active ? '#FFFFFF' : colors.text, fontWeight: font.bold, fontSize: fontSize.sm }}>{item.name}</Text>
                  </Pressable>
                );
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['vegano', 'diet', 'promocao'] as DietFilter[]).map((d) => {
                const active = diet.includes(d);
                return (
                  <Pressable key={d} onPress={() => toggleDiet(d)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, backgroundColor: active ? colors.primarySoft : colors.card, borderWidth: 2, borderColor: active ? colors.primary : colors.border }}>
                    <Text style={{ color: active ? colors.primaryDark : colors.textMuted, fontWeight: font.bold, fontSize: fontSize.sm, textTransform: 'capitalize' }}>{d === 'promocao' ? 'Promoção' : d}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([['relevance', 'Relevância'], ['price_asc', 'Menor preço'], ['price_desc', 'Maior preço']] as [SortKey, string][]).map(([key, label]) => {
                const active = sort === key;
                return (
                  <Pressable key={key} onPress={() => setSort(key)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, backgroundColor: active ? colors.text : colors.card, borderWidth: 2, borderColor: active ? colors.text : colors.border }}>
                    <Text style={{ color: active ? colors.bg : colors.textMuted, fontWeight: font.bold, fontSize: fontSize.xs }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {suggestion && (
          <Pressable onPress={() => setQ(suggestion)}>
            <Text style={{ color: colors.textMuted, fontWeight: font.medium }}>
              Você quis dizer <Text style={{ color: colors.primary, fontWeight: font.black }}>{suggestion}</Text>?
            </Text>
          </Pressable>
        )}
        {q.trim() ? (
          <Text style={{ color: colors.textMuted, fontWeight: font.semibold, fontSize: fontSize.sm }}>
            {results.length} resultado{results.length === 1 ? '' : 's'}
          </Text>
        ) : null}
      </View>

      <FlatList
        data={results}
        keyExtractor={(p: Product) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md, paddingBottom: 120 }}
        renderItem={({ item }) => <ProductCard product={item} />}
        ListEmptyComponent={
          <EmptyState
            icon={<PackageSearch size={40} color={colors.primary} />}
            title={q.trim() ? 'Nada encontrado' : 'Busque o que precisa'}
            subtitle={q.trim() ? 'Tente outro termo ou ajuste os filtros.' : 'Digite o nome de um produto ou marca.'}
          />
        }
      />
    </SafeAreaView>
  );
}
