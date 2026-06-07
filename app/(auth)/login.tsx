import React, { useState, useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, Lock, Phone, Apple, ShoppingBasket } from 'lucide-react-native';

import { Screen } from '../../src/components/ui/Screen';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing, shadow } from '../../src/lib/theme';
import { loginWithEmail, authErrorMessage } from '../../src/lib/firebase';
import { useGoogleAuth, signInWithGoogleIdToken, signInWithApple } from '../../src/lib/socialAuth';
import { ensureCustomerProfile } from '../../src/lib/customers';
import { auth } from '../../src/lib/firebase';
import { useStore } from '../../src/store/useStore';

export default function Login() {
  const { colors } = useColors();
  const router = useRouter();
  const branding = useStore((s) => s.branding);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [gReq, gRes, gPrompt] = useGoogleAuth();

  const done = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  // Handle the Google auth-session response.
  useEffect(() => {
    if (gRes?.type === 'success') {
      const idToken = gRes.params?.id_token || gRes.authentication?.idToken;
      if (idToken) {
        setLoading('google');
        signInWithGoogleIdToken(idToken)
          .then(async () => {
            await ensureCustomerProfile(auth.currentUser!.uid, {
              name: auth.currentUser?.displayName || 'Cliente',
              email: auth.currentUser?.email || '',
              photoUrl: auth.currentUser?.photoURL || '',
            });
            done();
          })
          .catch((e) => setError(authErrorMessage(e)))
          .finally(() => setLoading(null));
      }
    }
  }, [gRes]);

  const handleEmailLogin = async () => {
    setLoading('email');
    setError(null);
    try {
      await loginWithEmail(email, password);
      done();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(null);
    }
  };

  const handleApple = async () => {
    setLoading('apple');
    setError(null);
    try {
      const { fullName } = await signInWithApple();
      await ensureCustomerProfile(auth.currentUser!.uid, {
        name: auth.currentUser?.displayName || fullName || 'Cliente',
        email: auth.currentUser?.email || '',
      });
      done();
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') setError(e?.message || authErrorMessage(e));
    } finally {
      setLoading(null);
    }
  };

  return (
    <Screen contentStyle={{ flexGrow: 1, justifyContent: 'center', gap: spacing.lg }}>
      <View style={{ alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
        {branding?.logoUrl ? (
          <Image source={{ uri: branding.logoUrl }} style={{ width: 80, height: 80, borderRadius: radius['2xl'] }} />
        ) : (
          <View
            style={[
              { width: 80, height: 80, borderRadius: radius['2xl'], backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '12deg' }] },
              shadow.card,
            ]}
          >
            <ShoppingBasket color="#FFFFFF" size={42} strokeWidth={2.5} style={{ transform: [{ rotate: '-12deg' }] }} />
          </View>
        )}
        <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize['3xl'] }}>
          {branding?.appName || 'Nexmarket'}
        </Text>
        <Text style={{ color: colors.textMuted, fontWeight: font.medium, textAlign: 'center' }}>
          Entre para finalizar seus pedidos e acompanhar entregas
        </Text>
      </View>

      {error ? (
        <View style={{ backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md, borderWidth: 2, borderColor: colors.danger }}>
          <Text style={{ color: colors.danger, fontWeight: font.semibold, textAlign: 'center' }}>{error}</Text>
        </View>
      ) : null}

      <Input placeholder="Seu e-mail" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} icon={<Mail size={20} color={colors.textSubtle} />} />
      <Input placeholder="Sua senha" secureTextEntry value={password} onChangeText={setPassword} icon={<Lock size={20} color={colors.textSubtle} />} />

      <Button label="Esqueceu a senha?" variant="ghost" size="sm" fullWidth={false} style={{ alignSelf: 'flex-end' }} textStyle={{ color: colors.primary }} onPress={() => router.push('/(auth)/recovery')} />

      <Button label="Entrar" size="lg" loading={loading === 'email'} onPress={handleEmailLogin} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: spacing.xs }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={{ color: colors.textSubtle, fontWeight: font.medium }}>ou continue com</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>

      <Button
        variant="secondary"
        loading={loading === 'google'}
        disabled={!gReq}
        onPress={() => gPrompt && gPrompt()}
        icon={<GoogleG />}
        label="Google"
      />
      <Button variant="secondary" loading={loading === 'apple'} onPress={handleApple} icon={<Apple size={20} color={colors.text} fill={colors.text} />} label="Apple" />
      <Button variant="secondary" onPress={() => router.push('/(auth)/phone')} icon={<Phone size={20} color={colors.text} />} label="Telefone (SMS)" />

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.sm }}>
        <Text style={{ color: colors.textMuted, fontWeight: font.medium }}>Não tem conta? </Text>
        <Button label="Cadastre-se" variant="ghost" size="sm" fullWidth={false} textStyle={{ color: colors.primary }} onPress={() => router.push('/(auth)/register')} />
      </View>

      <Button label="Continuar explorando" variant="ghost" size="sm" textStyle={{ color: colors.textMuted }} onPress={done} />
    </Screen>
  );
}

/** Tiny multicolor Google "G" so we don't ship an image asset. */
function GoogleG() {
  return (
    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' }}>
      <Text style={{ fontWeight: '900', color: '#4285F4', fontSize: 14 }}>G</Text>
    </View>
  );
}
