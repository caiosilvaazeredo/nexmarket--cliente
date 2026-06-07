import React from 'react';
import { View, Pressable } from 'react-native';
import { Star } from 'lucide-react-native';
import { palette } from '../lib/theme';

interface Props {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  color?: string;
}

/** Tappable 1–5 star control (RF23). Read-only when onChange is omitted. */
export function RatingStars({ value, onChange, size = 32, color = palette.amber }: Props) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const StarEl = (
          <Star
            size={size}
            color={filled ? color : palette.slate300}
            fill={filled ? color : 'transparent'}
            strokeWidth={2}
          />
        );
        return onChange ? (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
            {StarEl}
          </Pressable>
        ) : (
          <View key={n}>{StarEl}</View>
        );
      })}
    </View>
  );
}
