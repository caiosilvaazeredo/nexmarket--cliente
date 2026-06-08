import React from 'react';
import { View, Text } from 'react-native';
import { useColors } from '../hooks/useColors';
import { font, fontSize, spacing } from '../lib/theme';
import { Button } from './ui/Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Centered empty/placeholder state used across lists and screens. */
export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useColors();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing['3xl'], paddingHorizontal: spacing.xl }}>
      {icon}
      <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg, textAlign: 'center' }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.textMuted, textAlign: 'center' }}>{subtitle}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} fullWidth={false} onPress={onAction} style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}
