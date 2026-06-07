import { create } from 'zustand';
import type {
  CustomerProfile,
  Supermarket,
  DeliveryConfig,
  CartItem,
  Order,
  Address,
  Branding,
} from '../lib/types';

interface AuthUser {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
}

interface AppState {
  /* ---- auth ---- */
  authUser: AuthUser | null;
  authReady: boolean;
  customer: CustomerProfile | null;
  customerLoaded: boolean;

  /* ---- store / branding ---- */
  supermarket: Supermarket | null;
  deliveryConfig: DeliveryConfig | null;
  branding: Branding | null;

  /* ---- addresses ---- */
  addresses: Address[];
  selectedAddressId: string | null;

  /* ---- cart ---- */
  cart: CartItem[];
  couponCode: string | null;

  /* ---- orders ---- */
  orders: Order[];

  setAuthUser: (u: AuthUser | null) => void;
  setAuthReady: (v: boolean) => void;
  setCustomer: (c: CustomerProfile | null) => void;
  setCustomerLoaded: (v: boolean) => void;
  setSupermarket: (s: Supermarket | null) => void;
  setDeliveryConfig: (d: DeliveryConfig | null) => void;
  setBranding: (b: Branding | null) => void;
  setAddresses: (a: Address[]) => void;
  setSelectedAddress: (id: string | null) => void;
  setCart: (items: CartItem[]) => void;
  setCoupon: (code: string | null) => void;
  setOrders: (o: Order[]) => void;
  reset: () => void;
}

export const useStore = create<AppState>((set) => ({
  authUser: null,
  authReady: false,
  customer: null,
  customerLoaded: false,

  supermarket: null,
  deliveryConfig: null,
  branding: null,

  addresses: [],
  selectedAddressId: null,

  cart: [],
  couponCode: null,

  orders: [],

  setAuthUser: (authUser) => set({ authUser }),
  setAuthReady: (authReady) => set({ authReady }),
  setCustomer: (customer) => set({ customer }),
  setCustomerLoaded: (customerLoaded) => set({ customerLoaded }),
  setSupermarket: (supermarket) => set({ supermarket }),
  setDeliveryConfig: (deliveryConfig) => set({ deliveryConfig }),
  setBranding: (branding) => set({ branding }),
  setAddresses: (addresses) => set({ addresses }),
  setSelectedAddress: (selectedAddressId) => set({ selectedAddressId }),
  setCart: (cart) => set({ cart }),
  setCoupon: (couponCode) => set({ couponCode }),
  setOrders: (orders) => set({ orders }),
  reset: () =>
    set({
      customer: null,
      customerLoaded: false,
      addresses: [],
      selectedAddressId: null,
      cart: [],
      couponCode: null,
      orders: [],
    }),
}));

/* --------------------------- selectors --------------------------- */

export const selectCartCount = (s: AppState) =>
  s.cart.reduce((n, i) => n + i.quantity, 0);

export const selectCartSubtotal = (s: AppState) =>
  s.cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

export const selectSelectedAddress = (s: AppState): Address | null => {
  if (!s.addresses.length) return null;
  return (
    s.addresses.find((a) => a.id === s.selectedAddressId) ||
    s.addresses.find((a) => a.isDefault) ||
    s.addresses[0]
  );
};

/** The single in-progress order (if any) for the home "track" banner. */
export const selectActiveOrder = (s: AppState): Order | null => {
  const active = s.orders.find(
    (o) =>
      o.status !== 'delivered' &&
      o.status !== 'cancelled' &&
      o.deliveryStatus !== 'delivered',
  );
  return active ?? null;
};
