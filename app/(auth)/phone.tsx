import React, { useState, useRef } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Phone, KeyRound } from 'lucide-react-native';

import { Screen } from '../../src/components/ui/Screen';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing } from '../../src/lib/theme';
import { sendPhoneCode, confirmPhoneCode, toE164BR } from '../../src/lib/socialAuth';
import { authErrorMessage, auth } from '../../src/lib/firebase';
import { ensureCustomerProfile } from '../../src/lib/customers';
import firebaseConfig from '../../firebase-config.json';

/**
 * Phone (SMS) login (RF01). Firebase JS requires a reCAPTCHA verifier on RN;
 * we use expo-firebase-recaptcha when present. If the module/native config
 * isn't available the screen explains it and the user can fall back to another
 * method — the rest of the app is unaffected.
 */

// Defensive require so the bundle never breaks if the module isn't installed.
let FirebaseRecaptchaVerifierModal: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  FirebaseRecaptchaVerifierModal = require('expo-firebase-recaptcha').FirebaseRecaptchaVerifierModal;
} catch {}

export default function PhoneLogin() {
  const { colors } = useColors();
  const router = useRouter();
  const recaptchaRef = useRef<any>(null);

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setError(null);
    if (phone.replace(/\D/g, '').length < 10) return setError('Informe um número de telefone válido com DDD.');
    setLoading(true);
    try {
      const id = await sendPhoneCode(toE164BR(phone), recaptchaRef.current);
      setVerificationId(id);
    } catch (e: any) {
      setError(e?.message || authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (!verificationId) return;
    setError(null);
    setLoading(true);
    try {
      await confirmPhoneCode(verificationId, code.trim());
      await ensureCustomerProfile(auth.currentUser!.uid, {
        name: auth.currentUser?.displayName || 'Cliente',
        email: auth.currentUser?.email || '',
        phone: auth.currentUser?.phoneNumber || toE164BR(phone),
      });
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Entrar com telefone" subtitle={verificationId ? 'Digite o código que enviamos por SMS' : 'Enviaremos um código por SMS'}>
      {FirebaseRecaptchaVerifierModal ? (
        <FirebaseRecaptchaVerifierModal ref={recaptchaRef} firebaseConfig={firebaseConfig as any} attemptInvisibleVerification />
      ) : null}

      {!FirebaseRecaptchaVerifierModal ? (
        <View style={{ backgroundColor: colors.amberSoft, borderRadius: radius.md, padding: spacing.md, borderWidth: 2, borderColor: colors.amber }}>
          <Text style={{ color: '#92400E', fontWeight: font.semibold }}>
            Para login por SMS, instale e configure expo-firebase-recaptcha neste build. Enquanto isso, use e-mail, Google ou Apple.
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={{ backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md, borderWidth: 2, borderColor: colors.danger }}>
          <Text style={{ color: colors.danger, fontWeight: font.semibold, textAlign: 'center' }}>{error}</Text>
        </View>
      ) : null}

      {!verificationId ? (
        <>
          <Input label="Telefone" placeholder="(00) 00000-0000" keyboardType="phone-pad" value={phone} onChangeText={setPhone} icon={<Phone size={20} color={colors.textSubtle} />} />
          <Button label="Enviar código" size="lg" loading={loading} onPress={sendCode} />
        </>
      ) : (
        <>
          <Input label="Código SMS" placeholder="000000" keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} icon={<KeyRound size={20} color={colors.textSubtle} />} />
          <Button label="Confirmar" size="lg" loading={loading} onPress={confirm} />
          <Button label="Reenviar código" variant="ghost" textStyle={{ color: colors.primary }} onPress={sendCode} />
        </>
      )}
      <Button label="Voltar" variant="ghost" textStyle={{ color: colors.textMuted }} onPress={() => router.back()} />
    </Screen>
  );
}
