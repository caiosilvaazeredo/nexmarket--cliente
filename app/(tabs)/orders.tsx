import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Receipt, ChevronRight, RotateCcw, Star, Store } from 'lucide-react-native';

import { Screen } from '../../src/components/ui/Screen';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { Badge, orderStatusLabel } from '../../src/components/ui/Badge';
import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, spacing, radius } from '../../src/lib/theme';
import { brl, formatDateTime } from '../../src/lib/format';
import { useStore } from '../../src/store/useStore';
import { useCatalog } from '../../src/hooks/useCatalog';
import { addToCart, toastReorder } from '../../src/lib/reorder';
import { isFinished, canRate } from '../../src/lib/orders';
import type { Order } from '../../src/lib/types';
import { toast } from '../../src/components/ProductCard';

export default function Orders() {
  const { colors } = useColors();
  const router = useRouter();
  const orders = useStore((s) => s.orders);
  const authUser = useStore((s) => s.authUser);
  const { products } = useCatalog();

  const reorder = (order: Order) => {
    const added = toastReorder(order, products);
    if (added > 0) {
      toast(`${added} ${added === 1 ? 'item adicionado' : 'itens adicionados'} ao carrinho.`);
      router.push('/cart');
    } else {
      toast('Os itens deste pedido não estão mais disponíveis.');
    }
  };

  if (authUser?.isAnonymous && orders.length === 0) {
    return (
      <Screen title="Pedidos">
        <EmptyState
          icon={<Receipt size={40} color={colors.primary} />}
          title="Entre para ver seus pedidos"
          subtitle="Faça login para acompanhar entregas e repetir compras."
          action={<Button label="Entrar ou cadastrar" onPress={() => router.push('/(auth)/login')} style={{ marginTop: spacing.md }} />}
        />
      </Screen>
    );
  }

  return (
    <Screen title="Meus pedidos" subtitle={orders.length ? `${orders.length} no total` : undefined}>
      {orders.length === 0 ? (
        <EmptyState
          icon={<Receipt size={40} color={colors.primary} />}
          title="Nenhum pedido ainda"
          subtitle="Quando você fizer um pedido, ele aparece aqui."
          action={<Button label="Começar a comprar" onPress={() => router.push('/(tabs)')} style={{ marginTop: spacing.md }} />}
        />
      ) : (
        orders.map((order) => {
          const badge = orderStatusLabel(order);
          const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
          return (
            <Card key={order.id} elevated style={{ gap: spacing.sm }}>
              <Pressable onPress={() => router.push(`/order/${order.id}?sm=${order.supermarketId}`)} style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  {order.storeLogoUrl ? (
                    <Image source={{ uri: order.storeLogoUrl }} style={{ width: 38, height: 38, borderRadius: radius.md }} />
                  ) : (
                    <View style={{ width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Store size={18} color={colors.primaryDark} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: font.black }} numberOfLines={1}>{order.storeName || 'Pedido'}</Text>
                    <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, fontWeight: font.medium }}>{formatDateTime(order.createdAt)}</Text>
                  </View>
                  <ChevronRight size={20} color={colors.textSubtle} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Badge label={badge.label} fg={badge.fg} bg={badge.bg} />
                  <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.base }}>{brl(order.total)}</Text>
                </View>
                <Text style={{ color: colors.textMuted, fontWeight: font.medium, fontSize: fontSize.sm }} numberOfLines={1}>
                  {itemCount} {itemCount === 1 ? 'item' : 'itens'} • {order.items.map((i) => i.name).join(', ')}
                </Text>
              </Pressable>

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {isFinished(order) && (
                  <Button label="Repetir pedido" variant="secondary" size="sm" icon={<RotateCcw size={16} color={colors.textMuted} />} onPress={() => reorder(order)} style={{ flex: 1 }} />
                )}
                {canRate(order) && (
                  <Button label="Avaliar" size="sm" icon={<Star size={16} color="#FFFFFF" />} onPress={() => router.push(`/rate/${order.id}?sm=${order.supermarketId}`)} style={{ flex: 1 }} />
                )}
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
