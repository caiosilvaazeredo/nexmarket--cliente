import React, { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Home, Briefcase, MapPin, Navigation, Search } from 'lucide-react-native';

import { Screen } from '../../src/components/ui/Screen';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing } from '../../src/lib/theme';
import { useStore } from '../../src/store/useStore';
import { saveAddress } from '../../src/lib/customers';
import { lookupCep, maskCep, isValidCep, addressFromCurrentLocation, geocodeAddress } from '../../src/lib/cep';
import type { AddressLabel } from '../../src/lib/types';

const TYPES: { label: AddressLabel; name: string; icon: any }[] = [
  { label: 'home', name: 'Casa', icon: Home },
  { label: 'work', name: 'Trabalho', icon: Briefcase },
  { label: 'other', name: 'Outro', icon: MapPin },
];

export default function AddressEdit() {
  const { colors } = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const customer = useStore((s) => s.customer);
  const existing = useStore((s) => s.addresses.find((a) => a.id === id));

  const [label, setLabel] = useState<AddressLabel>(existing?.label || 'home');
  const [form, setForm] = useState({
    cep: existing?.cep || '',
    street: existing?.street || '',
    number: existing?.number || '',
    complement: existing?.complement || '',
    neighborhood: existing?.neighborhood || '',
    city: existing?.city || '',
    state: existing?.state || '',
    reference: existing?.reference || '',
    lat: existing?.lat,
    lng: existing?.lng,
  });
  const [cepLoading, setCepLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const onCepChange = async (raw: string) => {
    const masked = maskCep(raw);
    set({ cep: masked });
    if (isValidCep(masked)) {
      setCepLoading(true);
      const res = await lookupCep(masked);
      setCepLoading(false);
      if (res) {
        set({ street: res.street || '', neighborhood: res.neighborhood || '', city: res.city || '', state: res.state || '' });
      } else {
        Alert.alert('CEP não encontrado', 'Confira o CEP ou preencha manualmente.');
      }
    }
  };

  const useGps = async () => {
    setGpsLoading(true);
    const res = await addressFromCurrentLocation();
    setGpsLoading(false);
    if (res) {
      set({ cep: res.cep || form.cep, street: res.street || '', number: res.number || '', neighborhood: res.neighborhood || '', city: res.city || '', state: res.state || '', lat: res.lat, lng: res.lng });
    } else {
      Alert.alert('Localização indisponível', 'Permita o acesso à localização ou informe o CEP.');
    }
  };

  const save = async () => {
    if (!customer) return;
    if (!form.street.trim() || !form.number.trim()) {
      Alert.alert('Endereço incompleto', 'Informe ao menos rua e número.');
      return;
    }
    setSaving(true);
    try {
      // Geocode for delivery routing if we don't have coordinates yet.
      let { lat, lng } = form;
      if (lat === undefined || lng === undefined) {
        const geo = await geocodeAddress([form.street, form.number, form.neighborhood, form.city, form.state].filter(Boolean).join(', '));
        if (geo) { lat = geo.lat; lng = geo.lng; }
      }
      const addressId = await saveAddress(customer.uid, {
        ...(existing?.id ? { id: existing.id } : {}),
        label,
        ...form,
        lat,
        lng,
      } as any);
      useStore.getState().setSelectedAddress(addressId);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title={existing ? 'Editar endereço' : 'Novo endereço'} subtitle="Auto-completar por CEP ou GPS">
      {/* Type */}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {TYPES.map((t) => {
          const active = label === t.label;
          const Icon = t.icon;
          return (
            <Pressable key={t.label} onPress={() => setLabel(t.label)} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, borderWidth: 2, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.card }}>
              <Icon size={20} color={active ? colors.primaryDark : colors.textMuted} />
              <Text style={{ color: active ? colors.primaryDark : colors.textMuted, fontWeight: font.bold, fontSize: fontSize.xs, marginTop: 4 }}>{t.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <Button label="Usar minha localização (GPS)" variant="secondary" loading={gpsLoading} icon={<Navigation size={18} color={colors.primary} />} textStyle={{ color: colors.primary }} onPress={useGps} />

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Input containerStyle={{ flex: 1 }} label="CEP" placeholder="00000-000" keyboardType="number-pad" value={form.cep} onChangeText={onCepChange} icon={<Search size={20} color={colors.textSubtle} />} />
        {cepLoading ? <Text style={{ color: colors.textMuted, alignSelf: 'flex-end', paddingBottom: 16 }}>buscando…</Text> : null}
      </View>

      <Input label="Rua / Logradouro" value={form.street} onChangeText={(v) => set({ street: v })} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Input containerStyle={{ width: 110 }} label="Número" keyboardType="number-pad" value={form.number} onChangeText={(v) => set({ number: v })} />
        <Input containerStyle={{ flex: 1 }} label="Complemento" placeholder="Apto, bloco…" value={form.complement} onChangeText={(v) => set({ complement: v })} />
      </View>
      <Input label="Bairro" value={form.neighborhood} onChangeText={(v) => set({ neighborhood: v })} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Input containerStyle={{ flex: 1 }} label="Cidade" value={form.city} onChangeText={(v) => set({ city: v })} />
        <Input containerStyle={{ width: 90 }} label="UF" autoCapitalize="characters" maxLength={2} value={form.state} onChangeText={(v) => set({ state: v })} />
      </View>
      <Input label="Ponto de referência" placeholder="Próximo a…" value={form.reference} onChangeText={(v) => set({ reference: v })} />

      <Button label="Salvar endereço" size="lg" loading={saving} onPress={save} style={{ marginTop: spacing.sm }} />
      <View style={{ height: 20 }} />
    </Screen>
  );
}
