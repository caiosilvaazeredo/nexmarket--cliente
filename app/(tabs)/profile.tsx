import React, { useState } from 'react';
import { View, Text, Switch, Pressable, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import {
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Bell,
  Moon,
  LogOut,
  LogIn,
  ChevronRight,
  HelpCircle,
  Trash2,
  Save,
  Heart,
  ShieldCheck,
} from 'lucide-react-native';

import { Screen } from '../../src/components/ui/Screen';
import { Card } from '../../src/components/ui/Card';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing } from '../../src/lib/theme';
import { useStore } from '../../src/store/useStore';
import {
  updateCustomer,
  updatePreferences,
  defaultPreferences,
  eraseCustomerData,
} from '../../src/lib/customers';
import { logout, deleteAccount } from '../../src/lib/firebase';
import { pickImage } from '../../src/lib/images';

export default function Profile() {
  const { colors } = useColors();
  const router = useRouter();
  const customer = useStore((s) => s.customer);
  const authUser = useStore((s) => s.authUser);
  const addresses = useStore((s) => s.addresses);
  const isGuest = authUser?.isAnonymous ?? true;

  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [saving, setSaving] = useState(false);
  const prefs = customer?.preferences || defaultPreferences;

  if (!customer) return <Screen title="Perfil"><View /></Screen>;

  const savePersonal = async () => {
    setSaving(true);
    try {
      await updateCustomer(customer.uid, { name: name.trim(), phone: phone.trim() });
      Alert.alert('Pronto', 'Dados atualizados.');
    } finally {
      setSaving(false);
    }
  };
  const setPref = (patch: Partial<typeof prefs>) =>
    updatePreferences(customer.uid, { ...prefs, ...patch });
  const changePhoto = async () => {
    const uri = await pickImage({ camera: false, maxWidth: 400, quality: 0.5 });
    if (uri) await updateCustomer(customer.uid, { photoUrl: uri });
  };

  const confirmDelete = () =>
    Alert.alert(
      'Excluir conta',
      'Isto apaga permanentemente sua conta e seus dados pessoais (LGPD). Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir tudo',
          style: 'destructive',
          onPress: async () => {
            try {
              await eraseCustomerData(customer.uid);
              await deleteAccount();
            } catch (e: any) {
              Alert.alert('Não foi possível excluir', 'Por segurança, entre novamente e tente de novo.');
            }
          },
        },
      ],
    );

  return (
    <Screen title="Perfil" subtitle="Conta e preferências">
      {/* Header / guest upsell */}
      <Card elevated>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Pressable onPress={changePhoto} disabled={isGuest}>
            {customer.photoUrl ? (
              <Image source={{ uri: customer.photoUrl }} style={{ width: 64, height: 64, borderRadius: 32 }} />
            ) : (
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.primaryDark, fontWeight: font.black, fontSize: fontSize['2xl'] }}>{(customer.name || 'V')[0].toUpperCase()}</Text>
              </View>
            )}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl }}>{isGuest ? 'Visitante' : customer.name}</Text>
            <Text style={{ color: colors.textMuted, fontWeight: font.medium, fontSize: fontSize.sm }}>{customer.email || customer.phone || 'Conta de visitante'}</Text>
          </View>
        </View>
        {isGuest && (
          <Button label="Entrar ou criar conta" icon={<LogIn size={18} color="#FFFFFF" />} onPress={() => router.push('/(auth)/login')} style={{ marginTop: spacing.md }} />
        )}
      </Card>

      {/* Quick links */}
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <Row icon={<MapPin size={20} color={colors.primary} />} label="Meus endereços" hint={`${addresses.length}`} onPress={() => router.push('/address')} colors={colors} />
        <Divider colors={colors} />
        <Row icon={<CreditCard size={20} color={colors.primary} />} label="Formas de pagamento" hint={`${customer.paymentTokens?.length || 0}`} onPress={() => router.push('/address?tab=payments')} colors={colors} />
        <Divider colors={colors} />
        <Row icon={<Heart size={20} color={colors.primary} />} label="Favoritos" hint={`${customer.favorites?.length || 0}`} onPress={() => router.push('/(tabs)/search')} colors={colors} />
        <Divider colors={colors} />
        <Row icon={<HelpCircle size={20} color={colors.primary} />} label="Ajuda e suporte" onPress={() => router.push('/support')} colors={colors} />
      </Card>

      {/* Personal data */}
      {!isGuest && (
        <Card>
          <Section title="Dados pessoais" colors={colors} />
          <View style={{ gap: spacing.md }}>
            <Input placeholder="Nome completo" value={name} onChangeText={setName} icon={<User size={20} color={colors.textSubtle} />} />
            <Input placeholder="Telefone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} icon={<Phone size={20} color={colors.textSubtle} />} />
            <Input placeholder="E-mail" editable={false} value={customer.email} icon={<Mail size={20} color={colors.textSubtle} />} />
            <Button label="Salvar" variant="secondary" loading={saving} icon={<Save size={18} color={colors.textMuted} />} onPress={savePersonal} />
          </View>
        </Card>
      )}

      {/* Preferences */}
      <Card>
        <Section title="Preferências" colors={colors} />
        <Toggle icon={<Bell size={20} color={colors.textMuted} />} label="Notificações de pedidos" value={prefs.pushEnabled} onChange={(v: boolean) => setPref({ pushEnabled: v })} colors={colors} />
        <Toggle icon={<Moon size={20} color={colors.textMuted} />} label="Modo escuro" value={prefs.darkMode === true} onChange={(v: boolean) => setPref({ darkMode: v })} colors={colors} />
        <Toggle icon={<Mail size={20} color={colors.textMuted} />} label="Ofertas por e-mail" value={prefs.emailMarketing} onChange={(v: boolean) => setPref({ emailMarketing: v })} colors={colors} />
      </Card>

      {/* Privacy / LGPD */}
      <Card>
        <Section title="Privacidade (LGPD)" colors={colors} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.md }}>
          <ShieldCheck size={20} color={colors.primary} />
          <Text style={{ color: colors.textMuted, fontWeight: font.medium, flex: 1, fontSize: fontSize.sm }}>
            Seus dados de pagamento nunca são salvos por nós. Você pode excluir sua conta e todos os dados pessoais a qualquer momento.
          </Text>
        </View>
        {!isGuest && (
          <Button label="Excluir minha conta" variant="danger" icon={<Trash2 size={18} color="#FFFFFF" />} onPress={confirmDelete} />
        )}
      </Card>

      {!isGuest && (
        <Button
          label="Sair da conta"
          variant="secondary"
          icon={<LogOut size={18} color={colors.textMuted} />}
          onPress={() => Alert.alert('Sair', 'Deseja sair da conta?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sair', style: 'destructive', onPress: logout }])}
        />
      )}
      <View style={{ height: 24 }} />
    </Screen>
  );
}

function Section({ title, colors }: { title: string; colors: any }) {
  return <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg, marginBottom: spacing.md }}>{title}</Text>;
}
function Divider({ colors }: { colors: any }) {
  return <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 54 }} />;
}
function Row({ icon, label, hint, onPress, colors }: any) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: spacing.lg }}>
      {icon}
      <Text style={{ flex: 1, color: colors.text, fontWeight: font.bold, fontSize: fontSize.base }}>{label}</Text>
      {hint ? <Text style={{ color: colors.textSubtle, fontWeight: font.bold }}>{hint}</Text> : null}
      <ChevronRight size={20} color={colors.textSubtle} />
    </Pressable>
  );
}
function Toggle({ icon, label, value, onChange, colors }: any) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {icon}
        <Text style={{ color: colors.text, fontWeight: font.semibold }}>{label}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#FFFFFF" />
    </View>
  );
}
