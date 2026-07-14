import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { Check, Receipt, PackageSearch, PackageCheck, Bike, Home, Store } from 'lucide-react-native';
import { useColors } from '../hooks/useColors';
import { font, fontSize, radius } from '../lib/theme';
import type { Order } from '../lib/types';

interface Step {
  key: string;
  label: string;
  hint: string;
  Icon: any;
}

/** Build the right step list for delivery vs pickup orders. */
function buildSteps(order: Order): { steps: Step[]; current: number } {
  const isPickup = order.fulfillment === 'pickup';

  const steps: Step[] = isPickup
    ? [
        { key: 'pending', label: 'Pedido confirmado', hint: 'Recebemos seu pedido', Icon: Receipt },
        { key: 'picking', label: 'Em separação', hint: 'Separando seus itens', Icon: PackageSearch },
        { key: 'ready', label: 'Pronto para retirada', hint: 'Retire na loja', Icon: Store },
        { key: 'delivered', label: 'Retirado', hint: 'Pedido concluído', Icon: PackageCheck },
      ]
    : [
        { key: 'pending', label: 'Pedido confirmado', hint: 'Recebemos seu pedido', Icon: Receipt },
        { key: 'picking', label: 'Em separação', hint: 'Separando seus itens', Icon: PackageSearch },
        { key: 'ready', label: 'Pronto / enviado', hint: 'Aguardando o entregador', Icon: PackageCheck },
        { key: 'going_to_customer', label: 'A caminho', hint: 'Seu pedido saiu para entrega', Icon: Bike },
        { key: 'delivered', label: 'Entregue', hint: 'Aproveite!', Icon: Home },
      ];

  if (order.status === 'cancelled') return { steps, current: -1 };

  let current = 0;
  const s = order.status;
  const d = order.deliveryStatus;

  if (s === 'delivered' || d === 'delivered') {
    current = steps.length - 1;
  } else if (!isPickup && (d === 'going_to_customer' || d === 'picked_up')) {
    current = 3;
  } else if (!isPickup && (d === 'going_to_store' || d === 'arrived_store')) {
    current = 2;
  } else if (s === 'ready') {
    current = 2;
  } else if (s === 'picking' || s === 'waiting_substitution') {
    current = 1;
  } else {
    current = 0;
  }
  return { steps, current };
}

export function OrderStatusTracker({ order }: { order: Order }) {
  const { colors } = useColors();
  const { steps, current } = buildSteps(order);
  const cancelled = order.status === 'cancelled';

  // Barra de progresso animada (estilo "pizza tracker") + pulso no passo atual.
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pct = cancelled ? 0 : Math.max(0.06, (current + 1) / steps.length);
    Animated.timing(progress, { toValue: pct, duration: 650, useNativeDriver: false }).start();
  }, [current, cancelled, steps.length]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    if (!cancelled && current < steps.length - 1) loop.start();
    return () => loop.stop();
  }, [current, cancelled]);

  return (
    <View style={{ gap: 0 }}>
      {/* Progress bar */}
      {!cancelled ? (
        <View style={{ height: 8, borderRadius: radius.full, backgroundColor: colors.cardMuted, overflow: 'hidden', marginBottom: 16 }}>
          <Animated.View
            style={{
              height: '100%',
              borderRadius: radius.full,
              backgroundColor: colors.primary,
              width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }}
          />
        </View>
      ) : null}

      {steps.map((step, i) => {
        const done = !cancelled && i <= current;
        const active = !cancelled && i === current;
        const Icon = step.Icon;
        const last = i === steps.length - 1;
        return (
          <View key={step.key} style={{ flexDirection: 'row', gap: 12 }}>
            {/* Rail */}
            <View style={{ alignItems: 'center', width: 36 }}>
              <Animated.View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: done ? colors.primary : colors.cardMuted,
                  borderWidth: 2,
                  borderColor: done ? colors.primary : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: active && !last ? [{ scale: pulse }] : undefined,
                }}
              >
                {done && !active ? (
                  <Check size={18} color="#fff" strokeWidth={3} />
                ) : (
                  <Icon size={18} color={done ? '#fff' : colors.textSubtle} />
                )}
              </Animated.View>
              {!last ? (
                <View style={{ width: 3, flex: 1, minHeight: 26, backgroundColor: i < current && !cancelled ? colors.primary : colors.border }} />
              ) : null}
            </View>
            {/* Label */}
            <View style={{ flex: 1, paddingBottom: last ? 0 : 18, paddingTop: 4 }}>
              <Text style={{ color: done ? colors.text : colors.textMuted, fontWeight: active ? font.black : font.bold, fontSize: fontSize.base }}>
                {step.label}
              </Text>
              <Text style={{ color: colors.textSubtle, fontSize: fontSize.sm, marginTop: 1 }}>{step.hint}</Text>
            </View>
          </View>
        );
      })}
      {cancelled ? (
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
          <View style={{ width: 36, alignItems: 'center' }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.danger, fontWeight: font.black }}>✕</Text>
            </View>
          </View>
          <View style={{ flex: 1, paddingTop: 6 }}>
            <Text style={{ color: colors.danger, fontWeight: font.black, fontSize: fontSize.base }}>Pedido cancelado</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
