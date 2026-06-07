import React from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Minus, Plus, Trash2 } from 'lucide-react-native';
import { useColors } from '../hooks/useColors';
import { radius, font, fontSize } from '../lib/theme';

interface Props {
  value: number;
  onInc: () => void;
  onDec: () => void;
  size?: 'sm' | 'md' | 'lg';
  max?: number;
}

/** Accessible +/− stepper with haptics; turns − into a trash icon at qty 1. */
export function QuantityStepper({ value, onInc, onDec, size = 'md', max }: Props) {
  const { colors } = useColors();
  const dim = size === 'lg' ? 44 : size === 'sm' ? 30 : 36;
  const atMax = max !== undefined && value >= max;

  const press = (fn: () => void, blocked?: boolean) => {
    Haptics.impactAsync(
      blocked ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {});
    if (!blocked) fn();
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primarySoft,
        borderRadius: radius.full,
        padding: 3,
        gap: 4,
      }}
    >
      <Pressable
        onPress={() => press(onDec)}
        style={{ width: dim, height: dim, borderRadius: dim / 2, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}
      >
        {value <= 1 ? (
          <Trash2 size={size === 'lg' ? 20 : 16} color={colors.danger} strokeWidth={2.5} />
        ) : (
          <Minus size={size === 'lg' ? 22 : 18} color={colors.primaryDark} strokeWidth={3} />
        )}
      </Pressable>
      <Text
        style={{
          minWidth: dim - 6,
          textAlign: 'center',
          color: colors.primaryDark,
          fontWeight: font.black,
          fontSize: size === 'lg' ? fontSize.lg : fontSize.base,
        }}
      >
        {value}
      </Text>
      <Pressable
        onPress={() => press(onInc, atMax)}
        style={{
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: atMax ? colors.cardMuted : colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: atMax ? 0.6 : 1,
        }}
      >
        <Plus size={size === 'lg' ? 22 : 18} color={atMax ? colors.textSubtle : '#FFFFFF'} strokeWidth={3} />
      </Pressable>
    </View>
  );
}
