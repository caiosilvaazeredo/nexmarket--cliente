import React, { useState } from 'react';
import { View, Text, Pressable, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, Navigation, Store, ChevronRight, Search, ShoppingBasket } from 'lucide-react-native';

import { Screen } from '../src/components/ui/Screen';
import { Input } from '../src/components/ui/Input';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { useColors } from '../src/hooks/useColors';
import { font, fontSize, radius, spacing, shadow } from '../src/lib/theme';
import { useAppStore } from '../src/store/useAppStore';
import { getCurrentPosition, reverseGeocode } from '../src/lib/location';
import { fuzzyMatch } from '../src/lib/search';

export default function StorePicker() {
  const { colors } = useColors();
  const router = useRouter();
  const supermarkets = useAppStore((s) => s.supermarkets);
  const setCurrentSmId = useAppStore((s) => s.setCurrentSmId);
  const [search, setSearch] = useState('');
  const [locating, setLocating] = useState(false);
  const [cityHint, setCityHint] = useState<string | null>(null);

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      if (!pos) {
        setCityHint(null);
        return;
      }
      const addr = await reverseGeocode(pos.lat, pos.lng);
      if (addr?.city) {
        setCityHint(addr.city);
        setSearch(addr.city);
      }
    } finally {
      setLocating(false);
    }
  };

  const filtered = search
    ? supermarkets.filter((s) => fuzzyMatch(search, s.name))
    : supermarkets;

  const choose = (id: string) => {
    setCurrentSmId(id);
    router.replace('/(tabs)');
  };

  return (
    <Screen scroll title="Escolha sua loja" subtitle="Onde você quer comprar hoje?">
      <Card elevated style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <MapPin size={20} color={colors.primary} />
          </View>
          <Text style={{ flex: 1, color: colors.text, fontWeight: font.bold }}>
            Encontre lojas que entregam na sua região
          </Text>
        </View>
        <Input
          placeholder="Buscar por nome ou cidade"
          value={search}
          onChangeText={setSearch}
          icon={<Search size={20} color={colors.textSubtle} />}
        />
        <Button
          label={locating ? 'Localizando…' : 'Usar minha localização'}
          variant="secondary"
          loading={locating}
          icon={<Navigation size={18} color={colors.primary} />}
          onPress={useMyLocation}
        />
        {cityHint ? (
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            Mostrando lojas próximas de {cityHint}.
          </Text>
        ) : null}
      </Card>

      {supermarkets.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing['3xl'], gap: 12 }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.textMuted, fontWeight: font.medium }}>Carregando lojas…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: 8, paddingVertical: spacing['2xl'] }}>
          <Store size={40} color={colors.textSubtle} />
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg, textAlign: 'center' }}>
            Nenhuma loja por aqui ainda
          </Text>
          <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
            Ainda não encontramos lojas para "{search}". Tente outra cidade ou veja todas as lojas disponíveis.
          </Text>
          <Button label="Ver todas as lojas" variant="secondary" onPress={() => setSearch('')} style={{ marginTop: 8 }} />
        </Card>
      ) : (
        filtered.map((sm) => (
          <Pressable
            key={sm.id}
            onPress={() => choose(sm.id)}
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                backgroundColor: colors.card,
                borderRadius: radius['2xl'],
                borderWidth: 2,
                borderColor: colors.border,
                padding: spacing.md,
              },
              shadow.card,
            ]}
          >
            <View style={{ width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.cardMuted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {sm.logoUrl ? (
                <Image source={{ uri: sm.logoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              ) : (
                <ShoppingBasket size={26} color={colors.primary} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.base }}>{sm.name}</Text>
              <View
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 4,
                  backgroundColor: colors.primarySoft,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: radius.full,
                }}
              >
                <Text style={{ color: colors.primaryDark, fontWeight: font.bold, fontSize: 11 }}>Aberta • entrega disponível</Text>
              </View>
            </View>
            <ChevronRight size={22} color={colors.textSubtle} />
          </Pressable>
        ))
      )}
    </Screen>
  );
}
