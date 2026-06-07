/**
 * Shared data model for the Nexmarket CUSTOMER app.
 *
 * These types mirror the SAME Firestore schema used by the manager app
 * (`nexmarket--loja`) and the driver app (`nexmarket--entregador`) so all three
 * apps read/write ONE integrated database (same Firebase project + named
 * Firestore database, see firebase-config.json).
 *
 * Collections (★ = written by this customer app):
 *   /supermarkets/{smId}                          -> Supermarket            (read)
 *   /supermarkets/{smId}/settings/storeInfo       -> StoreInfo / location   (read)
 *   /supermarkets/{smId}/deliveryConfig/main      -> DeliveryConfig         (read)
 *   /supermarkets/{smId}/categories/{catId}       -> Category (gôndola)     (read)
 *   /supermarkets/{smId}/products/{productId}     -> Product                (read)
 *   /supermarkets/{smId}/coupons/{code}           -> Coupon                 (read)
 *   /supermarkets/{smId}/orders/{orderId}       ★ -> Order                  (create + read own)
 *   /supermarkets/{smId}/orders/{id}/messages   ★ -> ChatMessage            (read + create)
 *   /customers/{uid}                            ★ -> CustomerProfile        (create/update own)
 *   /customers/{uid}/addresses/{addressId}      ★ -> Address                (own)
 *   /drivers/{uid}                                -> DriverProfile (public subset, read)
 *
 * See README "Integração & Schema" for the full contract and the Firestore
 * Security Rules that enforce this access model.
 */

/* ----------------------------- Geo ----------------------------- */

export interface GeoPoint {
  lat: number;
  lng: number;
  updatedAt?: any;
}

/* ----------------------------- Customer ----------------------------- */

export type AddressLabel = 'home' | 'work' | 'other';

export interface Address {
  id: string;
  label: AddressLabel;
  /** Free-text nickname overriding the label ("Casa da praia"). */
  title?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  reference?: string;
  lat?: number;
  lng?: number;
  isDefault?: boolean;
  createdAt?: any;
}

export interface CustomerPreferences {
  darkMode: boolean | null; // null -> follow system
  pushEnabled: boolean;
  emailMarketing: boolean;
}

export interface CustomerProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  photoUrl?: string;
  cpf?: string;
  defaultAddressId?: string | null;
  preferences: CustomerPreferences;
  /** Saved payment-method tokens ONLY (never raw card data — see RNF10). */
  paymentTokens?: SavedPaymentToken[];
  pushTokens?: string[];
  favorites?: string[]; // product ids
  birthDate?: string;
  createdAt?: any;
  updatedAt?: any;
}

/** A tokenized card returned by the payment provider (Stripe / MercadoPago / Pagar.me). */
export interface SavedPaymentToken {
  id: string;
  brand: string; // visa, master, elo...
  last4: string;
  holderName?: string;
  token: string; // provider token — NOT the PAN
  provider: 'stripe' | 'mercadopago' | 'pagarme';
}

/* ----------------------------- Store / catalog ----------------------------- */

/** White-label branding configured by the supermarket via GondolaAppBuilder. */
export interface Branding {
  primaryColor?: string; // hex, e.g. "#58CC02"
  primaryDark?: string;
  accentColor?: string;
  appName?: string;
  logoUrl?: string; // data: URI or https
  bannerUrl?: string;
  fontFamily?: string;
}

export interface Supermarket {
  id: string;
  name: string;
  logoUrl?: string;
  bannerUrl?: string;
  description?: string;
  branding?: Branding;
  location?: GeoPoint | null;
  address?: string;
  isOpen?: boolean;
  minOrder?: number;
  rating?: number;
  /** WhatsApp number (digits only) for support shortcut. */
  whatsapp?: string;
  active?: boolean;
}

export interface DeliveryConfig {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  baseFee: number;
  perKm: number;
  freeShippingMinimum?: number; // free shipping above this subtotal
  maxRadiusKm?: number;
  estimatedMinutes?: number;
  scheduleEnabled?: boolean;
  scheduleSlots?: string[]; // e.g. ["09:00-11:00", "11:00-13:00"]
}

export interface Category {
  id: string;
  name: string;
  imageUrl?: string;
  icon?: string;
  order?: number;
  /** True for curated "gôndola" rows shown on the home storefront. */
  featured?: boolean;
}

export interface NutritionFacts {
  servingSize?: string;
  calories?: string;
  table?: { label: string; value: string }[];
}

export interface Product {
  id: string;
  supermarketId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  images?: string[];
  price: number;
  /** Original price for strike-through when on promo. */
  originalPrice?: number;
  /** 0–100 discount percent; derived if absent. */
  discountPercent?: number;
  categoryId?: string;
  categoryName?: string;
  brand?: string;
  unit?: string; // "un", "kg", "500g", "garrafa 1L"...
  stock?: number;
  active?: boolean;
  tags?: string[]; // "vegano", "diet", "sem-gluten", "promocao"...
  barcode?: string;
  nutrition?: NutritionFacts;
  ageRestricted?: boolean; // alcohol / 18+
  /** Customization groups (e.g. cut type, ripeness, add-ons). */
  options?: ProductOptionGroup[];
  rating?: number;
  ratingCount?: number;
}

