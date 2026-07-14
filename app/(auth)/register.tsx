import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { User, Mail, Lock, Phone, ArrowLeft } from 'lucide-react-native';

import { Screen } from '../../src/components/ui/Screen';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing } from '../../src/lib/theme';
import { registerWithEmail, authErrorMessage } from '../../src/lib/firebase';
import { createCustomerProfile } from '../../src/lib/customers';
import { formatPhone, onlyDigits } from '../../src/lib/format';

export default function Register() {
  const { colors } = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!name.trim()) return setError('Informe seu nome.');
    if (onlyDigits(phone).length < 10) return setError('Informe um telefone válido com DDD.');
    setLoading(true);
    setError(null);
    try {
      const user = await registerWithEmail(email, password, name.trim());
      await createCustomerProfile(user.uid, {
        name: name.trim(),
        email: email.trim(),
        phone: onlyDigits(phone),
      });
      if (params.next) router.replace(params.next as any);
      else router.replace('/(tabs)');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      title="Criar conta"
      subtitle="Leva menos de um minuto"
      left={
        <Button variant="ghost" fullWidth={false} icon={<ArrowLeft size={24} color={colors.text} />} onPress={() => router.back()} />
      }
      contentStyle={{ gap: spacing.md }}
    >
      {error ? (
        <View style={{ backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md, borderWidth: 2, borderColor: colors.danger }}>
          <Text style={{ color: colors.danger, fontWeight: font.semibold, textAlign: 'center' }}>{error}</Text>
        </View>
      ) : null}

      <Input label="Nome completo" placeholder="Como podemos te chamar?" value={name} onChangeText={setName} icon={<User size={20} color={colors.textSubtle} />} />
      <Input label="E-mail" placeholder="voce@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} icon={<Mail size={20} color={colors.textSubtle} />} />
      <Input label="Telefone" placeholder="(11) 99999-9999" keyboardType="phone-pad" value={phone} onChangeText={(t) => setPhone(formatPhone(t))} icon={<Phone size={20} color={colors.textSubtle} />} />
      <Input label="Senha" placeholder="Mínimo 6 caracteres" secureTextEntry value={password} onChangeText={setPassword} icon={<Lock size={20} color={colors.textSubtle} />} />

      <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, lineHeight: 18, marginTop: 4 }}>
        Ao criar a conta você concorda com os Termos de Uso e a Política de Privacidade. Seus dados são tratados conforme a LGPD e podem ser excluídos a qualquer momento.
      </Text>

      <Button label="Criar conta" size="lg" loading={loading} onPress={handleRegister} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}
