import React, { useEffect, useState } from 'react';
import { View, Text, Platform, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Mail, Lock, ShoppingBasket, Phone, ArrowRight } from 'lucide-react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { Screen } from '../../src/components/ui/Screen';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { useColors, useBrand } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing, shadow } from '../../src/lib/theme';
import { loginWithEmail, authErrorMessage, loginWithAppleCredential } from '../../src/lib/firebase';
import { useGoogleAuth } from '../../src/hooks/useGoogleAuth';

export default function Login() {
  const { colors } = useColors();
  const brand = useBrand();
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const google = useGoogleAuth(setError);

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
  }, []);

  const goNext = () => {
    if (params.next) router.replace(params.next as any);
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithEmail(email, password);
      goNext();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setError(null);
    try {
      const nonce = Math.random().toString(36).slice(2);
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (cred.identityToken) {
        await loginWithAppleCredential(cred.identityToken, nonce);
        goNext();
      }
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') setError('Não foi possível entrar com a Apple.');
    }
  };

  return (
    <Screen contentStyle={{ flexGrow: 1, justifyContent: 'center', gap: spacing.lg }}>
      <View style={{ alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
        <View
          style={[
            {
              width: 80,
              height: 80,
              borderRadius: radius['2xl'],
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ rotate: '-8deg' }],
            },
            shadow.card,
          ]}
        >
          <ShoppingBasket color="#FFFFFF" size={40} strokeWidth={2.5} style={{ transform: [{ rotate: '8deg' }] }} />
        </View>
        <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize['3xl'] }}>{brand.name}</Text>
        <Text style={{ color: colors.textMuted, fontWeight: font.medium }}>Seu mercado, na palma da mão</Text>
      </View>

      {error ? (
        <View
          style={{
            backgroundColor: colors.dangerSoft,
            borderRadius: radius.md,
            padding: spacing.md,
            borderWidth: 2,
            borderColor: colors.danger,
          }}
        >
          <Text style={{ color: colors.danger, fontWeight: font.semibold, textAlign: 'center' }}>{error}</Text>
        </View>
      ) : null}

      <Input
        placeholder="Seu e-mail"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={email}
        onChangeText={setEmail}
        icon={<Mail size={20} color={colors.textSubtle} />}
      />
      <Input
        placeholder="Sua senha"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        icon={<Lock size={20} color={colors.textSubtle} />}
      />

      <Button
        label="Esqueceu a senha?"
        variant="ghost"
        size="sm"
        fullWidth={false}
        style={{ alignSelf: 'flex-end' }}
        textStyle={{ color: colors.primary }}
        onPress={() => router.push('/(auth)/recovery')}
      />

      <Button label="Entrar" size="lg" loading={loading} onPress={handleLogin} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: spacing.xs }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={{ color: colors.textSubtle, fontWeight: font.medium }}>ou continue com</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Button
          label="Google"
          variant="secondary"
          loading={google.busy}
          style={{ flex: 1 }}
          onPress={google.signIn}
          icon={<Text style={{ fontWeight: font.black, color: '#4285F4', fontSize: fontSize.lg }}>G</Text>}
        />
        <Button
          label="Telefone"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => router.push('/(auth)/phone')}
          icon={<Phone size={18} color={colors.text} />}
        />
      </View>

      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={radius.lg}
          style={{ height: 52, width: '100%' }}
          onPress={handleApple}
        />
      ) : null}

      <Pressable onPress={goNext} style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
        <Text style={{ color: colors.textMuted, fontWeight: font.bold }}>Explorar sem conta</Text>
        <ArrowRight size={16} color={colors.textMuted} />
      </Pressable>

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.textMuted, fontWeight: font.medium }}>Não tem conta? </Text>
        <Button
          label="Cadastre-se"
          variant="ghost"
          size="sm"
          fullWidth={false}
          textStyle={{ color: colors.primary }}
          onPress={() => router.push(params.next ? `/(auth)/register?next=${encodeURIComponent(String(params.next))}` : '/(auth)/register')}
        />
      </View>
    </Screen>
  );
}
