import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, CheckCircle2 } from 'lucide-react-native';

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

  if (sent) {
    return (
      <Screen contentStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg }}>
        <CheckCircle2 size={72} color={colors.primary} />
        <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize['2xl'], textAlign: 'center' }}>E-mail enviado!</Text>
        <Text style={{ color: colors.textMuted, fontWeight: font.medium, textAlign: 'center' }}>
          Enviamos um link de redefinição para {email}. Verifique sua caixa de entrada e o spam.
        </Text>
        <Button label="Voltar ao login" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen title="Recuperar senha" subtitle="Enviaremos um link de redefinição">
      {error ? (
        <View style={{ backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md, borderWidth: 2, borderColor: colors.danger }}>
          <Text style={{ color: colors.danger, fontWeight: font.semibold, textAlign: 'center' }}>{error}</Text>
        </View>
      ) : null}
      <Input label="E-mail" placeholder="voce@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} icon={<Mail size={20} color={colors.textSubtle} />} />
      <Button label="Enviar link" size="lg" loading={loading} onPress={handleReset} />
      <Button label="Voltar" variant="ghost" textStyle={{ color: colors.textMuted }} onPress={() => router.back()} />
    </Screen>
  );
}
