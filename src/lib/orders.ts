import {
  collection,
  doc,
  addDoc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { isDemoMode } from './catalog';
import type {
  Order,
  OrderItem,
  CartItem,
  DeliveryMethod,
  PaymentMethod,
  DeliveryAddress,
  CustomerProfile,
} from './types';

/**
 * Customer-side order lifecycle (RF14–RF21).
 *
 * Orders are created at /supermarkets/{smId}/orders/{orderId} with
 * customerId == auth uid. The store app drives `status`
 * (pending → picking → ready → delivered) and the driver app drives
 * `deliveryStatus`. We listen in real-time for instant tracking (RF20).
 *
 * Security: customers may only create an order for their own uid and read
 * their own orders (RNF11) — enforced by Firestore rules in the loja repo.
 */

/* ----------------------------- Demo store ----------------------------- */

const demoOrders = new Map<string, Order>();
let demoListeners: ((o: Order[]) => void)[] = [];
function emitDemo() {
  const list = Array.from(demoOrders.values()).sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
  demoListeners.forEach((cb) => cb(list));
}

const ms = (ts: any): number => {
  if (!ts) return 0;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (typeof ts?.seconds === 'number') return ts.seconds * 1000;
  if (typeof ts === 'number') return ts;
  return 0;
};

/* ----------------------------- Build items ----------------------------- */

export function cartToOrderItems(cart: CartItem[]): OrderItem[] {
  return cart.map((i) => ({
    productId: i.productId,
    name: i.name,
    quantity: i.quantity,
    price: i.price,
    imageUrl: i.imageUrl,
    unit: i.unit,
    options: i.options,
    notes: i.notes,
    separated: false,
    missing: false,
    substituted: false,
    substitutionAccepted: null,
  }));
}

/* ----------------------------- Create (RF17) ----------------------------- */

export interface PlaceOrderInput {
  supermarketId: string;
  customer: CustomerProfile;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  couponCode?: string | null;
  deliveryMethod: DeliveryMethod;
  deliveryAddress?: DeliveryAddress;
  scheduledFor?: string | null;
  paymentMethod: PaymentMethod;
  paymentTokenId?: string;
  changeFor?: number;
  notes?: string;
  storeName?: string;
  storeLogoUrl?: string;
  storeLocation?: { lat: number; lng: number } | null;
}

export async function placeOrder(input: PlaceOrderInput): Promise<string> {
  const isDelivery = input.deliveryMethod === 'delivery';

  // Build payment block. Online methods start "pending" until confirmed; cash
  // and card-on-delivery are settled at hand-off. NO raw card data is ever
  // stored here — only a provider token id (RNF10).
  const online = input.paymentMethod === 'pix' || input.paymentMethod === 'card_online';
  const payment = {
    method: input.paymentMethod,
    status: 'pending' as const,
    provider: online ? ('mercadopago' as const) : undefined,
    tokenId: input.paymentTokenId || undefined,
    changeFor: input.changeFor,
    pixCode:
      input.paymentMethod === 'pix' ? generatePixCode(input.total) : undefined,
    pixExpiresAt:
      input.paymentMethod === 'pix' ? Date.now() + 15 * 60 * 1000 : undefined,
  };

  const order: Omit<Order, 'id'> = {
    supermarketId: input.supermarketId,
    customerId: input.customer.uid,
    customerName: input.customer.name,
    customerPhone: input.customer.phone,
    status: 'pending',
    items: cartToOrderItems(input.items),
    subtotal: input.subtotal,
    deliveryFee: input.deliveryFee,
    discount: input.discount,
    couponCode: input.couponCode || undefined,
    total: input.total,
    deliveryMethod: input.deliveryMethod,
    deliveryAddress: isDelivery ? input.deliveryAddress : undefined,
    // Delivery orders enter the driver pool the moment the store marks them
    // "ready"; pickup orders never get a deliveryStatus.
    deliveryStatus: isDelivery ? 'awaiting_driver' : undefined,
    scheduledFor: input.scheduledFor ?? null,
    payment,
    notes: input.notes,
    storeName: input.storeName,
    storeLogoUrl: input.storeLogoUrl,
    storeLocation: input.storeLocation ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (isDemoMode()) {
    const id = `demo-${Date.now()}`;
    const demo = { ...order, id, createdAt: Date.now(), updatedAt: Date.now() } as Order;
    demoOrders.set(id, demo);
    emitDemo();
    simulateDemoProgress(id);
    return id;
  }

  const ref = await addDoc(collection(db, `supermarkets/${input.supermarketId}/orders`), order as any);
  return ref.id;
}

/** Deterministic-ish fake PIX payload for demo/preview. Real PIX comes from the PSP. */
function generatePixCode(amount: number): string {
  const v = amount.toFixed(2);
  return `00020126BR.GOV.BCB.PIX5204000053039865802BR5913NEXMARKET6009SAO PAULO62070503***6304${v.replace('.', '')}`;
}

/* ----------------------------- Subscriptions (RF18, RF20) ----------------------------- */

export function subscribeMyOrders(uid: string, cb: (orders: Order[]) => void) {
  if (isDemoMode()) {
    demoListeners.push(cb);
    emitDemo();
    return () => {
      demoListeners = demoListeners.filter((l) => l !== cb);
    };
  }
  // Collection-group query across every store the customer ordered from.
  const q = query(
    // @ts-ignore collectionGroup typing via any to keep imports tidy
    require('firebase/firestore').collectionGroup(db, 'orders'),
    where('customerId', '==', uid),
  );
  return onSnapshot(
    q,
    (snap: any) => {
      const orders = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) } as Order));
      orders.sort((a: Order, b: Order) => ms(b.createdAt) - ms(a.createdAt));
      cb(orders);
    },
    (err: any) => {
      console.warn('subscribeMyOrders error', err);
      cb([]);
    },
  );
}

