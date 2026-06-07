import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, ShoppingBasket } from 'lucide-react-native';

import { Screen } from '../src/components/ui/Screen';
import { Button } from '../src/components/ui/Button';
import { useColors } from '../src/hooks/useColors';
import { font, fontSize, radius, spacing, shadow } from '../src/lib/theme';
import { useStore } from '../src/store/useStore';
import { addressFromCurrentLocation } from '../src/lib/cep';

/**
 * Optional first-run welcome. Guest browsing is automatic, so this is reachable
 * but never forced — it simply offers to set a delivery location up front
 * (RF04, falls back to manual CEP if location is denied).
 */
export default function Onboarding() {
  const { colors } = useColors();
  const router = useRouter();
  const branding = useStore((s) => s.branding);
  const [loading, setLoading] = useState(false);

  const useLocation = async () => {
    setLoading(true);
    const res = await addressFromCurrentLocation();
    setLoading(false);
    if (res) router.replace('/address/edit');
    else router.replace('/(tabs)');
  };

  return (
    <Screen scroll={false} contentStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.lg }}>
      <View style={[{ width: 96, height: 96, borderRadius: radius['2xl'], backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '12deg' }] }, shadow.raised]}>
        <ShoppingBasket color="#FFFFFF" size={48} strokeWidth={2.5} style={{ transform: [{ rotate: '-12deg' }] }} />
      </View>
      <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize['3xl'], textAlign: 'center' }}>{branding?.appName || 'Nexmarket'}</Text>
      <Text style={{ color: colors.textMuted, fontWeight: font.medium, textAlign: 'center', fontSize: fontSize.base }}>
        Seu mercado favorito na palma da mão. Para começar, onde você quer receber suas compras?
      </Text>
      <View style={{ width: '100%', gap: spacing.sm, marginTop: spacing.md }}>
        <Button label="Usar minha localização" size="lg" loading={loading} icon={<MapPin size={20} color="#FFFFFF" />} onPress={useLocation} />
        <Button label="Informar CEP manualmente" variant="secondary" onPress={() => router.replace('/address/edit')} />
        <Button label="Só quero explorar" variant="ghost" textStyle={{ color: colors.textMuted }} onPress={() => router.replace('/(tabs)')} />
      </View>
    </Screen>
  );
}