export interface ProductOptionGroup {
  id: string;
  name: string;
  required?: boolean;
  min?: number;
  max?: number; // max selectable choices; 1 = single select
  choices: ProductOptionChoice[];
}

export interface ProductOptionChoice {
  id: string;
  name: string;
  priceDelta?: number;
}

/* ----------------------------- Cart ----------------------------- */

export interface CartOption {
  groupId: string;
  groupName: string;
  choiceId: string;
  choiceName: string;
  priceDelta: number;
}

export interface CartItem {
  /** Unique line key (productId + serialized options). */
  key: string;
  productId: string;
  name: string;
  imageUrl?: string;
  unit?: string;
  price: number; // unit price incl. selected options
  basePrice: number;
  originalPrice?: number;
  quantity: number;
  options?: CartOption[];
  notes?: string;
  stock?: number;
  ageRestricted?: boolean;
}

/* ----------------------------- Coupons ----------------------------- */

export type CouponType = 'percent' | 'fixed' | 'free_shipping';

export interface Coupon {
  code: string;
  type: CouponType;
  value: number; // percent (0-100) or fixed amount in BRL
  minSubtotal?: number;
  maxDiscount?: number;
  firstOrderOnly?: boolean;
  active?: boolean;
  expiresAt?: any;
  description?: string;
}

/* ----------------------------- Orders ----------------------------- */

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  unit?: string;
  options?: CartOption[];
  notes?: string;
  // Filled in by the store during picking (read-only for customer):
  separated?: boolean;
  missing?: boolean;
  substituted?: boolean;
  substituteName?: string;
  substitutePrice?: number;
  /** Customer's response to a proposed substitution. */
  substitutionAccepted?: boolean | null;
}

export interface DeliveryAddress {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  reference?: string;
  lat?: number;
  lng?: number;
}

export type DeliveryMethod = 'delivery' | 'pickup';

export type PaymentMethod =
  | 'pix'
  | 'card_online'
  | 'card_delivery'
  | 'cash_delivery';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface PaymentInfo {
  method: PaymentMethod;
  status: PaymentStatus;
  provider?: 'stripe' | 'mercadopago' | 'pagarme';
  tokenId?: string;
  /** For PIX: copy-paste code + expiry. */
  pixCode?: string;
  pixExpiresAt?: any;
  changeFor?: number; // troco para (cash)
  paidAt?: any;
}

/** Store-facing order status (owned by the loja app). */
export type OrderStatus =
  | 'pending'
  | 'picking'
  | 'waiting_substitution'
  | 'ready'
  | 'delivered'
  | 'cancelled';

/** Granular delivery sub-status (owned by the driver app). */
export type DeliveryStatus =
  | 'awaiting_driver'
  | 'assigned'
  | 'going_to_store'
  | 'arrived_store'
  | 'picked_up'
  | 'going_to_customer'
  | 'delivered'
  | 'problem';

export interface ProofOfDelivery {
  signatureUrl?: string;
  photoUrl?: string;
  note?: string;
  receivedBy?: string;
}

export interface Order {
  id: string;
  supermarketId: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;

  status: OrderStatus;
  items: OrderItem[];

  subtotal: number;
  deliveryFee?: number;
  discount?: number;
  couponCode?: string;
  total: number;

  deliveryMethod: DeliveryMethod;
  deliveryAddress?: DeliveryAddress;
  scheduledFor?: string | null; // null = ASAP

  payment: PaymentInfo;

  // Delivery / driver fields (written by driver app, read here):
  deliveryStatus?: DeliveryStatus;
  driverId?: string;
  driverName?: string;
  driverLocation?: GeoPoint | null;
  driverEarnings?: number;
  acceptedAt?: any;
  pickedUpAt?: any;
  deliveredAt?: any;
  proofOfDelivery?: ProofOfDelivery;

  // Rating (written here after delivery):
  rating?: number;
  ratingComment?: string;
  deliveryRating?: number;
  ratedAt?: any;

  notes?: string;
  createdAt?: any;
  updatedAt?: any;

  // Joined client-side only:
  storeName?: string;
  storeLogoUrl?: string;
  storeLocation?: GeoPoint | null;
}

/* ----------------------------- Chat ----------------------------- */

export type ChatRole = 'driver' | 'customer' | 'store' | 'support';

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderRole: ChatRole;
  createdAt?: any;
}

/* ----------------------------- Driver (public read) ----------------------------- */

export interface DriverPublic {
  uid: string;
  name: string;
  photoUrl?: string;
  rating?: number;
  vehicle?: { type?: string; model?: string; plate?: string };
  location?: GeoPoint | null;
}
