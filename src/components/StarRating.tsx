import React from 'react';
import { View, Pressable } from 'react-native';
import { Star } from 'lucide-react-native';
import { palette } from '../lib/theme';

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
  color?: string;
}

export function StarRating({ value, onChange, size = 36, readOnly = false, color = palette.yellow }: StarRatingProps) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= value;
        const star = (
          <Star
            size={size}
            color={filled ? color : palette.slate300}
            fill={filled ? color : 'transparent'}
            strokeWidth={2}
          />
        );
        if (readOnly) return <View key={i}>{star}</View>;
        return (
          <Pressable key={i} onPress={() => onChange?.(i)} hitSlop={6}>
            {star}
          </Pressable>
        );
      })}
    </View>
  );
}
