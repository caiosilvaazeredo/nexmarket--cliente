import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, FlatList, Pressable, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Search as SearchIcon, SlidersHorizontal, X, Check } from 'lucide-react-native';

import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing } from '../../src/lib/theme';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { ProductCard } from '../../src/components/ProductCard';
import { CartBar } from '../../src/components/CartBar';
import { useAppStore } from '../../src/store/useAppStore';
import { filterProducts, collectBrands, collectTags, ProductFilters, normalize } from '../../src/lib/search';
import { hasDiscount } from '../../src/lib/promotions';

export default function SearchScreen() {
  const { colors } = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ gondola?: string; promo?: string; q?: string; fav?: string }>();

  const products = useAppStore((s) => s.products);
  const gondolas = useAppStore((s) => s.gondolas);
  const promotions = useAppStore((s) => s.promotions);
  const favorites = useAppStore((s) => s.customer?.favorites);
  const favMode = params.fav === '1';

  const [search, setSearch] = useState(params.q || '');
  const [filters, setFilters] = useState<ProductFilters>({
    gondolaId: params.gondola || null,
    onlyPromo: params.promo === '1',
    sort: 'relevance',
    tags: [],
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (params.gondola) setFilters((f) => ({ ...f, gondolaId: String(params.gondola) }));
    if (params.promo === '1') setFilters((f) => ({ ...f, onlyPromo: true }));
  }, [params.gondola, params.promo]);

  const brands = useMemo(() => collectBrands(products), [products]);
  const tags = useMemo(() => collectTags(products), [products]);

  const results = useMemo(() => {
    const base = favMode ? products.filter((p) => (favorites || []).includes(p.id)) : products;
    return filterProducts(base, search, filters, gondolas, (p) => hasDiscount(p, promotions));
  }, [products, search, filters, gondolas, promotions, favMode, favorites]);

  // "Você quis dizer" — when nothing matches, suggest the closest product name.
  const suggestion = useMemo(() => {
    if (!search || results.length > 0) return null;
    const q = normalize(search);
    type Best = { name: string; score: number };
    let best: Best | null = null;
    products.forEach((p) => {
      const n = normalize(p.name);
      if (!n) return;
      let score = 0;
      for (let i = 0; i < Math.min(n.length, q.length); i++) if (n[i] === q[i]) score++;
      if (n.includes(q.slice(0, 3))) score += 2;
      if (best === null || score > best.score) best = { name: p.name, score };
    });
    const top = best as Best | null;
    return top && top.score > 1 ? top.name : null;
  }, [search, results.length, products]);

  const activeFilterCount =
    (filters.gondolaId ? 1 : 0) + (filters.brand ? 1 : 0) + (filters.onlyPromo ? 1 : 0) + (filters.tags?.length || 0) + (filters.sort && filters.sort !== 'relevance' ? 1 : 0);

  const clearFilters = () => setFilters({ gondolaId: null, brand: null, onlyPromo: false, tags: [], sort: 'relevance', minPrice: null, maxPrice: null });

  const Header = (
    <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Input
            placeholder="Buscar produtos…"
            value={search}
            onChangeText={setSearch}
            autoFocus={!params.gondola && !params.promo}
            icon={<SearchIcon size={20} color={colors.textSubtle} />}
            right={search ? <Pressable onPress={() => setSearch('')}><X size={18} color={colors.textSubtle} /></Pressable> : undefined}
          />
        </View>
        <Pressable
          onPress={() => setShowFilters(true)}
          style={{ width: 52, height: 52, borderRadius: radius.md, borderWidth: 2, borderColor: activeFilterCount ? colors.primary : colors.border, backgroundColor: activeFilterCount ? colors.primarySoft : colors.card, alignItems: 'center', justifyContent: 'center' }}
        >
          <SlidersHorizontal size={20} color={activeFilterCount ? colors.primary : colors.textMuted} />
          {activeFilterCount ? (
            <View style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: font.black }}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        <Chip label="Todos" active={!filters.gondolaId} onPress={() => setFilters((f) => ({ ...f, gondolaId: null }))} colors={colors} />
        <Chip label="🔥 Promoções" active={!!filters.onlyPromo} onPress={() => setFilters((f) => ({ ...f, onlyPromo: !f.onlyPromo }))} colors={colors} />
        {gondolas.map((g) => (
          <Chip key={g.id} label={g.name} active={filters.gondolaId === g.id} onPress={() => setFilters((f) => ({ ...f, gondolaId: f.gondolaId === g.id ? null : g.id }))} colors={colors} />
        ))}
      </ScrollView>

      <Text style={{ color: colors.textMuted, fontWeight: font.bold, fontSize: fontSize.sm }}>
        {results.length} produto{results.length === 1 ? '' : 's'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize['2xl'], marginBottom: spacing.sm }}>{favMode ? 'Favoritos ❤️' : 'Buscar'}</Text>
      </View>
      <FlatList
        data={results}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: 120 }}
        ListHeaderComponent={<View style={{ paddingHorizontal: spacing.lg }}>{Header}</View>}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <View style={{ flex: 1, maxWidth: '48%' }}>
            <ProductCard product={item} onPress={() => router.push(`/product/${item.id}`)} />
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: spacing['3xl'], paddingHorizontal: spacing.lg, gap: 10 }}>
            <SearchIcon size={40} color={colors.textSubtle} />
            <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg, textAlign: 'center' }}>Nenhum produto encontrado</Text>
            {suggestion ? (
              <Pressable onPress={() => setSearch(suggestion)}>
                <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
                  Você quis dizer <Text style={{ color: colors.primary, fontWeight: font.black }}>{suggestion}</Text>?
                </Text>
              </Pressable>
            ) : (
              <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Tente outro termo ou ajuste os filtros.</Text>
            )}
            {activeFilterCount ? <Button label="Limpar filtros" variant="secondary" fullWidth={false} onPress={clearFilters} style={{ marginTop: 8 }} /> : null}
          </View>
        }
      />

      <CartBar />

      {/* Filters modal */}
      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'], maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl }}>Filtros</Text>
              <Pressable onPress={() => setShowFilters(false)} hitSlop={10}><X size={24} color={colors.textMuted} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
              <FilterGroup title="Ordenar por" colors={colors}>
                {([
                  ['relevance', 'Relevância'],
                  ['price_asc', 'Menor preço'],
                  ['price_desc', 'Maior preço'],
                  ['name', 'Nome (A-Z)'],
                ] as const).map(([key, label]) => (
                  <Chip key={key} label={label} active={(filters.sort || 'relevance') === key} onPress={() => setFilters((f) => ({ ...f, sort: key }))} colors={colors} />
                ))}
              </FilterGroup>

              {brands.length > 0 ? (
                <FilterGroup title="Marca" colors={colors}>
                  {brands.map((b) => (
                    <Chip key={b} label={b} active={filters.brand === b} onPress={() => setFilters((f) => ({ ...f, brand: f.brand === b ? null : b }))} colors={colors} />
                  ))}
                </FilterGroup>
              ) : null}

              {tags.length > 0 ? (
                <FilterGroup title="Preferências" colors={colors}>
                  {tags.map((t) => {
                    const active = filters.tags?.includes(t);
                    return (
                      <Chip key={t} label={t} active={!!active} onPress={() => setFilters((f) => ({ ...f, tags: active ? (f.tags || []).filter((x) => x !== t) : [...(f.tags || []), t] }))} colors={colors} />
                    );
                  })}
                </FilterGroup>
              ) : null}

              <FilterGroup title="Outros" colors={colors}>
                <Chip label="🔥 Só promoções" active={!!filters.onlyPromo} onPress={() => setFilters((f) => ({ ...f, onlyPromo: !f.onlyPromo }))} colors={colors} />
              </FilterGroup>

              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
                <Button label="Limpar" variant="secondary" style={{ flex: 1 }} onPress={clearFilters} />
                <Button label="Ver resultados" style={{ flex: 1 }} icon={<Check size={18} color="#fff" />} onPress={() => setShowFilters(false)} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress, colors }: { label: string; active: boolean; onPress: () => void; colors: any }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: radius.full,
        backgroundColor: active ? colors.primary : colors.card,
        borderWidth: 2,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      <Text style={{ color: active ? '#fff' : colors.textMuted, fontWeight: font.bold, fontSize: fontSize.sm }}>{label}</Text>
    </Pressable>
  );
}

function FilterGroup({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.base }}>{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}
