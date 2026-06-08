import React, { useState } from 'react';
import { View, Text, Pressable, Switch, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import {
  MapPin,
  Heart,
  Store,
  Bell,
  Moon,
  HelpCircle,
  Shield,
  LogOut,
  LogIn,
  ChevronRight,
  Trash2,
  User as UserIcon,
  FileText,
} from 'lucide-react-native';

import { Screen } from '../../src/components/ui/Screen';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useColors, useBrand } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing } from '../../src/lib/theme';
import { useAppStore } from '../../src/store/useAppStore';
import { useCartStore } from '../../src/store/useCartStore';
import { logout, deleteCurrentAuthUser, authErrorMessage } from '../../src/lib/firebase';
import { updateCustomer, deleteCustomerData } from '../../src/lib/customers';

export default function Profile() {
  const { colors, dark } = useColors();
  const brand = useBrand();
  const router = useRouter();
  const authUser = useAppStore((s) => s.authUser);
  const customer = useAppStore((s) => s.customer);
  const resetStore = useAppStore((s) => s.resetStore);
  const clearCart = useCartStore((s) => s.clear);
  const [busy, setBusy] = useState(false);

  const togglePush = (v: boolean) => {
    if (!authUser || !customer) return;
    updateCustomer(authUser.uid, { preferences: { ...customer.preferences, pushEnabled: v } }).catch(() => {});
  };
  const toggleDark = (v: boolean) => {
    if (!authUser || !customer) return;
    updateCustomer(authUser.uid, { preferences: { ...customer.preferences, darkMode: v } }).catch(() => {});
  };

  const doLogout = async () => {
    await logout();
    clearCart();
  };

  const confirmDelete = () => {
    Alert.alert(
      'Excluir conta',
      'Isso apaga permanentemente sua conta e seus dados pessoais (LGPD). Esta ação não pode ser desfeita. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir tudo',
          style: 'destructive',
          onPress: async () => {
            if (!authUser) return;
            setBusy(true);
            try {
              await deleteCustomerData(authUser.uid);
              await deleteCurrentAuthUser();
              clearCart();
              resetStore();
              Alert.alert('Conta excluída', 'Seus dados foram removidos. Sentiremos sua falta!');
            } catch (e) {
              Alert.alert('Não foi possível excluir', authErrorMessage(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  if (!authUser) {
    return (
      <Screen title="Perfil">
        <Card style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing['2xl'] }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <UserIcon size={34} color={colors.primary} />
          </View>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg, textAlign: 'center' }}>Você está navegando como visitante</Text>
          <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Entre para salvar endereços, favoritos e acompanhar pedidos.</Text>
          <Button label="Entrar ou criar conta" icon={<LogIn size={18} color="#fff" />} onPress={() => router.push('/(auth)/login')} style={{ marginTop: 8 }} />
        </Card>

        <MenuItem icon={<Store size={20} color={colors.primary} />} label="Trocar de loja" colors={colors} onPress={() => router.replace('/store-picker')} />
        <MenuItem icon={<HelpCircle size={20} color={colors.primary} />} label="Ajuda e suporte" colors={colors} onPress={() => router.push('/support')} />
      </Screen>
    );
  }

  return (
    <Screen title="Perfil">
      {/* Header */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {customer?.photoUrl ? (
            <Image source={{ uri: customer.photoUrl }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text style={{ color: colors.primary, fontWeight: font.black, fontSize: fontSize['2xl'] }}>
              {(customer?.name || 'C').charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>{customer?.name || 'Cliente'}</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{customer?.email || authUser.email}</Text>
          {customer?.phone ? <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs }}>{customer.phone}</Text> : null}
        </View>
      </Card>

      <Text style={{ color: colors.textMuted, fontWeight: font.bold, fontSize: fontSize.xs, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.sm }}>Minha conta</Text>
      <MenuItem icon={<MapPin size={20} color={colors.primary} />} label="Endereços de entrega" colors={colors} onPress={() => router.push('/addresses')} badge={customer?.addresses?.length ? String(customer.addresses.length) : undefined} />
      <MenuItem icon={<Heart size={20} color={colors.primary} />} label="Favoritos" colors={colors} onPress={() => router.push('/(tabs)/search?fav=1')} badge={customer?.favorites?.length ? String(customer.favorites.length) : undefined} />
      <MenuItem icon={<Store size={20} color={colors.primary} />} label="Trocar de loja" colors={colors} onPress={() => router.replace('/store-picker')} />

      <Text style={{ color: colors.textMuted, fontWeight: font.bold, fontSize: fontSize.xs, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.sm }}>Preferências</Text>
      <ToggleItem icon={<Bell size={20} color={colors.primary} />} label="Notificações push" value={customer?.preferences?.pushEnabled !== false} onChange={togglePush} colors={colors} />
      <ToggleItem icon={<Moon size={20} color={colors.primary} />} label="Modo escuro" value={dark} onChange={toggleDark} colors={colors} />

      <Text style={{ color: colors.textMuted, fontWeight: font.bold, fontSize: fontSize.xs, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.sm }}>Suporte e privacidade</Text>
      <MenuItem icon={<HelpCircle size={20} color={colors.primary} />} label="Ajuda e suporte (FAQ)" colors={colors} onPress={() => router.push('/support')} />
      <MenuItem icon={<FileText size={20} color={colors.primary} />} label="Termos de uso" colors={colors} onPress={() => Alert.alert('Termos de uso', 'Os Termos de Uso completos estão disponíveis no site da loja.')} />
      <MenuItem icon={<Shield size={20} color={colors.primary} />} label="Política de privacidade (LGPD)" colors={colors} onPress={() => Alert.alert('Privacidade', 'Tratamos seus dados conforme a LGPD. Você pode solicitar a exclusão total a qualquer momento nesta tela.')} />

      <Button label="Sair da conta" variant="secondary" icon={<LogOut size={18} color={colors.text} />} onPress={doLogout} style={{ marginTop: spacing.md }} />
      <Button label="Excluir minha conta" variant="ghost" loading={busy} icon={<Trash2 size={18} color={colors.danger} />} textStyle={{ color: colors.danger }} onPress={confirmDelete} />

      <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, textAlign: 'center', marginTop: spacing.sm }}>
        {brand.name} • Nexmarket Cliente v1.0.0
      </Text>
    </Screen>
  );
}

function MenuItem({ icon, label, colors, onPress, badge }: { icon: React.ReactNode; label: string; colors: any; onPress: () => void; badge?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, padding: spacing.md }}
    >
      <View style={{ width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <Text style={{ flex: 1, color: colors.text, fontWeight: font.bold, fontSize: fontSize.base }}>{label}</Text>
      {badge ? (
        <View style={{ backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full }}>
          <Text style={{ color: colors.primaryDark, fontWeight: font.black, fontSize: 11 }}>{badge}</Text>
        </View>
      ) : null}
      <ChevronRight size={20} color={colors.textSubtle} />
    </Pressable>
  );
}

function ToggleItem({ icon, label, value, onChange, colors }: { icon: React.ReactNode; label: string; value: boolean; onChange: (v: boolean) => void; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, padding: spacing.md }}>
      <View style={{ width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <Text style={{ flex: 1, color: colors.text, fontWeight: font.bold, fontSize: fontSize.base }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" />
    </View>
  );
}
