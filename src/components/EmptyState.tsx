import React from 'react';
import { View, Text } from 'react-native';
import { useColors } from '../hooks/useColors';
import { font, fontSize, spacing, radius } from '../lib/theme';

interface Props {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, subtitle, action }: Props) {
  const { colors } = useColors();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['3xl'], gap: spacing.md }}>
      <View
        style={{
          width: 84,
          height: 84,
          borderRadius: radius['2xl'],
          backgroundColor: colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl, textAlign: 'center' }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: colors.textMuted, fontWeight: font.medium, textAlign: 'center', paddingHorizontal: spacing.xl }}>
          {subtitle}
        </Text>
      ) : null}
      {action}
    </View>
  );
}
