import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Receipt, ChevronRight, RotateCcw, Star, ShoppingBasket, LogIn, Package } from 'lucide-react-native';

import { Screen } from '../../src/components/ui/Screen';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing, shadow } from '../../src/lib/theme';
import { brl, formatDateTime } from '../../src/lib/format';
import { useAppStore } from '../../src/store/useAppStore';
import { customerStatus } from '../../src/components/ui/Badge';
import { isFinishedOrder } from '../../src/lib/orders';
import { useReorder } from '../../src/hooks/useReorder';
import type { Order } from '../../src/lib/types';

export default function Orders() {
  const { colors } = useColors();
  const router = useRouter();
  const authUser = useAppStore((s) => s.authUser);
  const myOrders = useAppStore((s) => s.myOrders);
  const repeat = useReorder();

  const active = myOrders.filter((o) => !isFinishedOrder(o));
  const past = myOrders.filter((o) => isFinishedOrder(o));

  if (!authUser) {
    return (
      <Screen title="Pedidos">
        <Card style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing['3xl'] }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Receipt size={34} color={colors.primary} />
          </View>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg, textAlign: 'center' }}>Entre para ver seus pedidos</Text>
          <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Faça login para acompanhar entregas e repetir compras com um toque.</Text>
          <Button label="Entrar ou criar conta" icon={<LogIn size={18} color="#fff" />} onPress={() => router.push('/(auth)/login')} style={{ marginTop: 8 }} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Pedidos" subtitle="Acompanhe e repita suas compras">
      {myOrders.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing['3xl'] }}>
          <ShoppingBasket size={40} color={colors.textSubtle} />
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>Nenhum pedido ainda</Text>
          <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Quando você fizer seu primeiro pedido, ele aparece aqui.</Text>
          <Button label="Começar a comprar" onPress={() => router.push('/(tabs)')} style={{ marginTop: 8 }} />
        </Card>
      ) : null}

      {active.length > 0 ? (
        <>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>Em andamento</Text>
          {active.map((o) => (
            <OrderRow key={o.id} order={o} colors={colors} onPress={() => router.push(`/order/${o.id}?sm=${o.supermarketId}`)} highlight />
          ))}
        </>
      ) : null}

      {past.length > 0 ? (
        <>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg, marginTop: active.length ? spacing.md : 0 }}>Histórico</Text>
          {past.map((o) => (
            <View key={o.id} style={{ gap: spacing.sm }}>
              <OrderRow order={o} colors={colors} onPress={() => router.push(`/order/${o.id}?sm=${o.supermarketId}`)} />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button label="Repetir pedido" variant="secondary" size="sm" style={{ flex: 1 }} icon={<RotateCcw size={16} color={colors.text} />} onPress={() => repeat(o)} />
                {o.status === 'delivered' && !o.rating ? (
                  <Button label="Avaliar" size="sm" style={{ flex: 1 }} icon={<Star size={16} color="#fff" />} onPress={() => router.push(`/order/${o.id}?sm=${o.supermarketId}&rate=1`)} />
                ) : o.rating ? (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Star size={16} color={colors.amber} fill={colors.amber} />
                    <Text style={{ color: colors.textMuted, fontWeight: font.bold }}>{o.rating}.0 avaliado</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function OrderRow({ order, colors, onPress, highlight }: { order: Order; colors: any; onPress: () => void; highlight?: boolean }) {
  const status = customerStatus(order);
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          backgroundColor: colors.card,
          borderRadius: radius['2xl'],
          borderWidth: 2,
          borderColor: highlight ? colors.primary : colors.border,
          padding: spacing.md,
        },
        shadow.card,
      ]}
    >
      <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.cardMuted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {order.storeLogoUrl ? (
          <Image source={{ uri: order.storeLogoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        ) : (
          <Package size={22} color={colors.primary} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.base }}>{order.storeName || 'Loja'}</Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
          {order.items?.length || 0} itens • {brl(order.total)}
        </Text>
        <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs }}>
          #{order.id.slice(0, 6).toUpperCase()} • {formatDateTime(order.createdAt)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <View style={{ backgroundColor: status.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full }}>
          <Text style={{ color: status.fg, fontWeight: font.black, fontSize: 10, textTransform: 'uppercase' }}>{status.label}</Text>
        </View>
        <ChevronRight size={18} color={colors.textSubtle} />
      </View>
    </Pressable>
  );
}
