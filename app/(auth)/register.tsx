import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, Lock, User, Phone } from 'lucide-react-native';

import { Screen } from '../../src/components/ui/Screen';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing } from '../../src/lib/theme';
import { registerWithEmail, authErrorMessage, auth } from '../../src/lib/firebase';
import { createCustomerProfile } from '../../src/lib/customers';

export default function Register() {
  const { colors } = useColors();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    setError(null);
    if (!name.trim()) return setError('Informe seu nome.');
    if (password.length < 6) return setError('A senha deve ter ao menos 6 caracteres.');
    if (password !== confirm) return setError('As senhas não coincidem.');
    setLoading(true);
    try {
      const user = await registerWithEmail(email, password, name.trim());
      await createCustomerProfile(user.uid, { name: name.trim(), email: email.trim(), phone: phone.trim() });
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Criar conta" subtitle="É rápido — só o essencial">
      {error ? (
        <View style={{ backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md, borderWidth: 2, borderColor: colors.danger }}>
          <Text style={{ color: colors.danger, fontWeight: font.semibold, textAlign: 'center' }}>{error}</Text>
        </View>
      ) : null}

      <Input label="Nome completo" placeholder="Como podemos te chamar?" value={name} onChangeText={setName} icon={<User size={20} color={colors.textSubtle} />} />
      <Input label="E-mail" placeholder="voce@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} icon={<Mail size={20} color={colors.textSubtle} />} />
      <Input label="Telefone" placeholder="(00) 00000-0000" keyboardType="phone-pad" value={phone} onChangeText={setPhone} icon={<Phone size={20} color={colors.textSubtle} />} />
      <Input label="Senha" placeholder="Mínimo 6 caracteres" secureTextEntry value={password} onChangeText={setPassword} icon={<Lock size={20} color={colors.textSubtle} />} />
      <Input label="Confirmar senha" placeholder="Repita a senha" secureTextEntry value={confirm} onChangeText={setConfirm} icon={<Lock size={20} color={colors.textSubtle} />} />

      <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, fontWeight: font.medium, marginTop: 4 }}>
        Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade (LGPD).
      </Text>

      <Button label="Criar conta" size="lg" loading={loading} onPress={handleRegister} style={{ marginTop: spacing.sm }} />
      <Button label="Já tenho conta" variant="ghost" textStyle={{ color: colors.primary }} onPress={() => router.back()} />
    </Screen>
  );
}
