import {
  collectionGroup,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import type {
  Order,
  OrderItem,
  DeliveryAddress,
  FulfillmentType,
  PaymentMethod,
  GeoPoint,
  PublicDriver,
} from './types';

/* ----------------------------- Store info cache ----------------------------- */

interface StoreInfo {
  name: string;
  logoUrl?: string;
  location?: GeoPoint | null;
}

const storeCache = new Map<string, StoreInfo>();

async function getStoreInfo(smId: string): Promise<StoreInfo> {
  if (storeCache.has(smId)) return storeCache.get(smId)!;
  const info: StoreInfo = { name: 'Loja' };
  try {
    const sm = await getDoc(doc(db, `supermarkets/${smId}`));
    if (sm.exists()) {
      const d = sm.data() as any;
      info.name = d.name || 'Loja';
      info.logoUrl = d.logoUrl;
    }
    const settings = await getDoc(doc(db, `supermarkets/${smId}/settings/storeInfo`));
    if (settings.exists()) {
      const s = settings.data() as any;
      const loc = s.storeLocation || {};
      if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        info.location = { lat: loc.lat, lng: loc.lng };
      }
    }
  } catch (e) {
    console.warn('getStoreInfo failed', e);
  }
  storeCache.set(smId, info);
  return info;
}

async function enrich(order: Order): Promise<Order> {
  const info = await getStoreInfo(order.supermarketId);
  return { ...order, storeName: info.name, storeLogoUrl: info.logoUrl, storeLocation: info.location ?? null };
}

const ms = (ts: any): number => {
  if (!ts) return 0;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (typeof ts?.seconds === 'number') return ts.seconds * 1000;
  if (typeof ts === 'number') return ts;
  return 0;
};

/* ----------------------------- Live queries ----------------------------- */

/** Every order that belongs to this customer (active + history) — RF18. */
export function subscribeMyOrders(uid: string, cb: (orders: Order[]) => void) {
  const q = query(collectionGroup(db, 'orders'), where('customerId', '==', uid));
  return onSnapshot(
    q,
    async (snap) => {
      const raw = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as Order);
      const enriched = await Promise.all(raw.map(enrich));
      enriched.sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
      cb(enriched);
    },
    (err) => {
      console.warn('subscribeMyOrders error', err);
      cb([]);
    },
  );
}

/** A single order in real time (status, driver location, substitutions). */
export function subscribeOrder(smId: string, orderId: string, cb: (o: Order | null) => void) {
  return onSnapshot(
    doc(db, `supermarkets/${smId}/orders/${orderId}`),
    async (d) => {
      if (!d.exists()) return cb(null);
      const enriched = await enrich({ id: d.id, ...(d.data() as any) } as Order);
      cb(enriched);
    },
    (err) => {
      console.warn('subscribeOrder error', err);
      cb(null);
    },
  );
}

/** Public driver info for live tracking (RF21). */
export function subscribeDriverPublic(uid: string, cb: (d: PublicDriver | null) => void) {
  return onSnapshot(
    doc(db, `drivers/${uid}`),
    (snap) => {
      if (!snap.exists()) return cb(null);
      const d = snap.data() as any;
      cb({
        uid,
        name: d.name,
        photoUrl: d.photoUrl,
        rating: d.rating,
        vehicle: d.vehicle,
        location: d.location ?? null,
      });
    },
    () => cb(null),
  );
}

/* ----------------------------- Status helpers ----------------------------- */

export const ACTIVE_ORDER_STATUSES: Order['status'][] = [
  'pending',
  'picking',
  'waiting_substitution',
  'ready',
];

export const isActiveOrder = (o: Order) =>
  ACTIVE_ORDER_STATUSES.includes(o.status) && o.deliveryStatus !== 'delivered';

export const isFinishedOrder = (o: Order) =>
  o.status === 'delivered' || o.status === 'cancelled' || o.deliveryStatus === 'delivered';

/** Whether an order is waiting for the customer to review substitutions. */
export const needsSubstitutionReview = (o: Order) =>
  o.status === 'waiting_substitution' &&
  (o.items || []).some((i) => (i.missing || i.substituted) && (!i.customerDecision || i.customerDecision === 'pending'));

