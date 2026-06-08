/**
 * Shared data model. These types mirror the Firestore schema used by the
 * Nexmarket (loja) + entregador apps so all three apps read/write the SAME
 * database.
 *
 * Collections (customer-relevant):
 *   /supermarkets/{smId}                          -> Supermarket (read-only)
 *   /supermarkets/{smId}/gondolas/{id}            -> Gondola (read-only)
 *   /supermarkets/{smId}/products/{id}            -> Product (read-only)
 *   /supermarkets/{smId}/promotions/{id}          -> Promotion (read-only)
 *   /supermarkets/{smId}/deliveryConfig/main      -> DeliveryConfig (read-only)
 *   /supermarkets/{smId}/settings/storeInfo       -> StoreInfo (read-only)
 *   /supermarkets/{smId}/storefront/{config|appConfig} -> StorefrontConfig (read-only)
 *   /supermarkets/{smId}/orders/{id}              -> Order (create + own read/update)
 *   /supermarkets/{smId}/orders/{id}/messages     -> ChatMessage
 *   /customers/{uid}                              -> CustomerProfile (own read/write)
 *   /drivers/{uid}                                -> DriverProfile (read for tracking)
 */

/* --------------------------- Catalog --------------------------- */

export interface Supermarket {
  id: string;
  name: string;
  ownerId?: string;
  themeColor?: string;
  logoUrl?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Gondola {
  id: string;
  supermarketId: string;
  name: string;
  iconName?: string;
  level?: number;
  colorTheme?: string;
  order: number;
}

export interface Product {
  id: string;
  supermarketId: string;
  gondolaId: string;
  name: string;
  price: number;
  imageUrl?: string;
  order?: number;
  ean?: string;
  active?: boolean;
  /** Optional descriptive fields the loja catalog may carry. */
  description?: string;
  unit?: string;
  brand?: string;
  subcategory?: string;
  /** Loja catalog writes `stockQuantity`; `stock` kept for backward compat. */
  stockQuantity?: number;
  stock?: number;
  tags?: string[]; // e.g. 'vegano', 'diet', 'sem-gluten'
  nutrition?: Record<string, string>;
  // Promotion fields stored on the product itself.
  inPromo?: boolean;
  promoPrice?: number;
  promoEndsAt?: any;
  lowestPrice30Days?: number;
  salesCount?: number;
}

export type PromotionTargetType = 'product' | 'subcategory' | 'category';
export type PromotionType = 'percentage' | 'fixed' | 'quantity' | 'free_shipping';

export interface Promotion {
  id: string;
  active?: boolean;
  targetType: PromotionTargetType;
  targetId: string;
  type: PromotionType;
  value: number;
  requiredQuantity?: number;
  title?: string;
  couponCode?: string;
  // Coupon-only constraints (honored by applyCoupon).
  minSubtotal?: number;
  maxDiscount?: number;
  firstOrderOnly?: boolean;
}

/* --------------------------- Store config --------------------------- */

export interface DeliveryConfig {
  deliveryType?: 'own' | 'grocify';
  shippingType?: 'transparent' | 'free_diluted';
  flatFeeValue?: number;
  minimumOrderValue?: number;
  pickerType?: 'employee' | 'driver';
}

export interface DayHours {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface PaymentMethods {
  pix?: boolean;
  creditCardDelivery?: boolean;
  debitCardDelivery?: boolean;
  creditCardOnline?: boolean;
  vouchers?: string[];
}

export interface StoreInfo {
  openingHours?: Record<string, DayHours>;
  paymentMethods?: PaymentMethods;
  storeLocation?: { address?: string; lat?: number | null; lng?: number | null };
}

/** White-label app config authored in the loja's GondolaAppBuilder (RNF01). */
export interface AppConfig {
  templateId?: string;
  shelfColor?: string;
  backgroundColor?: string;
  textColor?: string;
  showTags?: boolean;
  tagStyle?: 'modern' | 'classic' | 'minimal';
  gondolaSpacing?: 'tight' | 'medium' | 'relaxed';
  storeName?: string;
  accentColor?: string;
  fontFamily?: 'sans' | 'serif' | 'mono';
}

/* --------------------------- Customer --------------------------- */

export type AddressLabel = 'casa' | 'trabalho' | 'outro';

export interface SavedAddress {
  id: string;
  label: AddressLabel;
  nickname?: string;
  cep?: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  reference?: string;
  lat?: number;
  lng?: number;
}

export interface CustomerPreferences {
  pushEnabled: boolean;
  darkMode?: boolean | null;
  marketingOptIn: boolean;
}

export interface CustomerProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  cpf?: string;
  addresses: SavedAddress[];
  defaultAddressId?: string | null;
  favorites: string[]; // product ids
  preferences: CustomerPreferences;
  lastSupermarketId?: string | null;
  createdAt?: any;
  updatedAt?: any;
}

/* --------------------------- Orders --------------------------- */

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  unit?: string;
  separated?: boolean;
  missing?: boolean;
  substituted?: boolean;
  substituteName?: string;
  substitutePrice?: number;
  /** Customer's decision on a suggested substitution (cliente app). */
  customerDecision?: 'pending' | 'accepted' | 'rejected';
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

export interface GeoPoint {
  lat: number;
  lng: number;
  updatedAt?: any;
}

export type OrderStatus =
  | 'pending'
  | 'picking'
  | 'waiting_substitution'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export type DeliveryStatus =
  | 'awaiting_driver'
  | 'assigned'
  | 'going_to_store'
  | 'arrived_store'
  | 'picked_up'
  | 'going_to_customer'
  | 'delivered'
  | 'problem';

export type FulfillmentType = 'delivery' | 'pickup';
export type PaymentMethod =
  | 'pix'
  | 'card_online'
  | 'card_delivery'
  | 'cash_delivery'
  | 'voucher_delivery';

export interface Order {
  id: string;
  supermarketId: string;
  customerId: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;

  subtotal?: number;
  deliveryFee?: number;
  discount?: number;
  couponCode?: string;

  fulfillment?: FulfillmentType;
  paymentMethod?: PaymentMethod;
  paymentStatus?: 'pending' | 'paid' | 'failed';
  scheduledFor?: string | null;
  changeFor?: number | null;
  notes?: string;

  deliveryStatus?: DeliveryStatus;
  deliveryAddress?: DeliveryAddress;
  customerName?: string;
  customerPhone?: string;

  driverId?: string;
  driverName?: string;
  driverLocation?: GeoPoint | null;
  driverEarnings?: number;

  acceptedAt?: any;
  pickedUpAt?: any;
  deliveredAt?: any;
  proofOfDelivery?: {
    signatureUrl?: string;
    photoUrl?: string;
    note?: string;
    receivedBy?: string;
  };

  rating?: number;
  ratingComment?: string;
  ratingTags?: string[];
  ratingPhotoUrl?: string;

  createdAt?: any;
  updatedAt?: any;

  // Joined client-side only
  storeName?: string;
  storeLogoUrl?: string;
  storeLocation?: GeoPoint | null;
}

export type ChatRole = 'driver' | 'customer' | 'store' | 'support';

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderRole: ChatRole;
  createdAt?: any;
}

/** Public-facing driver info for live tracking. */
export interface PublicDriver {
  uid: string;
  name?: string;
  photoUrl?: string;
  rating?: number;
  vehicle?: { type?: string; model?: string; plate?: string };
  location?: GeoPoint | null;
}

/* --------------------------- Cart --------------------------- */

export interface CartLine {
  product: Product;
  quantity: number;
}
