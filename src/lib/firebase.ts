import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously,
  signOut,
  updateProfile,
  deleteUser,
  EmailAuthProvider,
  linkWithCredential,
} from 'firebase/auth';

// getReactNativePersistence is exported only from Firebase's React Native
// entry point — Metro resolves it at runtime, but the web-entry TS types omit
// it, so we access it via require to keep type-checking happy.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getReactNativePersistence } = require('firebase/auth') as any;
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

import firebaseConfig from '../../firebase-config.json';

// Reuse the SAME Firebase project + named Firestore database as the loja and
// entregador apps, so all three apps share one integrated backend (RNF08).
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// React Native needs explicit AsyncStorage-backed auth persistence,
// otherwise the user is logged out on every cold start.
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);

export { app };

/* -------------------------- Email/password auth -------------------------- */

export const loginWithEmail = async (email: string, pass: string) =>
  (await signInWithEmailAndPassword(auth, email.trim(), pass)).user;

export const registerWithEmail = async (email: string, pass: string, name?: string) => {
  // If the visitor is browsing as a guest (anonymous), UPGRADE that account in
  // place via linkWithCredential so their cart, addresses and any orders made
  // as a guest stay attached to the new permanent account (same uid).
  const current = auth.currentUser;
  let user;
  if (current?.isAnonymous) {
    try {
      const credential = EmailAuthProvider.credential(email.trim(), pass);
      user = (await linkWithCredential(current, credential)).user;
    } catch (e: any) {
      // e.g. email already in use -> fall back to a fresh account.
      user = (await createUserWithEmailAndPassword(auth, email.trim(), pass)).user;
    }
  } else {
    user = (await createUserWithEmailAndPassword(auth, email.trim(), pass)).user;
  }
  if (name) {
    try {
      await updateProfile(user, { displayName: name });
    } catch {}
  }
  return user;
};

export const resetPassword = async (email: string) =>
  sendPasswordResetEmail(auth, email.trim());

export const loginAsVisitor = async () => {
  if (auth.currentUser) return auth.currentUser;
  return (await signInAnonymously(auth)).user;
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Logout failed', e);
  }
};

/** LGPD (RNF12): permanently delete the auth account. The Firestore profile +
 *  personal data are erased separately in customers.ts before this call. */
export const deleteAccount = async () => {
  if (auth.currentUser) await deleteUser(auth.currentUser);
};

/* -------------------------- Error handling -------------------------- */

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  console.error(
    'Firestore Error:',
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      operationType,
      path,
      uid: auth.currentUser?.uid ?? null,
    }),
  );
}

/** Map Firebase auth error codes to friendly Portuguese messages. */
export function authErrorMessage(err: any): string {
  const code = err?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'E-mail inválido.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Credenciais inválidas. Verifique e-mail e senha.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já está em uso.';
    case 'auth/weak-password':
      return 'A senha deve ter ao menos 6 caracteres.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Tente novamente em instantes.';
    case 'auth/network-request-failed':
      return 'Sem conexão. Verifique sua internet.';
    case 'auth/invalid-verification-code':
      return 'Código SMS inválido. Confira os números.';
    case 'auth/code-expired':
      return 'O código expirou. Solicite um novo.';
    case 'auth/admin-restricted-operation':
      return 'Modo de teste desativado no Firebase (ative o login anônimo).';
    default:
      return 'Ocorreu um erro. Tente novamente.';
  }
}
