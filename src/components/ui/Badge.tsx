import React from 'react';
import { View, Text } from 'react-native';
import { radius, font, fontSize, palette } from '../../lib/theme';
import type { Order, OrderStatus, DeliveryStatus } from '../../lib/types';

interface BadgeProps {
  label: string;
  fg: string;
  bg: string;
  icon?: React.ReactNode;
  small?: boolean;
}

export function Badge({ label, fg, bg, icon, small }: BadgeProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: bg,
        paddingHorizontal: small ? 8 : 10,
        paddingVertical: small ? 3 : 4,
        borderRadius: radius.full,
        gap: 4,
      }}
    >
      {icon}
      <Text
        style={{
          color: fg,
          fontWeight: font.bold,
          fontSize: small ? 10 : fontSize.xs,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Customer-facing label for the overall order progress (RF20). */
export function orderStatusLabel(order: Order): { label: string; fg: string; bg: string } {
  // Delivery sub-status takes precedence once a driver is involved.
  const ds = order.deliveryStatus;
  if (ds && order.deliveryMethod === 'delivery') {
    const map: Partial<Record<DeliveryStatus, { label: string; fg: string; bg: string }>> = {
      awaiting_driver: { label: 'Pronto • buscando entregador', fg: '#92400E', bg: palette.amberSoft },
      going_to_store: { label: 'Entregador a caminho da loja', fg: '#1E40AF', bg: palette.blueSoft },
      arrived_store: { label: 'Entregador na loja', fg: '#1E40AF', bg: palette.blueSoft },
      picked_up: { label: 'Coletado', fg: '#3730A3', bg: palette.indigoSoft },
      going_to_customer: { label: 'A caminho de você', fg: '#3730A3', bg: palette.indigoSoft },
      delivered: { label: 'Entregue', fg: '#166534', bg: palette.greenSoft },
      problem: { label: 'Problema na entrega', fg: '#991B1B', bg: palette.redSoft },
    };
    if (map[ds]) return map[ds]!;
  }
  const map: Record<OrderStatus, { label: string; fg: string; bg: string }> = {
    pending: { label: 'Aguardando', fg: '#92400E', bg: palette.amberSoft },
    picking: { label: 'Em separação', fg: '#1E40AF', bg: palette.blueSoft },
    waiting_substitution: { label: 'Substituição', fg: '#92400E', bg: palette.amberSoft },
    ready: { label: order.deliveryMethod === 'pickup' ? 'Pronto p/ retirada' : 'Pronto / enviado', fg: '#166534', bg: palette.greenSoft },
    delivered: { label: 'Entregue', fg: '#166534', bg: palette.greenSoft },
    cancelled: { label: 'Cancelado', fg: '#991B1B', bg: palette.redSoft },
  };
  return map[order.status] || { label: order.status, fg: palette.slate600, bg: palette.slate100 };
}
