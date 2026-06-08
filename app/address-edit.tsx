import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Home, Briefcase, MapPinned, Navigation, Search, Check } from 'lucide-react-native';

import { Input } from '../src/components/ui/Input';
import { Button } from '../src/components/ui/Button';
import { useColors } from '../src/hooks/useColors';
import { font, fontSize, radius, spacing } from '../src/lib/theme';
import { formatCep, onlyDigits } from '../src/lib/format';
import { useAppStore } from '../src/store/useAppStore';
import { saveAddress } from '../src/lib/customers';
import { lookupCep } from '../src/lib/cep';
import { getCurrentPosition, reverseGeocode } from '../src/lib/location';
import type { AddressLabel, SavedAddress } from '../src/lib/types';

export default function AddressEdit() {
  const { colors } = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const authUser = useAppStore((s) => s.authUser);
  const customer = useAppStore((s) => s.customer);

  const existing = customer?.addresses?.find((a) => a.id === params.id);

  const [label, setLabel] = useState<AddressLabel>(existing?.label || 'casa');
  const [nickname, setNickname] = useState(existing?.nickname || '');
  const [cep, setCep] = useState(existing?.cep ? formatCep(existing.cep) : '');
  const [street, setStreet] = useState(existing?.street || '');
  const [number, setNumber] = useState(existing?.number || '');
  const [complement, setComplement] = useState(existing?.complement || '');
  const [neighborhood, setNeighborhood] = useState(existing?.neighborhood || '');
  const [city, setCity] = useState(existing?.city || '');
  const [stateUf, setStateUf] = useState(existing?.state || '');
  const [reference, setReference] = useState(existing?.reference || '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    existing?.lat != null && existing?.lng != null ? { lat: existing.lat, lng: existing.lng } : null,
  );
  const [cepLoading, setCepLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const onCepBlur = async () => {
    if (onlyDigits(cep).length !== 8) return;
    setCepLoading(true);
    try {
      const res = await lookupCep(cep);
      if (res) {
        if (res.street) setStreet(res.street);
        if (res.neighborhood) setNeighborhood(res.neighborhood);
        if (res.city) setCity(res.city);
        if (res.state) setStateUf(res.state);
      } else {
        Alert.alert('CEP não encontrado', 'Confira o CEP ou preencha manualmente.');
      }
    } finally {
      setCepLoading(false);
    }
  };

  const useGps = async () => {
    setGpsLoading(true);
    try {
      const pos = await getCurrentPosition();
      if (!pos) {
        Alert.alert('Localização', 'Não foi possível obter sua localização. Verifique a permissão.');
        return;
      }
      setCoords(pos);
      const addr = await reverseGeocode(pos.lat, pos.lng);
      if (addr) {
        if (addr.street) setStreet(addr.street);
        if (addr.neighborhood) setNeighborhood(addr.neighborhood);
        if (addr.city) setCity(addr.city);
        if (addr.state) setStateUf(addr.state);
        if (addr.cep) setCep(formatCep(addr.cep));
      }
      Alert.alert('Localização capturada', 'Confira os campos e ajuste o número.');
    } finally {
      setGpsLoading(false);
    }
  };

  const save = async () => {
    if (!authUser || !customer) {
      router.replace('/(auth)/login');
      return;
    }
    if (!street.trim() || !number.trim()) {
      Alert.alert('Endereço incompleto', 'Informe ao menos rua e número.');
      return;
    }
    setSaving(true);
    try {
      const address: SavedAddress = {
        id: existing?.id || `addr_${Date.now()}`,
        label,
        nickname: nickname.trim() || undefined,
        cep: onlyDigits(cep) || undefined,
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim() || undefined,
        neighborhood: neighborhood.trim() || undefined,
        city: city.trim() || undefined,
        state: stateUf.trim() || undefined,
        reference: reference.trim() || undefined,
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      };
      await saveAddress(authUser.uid, customer, address);
      router.back();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o endereço.');
    } finally {
      setSaving(false);
    }
  };

  const LABELS: { key: AddressLabel; label: string; icon: any }[] = [
    { key: 'casa', label: 'Casa', icon: Home },
    { key: 'trabalho', label: 'Trabalho', icon: Briefcase },
    { key: 'outro', label: 'Outro', icon: MapPinned },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md }}>
        <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl }}>{existing ? 'Editar endereço' : 'Novo endereço'}</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}><X size={24} color={colors.textMuted} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        {/* Label */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {LABELS.map(({ key, label: l, icon: Icon }) => {
            const active = label === key;
            return (
              <Pressable key={key} onPress={() => setLabel(key)} style={{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: spacing.md, borderRadius: radius.lg, borderWidth: 2, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.card }}>
                <Icon size={22} color={active ? colors.primary : colors.textMuted} />
                <Text style={{ color: active ? colors.primary : colors.textMuted, fontWeight: font.bold, fontSize: fontSize.sm }}>{l}</Text>
              </Pressable>
            );
          })}
        </View>

        <Button label={gpsLoading ? 'Localizando…' : 'Usar minha localização (GPS)'} variant="secondary" loading={gpsLoading} icon={<Navigation size={18} color={colors.primary} />} onPress={useGps} />

        <Input
          label="CEP"
          placeholder="00000-000"
          keyboardType="number-pad"
          value={cep}
          onChangeText={(t) => setCep(formatCep(t))}
          onBlur={onCepBlur}
          right={cepLoading ? <Text style={{ color: colors.textSubtle, fontSize: 11 }}>buscando…</Text> : <Pressable onPress={onCepBlur}><Search size={18} color={colors.primary} /></Pressable>}
        />

        <Input label="Rua / Avenida" placeholder="Ex: Av. Brasil" value={street} onChangeText={setStreet} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}><Input label="Número" placeholder="123" keyboardType="number-pad" value={number} onChangeText={setNumber} /></View>
          <View style={{ flex: 2 }}><Input label="Complemento" placeholder="Apto / bloco" value={complement} onChangeText={setComplement} /></View>
        </View>
        <Input label="Bairro" placeholder="Bairro" value={neighborhood} onChangeText={setNeighborhood} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 2 }}><Input label="Cidade" placeholder="Cidade" value={city} onChangeText={setCity} /></View>
          <View style={{ flex: 1 }}><Input label="UF" placeholder="SP" autoCapitalize="characters" maxLength={2} value={stateUf} onChangeText={setStateUf} /></View>
        </View>
        <Input label="Ponto de referência" placeholder="Ex: portão azul, ao lado da padaria" value={reference} onChangeText={setReference} />
        <Input label="Apelido (opcional)" placeholder="Ex: Casa da praia" value={nickname} onChangeText={setNickname} />

        {coords ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Check size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: font.bold, fontSize: fontSize.xs }}>Localização precisa salva para o entregador</Text>
          </View>
        ) : null}

        <Button label="Salvar endereço" size="lg" loading={saving} onPress={save} style={{ marginTop: spacing.sm }} />
      </ScrollView>
    </SafeAreaView>
  );
}
