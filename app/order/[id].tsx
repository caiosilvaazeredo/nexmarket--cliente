import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  MessageCircle,
  Phone,
  Star,
  QrCode,
  Copy,
  CheckCircle2,
  Bike,
  X,
  RefreshCw,
} from 'lucide-react-native';

import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing, shadow } from '../../src/lib/theme';
import { brl, formatTime } from '../../src/lib/format';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Badge, orderStatusLabel } from '../../src/components/ui/Badge';
import { OrderStatusTracker } from '../../src/components/OrderStatusTracker';
import { subscribeOrder, cancelOrder, respondToSubstitution, canRate } from '../../src/lib/orders';
import { toast } from '../../src/components/ProductCard';
import type { Order } from '../../src/lib/types';

let MapView: any, Marker: any;
try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
} catch {}

export default function OrderTracking() {
  const { colors } = useColors();
  const router = useRouter();
  const { id, sm, new: isNew } = useLocalSearchParams<{ id: string; sm: string; new?: string }>();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!id || !sm) return;
    return subscribeOrder(sm, id, setOrder);
  }, [id, sm]);

  if (!order) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textMuted, fontWeight: font.semibold }}>Carregando pedido…</Text>
      </SafeAreaView>
    );
  }

  const badge = orderStatusLabel(order);
  const pixPending = order.payment.method === 'pix' && order.payment.status === 'pending' && order.status !== 'cancelled';
  const showMap =
    order.deliveryMethod === 'delivery' &&
    order.deliveryStatus === 'going_to_customer' &&
    order.driverLocation &&
    MapView;
  const substitutions = order.items
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => it.substituted && (it.substitutionAccepted === null || it.substitutionAccepted === undefined));

  const cancellable = order.status === 'pending';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/orders'))} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl }}>Pedido #{order.id.slice(-6).toUpperCase()}</Text>
          <Text style={{ color: colors.textMuted, fontWeight: font.medium, fontSize: fontSize.sm }}>{order.storeName}</Text>
        </View>
        <Badge label={badge.label} fg={badge.fg} bg={badge.bg} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }} showsVerticalScrollIndicator={false}>
        {isNew && order.status !== 'cancelled' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: 14 }}>
            <CheckCircle2 size={24} color={colors.primaryDark} />
            <Text style={{ flex: 1, color: colors.primaryDark, fontWeight: font.black }}>Pedido realizado com sucesso!</Text>
          </View>
        )}

        {/* PIX payment (RF15) */}
        {pixPending && (
          <Card style={{ gap: spacing.sm, borderColor: colors.primary }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <QrCode size={22} color={colors.primary} />
              <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>Pague com PIX</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontWeight: font.medium, fontSize: fontSize.sm }}>
              Copie o código e pague no app do seu banco. O pedido é confirmado automaticamente.
            </Text>
            <View style={{ backgroundColor: colors.cardMuted, borderRadius: radius.md, padding: 12 }}>
              <Text numberOfLines={2} style={{ color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: fontSize.xs }}>{order.payment.pixCode}</Text>
            </View>
            <Button label="Copiar código PIX" icon={<Copy size={18} color="#FFFFFF" />} onPress={() => toast('Código PIX copiado ✓')} />
            <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, fontWeight: font.medium, textAlign: 'center' }}>Expira em 15 minutos</Text>
          </Card>
        )}

        {/* Substitution prompt (alternative flow) */}
        {substitutions.map(({ it, idx }) => (
          <Card key={idx} style={{ gap: spacing.sm, borderColor: colors.amber }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <RefreshCw size={20} color={colors.amber} />
              <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.base }}>Item em falta</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontWeight: font.medium }}>
              <Text style={{ fontWeight: font.black, color: colors.text }}>{it.name}</Text> está em falta. A loja sugere trocar por{' '}
              <Text style={{ fontWeight: font.black, color: colors.text }}>{it.substituteName}</Text>
              {it.substitutePrice ? ` (${brl(it.substitutePrice)})` : ''}.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button label="Recusar" variant="secondary" size="sm" icon={<X size={16} color={colors.textMuted} />} style={{ flex: 1 }} onPress={() => respondToSubstitution(order, idx, false)} />
              <Button label="Aceitar troca" size="sm" style={{ flex: 1 }} onPress={() => respondToSubstitution(order, idx, true)} />
            </View>
          </Card>
        ))}

        {/* Live driver map (RF21) */}
        {showMap && (
          <Card padded={false} style={{ overflow: 'hidden', height: 200 }}>
            <MapView
              style={{ flex: 1 }}
              initialRegion={{ latitude: order.driverLocation!.lat, longitude: order.driverLocation!.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
            >
              <Marker coordinate={{ latitude: order.driverLocation!.lat, longitude: order.driverLocation!.lng }} title={order.driverName || 'Entregador'} />
              {order.deliveryAddress?.lat && order.deliveryAddress?.lng && (
                <Marker coordinate={{ latitude: order.deliveryAddress.lat, longitude: order.deliveryAddress.lng }} title="Você" pinColor={colors.primary} />
              )}
            </MapView>
          </Card>
        )}

        {/* Driver card */}
        {order.driverName && order.deliveryStatus && order.deliveryStatus !== 'delivered' && (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Bike size={24} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: font.black }}>{order.driverName}</Text>
              <Text style={{ color: colors.textMuted, fontWeight: font.medium, fontSize: fontSize.sm }}>Seu entregador</Text>
            </View>
            <Pressable onPress={() => router.push(`/chat/${order.id}?sm=${order.supermarketId}`)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <MessageCircle size={22} color={colors.primaryDark} />
            </Pressable>
          </Card>
        )}

        {/* Status tracker */}
        {order.status !== 'cancelled' && (
          <Card>
            <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg, marginBottom: spacing.md }}>Acompanhe seu pedido</Text>
            <OrderStatusTracker order={order} />
          </Card>
        )}

        {order.status === 'cancelled' && (
          <Card style={{ borderColor: colors.danger }}>
            <Text style={{ color: colors.danger, fontWeight: font.black, fontSize: fontSize.lg }}>Pedido cancelado</Text>
            <Text style={{ color: colors.textMuted, fontWeight: font.medium, marginTop: 4 }}>Se houve pagamento, o estorno já foi iniciado.</Text>
          </Card>
        )}

        {/* Items + totals */}
        <Card style={{ gap: 6 }}>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg, marginBottom: 4 }}>Itens</Text>
          {order.items.map((i, idx) => (
            <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={{ color: i.missing ? colors.danger : colors.text, fontWeight: font.medium, flex: 1, textDecorationLine: i.missing ? 'line-through' : 'none' }} numberOfLines={1}>
                {i.quantity}× {i.substitutionAccepted ? i.substituteName : i.name}
              </Text>
              <Text style={{ color: colors.text, fontWeight: font.bold }}>{brl(i.price * i.quantity)}</Text>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
          <Line label="Subtotal" value={brl(order.subtotal)} colors={colors} />
          {order.discount ? <Line label="Desconto" value={`− ${brl(order.discount)}`} colors={colors} /> : null}
          <Line label="Frete" value={order.deliveryFee ? brl(order.deliveryFee) : 'Grátis'} colors={colors} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.base }}>Total</Text>
            <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>{brl(order.total)}</Text>
          </View>
        </Card>

        {/* Actions */}
        <View style={{ gap: spacing.sm }}>
          <Button label="Falar com a loja" variant="secondary" icon={<MessageCircle size={18} color={colors.textMuted} />} onPress={() => router.push(`/chat/${order.id}?sm=${order.supermarketId}`)} />
          {canRate(order) && (
            <Button label="Avaliar pedido" icon={<Star size={18} color="#FFFFFF" />} onPress={() => router.push(`/rate/${order.id}?sm=${order.supermarketId}`)} />
          )}
          {cancellable && (
            <Button
              label="Cancelar pedido"
              variant="secondary"
              textStyle={{ color: colors.danger }}
              onPress={() => Alert.alert('Cancelar pedido', 'Deseja cancelar? Esta ação não pode ser desfeita.', [{ text: 'Não', style: 'cancel' }, { text: 'Sim, cancelar', style: 'destructive', onPress: () => cancelOrder(order) }])}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Line({ label, value, colors }: any) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
      <Text style={{ color: colors.textMuted, fontWeight: font.medium }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: font.bold }}>{value}</Text>
    </View>
  );
}
