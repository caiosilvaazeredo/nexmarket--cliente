import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { radius, spacing, shadow } from '../../lib/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
}

export function Card({ children, style, padded = true, elevated = false }: CardProps) {
  const { colors } = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius['2xl'],
          borderWidth: 2,
          borderColor: colors.border,
          padding: padded ? spacing.lg : 0,
        },
        elevated && shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}
