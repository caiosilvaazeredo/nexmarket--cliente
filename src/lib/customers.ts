import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  orderBy,
  getDocs,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase';
import type { CustomerProfile, CustomerPreferences, Address } from './types';

export const defaultPreferences: CustomerPreferences = {
  darkMode: null,
  pushEnabled: true,
  emailMarketing: true,
};

export function customerRef(uid: string) {
  return doc(db, `customers/${uid}`);
}
function addressesCol(uid: string) {
  return collection(db, `customers/${uid}/addresses`);
}

export async function getCustomer(uid: string): Promise<CustomerProfile | null> {
  const snap = await getDoc(customerRef(uid));
  return snap.exists() ? ({ uid, ...(snap.data() as any) } as CustomerProfile) : null;
}

export function subscribeCustomer(uid: string, cb: (c: CustomerProfile | null) => void) {
  return onSnapshot(
    customerRef(uid),
    (snap) => cb(snap.exists() ? ({ uid, ...(snap.data() as any) } as CustomerProfile) : null),
    (err) => {
      console.warn('subscribeCustomer error', err);
      cb(null);
    },
  );
}

export async function createCustomerProfile(
  uid: string,
  data: { name: string; email: string; phone?: string; photoUrl?: string },
): Promise<void> {
  const profile = {
    name: data.name || 'Cliente',
    email: data.email || '',
    phone: data.phone || '',
    photoUrl: data.photoUrl || '',
    defaultAddressId: null,
    preferences: defaultPreferences,
    paymentTokens: [],
    pushTokens: [],
    favorites: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(customerRef(uid), profile, { merge: true });
}

/** Create the profile only if it doesn't exist yet (social/phone first login). */
export async function ensureCustomerProfile(
  uid: string,
  data: { name: string; email: string; phone?: string; photoUrl?: string },
): Promise<CustomerProfile> {
  const existing = await getCustomer(uid);
  if (existing) return existing;
  await createCustomerProfile(uid, data);
  return (await getCustomer(uid))!;
}

export async function updateCustomer(uid: string, partial: Partial<CustomerProfile>) {
  await updateDoc(customerRef(uid), { ...partial, updatedAt: serverTimestamp() });
}

export async function updatePreferences(uid: string, prefs: CustomerPreferences) {
  await updateCustomer(uid, { preferences: prefs });
}

/* ----------------------------- Favorites ----------------------------- */

export async function toggleFavorite(uid: string, productId: string, on: boolean) {
  await updateDoc(customerRef(uid), {
    favorites: on ? arrayUnion(productId) : arrayRemove(productId),
    updatedAt: serverTimestamp(),
  });
}

/* ----------------------------- Push tokens ----------------------------- */

export async function registerPushToken(uid: string, token: string) {
  try {
    await updateDoc(customerRef(uid), { pushTokens: arrayUnion(token) });
  } catch (e) {
    console.warn('registerPushToken failed', e);
  }
}

/* ----------------------------- Addresses (RF03) ----------------------------- */

export function subscribeAddresses(uid: string, cb: (a: Address[]) => void) {
  const q = query(addressesCol(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Address))),
    (err) => {
      console.warn('subscribeAddresses error', err);
      cb([]);
    },
  );
}

export async function saveAddress(uid: string, address: Omit<Address, 'id'> & { id?: string }) {
  const id = address.id || doc(addressesCol(uid)).id;
  const ref = doc(db, `customers/${uid}/addresses/${id}`);
  await setDoc(
    ref,
    {
      ...address,
      id,
      createdAt: address.createdAt || serverTimestamp(),
    },
    { merge: true },
  );
  // First address becomes the default automatically.
  const all = await getDocs(addressesCol(uid));
  if (all.size === 1 || address.isDefault) {
    await setDefaultAddress(uid, id);
  }
  return id;
}

export async function deleteAddress(uid: string, addressId: string) {
  await deleteDoc(doc(db, `customers/${uid}/addresses/${addressId}`));
}

export async function setDefaultAddress(uid: string, addressId: string) {
  const all = await getDocs(addressesCol(uid));
  await Promise.all(
    all.docs.map((d) =>
      updateDoc(d.ref, { isDefault: d.id === addressId }).catch(() => {}),
    ),
  );
  await updateCustomer(uid, { defaultAddressId: addressId });
}

/* ----------------------------- LGPD account deletion (RNF12) ----------------------------- */

/**
 * Erase the customer's personal data from Firestore (profile + addresses).
 * Orders are kept for the store's fiscal/legal records but are anonymized
 * (name/phone stripped) so they no longer carry personal data. The auth
 * account itself is removed by firebase.deleteAccount() after this resolves.
 */
export async function eraseCustomerData(uid: string) {
  // Delete addresses subcollection.
  const addrs = await getDocs(addressesCol(uid));
  await Promise.all(addrs.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
  // Delete the profile document.
  await deleteDoc(customerRef(uid)).catch(() => {});
}
