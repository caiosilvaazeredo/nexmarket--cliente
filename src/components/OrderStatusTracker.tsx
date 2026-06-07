import React from 'react';
import { View, Text } from 'react-native';
import { Check, Clock, Package, ShoppingBag, Bike, Home } from 'lucide-react-native';
import { useColors } from '../hooks/useColors';
import { font, fontSize } from '../lib/theme';
import type { Order } from '../lib/types';

/** Maps an order to a 0-based step index along the journey (RF20). */
function currentStep(order: Order): number {
  if (order.status === 'delivered' || order.deliveryStatus === 'delivered') return 4;
  if (order.deliveryStatus === 'going_to_customer' || order.deliveryStatus === 'picked_up') return 3;
  if (order.status === 'ready' || order.deliveryStatus === 'going_to_store' || order.deliveryStatus === 'arrived_store') return 2;
  if (order.status === 'picking' || order.status === 'waiting_substitution') return 1;
  return 0;
}

export function OrderStatusTracker({ order }: { order: Order }) {
  const { colors } = useColors();
  const pickup = order.deliveryMethod === 'pickup';
  const step = currentStep(order);

  const steps = [
    { label: 'Pedido confirmado', icon: Clock },
    { label: 'Em separação', icon: Package },
    { label: pickup ? 'Pronto para retirada' : 'Pronto / enviado', icon: ShoppingBag },
    { label: pickup ? 'Retire na loja' : 'A caminho de você', icon: pickup ? Home : Bike },
    { label: pickup ? 'Retirado' : 'Entregue', icon: Home },
  ];

  return (
    <View style={{ gap: 0 }}>
      {steps.map((s, i) => {
        const done = i < step;
        const active = i === step;
        const Icon = s.icon;
        const reached = done || active;
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center' }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: reached ? colors.primary : colors.cardMuted,
                  borderWidth: 2,
                  borderColor: reached ? colors.primaryDark : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {done ? (
                  <Check size={18} color="#FFFFFF" strokeWidth={3} />
                ) : (
                  <Icon size={18} color={active ? '#FFFFFF' : colors.textSubtle} strokeWidth={2.5} />
                )}
              </View>
              {i < steps.length - 1 && (
                <View style={{ width: 3, flex: 1, minHeight: 28, backgroundColor: done ? colors.primary : colors.border, marginVertical: 2, borderRadius: 2 }} />
              )}
            </View>
            <View style={{ paddingBottom: 18, flex: 1, paddingTop: 6 }}>
              <Text
                style={{
                  color: reached ? colors.text : colors.textSubtle,
                  fontWeight: active ? font.black : font.semibold,
                  fontSize: fontSize.base,
                }}
              >
                {s.label}
              </Text>
              {active && (
                <Text style={{ color: colors.primaryDark, fontWeight: font.bold, fontSize: fontSize.xs, marginTop: 2 }}>
                  Em andamento
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