/* ----------------------------- Mutations ----------------------------- */

export interface PlaceOrderInput {
  supermarketId: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  couponCode?: string;
  fulfillment: FulfillmentType;
  paymentMethod: PaymentMethod;
  customerName: string;
  customerPhone: string;
  deliveryAddress?: DeliveryAddress;
  scheduledFor?: string | null;
  changeFor?: number | null;
  notes?: string;
}

function genId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toUpperCase();
}

/**
 * Create an order tied to the authenticated customer's uid (RNF11). Pickup
 * orders skip the driver pool; delivery orders enter it once the store marks
 * the order "ready".
 */
export async function placeOrder(input: PlaceOrderInput): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('É necessário estar logado para finalizar o pedido.');

  const id = genId();
  const isDelivery = input.fulfillment === 'delivery';

  const payload: Record<string, any> = {
    supermarketId: input.supermarketId,
    customerId: uid,
    status: 'pending',
    items: input.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      imageUrl: i.imageUrl || '',
      unit: i.unit || '',
      separated: false,
      missing: false,
    })),
    subtotal: input.subtotal,
    deliveryFee: input.deliveryFee,
    discount: input.discount,
    total: input.total,
    couponCode: input.couponCode || '',
    fulfillment: input.fulfillment,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentMethod === 'pix' || input.paymentMethod === 'card_online' ? 'pending' : 'pending',
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    notes: input.notes || '',
    scheduledFor: input.scheduledFor || null,
    changeFor: input.changeFor ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (isDelivery) {
    payload.deliveryStatus = 'awaiting_driver';
    payload.deliveryAddress = input.deliveryAddress || {};
  }

  await setDoc(doc(db, `supermarkets/${input.supermarketId}/orders/${id}`), payload);
  return id;
}

/** Respond to the store's substitution suggestions (Fase 4 of the journey). */
export async function respondToSubstitutions(
  order: Order,
  decisions: Record<number, 'accepted' | 'rejected'>,
): Promise<void> {
  const items = order.items.map((it, idx) => {
    const decision = decisions[idx];
    if (!decision) return it;
    if (decision === 'rejected') {
      // Reject: drop the substitute, keep the item flagged missing & removed.
      return { ...it, substituted: false, missing: true, customerDecision: 'rejected' as const };
    }
    return { ...it, customerDecision: 'accepted' as const };
  });

  // Recompute total from accepted items (rejected missing items are refunded).
  const newSubtotal = items.reduce((acc, it) => {
    if (it.missing && it.customerDecision === 'rejected' && !it.substituted) return acc;
    const price = it.substituted && typeof it.substitutePrice === 'number' ? it.substitutePrice : it.price;
    return acc + price * it.quantity;
  }, 0);
  const total = newSubtotal + (order.deliveryFee || 0) - (order.discount || 0);

  await updateDoc(doc(db, `supermarkets/${order.supermarketId}/orders/${order.id}`), {
    items,
    total: Math.max(0, total),
    updatedAt: serverTimestamp(),
  });
}

/** Customer cancels an order while it is still cancellable. */
export async function cancelOrder(order: Order): Promise<void> {
  await updateDoc(doc(db, `supermarkets/${order.supermarketId}/orders/${order.id}`), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
}

/** Confirm an online/PIX payment (gateway-ready stub — RNF10). */
export async function markPaid(order: Order): Promise<void> {
  await updateDoc(doc(db, `supermarkets/${order.supermarketId}/orders/${order.id}`), {
    paymentStatus: 'paid',
    updatedAt: serverTimestamp(),
  });
}

export interface RatingInput {
  rating: number;
  comment?: string;
  tags?: string[];
  photoUrl?: string;
}

/** Rate a completed order (RF23). */
export async function rateOrder(order: Order, input: RatingInput): Promise<void> {
  await updateDoc(doc(db, `supermarkets/${order.supermarketId}/orders/${order.id}`), {
    rating: input.rating,
    ratingComment: input.comment || '',
    ratingTags: input.tags || [],
    ratingPhotoUrl: input.photoUrl || '',
    updatedAt: serverTimestamp(),
  });
}
