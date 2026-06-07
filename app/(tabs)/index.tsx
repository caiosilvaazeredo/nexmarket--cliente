import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Image, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Search,
  MapPin,
  ChevronRight,
  Clock,
  Tag,
  Bike,
  Store,
  ChevronDown,
} from 'lucide-react-native';

import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing, shadow } from '../../src/lib/theme';
import { brl } from '../../src/lib/format';
import { useStore, selectSelectedAddress, selectActiveOrder } from '../../src/store/useStore';
import { useCatalog } from '../../src/hooks/useCatalog';
import { groupByCategory, onSale } from '../../src/lib/catalog';
import { ProductCard } from '../../src/components/ProductCard';
import { orderStatusLabel } from '../../src/components/ui/Badge';
import type { Product } from '../../src/lib/types';

export default function Home() {
  const { colors } = useColors();
  const router = useRouter();
  const supermarket = useStore((s) => s.supermarket);
  const config = useStore((s) => s.deliveryConfig);
  const address = useStore(selectSelectedAddress);
  const activeOrder = useStore(selectActiveOrder);
  const { products, categories } = useCatalog();

  const promos = useMemo(() => products.filter(onSale).slice(0, 10), [products]);
  const gondolas = useMemo(
    () => groupByCategory(products, categories.filter((c) => c.featured)),
    [products, categories],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* ---- Store + address header ---- */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {supermarket?.logoUrl ? (
            <Image source={{ uri: supermarket.logoUrl }} style={{ width: 40, height: 40, borderRadius: radius.md }} />
          ) : (
            <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Store size={22} color="#FFFFFF" />
            </View>
          )}
          <Pressable onPress={() => router.push('/address')} style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: font.bold, textTransform: 'uppercase' }}>Entregar em</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MapPin size={14} color={colors.primary} />
              <Text style={{ color: colors.text, fontWeight: font.bold, fontSize: fontSize.sm }} numberOfLines={1}>
                {address ? [address.street, address.number].filter(Boolean).join(', ') || address.title || 'Endereço' : 'Escolher endereço'}
              </Text>
              <ChevronDown size={14} color={colors.textMuted} />
            </View>
          </Pressable>
        </View>

        {/* Search bar (RF06) */}
        <Pressable
          onPress={() => router.push('/(tabs)/search')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 14, height: 48 }}
        >
          <Search size={20} color={colors.textSubtle} />
          <Text style={{ color: colors.textSubtle, fontWeight: font.medium }}>Buscar produtos, marcas…</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120, gap: spacing.lg }} showsVerticalScrollIndicator={false}>
        {/* ---- Active order banner (RF20) ---- */}
        {activeOrder && (
          <Pressable
            onPress={() => router.push(`/order/${activeOrder.id}?sm=${activeOrder.supermarketId}`)}
            style={[{ marginHorizontal: spacing.lg, backgroundColor: colors.primary, borderRadius: radius['2xl'], padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 12 }, shadow.card]}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
              <Bike size={24} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: font.black, fontSize: fontSize.base }}>Pedido em andamento</Text>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: font.semibold, fontSize: fontSize.sm }}>
                {orderStatusLabel(activeOrder).label}
              </Text>
            </View>
            <ChevronRight size={22} color="#FFFFFF" />
          </Pressable>
        )}

        {/* ---- Store banner / welcome ---- */}
        <View style={{ marginHorizontal: spacing.lg, backgroundColor: colors.primarySoft, borderRadius: radius['2xl'], padding: spacing.lg, gap: 6 }}>
          <Text style={{ color: colors.primaryDark, fontWeight: font.black, fontSize: fontSize.xl }}>{supermarket?.name || 'Bem-vindo!'}</Text>
          <Text style={{ color: colors.text, fontWeight: font.medium }}>{supermarket?.description || 'Tudo o que você precisa, na sua porta.'}</Text>
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Clock size={14} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontWeight: font.bold, fontSize: fontSize.xs }}>{config?.estimatedMinutes ?? 40} min</Text>
            </View>
            {config?.freeShippingMinimum ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Bike size={14} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontWeight: font.bold, fontSize: fontSize.xs }}>Frete grátis acima de {brl(config.freeShippingMinimum)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ---- Categories (gôndolas) RF05 ---- */}
        {categories.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="Categorias" />
            <FlatList
              horizontal
              data={categories}
              keyExtractor={(c) => c.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
              renderItem={({ item }) => (
                <Pressable onPress={() => router.push(`/category/${item.id}`)} style={{ alignItems: 'center', width: 76, gap: 6 }}>
                  <View style={{ width: 72, height: 72, borderRadius: radius['2xl'], overflow: 'hidden', backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Tag size={26} color={colors.primary} />
                    )}
                  </View>
                  <Text style={{ color: colors.text, fontWeight: font.semibold, fontSize: fontSize.xs, textAlign: 'center' }} numberOfLines={2}>
                    {item.name}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        )}

        {/* ---- Promo carousel (RF09) ---- */}
        {promos.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="🔥 Ofertas do dia" onSeeAll={() => router.push('/category/promocao')} />
            <FlatList
              horizontal
              data={promos}
              keyExtractor={(p) => p.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
              renderItem={({ item }) => (
                <View style={{ width: 150 }}>
                  <ProductCard product={item} />
                </View>
              )}
            />
          </View>
        )}

        {/* ---- Featured gôndola rows ---- */}
        {gondolas.map(({ category, products: items }) => (
          <View key={category.id} style={{ gap: spacing.sm }}>
            <SectionHeader title={category.name} onSeeAll={() => router.push(`/category/${category.id}`)} />
            <FlatList
              horizontal
              data={items}
              keyExtractor={(p) => p.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
              renderItem={({ item }: { item: Product }) => (
                <View style={{ width: 150 }}>
                  <ProductCard product={item} />
                </View>
              )}
            />
          </View>
        ))}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );

  function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg }}>
        <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl }}>{title}</Text>
        {onSeeAll && (
          <Pressable onPress={onSeeAll} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: colors.primary, fontWeight: font.bold, fontSize: fontSize.sm }}>Ver tudo</Text>
            <ChevronRight size={16} color={colors.primary} />
          </Pressable>
        )}
      </View>
    );
  }
}
