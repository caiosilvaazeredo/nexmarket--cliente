import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { loginWithGoogleIdToken } from '../lib/firebase';

WebBrowser.maybeCompleteAuthSession();

function cfg(key: string, envKey: string): string | undefined {
  const extra = (Constants.expoConfig?.extra as any)?.googleAuth || {};
  return extra[key] || process.env[envKey] || undefined;
}

/**
 * Google sign-in via expo-auth-session. Returns a `signIn` function and a
 * `configured` flag. When OAuth client IDs are not set (extra.googleAuth /
 * EXPO_PUBLIC_GOOGLE_*), the button degrades gracefully instead of crashing.
 */
export function useGoogleAuth(onError?: (msg: string) => void) {
  const webClientId = cfg('webClientId', 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
  const iosClientId = cfg('iosClientId', 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');
  const androidClientId = cfg('androidClientId', 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID');
  const expoClientId = cfg('expoClientId', 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');

  const configured = !!(webClientId || iosClientId || androidClientId || expoClientId);
  const [busy, setBusy] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: webClientId,
    iosClientId,
    androidClientId,
    // expoClientId is accepted by the provider for the Expo Go proxy flow.
    // @ts-ignore
    expoClientId,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = (response.params as any)?.id_token || (response.authentication as any)?.idToken;
      if (idToken) {
        loginWithGoogleIdToken(idToken).catch(() => onError?.('Não foi possível entrar com o Google.'));
      }
      setBusy(false);
    } else if (response) {
      setBusy(false);
    }
  }, [response]);

  const signIn = async () => {
    if (!configured) {
      onError?.('Login com Google ainda não configurado. Use e-mail ou telefone.');
      return;
    }
    setBusy(true);
    try {
      await promptAsync();
    } catch {
      setBusy(false);
      onError?.('Não foi possível abrir o login do Google.');
    }
  };

  return { signIn, configured, busy: busy && !!request };
}
