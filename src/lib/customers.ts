import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { CustomerProfile, SavedAddress, CustomerPreferences } from './types';

export const defaultPreferences: CustomerPreferences = {
  pushEnabled: true,
  darkMode: null,
  marketingOptIn: true,
};

export function customerRef(uid: string) {
  return doc(db, `customers/${uid}`);
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
    cpf: '',
    addresses: [],
    defaultAddressId: null,
    favorites: [],
    preferences: defaultPreferences,
    lastSupermarketId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(customerRef(uid), profile, { merge: true });
}

export async function updateCustomer(uid: string, partial: Partial<CustomerProfile>): Promise<void> {
  await updateDoc(customerRef(uid), { ...partial, updatedAt: serverTimestamp() });
}

/* ----------------------------- Addresses (RF03) ----------------------------- */

export async function saveAddress(
  uid: string,
  current: CustomerProfile,
  address: SavedAddress,
): Promise<void> {
  const exists = current.addresses?.some((a) => a.id === address.id);
  const addresses = exists
    ? current.addresses.map((a) => (a.id === address.id ? address : a))
    : [...(current.addresses || []), address];
  const defaultAddressId = current.defaultAddressId || address.id;
  await updateCustomer(uid, { addresses, defaultAddressId });
}

export async function removeAddress(uid: string, current: CustomerProfile, addressId: string): Promise<void> {
  const addresses = (current.addresses || []).filter((a) => a.id !== addressId);
  let defaultAddressId = current.defaultAddressId;
  if (defaultAddressId === addressId) defaultAddressId = addresses[0]?.id || null;
  await updateCustomer(uid, { addresses, defaultAddressId });
}

export async function setDefaultAddress(uid: string, addressId: string): Promise<void> {
  await updateCustomer(uid, { defaultAddressId: addressId });
}

/* ----------------------------- Favorites ----------------------------- */

export async function toggleFavorite(
  uid: string,
  current: CustomerProfile,
  productId: string,
): Promise<void> {
  const set = new Set(current.favorites || []);
  if (set.has(productId)) set.delete(productId);
  else set.add(productId);
  await updateCustomer(uid, { favorites: Array.from(set) });
}

/* ----------------------------- LGPD (RNF12) ----------------------------- */

/** Delete the customer's profile document (account data erasure). */
export async function deleteCustomerData(uid: string): Promise<void> {
  await deleteDoc(customerRef(uid));
}
