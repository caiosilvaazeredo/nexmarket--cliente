import React from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Home, Briefcase, MapPin, Plus, Check, Trash2, Star } from 'lucide-react-native';

import { Screen } from '../../src/components/ui/Screen';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, spacing, radius } from '../../src/lib/theme';
import { useStore, selectSelectedAddress } from '../../src/store/useStore';
import { setDefaultAddress, deleteAddress } from '../../src/lib/customers';
import type { Address, AddressLabel } from '../../src/lib/types';

const ICONS: Record<AddressLabel, any> = { home: Home, work: Briefcase, other: MapPin };
const LABELS: Record<AddressLabel, string> = { home: 'Casa', work: 'Trabalho', other: 'Outro' };

export default function AddressList() {
  const { colors } = useColors();
  const router = useRouter();
  const addresses = useStore((s) => s.addresses);
  const customer = useStore((s) => s.customer);
  const selected = useStore(selectSelectedAddress);
  const setSelected = useStore((s) => s.setSelectedAddress);
  const isGuest = useStore((s) => s.authUser?.isAnonymous);

  const select = (a: Address) => {
    setSelected(a.id);
    if (customer) setDefaultAddress(customer.uid, a.id).catch(() => {});
    router.back();
  };

  if (isGuest) {
    return (
      <Screen title="Endereços">
        <EmptyState icon={<MapPin size={40} color={colors.primary} />} title="Entre para salvar endereços" subtitle="Crie uma conta para manter seus endereços de entrega." action={<Button label="Entrar" onPress={() => router.push('/(auth)/login')} style={{ marginTop: spacing.md }} />} />
      </Screen>
    );
  }

  return (
    <Screen title="Meus endereços" subtitle="Casa, trabalho e outros">
      {addresses.length === 0 ? (
        <EmptyState icon={<MapPin size={40} color={colors.primary} />} title="Nenhum endereço salvo" subtitle="Adicione um endereço para receber suas compras." />
      ) : (
        addresses.map((a) => {
          const Icon = ICONS[a.label] || MapPin;
          const isSel = selected?.id === a.id;
          return (
            <Card key={a.id} style={{ gap: spacing.sm, borderColor: isSel ? colors.primary : colors.border }}>
              <Pressable onPress={() => select(a)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={22} color={colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: colors.text, fontWeight: font.black }}>{a.title || LABELS[a.label]}</Text>
                    {a.isDefault && <Star size={13} color={colors.amber} fill={colors.amber} />}
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }} numberOfLines={1}>
                    {[a.street, a.number].filter(Boolean).join(', ')} • {[a.neighborhood, a.city].filter(Boolean).join(' - ')}
                  </Text>
                </View>
                {isSel && <Check size={22} color={colors.primary} strokeWidth={3} />}
              </Pressable>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button label="Editar" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => router.push(`/address/edit?id=${a.id}`)} />
                <Button
                  label="Excluir"
                  variant="secondary"
                  size="sm"
                  textStyle={{ color: colors.danger }}
                  icon={<Trash2 size={15} color={colors.danger} />}
                  style={{ flex: 1 }}
                  onPress={() => Alert.alert('Excluir endereço', 'Remover este endereço?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => customer && deleteAddress(customer.uid, a.id) }])}
                />
              </View>
            </Card>
          );
        })
      )}
      <Button label="Adicionar endereço" icon={<Plus size={18} color="#FFFFFF" />} onPress={() => router.push('/address/edit')} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}