export function subscribeOrder(smId: string, orderId: string, cb: (o: Order | null) => void) {
  if (isDemoMode()) {
    const tick = () => cb(demoOrders.get(orderId) || null);
    demoListeners.push(() => tick());
    tick();
    return () => {};
  }
  return onSnapshot(
    doc(db, `supermarkets/${smId}/orders/${orderId}`),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Order) : null),
    (err) => {
      console.warn('subscribeOrder error', err);
      cb(null);
    },
  );
}

/* ----------------------------- Mutations ----------------------------- */

/** Cancel while still cancellable (before the store starts separating). */
export async function cancelOrder(order: Order): Promise<boolean> {
  if (order.status !== 'pending') return false;
  if (isDemoMode()) {
    const o = demoOrders.get(order.id);
    if (o) {
      o.status = 'cancelled';
      o.updatedAt = Date.now();
      emitDemo();
    }
    return true;
  }
  await updateDoc(doc(db, `supermarkets/${order.supermarketId}/orders/${order.id}`), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
  return true;
}

/** Respond to a store-proposed substitution (RF: substitution flow). */
export async function respondToSubstitution(
  order: Order,
  itemIndex: number,
  accepted: boolean,
): Promise<void> {
  const items = order.items.map((it, i) =>
    i === itemIndex ? { ...it, substitutionAccepted: accepted } : it,
  );
  if (isDemoMode()) {
    const o = demoOrders.get(order.id);
    if (o) {
      o.items = items;
      o.status = 'picking';
      o.updatedAt = Date.now();
      emitDemo();
    }
    return;
  }
  await updateDoc(doc(db, `supermarkets/${order.supermarketId}/orders/${order.id}`), {
    items,
    updatedAt: serverTimestamp(),
  });
}

/** Rate the order + delivery after completion (RF23). */
export async function rateOrder(
  order: Order,
  rating: number,
  deliveryRating: number,
  comment: string,
): Promise<void> {
  const patch = {
    rating,
    deliveryRating,
    ratingComment: comment.trim(),
    ratedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (isDemoMode()) {
    const o = demoOrders.get(order.id);
    if (o) Object.assign(o, { ...patch, ratedAt: Date.now() });
    emitDemo();
    return;
  }
  await updateDoc(doc(db, `supermarkets/${order.supermarketId}/orders/${order.id}`), patch);
}

/* ----------------------------- Demo progress simulation ----------------------------- */

/** In demo mode, advance the order through its lifecycle so tracking is alive. */
function simulateDemoProgress(id: string) {
  const steps: { delay: number; apply: (o: Order) => void }[] = [
    { delay: 4000, apply: (o) => (o.status = 'picking') },
    { delay: 9000, apply: (o) => { o.status = 'ready'; if (o.deliveryMethod === 'delivery') o.deliveryStatus = 'awaiting_driver'; } },
    { delay: 13000, apply: (o) => { if (o.deliveryMethod === 'delivery') { o.deliveryStatus = 'going_to_store'; o.driverName = 'Marcos'; o.driverId = 'demo-driver'; o.driverLocation = { lat: -22.905, lng: -43.18 }; } } },
    { delay: 18000, apply: (o) => { if (o.deliveryMethod === 'delivery') o.deliveryStatus = 'going_to_customer'; o.driverLocation = { lat: -22.907, lng: -43.175 }; } },
    { delay: 24000, apply: (o) => { o.status = 'delivered'; if (o.deliveryMethod === 'delivery') o.deliveryStatus = 'delivered'; o.deliveredAt = Date.now(); } },
  ];
  steps.forEach(({ delay, apply }) => {
    setTimeout(() => {
      const o = demoOrders.get(id);
      if (!o || o.status === 'cancelled') return;
      apply(o);
      o.updatedAt = Date.now();
      if (o.payment.method === 'pix' || o.payment.method === 'card_online') o.payment.status = 'paid';
      emitDemo();
    }, delay);
  });
}

/* ----------------------------- Status helpers ----------------------------- */

export const isFinished = (o: Order) =>
  o.status === 'delivered' || o.status === 'cancelled' || o.deliveryStatus === 'delivered';

export const canRate = (o: Order) =>
  (o.status === 'delivered' || o.deliveryStatus === 'delivered') && !o.rating;
