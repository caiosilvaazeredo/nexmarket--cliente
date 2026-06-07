/**
 * Bundled demo catalog used when the resolved store has no data yet (fresh
 * Firebase project / "test mode"). Lets the whole shopping journey be explored
 * end-to-end without writing to the protected catalog. Real stores override
 * all of this from Firestore. Images use a public CDN (cached on device, RNF05).
 */
import type {
  Supermarket,
  Category,
  Product,
  DeliveryConfig,
} from './types';

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&q=70`;

export const DEMO_STORE: Supermarket = {
  id: 'demo-store',
  name: 'Mercado Nexmarket',
  description: 'Tudo o que você precisa, na sua porta.',
  branding: {
    primaryColor: '#58CC02',
    appName: 'Nexmarket',
  },
  location: { lat: -22.9068, lng: -43.1729 },
  address: 'Av. das Gôndolas, 100 — Centro',
  isOpen: true,
  minOrder: 30,
  rating: 4.8,
  whatsapp: '5521999999999',
  active: true,
};

export const DEMO_DELIVERY: DeliveryConfig = {
  deliveryEnabled: true,
  pickupEnabled: true,
  baseFee: 6.9,
  perKm: 1.5,
  freeShippingMinimum: 80,
  maxRadiusKm: 12,
  estimatedMinutes: 40,
  scheduleEnabled: true,
  scheduleSlots: ['09:00-11:00', '11:00-13:00', '14:00-16:00', '16:00-18:00', '18:00-20:00'],
};

export const DEMO_CATEGORIES: Category[] = [
  { id: 'hortifruti', name: 'Hortifrúti', order: 1, featured: true, imageUrl: img('photo-1542838132-92c53300491e') },
  { id: 'bebidas', name: 'Bebidas', order: 2, featured: true, imageUrl: img('photo-1551024709-8f23befc6f87') },
  { id: 'padaria', name: 'Padaria', order: 3, featured: true, imageUrl: img('photo-1509440159596-0249088772ff') },
  { id: 'mercearia', name: 'Mercearia', order: 4, imageUrl: img('photo-1604719312566-8912e9227c6a') },
  { id: 'laticinios', name: 'Laticínios', order: 5, imageUrl: img('photo-1550583724-b2692b85b150') },
  { id: 'limpeza', name: 'Limpeza', order: 6, imageUrl: img('photo-1583947215259-38e31be8751f') },
];

export const DEMO_PRODUCTS: Product[] = [
  {
    id: 'p-tomate', supermarketId: 'demo-store', name: 'Tomate Italiano', categoryId: 'hortifruti',
    categoryName: 'Hortifrúti', brand: 'Hortifruti', unit: 'kg', price: 7.99, originalPrice: 9.99,
    stock: 40, active: true, tags: ['vegano', 'promocao'], imageUrl: img('photo-1546470427-e26264be0b0d'),
    description: 'Tomate italiano fresquinho, ideal para molhos e saladas.',
    nutrition: { servingSize: '100g', calories: '18 kcal', table: [{ label: 'Carboidratos', value: '3,9g' }, { label: 'Fibras', value: '1,2g' }] },
  },
  {
    id: 'p-banana', supermarketId: 'demo-store', name: 'Banana Prata', categoryId: 'hortifruti',
    categoryName: 'Hortifrúti', unit: 'kg', price: 5.49, stock: 60, active: true, tags: ['vegano'],
    imageUrl: img('photo-1571771894821-ce9b6c11b08e'), description: 'Banana prata madura, doce na medida.',
  },
  {
    id: 'p-alface', supermarketId: 'demo-store', name: 'Alface Crespa', categoryId: 'hortifruti',
    categoryName: 'Hortifrúti', unit: 'un', price: 3.29, stock: 25, active: true, tags: ['vegano', 'diet'],
    imageUrl: img('photo-1622206151226-18ca2c9ab4a1'),
  },
  {
    id: 'p-heineken', supermarketId: 'demo-store', name: 'Cerveja Heineken Long Neck 330ml', categoryId: 'bebidas',
    categoryName: 'Bebidas', brand: 'Heineken', unit: 'pack 6un', price: 32.9, originalPrice: 38.9,
    stock: 18, active: true, ageRestricted: true, tags: ['promocao'], imageUrl: img('photo-1618183479302-1e0aa382c36b'),
    description: 'Pack com 6 long necks gelados.',
  },
  {
    id: 'p-coca', supermarketId: 'demo-store', name: 'Refrigerante Coca-Cola 2L', categoryId: 'bebidas',
    categoryName: 'Bebidas', brand: 'Coca-Cola', unit: '2L', price: 9.99, stock: 50, active: true,
    imageUrl: img('photo-1629203851122-3726ecdf080e'),
  },
  {
    id: 'p-agua', supermarketId: 'demo-store', name: 'Água Mineral sem Gás 1,5L', categoryId: 'bebidas',
    categoryName: 'Bebidas', brand: 'Crystal', unit: '1,5L', price: 2.79, stock: 80, active: true, tags: ['diet'],
    imageUrl: img('photo-1616118132534-381148898bb4'),
  },
  {
    id: 'p-pao', supermarketId: 'demo-store', name: 'Pão Francês', categoryId: 'padaria',
    categoryName: 'Padaria', unit: 'kg', price: 14.9, stock: 30, active: true, imageUrl: img('photo-1509440159596-0249088772ff'),
    description: 'Assado na hora, crocante por fora e macio por dentro.',
    options: [
      { id: 'ponto', name: 'Ponto do pão', required: true, max: 1, choices: [
        { id: 'claro', name: 'Mais claro' }, { id: 'normal', name: 'No ponto' }, { id: 'tostado', name: 'Bem tostado' },
      ] },
    ],
  },
  {
    id: 'p-bolo', supermarketId: 'demo-store', name: 'Bolo de Cenoura com Chocolate', categoryId: 'padaria',
    categoryName: 'Padaria', unit: 'un 500g', price: 18.9, originalPrice: 22.9, stock: 8, active: true, tags: ['promocao'],
    imageUrl: img('photo-1578985545062-69928b1d9587'),
  },
  {
    id: 'p-arroz', supermarketId: 'demo-store', name: 'Arroz Branco Tipo 1 5kg', categoryId: 'mercearia',
    categoryName: 'Mercearia', brand: 'Tio João', unit: '5kg', price: 27.9, stock: 10, active: true, tags: ['vegano'],
    imageUrl: img('photo-1586201375761-83865001e31c'),
  },
  {
    id: 'p-feijao', supermarketId: 'demo-store', name: 'Feijão Carioca 1kg', categoryId: 'mercearia',
    categoryName: 'Mercearia', brand: 'Camil', unit: '1kg', price: 8.49, stock: 22, active: true, tags: ['vegano'],
    imageUrl: img('photo-1614961233913-a5113a4a34ed'),
  },
  {
    id: 'p-leite', supermarketId: 'demo-store', name: 'Leite Integral 1L', categoryId: 'laticinios',
    categoryName: 'Laticínios', brand: 'Itambé', unit: '1L', price: 5.29, stock: 35, active: true,
    imageUrl: img('photo-1550583724-b2692b85b150'),
  },
  {
    id: 'p-queijo', supermarketId: 'demo-store', name: 'Queijo Mussarela Fatiado 200g', categoryId: 'laticinios',
    categoryName: 'Laticínios', brand: 'Tirolez', unit: '200g', price: 12.9, stock: 0, active: true,
    imageUrl: img('photo-1486297678162-eb2a19b0a32d'), description: 'Fatias finas, ideal para sanduíches.',
  },
  {
    id: 'p-detergente', supermarketId: 'demo-store', name: 'Detergente Neutro 500ml', categoryId: 'limpeza',
    categoryName: 'Limpeza', brand: 'Ypê', unit: '500ml', price: 2.49, stock: 100, active: true,
    imageUrl: img('photo-1585421514738-01798e348b17'),
  },
  {
    id: 'p-sabao', supermarketId: 'demo-store', name: 'Sabão em Pó 1,6kg', categoryId: 'limpeza',
    categoryName: 'Limpeza', brand: 'Omo', unit: '1,6kg', price: 21.9, originalPrice: 25.9, stock: 14, active: true, tags: ['promocao'],
    imageUrl: img('photo-1610557892470-55d9e80c0bce'),
  },
];

export const DEMO_COUPONS = [
  { code: 'BEMVINDO', type: 'percent' as const, value: 15, minSubtotal: 40, firstOrderOnly: true, active: true, description: '15% OFF na primeira compra (mín. R$ 40).' },
  { code: 'FRETEGRATIS', type: 'free_shipping' as const, value: 0, minSubtotal: 50, active: true, description: 'Frete grátis acima de R$ 50.' },
  { code: 'NEX10', type: 'fixed' as const, value: 10, minSubtotal: 60, active: true, description: 'R$ 10 OFF acima de R$ 60.' },
];
