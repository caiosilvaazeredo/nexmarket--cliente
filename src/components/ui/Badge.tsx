import React from 'react';
import { View, Text } from 'react-native';
import { radius, font, fontSize, palette } from '../../lib/theme';
import type { Order } from '../../lib/types';

interface BadgeProps {
  label: string;
  fg: string;
  bg: string;
  icon?: React.ReactNode;
}

export function Badge({ label, fg, bg, icon }: BadgeProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: bg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radius.full,
        gap: 4,
      }}
    >
      {icon}
      <Text
        style={{
          color: fg,
          fontWeight: font.bold,
          fontSize: fontSize.xs,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Customer-facing status label derived from the combined store status +
 * delivery sub-status (RF20). Mirrors the iFood/Uber Eats progress language.
 */
export function customerStatus(order: Order): { label: string; fg: string; bg: string } {
  if (order.status === 'cancelled') return { label: 'Cancelado', fg: '#991B1B', bg: palette.redSoft };
  if (order.status === 'delivered' || order.deliveryStatus === 'delivered')
    return { label: 'Entregue', fg: '#166534', bg: palette.greenSoft };

  if (order.deliveryStatus) {
    switch (order.deliveryStatus) {
      case 'going_to_store':
      case 'arrived_store':
        return { label: 'Entregador na loja', fg: '#3730A3', bg: palette.indigoSoft };
      case 'picked_up':
      case 'going_to_customer':
        return { label: 'A caminho', fg: '#3730A3', bg: palette.indigoSoft };
      case 'problem':
        return { label: 'Atenção', fg: '#991B1B', bg: palette.redSoft };
    }
  }

  switch (order.status) {
    case 'pending':
      return { label: 'Aguardando', fg: '#92400E', bg: palette.amberSoft };
    case 'picking':
      return { label: 'Em separação', fg: '#1E40AF', bg: palette.blueSoft };
    case 'waiting_substitution':
      return { label: 'Revisar itens', fg: '#92400E', bg: palette.amberSoft };
    case 'ready':
      return { label: 'Pronto', fg: '#166534', bg: palette.greenSoft };
    default:
      return { label: order.status, fg: palette.slate600, bg: palette.slate100 };
  }
}
