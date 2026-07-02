import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Search,
  MapPin,
  ChevronDown,
  ShoppingBasket,
  Tag,
  ChevronRight,
  Bike,
  Store,
  Clock,
} from 'lucide-react-native';

import { useColors, useBrand } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing, shadow } from '../../src/lib/theme';
import { brl } from '../../src/lib/format';
import { useAppStore, selectActiveOrders } from '../../src/store/useAppStore';
import { useCartStore } from '../../src/store/useCartStore';
import { ProductCard } from '../../src/components/ProductCard';
import { CartBar } from '../../src/components/CartBar';
import { RailSkeleton } from '../../src/components/Skeleton';
import { EmptyState } from '../../src/components/EmptyState';
import { customerStatus } from '../../src/components/ui/Badge';
import { hasDiscount } from '../../src/lib/promotions';
import { isStoreOpenNow, freeShippingHint } from '../../src/lib/storeHours';

export default function Home() {
  const { colors } = useColors();
  const brand = useBrand();
  const router = useRouter();

  const supermarket = useAppStore((s) => s.supermarket);
  const gondolas = useAppStore((s) => s.gondolas);
  const products = useAppStore((s) => s.products);
  const promotions = useAppStore((s) => s.promotions);
  const storeInfo = useAppStore((s) => s.storeInfo);
  const deliveryConfig = useAppStore((s) => s.deliveryConfig);
  const customer = useAppStore((s) => s.customer);
  const myOrders = useAppStore((s) => s.myOrders);
  const catalogLoaded = useAppStore((s) => s.catalogLoaded);
  const activeOrders = useAppStore(selectActiveOrders);
  const cartSubtotalLines = useCartStore((s) => s.lines);

  const open = isStoreOpenNow(storeInfo);
  const defaultAddress = customer?.addresses?.find((a) => a.id === customer?.defaultAddressId) || customer?.addresses?.[0];

  const onSale = useMemo(
    () => products.filter((p) => p.active !== false && hasDiscount(p, promotions)).slice(0, 10),
    [products, promotions],
  );

  // "Compre de novo": itens mais frequentes do histórico que existem nesta loja.
  const buyAgain = useMemo(() => {
    const freq = new Map<string, number>();
    myOrders.forEach((o) =>
      (o.items || []).forEach((it) => {
        if (it.productId) freq.set(it.productId, (freq.get(it.productId) || 0) + it.quantity);
      }),
    );
    return products
      .filter((p) => p.active !== false && freq.has(p.id))
      .sort((a, b) => (freq.get(b.id) || 0) - (freq.get(a.id) || 0))
      .slice(0, 10);
  }, [myOrders, products]);

  // "Mais vendidos" da loja (campo salesCount alimentado pelo painel da loja).
  const bestSellers = useMemo(
    () =>
      products
        .filter((p) => p.active !== false && (p.salesCount || 0) > 0)
        .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
        .slice(0, 10),
    [products],
  );

  // Vitrine por horário do dia (estilo iFood).
  const daypart = useMemo(() => {
    const h = new Date().getHours();
    if (h < 10) return { title: 'Para o seu café da manhã', emoji: '☕', words: ['cafe', 'pao', 'leite', 'queijo', 'presunto', 'iogurte', 'fruta', 'suco', 'manteiga', 'granola'] };
    if (h < 15) return { title: 'Para o almoço de hoje', emoji: '🍝', words: ['arroz', 'feijao', 'carne', 'frango', 'massa', 'macarrao', 'molho', 'salada', 'legume', 'tempero'] };
    if (h < 19) return { title: 'Para o lanche da tarde', emoji: '🥪', words: ['bolo', 'biscoito', 'cafe', 'chocolate', 'pao', 'salgadinho', 'refrigerante', 'suco'] };
    return { title: 'Para o seu jantar', emoji: '🌙', words: ['pizza', 'massa', 'sopa', 'lasanha', 'vinho', 'cerveja', 'queijo', 'pao', 'congelado'] };
  }, []);
  const daypartItems = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return products
      .filter((p) => p.active !== false && daypart.words.some((w) => norm(p.name).includes(w)))
      .slice(0, 10);
  }, [products, daypart]);

  const subtotal = useMemo(() => {
    // light estimate for the free-shipping hint (uses base prices)
    return cartSubtotalLines.reduce((a, l) => a + l.product.price * l.quantity, 0);
  }, [cartSubtotalLines]);

  const shipHint = freeShippingHint(deliveryConfig, subtotal);

  const gondolasWithProducts = useMemo(
    () =>
      gondolas
        .map((g) => ({ gondola: g, items: products.filter((p) => p.gondolaId === g.id && p.active !== false) }))
        .filter((x) => x.items.length > 0),
    [gondolas, products],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* Top bar */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {brand.logoUrl ? (
              <Image source={{ uri: brand.logoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            ) : (
              <ShoppingBasket size={20} color={colors.primary} />
            )}
          </View>
          <Pressable onPress={() => router.push('/addresses')} style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {defaultAddress ? 'Entregar em' : 'Loja'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MapPin size={14} color={colors.primary} />
              <Text numberOfLines={1} style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.base, flexShrink: 1 }}>
                {defaultAddress ? `${defaultAddress.street}, ${defaultAddress.number}` : brand.name}
              </Text>
              <ChevronDown size={16} color={colors.textMuted} />
            </View>
          </Pressable>
        </View>

        {/* Search shortcut */}
        <Pressable
          onPress={() => router.push('/(tabs)/search')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: colors.card,
            borderWidth: 2,
            borderColor: colors.border,
            borderRadius: radius.full,
            paddingHorizontal: 16,
            height: 46,
          }}
        >
          <Search size={20} color={colors.textSubtle} />
          <Text style={{ color: colors.textSubtle, fontWeight: font.medium }}>Buscar produtos em {brand.name}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120, gap: spacing.lg }} showsVerticalScrollIndicator={false}>
        {/* Endereço primeiro (estilo iFood): frete e disponibilidade corretos */}
        {customer && !defaultAddress ? (
          <Pressable
            onPress={() => router.push('/address-edit')}
            style={{ marginHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.amberSoft, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.amber, padding: spacing.md }}
          >
            <MapPin size={20} color="#92400E" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#92400E', fontWeight: font.black }}>Onde você está?</Text>
              <Text style={{ color: '#92400E', fontSize: fontSize.sm }}>Adicione seu endereço para ver frete e disponibilidade certos.</Text>
            </View>
            <ChevronRight size={18} color="#92400E" />
          </Pressable>
        ) : null}

        {/* Store status / free shipping */}
        <View style={{ paddingHorizontal: spacing.lg, flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: open ? colors.primarySoft : colors.dangerSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full }}>
            {open ? <Store size={14} color={colors.primaryDark} /> : <Clock size={14} color={colors.danger} />}
            <Text style={{ color: open ? colors.primaryDark : colors.danger, fontWeight: font.bold, fontSize: fontSize.xs }}>
              {open ? 'Aberta agora' : 'Fechada no momento'}
            </Text>
          </View>
          {shipHint ? (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.blueSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full }}>
              <Bike size={14} color={colors.blue} />
              <Text numberOfLines={1} style={{ color: colors.blue, fontWeight: font.bold, fontSize: fontSize.xs, flex: 1 }}>{shipHint}</Text>
            </View>
          ) : null}
        </View>

        {/* Active order banner */}
        {activeOrders.length > 0 ? (
          <Pressable
            onPress={() => router.push(`/order/${activeOrders[0].id}?sm=${activeOrders[0].supermarketId}`)}
            style={[{ marginHorizontal: spacing.lg, backgroundColor: colors.primary, borderRadius: radius['2xl'], padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 12 }, shadow.card]}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
              <Bike size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: font.black, fontSize: fontSize.base }}>
                Pedido em andamento
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: font.semibold, fontSize: fontSize.sm }}>
                {customerStatus(activeOrders[0]).label} • toque para acompanhar
              </Text>
            </View>
            <ChevronRight size={22} color="#fff" />
          </Pressable>
        ) : null}

        {/* Categories */}
        {gondolas.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="Categorias" colors={colors} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
              {gondolas.map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => router.push(`/category/${g.id}`)}
                  style={{ alignItems: 'center', width: 76, gap: 6 }}
                >
                  <View style={{ width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Tag size={26} color={colors.primary} />
                  </View>
                  <Text numberOfLines={2} style={{ color: colors.text, fontWeight: font.semibold, fontSize: 11, textAlign: 'center' }}>
                    {g.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Compre de novo (recomendações do histórico) */}
        {buyAgain.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="Compre de novo" emoji="🔁" colors={colors} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              {buyAgain.map((p) => (
                <View key={p.id} style={{ width: 150 }}>
                  <ProductCard product={p} onPress={() => router.push(`/product/${p.id}`)} />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Offers carousel */}
        {onSale.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="Ofertas do dia" emoji="🔥" colors={colors} onSeeAll={() => router.push('/(tabs)/search?promo=1')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              {onSale.map((p) => (
                <View key={p.id} style={{ width: 150 }}>
                  <ProductCard product={p} onPress={() => router.push(`/product/${p.id}`)} />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Vitrine por horário do dia */}
        {daypartItems.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title={daypart.title} emoji={daypart.emoji} colors={colors} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              {daypartItems.map((p) => (
                <View key={p.id} style={{ width: 150 }}>
                  <ProductCard product={p} onPress={() => router.push(`/product/${p.id}`)} />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Mais vendidos */}
        {bestSellers.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="Mais vendidos" emoji="🏆" colors={colors} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              {bestSellers.map((p) => (
                <View key={p.id} style={{ width: 150 }}>
                  <ProductCard product={p} onPress={() => router.push(`/product/${p.id}`)} />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Gondola shelves */}
        {gondolasWithProducts.map(({ gondola, items }) => (
          <View key={gondola.id} style={{ gap: spacing.sm }}>
            <SectionHeader title={gondola.name} colors={colors} onSeeAll={() => router.push(`/category/${gondola.id}`)} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              {items.slice(0, 12).map((p) => (
                <View key={p.id} style={{ width: 150 }}>
                  <ProductCard product={p} onPress={() => router.push(`/product/${p.id}`)} />
                </View>
              ))}
            </ScrollView>
          </View>
        ))}

        {/* Skeletons enquanto o catálogo carrega; vazio acionável depois */}
        {!catalogLoaded && products.length === 0 ? (
          <>
            <RailSkeleton />
            <RailSkeleton />
          </>
        ) : products.length === 0 ? (
          <EmptyState
            icon={<ShoppingBasket size={40} color={colors.textSubtle} />}
            title="Esta loja ainda não tem produtos"
            subtitle="Explore outras lojas da sua região enquanto isso."
            actionLabel="Ver outras lojas"
            onAction={() => router.replace('/store-picker')}
          />
        ) : null}
      </ScrollView>

      <CartBar bottomOffset={0} />
    </SafeAreaView>
  );
}

function SectionHeader({ title, emoji, colors, onSeeAll }: { title: string; emoji?: string; colors: any; onSeeAll?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 5, height: 22, borderRadius: 3, backgroundColor: colors.primary }} />
        <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl }}>
          {title} {emoji || ''}
        </Text>
      </View>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: colors.primary, fontWeight: font.bold, fontSize: fontSize.sm }}>ver tudo</Text>
          <ChevronRight size={16} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}
