import { create } from 'zustand';
import type {
  CustomerProfile,
  Supermarket,
  Gondola,
  Product,
  Promotion,
  DeliveryConfig,
  StoreInfo,
  AppConfig,
  Order,
} from '../lib/types';
import { Brand, defaultBrand, resolveBrand } from '../lib/whitelabel';

interface AuthUser {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
}

interface AppState {
  authUser: AuthUser | null;
  authReady: boolean;
  customer: CustomerProfile | null;
  customerLoaded: boolean;

  supermarkets: Supermarket[];
  currentSmId: string | null;
  /** Primeiro snapshot do catálogo já chegou (controla skeletons na home). */
  catalogLoaded: boolean;

  supermarket: Supermarket | null;
  gondolas: Gondola[];
  products: Product[];
  promotions: Promotion[];
  deliveryConfig: DeliveryConfig | null;
  storeInfo: StoreInfo | null;
  appConfig: AppConfig | null;
  storefrontConfig: any | null;
  brand: Brand;

  myOrders: Order[];

  setAuthUser: (u: AuthUser | null) => void;
  setAuthReady: (v: boolean) => void;
  setCustomer: (c: CustomerProfile | null) => void;
  setCustomerLoaded: (v: boolean) => void;
  setSupermarkets: (s: Supermarket[]) => void;
  setCurrentSmId: (id: string | null) => void;
  setSupermarket: (s: Supermarket | null) => void;
  setGondolas: (g: Gondola[]) => void;
  setProducts: (p: Product[]) => void;
  setCatalogLoaded: (v: boolean) => void;
  setPromotions: (p: Promotion[]) => void;
  setDeliveryConfig: (c: DeliveryConfig | null) => void;
  setStoreInfo: (c: StoreInfo | null) => void;
  setAppConfig: (c: AppConfig | null) => void;
  setStorefrontConfig: (c: any | null) => void;
  setMyOrders: (o: Order[]) => void;
  resetStore: () => void;
}

function recomputeBrand(sm: Supermarket | null, appConfig: AppConfig | null): Brand {
  return resolveBrand(sm, appConfig);
}

export const useAppStore = create<AppState>((set, get) => ({
  authUser: null,
  authReady: false,
  customer: null,
  customerLoaded: false,

  supermarkets: [],
  currentSmId: null,
  catalogLoaded: false,

  supermarket: null,
  gondolas: [],
  products: [],
  promotions: [],
  deliveryConfig: null,
  storeInfo: null,
  appConfig: null,
  storefrontConfig: null,
  brand: defaultBrand,

  myOrders: [],

  setAuthUser: (authUser) => set({ authUser }),
  setAuthReady: (authReady) => set({ authReady }),
  setCustomer: (customer) => set({ customer }),
  setCustomerLoaded: (customerLoaded) => set({ customerLoaded }),
  setSupermarkets: (supermarkets) => set({ supermarkets }),
  setCurrentSmId: (currentSmId) => set({ currentSmId }),
  setSupermarket: (supermarket) => set({ supermarket, brand: recomputeBrand(supermarket, get().appConfig) }),
  setGondolas: (gondolas) => set({ gondolas }),
  setProducts: (products) => set({ products }),
  setCatalogLoaded: (catalogLoaded) => set({ catalogLoaded }),
  setPromotions: (promotions) => set({ promotions }),
  setDeliveryConfig: (deliveryConfig) => set({ deliveryConfig }),
  setStoreInfo: (storeInfo) => set({ storeInfo }),
  setAppConfig: (appConfig) => set({ appConfig, brand: recomputeBrand(get().supermarket, appConfig) }),
  setStorefrontConfig: (storefrontConfig) => set({ storefrontConfig }),
  setMyOrders: (myOrders) => set({ myOrders }),
  resetStore: () =>
    set({
      customer: null,
      customerLoaded: false,
      currentSmId: null,
      supermarket: null,
      gondolas: [],
      products: [],
      promotions: [],
      deliveryConfig: null,
      storeInfo: null,
      appConfig: null,
      storefrontConfig: null,
      brand: defaultBrand,
      myOrders: [],
    }),
}));

/** Active (in-progress) orders for the badge + home banner. */
export const selectActiveOrders = (s: AppState): Order[] =>
  s.myOrders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled' && o.deliveryStatus !== 'delivered',
  );
