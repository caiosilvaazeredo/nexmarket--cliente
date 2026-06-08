import React from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, MapPin, Home, Briefcase, MapPinned, Plus, Check, Trash2, LogIn } from 'lucide-react-native';

import { Screen } from '../src/components/ui/Screen';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { useColors } from '../src/hooks/useColors';
import { font, fontSize, radius, spacing } from '../src/lib/theme';
import { fullAddress } from '../src/lib/format';
import { useAppStore } from '../src/store/useAppStore';
import { setDefaultAddress, removeAddress } from '../src/lib/customers';
import type { SavedAddress } from '../src/lib/types';

export default function Addresses() {
  const { colors } = useColors();
  const router = useRouter();
  const authUser = useAppStore((s) => s.authUser);
  const customer = useAppStore((s) => s.customer);

  if (!authUser || !customer) {
    return (
      <Screen
        title="Endereços"
        left={<Button variant="ghost" fullWidth={false} icon={<ArrowLeft size={24} color={colors.text} />} onPress={() => router.back()} />}
      >
        <Card style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing['2xl'] }}>
          <MapPin size={36} color={colors.primary} />
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg, textAlign: 'center' }}>Entre para salvar endereços</Text>
          <Button label="Entrar" icon={<LogIn size={18} color="#fff" />} onPress={() => router.push('/(auth)/login')} />
        </Card>
      </Screen>
    );
  }

  const icon = (a: SavedAddress) => {
    if (a.label === 'casa') return <Home size={20} color={colors.primary} />;
    if (a.label === 'trabalho') return <Briefcase size={20} color={colors.primary} />;
    return <MapPinned size={20} color={colors.primary} />;
  };

  return (
    <Screen
      title="Endereços"
      subtitle="Seus locais de entrega"
      left={<Button variant="ghost" fullWidth={false} icon={<ArrowLeft size={24} color={colors.text} />} onPress={() => router.back()} />}
    >
      {(customer.addresses || []).length === 0 ? (
        <Card style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing['2xl'] }}>
          <MapPin size={36} color={colors.textSubtle} />
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>Nenhum endereço salvo</Text>
          <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Adicione casa, trabalho e outros locais para agilizar a entrega.</Text>
        </Card>
      ) : (
        customer.addresses.map((a) => {
          const isDefault = customer.defaultAddressId === a.id;
          return (
            <Card key={a.id} style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>{icon(a)}</View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: colors.text, fontWeight: font.black, textTransform: 'capitalize' }}>{a.nickname || a.label}</Text>
                    {isDefault ? (
                      <View style={{ backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full }}>
                        <Text style={{ color: colors.primaryDark, fontWeight: font.black, fontSize: 10 }}>PADRÃO</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text numberOfLines={2} style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{fullAddress(a)}{a.complement ? ` • ${a.complement}` : ''}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {!isDefault ? (
                  <Button label="Tornar padrão" variant="secondary" size="sm" style={{ flex: 1 }} icon={<Check size={16} color={colors.text} />} onPress={() => setDefaultAddress(authUser.uid, a.id)} />
                ) : null}
                <Button label="Editar" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => router.push(`/address-edit?id=${a.id}`)} />
                <Button
                  label=""
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  icon={<Trash2 size={16} color={colors.danger} />}
                  onPress={() =>
                    Alert.alert('Remover endereço', 'Deseja remover este endereço?', [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Remover', style: 'destructive', onPress: () => removeAddress(authUser.uid, customer, a.id) },
                    ])
                  }
                />
              </View>
            </Card>
          );
        })
      )}

      <Button label="Adicionar novo endereço" icon={<Plus size={18} color="#fff" />} onPress={() => router.push('/address-edit')} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}
