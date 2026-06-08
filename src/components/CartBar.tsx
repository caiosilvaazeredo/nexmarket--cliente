import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ShoppingCart } from 'lucide-react-native';
import { useColors } from '../hooks/useColors';
import { radius, font, fontSize, spacing, shadow } from '../lib/theme';
import { brl } from '../lib/format';
import { useCartStore } from '../store/useCartStore';
import { useAppStore } from '../store/useAppStore';
import { lineTotal } from '../lib/promotions';

/** Floating "Ver carrinho" footer with the live subtotal (RF11, RNF02). */
export function CartBar({ bottomOffset = 0 }: { bottomOffset?: number }) {
  const { colors } = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lines = useCartStore((s) => s.lines);
  const promotions = useAppStore((s) => s.promotions);

  if (lines.length === 0) return null;

  const count = lines.reduce((a, l) => a + l.quantity, 0);
  const subtotal = lines.reduce((acc, l) => acc + lineTotal(l.product, l.quantity, promotions), 0);

  return (
    <View
      style={{
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        bottom: bottomOffset + Math.max(insets.bottom, spacing.md),
      }}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={() => router.push('/cart')}
        style={[
          {
            backgroundColor: colors.primary,
            borderRadius: radius.lg,
            borderBottomWidth: 4,
            borderBottomColor: colors.primaryDark,
            paddingVertical: 14,
            paddingHorizontal: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
          shadow.raised,
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.25)',
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: font.black, fontSize: fontSize.sm }}>{count}</Text>
          </View>
          <ShoppingCart size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: font.black, fontSize: fontSize.base }}>Ver carrinho</Text>
        </View>
        <Text style={{ color: '#fff', fontWeight: font.black, fontSize: fontSize.base }}>{brl(subtotal)}</Text>
      </Pressable>
    </View>
  );
}
