import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, ArrowLeft, MailCheck } from 'lucide-react-native';

import { Screen } from '../../src/components/ui/Screen';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing } from '../../src/lib/theme';
import { resetPassword, authErrorMessage } from '../../src/lib/firebase';

export default function Recovery() {
  const { colors } = useColors();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    if (!email.trim()) return setError('Informe seu e-mail.');
    setLoading(true);
    setError(null);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      title="Recuperar senha"
      left={<Button variant="ghost" fullWidth={false} icon={<ArrowLeft size={24} color={colors.text} />} onPress={() => router.back()} />}
      contentStyle={{ gap: spacing.md }}
    >
      {sent ? (
        <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing['2xl'] }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <MailCheck size={36} color={colors.primary} />
          </View>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl, textAlign: 'center' }}>E-mail enviado!</Text>
          <Text style={{ color: colors.textMuted, fontWeight: font.medium, textAlign: 'center' }}>
            Enviamos um link de recuperação para {email}. Verifique sua caixa de entrada e o spam.
          </Text>
          <Button label="Voltar ao login" onPress={() => router.replace('/(auth)/login')} style={{ marginTop: spacing.md }} />
        </View>
      ) : (
        <>
          <Text style={{ color: colors.textMuted, fontWeight: font.medium }}>
            Informe o e-mail da sua conta e enviaremos um link para você criar uma nova senha.
          </Text>
          {error ? (
            <View style={{ backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md, borderWidth: 2, borderColor: colors.danger }}>
              <Text style={{ color: colors.danger, fontWeight: font.semibold, textAlign: 'center' }}>{error}</Text>
            </View>
          ) : null}
          <Input placeholder="Seu e-mail" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} icon={<Mail size={20} color={colors.textSubtle} />} />
          <Button label="Enviar link" size="lg" loading={loading} onPress={handleReset} />
        </>
      )}
    </Screen>
  );
}
