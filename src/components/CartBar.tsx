import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { ShoppingCart } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../hooks/useColors';
import { radius, font, fontSize, shadow } from '../lib/theme';
import { brl } from '../lib/format';
import { useStore, selectCartCount, selectCartSubtotal } from '../store/useStore';

/**
 * Floating cart bar shown above the tab bar whenever there are items (RF11).
 * Hidden on the cart/checkout screens themselves.
 */
export function CartBar() {
  const { colors } = useColors();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const count = useStore(selectCartCount);
  const subtotal = useStore(selectCartSubtotal);

  const hidden =
    count === 0 ||
    pathname?.startsWith('/cart') ||
    pathname?.startsWith('/checkout') ||
    pathname?.startsWith('/order');
  if (hidden) return null;

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 64 + Math.max(insets.bottom, 6), paddingHorizontal: 16 }}>
      <Pressable
        onPress={() => router.push('/cart')}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.primary,
            borderRadius: radius.lg,
            borderBottomWidth: 4,
            borderColor: colors.primaryDark,
            paddingVertical: 12,
            paddingHorizontal: 16,
            gap: 12,
          },
          shadow.raised,
        ]}
      >
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <ShoppingCart size={20} color="#FFFFFF" strokeWidth={2.5} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: font.black, fontSize: fontSize.base }}>Ver carrinho</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: font.semibold, fontSize: fontSize.xs }}>
            {count} {count === 1 ? 'item' : 'itens'}
          </Text>
        </View>
        <Text style={{ color: '#FFFFFF', fontWeight: font.black, fontSize: fontSize.lg }}>{brl(subtotal)}</Text>
      </Pressable>
    </View>
  );
}
