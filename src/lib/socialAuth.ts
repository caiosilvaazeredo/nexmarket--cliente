/**
 * Social & phone authentication (RF01).
 *
 * All providers exchange their credential for a Firebase session via
 * signInWithCredential, so the rest of the app only ever sees a normal
 * Firebase user — no matter how the customer signed in.
 *
 * Native modules (Google/Apple/reCAPTCHA) are loaded defensively with
 * try/catch so the bundle never crashes in environments where a provider
 * isn't configured yet (mirrors firebase.ts's getReactNativePersistence
 * pattern). Each helper throws a friendly, localized error when its provider
 * is unavailable, which the login screen surfaces to the user.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  PhoneAuthProvider,
  type ConfirmationResult,
} from 'firebase/auth';
import { auth } from './firebase';

/* ------------------------------- Google ------------------------------- */

let WebBrowser: any;
let Google: any;
try {
  WebBrowser = require('expo-web-browser');
  Google = require('expo-auth-session/providers/google');
  WebBrowser?.maybeCompleteAuthSession?.();
} catch {
  // expo-auth-session not installed / not configured yet.
}

/** Returns the [request, response, promptAsync] hook for Google sign-in.
 *  Usage in a component:
 *    const [req, res, prompt] = useGoogleAuth();
 *    ... onPress={() => prompt()} ... and watch `res` for type === 'success'.
 */
export function useGoogleAuth() {
  const cfg = (Constants.expoConfig?.extra as any)?.googleAuth || {};
  if (!Google?.useAuthRequest) {
    return [null, null, async () => {
      throw new Error('Login com Google ainda não está configurado neste build.');
    }] as const;
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return Google.useAuthRequest({
    expoClientId: cfg.expoClientId,
    iosClientId: cfg.iosClientId,
    androidClientId: cfg.androidClientId,
    webClientId: cfg.webClientId,
  });
}

/** Exchange a Google id_token (from the auth-session response) for a Firebase user. */
export async function signInWithGoogleIdToken(idToken: string) {
  const credential = GoogleAuthProvider.credential(idToken);
  return (await signInWithCredential(auth, credential)).user;
}

/* -------------------------------- Apple ------------------------------- */

export async function signInWithApple() {
  let AppleAuthentication: any;
  let Crypto: any;
  try {
    AppleAuthentication = require('expo-apple-authentication');
    Crypto = require('expo-crypto');
  } catch {
    throw new Error('Login com Apple indisponível neste dispositivo.');
  }
  if (Platform.OS !== 'ios') {
    throw new Error('Login com Apple está disponível apenas no iOS.');
  }
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) throw new Error('Login com Apple indisponível neste dispositivo.');

  // Nonce protects against replay; Apple returns its SHA-256, Firebase checks the raw.
  const rawNonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({
    idToken: appleCredential.identityToken!,
    rawNonce,
  });
  const user = (await signInWithCredential(auth, credential)).user;

  const fullName = [
    appleCredential.fullName?.givenName,
    appleCredential.fullName?.familyName,
  ]
    .filter(Boolean)
    .join(' ');
  return { user, fullName: fullName || undefined };
}

/* -------------------------------- Phone ------------------------------- */

/**
 * Phone (SMS) auth. Firebase JS SDK requires an app-verifier (reCAPTCHA). On
 * native we use a FirebaseRecaptchaVerifierModal ref (expo-firebase-recaptcha)
 * passed in from the screen. Returns the verificationId used to confirm the code.
 */
export async function sendPhoneCode(
  phoneE164: string,
  recaptchaVerifier: any,
): Promise<string> {
  if (!recaptchaVerifier) {
    throw new Error('Verificação por SMS indisponível neste build.');
  }
  const provider = new PhoneAuthProvider(auth);
  return provider.verifyPhoneNumber(phoneE164, recaptchaVerifier);
}

/** Confirm the 6-digit SMS code against the verificationId from sendPhoneCode. */
export async function confirmPhoneCode(verificationId: string, code: string) {
  const credential = PhoneAuthProvider.credential(verificationId, code);
  return (await signInWithCredential(auth, credential)).user;
}

export type { ConfirmationResult };

/** Normalize a BR phone string to E.164 (+55...). */
export function toE164BR(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+')) return '+' + digits;
  if (digits.length >= 12 && digits.startsWith('55')) return '+' + digits;
  return '+55' + digits;
}
