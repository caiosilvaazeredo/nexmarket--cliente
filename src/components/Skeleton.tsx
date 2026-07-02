import React, { useEffect, useRef } from 'react';
import { Animated, View, type ViewStyle } from 'react-native';
import { useColors } from '../hooks/useColors';
import { radius as r, spacing } from '../lib/theme';

/**
 * Skeleton loaders (pulso suave) — substituem spinners nas listas para o
 * layout "chegar antes" do conteúdo (UX estilo iFood).
 */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: { width?: number | string; height?: number; radius?: number; style?: ViewStyle }) {
  const { colors } = useColors();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius: radius, backgroundColor: colors.cardMuted, opacity }, style]}
    />
  );
}

/** Skeleton com o formato do ProductCard. */
export function ProductCardSkeleton({ width = 150 }: { width?: number }) {
  const { colors } = useColors();
  return (
    <View style={{ width, backgroundColor: colors.card, borderRadius: r['2xl'], borderWidth: 2, borderColor: colors.border, padding: spacing.md, gap: 8 }}>
      <Skeleton height={110} radius={r.lg} />
      <Skeleton height={14} width="90%" />
      <Skeleton height={14} width="60%" />
      <Skeleton height={20} width="45%" />
      <Skeleton height={44} radius={r.md} />
    </View>
  );
}

/** Trilho horizontal de skeletons (home enquanto o catálogo carrega). */
export function RailSkeleton() {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Skeleton height={22} width={180} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg }}>
        <ProductCardSkeleton />
        <ProductCardSkeleton />
        <ProductCardSkeleton />
      </View>
    </View>
  );
}
