import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Phone, ArrowLeft, MessageSquare } from 'lucide-react-native';

import { Screen } from '../../src/components/ui/Screen';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing } from '../../src/lib/theme';
import { signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import { auth, authErrorMessage } from '../../src/lib/firebase';
import { formatPhone, onlyDigits } from '../../src/lib/format';

/**
 * Phone / SMS login (RF01). The two-step UI (number -> 6-digit code) is fully
 * built. Firebase phone auth needs an app-verifier (reCAPTCHA), which requires
 * a dev build with the verifier module; we attempt it and degrade gracefully
 * with a clear message if the verifier isn't available in this runtime.
 */
export default function PhoneLogin() {
  const { colors } = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    const digits = onlyDigits(phone);
    if (digits.length < 10) return setError('Informe um telefone válido com DDD.');
    setLoading(true);
    setError(null);
    try {
      // Requires an app verifier; in a bare/dev build this is wired to a
      // reCAPTCHA modal. If unavailable, the catch below guides the user.
      const verifier = new (RecaptchaVerifier as any)(auth, 'recaptcha', { size: 'invisible' });
      const conf = await signInWithPhoneNumber(auth, `+55${digits}`, verifier);
      setConfirmation(conf);
      setStep('code');
    } catch (e: any) {
      setError(
        'A verificação por SMS precisa de configuração adicional neste app. Por enquanto, entre com e-mail, Google ou Apple.',
      );
    } finally {
      setLoading(false);
    }
  };

  const confirmCode = async () => {
    if (code.trim().length < 6) return setError('Digite o código de 6 dígitos.');
    setLoading(true);
    setError(null);
    try {
      await confirmation.confirm(code.trim());
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
      title={step === 'phone' ? 'Entrar com telefone' : 'Confirme o código'}
      left={<Button variant="ghost" fullWidth={false} icon={<ArrowLeft size={24} color={colors.text} />} onPress={() => (step === 'code' ? setStep('phone') : router.back())} />}
      contentStyle={{ gap: spacing.md }}
    >
      {error ? (
        <View style={{ backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md, borderWidth: 2, borderColor: colors.danger }}>
          <Text style={{ color: colors.danger, fontWeight: font.semibold, textAlign: 'center' }}>{error}</Text>
        </View>
      ) : null}

      {step === 'phone' ? (
        <>
          <Text style={{ color: colors.textMuted, fontWeight: font.medium }}>
            Enviaremos um código por SMS para confirmar seu número.
          </Text>
          <Input
            label="Telefone"
            placeholder="(11) 99999-9999"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(t) => setPhone(formatPhone(t))}
            icon={<Phone size={20} color={colors.textSubtle} />}
          />
          <Button label="Enviar código" size="lg" loading={loading} onPress={sendCode} />
        </>
      ) : (
        <>
          <Text style={{ color: colors.textMuted, fontWeight: font.medium }}>
            Digite o código de 6 dígitos enviado para {phone}.
          </Text>
          <Input
            label="Código"
            placeholder="______"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
            icon={<MessageSquare size={20} color={colors.textSubtle} />}
          />
          <Button label="Confirmar" size="lg" loading={loading} onPress={confirmCode} />
          <Button label="Reenviar código" variant="ghost" textStyle={{ color: colors.primary }} onPress={() => setStep('phone')} />
        </>
      )}
    </Screen>
  );
}
