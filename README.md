# 🛒 Nexmarket Cliente

App do **cliente** da plataforma **Nexmarket**, no estilo *iFood / Uber Eats*,
**totalmente integrado** ao painel da loja (`nexmarket--loja`) e ao app do
entregador (`nexmarket--entregador`): os três compartilham o **mesmo projeto
Firebase e o mesmo banco Firestore** (RNF08).

Construído na **mesma stack do app do entregador** — **Expo SDK 52 / React
Native 0.76 + TypeScript + expo-router + Firebase 11 + Zustand** — reaproveitando
a identidade visual “Duolingo” (verde `#58CC02`, botões 3D, tipografia forte) e o
kit de UI. A marca é **white-label dinâmica**: cada supermercado re-skina o app
(cor, nome e logo) pelo **GondolaAppBuilder** do painel, sem rebuild (RNF01).

---

## 🚀 Como rodar

```bash
npm install
npm start        # Expo dev server  (a, i, w para Android/iOS/web)
npm run lint     # tsc --noEmit (checagem de tipos)
```

O Firebase já vem configurado em `firebase-config.json` (mesmo projeto da loja e
do entregador — comitado de propósito, como nos outros repos). Para o mapa de
rastreio e o login social, preencha `.env` a partir de `.env.example`
(`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`) e espelhe
em `app.json`.

---

## 🗺️ Jornada do cliente (fluxo feliz + alternativos)

| Fase | Implementação |
|---|---|
| **Descoberta / onboarding** | `app/store-picker.tsx` (escolha de loja, GPS/CEP, fora de área → retirada), branding aplicado via `whitelabel.ts`. Navegação livre **sem login** (guest); o login só é exigido no checkout. |
| **Navegação / gôndolas** | `app/(tabs)/index.tsx` (vitrine), `app/category/[id].tsx`, `app/(tabs)/search.tsx` (fuzzy + filtros), `app/product/[id].tsx`. Esgotado → “Avise-me”; limite de estoque → trava + háptico; carrinho persiste offline. |
| **Carrinho / checkout** | `app/cart.tsx` (cupom, frete, mínimo, cross-sell “leve também”) → `app/checkout.tsx` (≤3 etapas; entrega/retirada, pagamento, agendamento, revisão). |
| **Triagem / acompanhamento** | `app/order/[id].tsx` (status em tempo real, mapa do entregador, **revisão de substituição** com estorno, expiração de PIX + “tentar de novo”, cancelamento). Push a cada mudança de status. |
| **Pós-venda** | Avaliação 1–5 ★ + tags de problema + foto (nota baixa); **repetir pedido** em 1 toque revalidando estoque/preço. |

---

## ✅ Mapa dos requisitos

| RF | Funcionalidade | Onde |
|---|---|---|
| RF01 | Login: e-mail, Google, Apple, Telefone (SMS) + visitante | `app/(auth)/*`, `src/lib/firebase.ts`, `src/hooks/useGoogleAuth.ts` |
| RF02 | Recuperação de senha | `app/(auth)/recovery.tsx` |
| RF03 | Catálogo de endereços (Casa, Trabalho…) | `app/addresses.tsx`, `app/address-edit.tsx`, `src/lib/customers.ts` |
| RF04 | Auto-completar/validar por CEP ou GPS | `src/lib/cep.ts` (ViaCEP), `src/lib/location.ts` |
| RF05 | Vitrine: gôndolas, categorias, destaques | `app/(tabs)/index.tsx`, `app/category/[id].tsx` |
| RF06 | Busca global com *fuzzy search* | `src/lib/search.ts`, `app/(tabs)/search.tsx` |
| RF07 | Filtros (categoria, marca, preço, diet/vegano, promoção) | `app/(tabs)/search.tsx`, `src/lib/search.ts` |
| RF08 | Detalhe do produto (foto, unidade, descrição, tabela nutricional) | `app/product/[id].tsx` |
| RF09 | Preço “de/por” + selo “% OFF” | `src/lib/promotions.ts`, `ProductCard`, `product/[id]` |
| RF10 | Adicionar/remover/alterar quantidade | `src/store/useCartStore.ts`, `ProductCard` |
| RF11 | Subtotal dinâmico no rodapé | `src/components/CartBar.tsx`, `app/cart.tsx` |
| RF12 | Cupom de desconto | `src/lib/promotions.ts (applyCoupon)`, `app/cart.tsx` |
| RF13 | Frete automático + alerta de frete grátis / mínimo | `src/lib/storeHours.ts`, `app/cart.tsx` |
| RF14 | Delivery ou Retirada na loja | `app/checkout.tsx` |
| RF15 | Pagamento: PIX, cartão online/na entrega, dinheiro, vale | `app/checkout.tsx`, `src/lib/payments.ts` |
| RF16 | Agendamento de entrega | `app/checkout.tsx` |
| RF17 | Revisão final antes de confirmar | `app/checkout.tsx` (seção “Resumo”) |
| RF18 | Histórico de pedidos | `app/(tabs)/orders.tsx`, `src/lib/orders.ts` |
| RF19 | Repetir pedido (1 toque) | `src/lib/reorder.ts`, `src/hooks/useReorder.ts` |
| RF20 | Status em tempo real | `app/order/[id].tsx`, `src/components/OrderStatusTracker.tsx` |
| RF21 | Rastrear entregador no mapa | `app/order/[id].tsx`, `src/components/MapPanel.tsx` |
| RF22 | Notificações push a cada mudança de status | `app/_layout.tsx`, `src/lib/notifications.ts` |
| RF23 | Avaliação 1–5 ★ + comentário + tags/foto | `app/order/[id].tsx`, `src/components/StarRating.tsx` |
| RF24 | FAQ/Suporte + chat + WhatsApp | `app/support.tsx`, `app/chat/[id].tsx`, `src/lib/chat.ts` |

| RNF | Requisito | Como atendemos |
|---|---|---|
| RNF01 | White-label dinâmico | `src/lib/whitelabel.ts` lê `storefront/appConfig` (accentColor/storeName/fontFamily) + `themeColor`; aplicado em `useColors`. |
| RNF02 | App visual, botões “Adicionar” grandes | `src/components/ProductCard.tsx`, imagens grandes, gôndolas em carrossel. |
| RNF03 | Checkout ≤ 3 etapas | `app/checkout.tsx` em tela única para cliente logado. |
| RNF04 | Abertura/busca < 2s | Listeners em cache + busca em memória; imagens lazy. |
| RNF05 | Imagens otimizadas/cacheadas | `Image` nativo com cache; upload comprimido em `src/lib/images.ts`. |
| RNF06 | Tempo real (estoque/preço) | `onSnapshot` em todo o catálogo (`src/lib/catalog.ts`, `_layout`). |
| RNF07 | Stack nativa | Expo / React Native (igual ao entregador). |
| RNF08 | Firebase do Manager | `firebase-config.json` compartilhado; banco Firestore nomeado. |
| RNF09 | APIs de mapa | `react-native-maps` + Google Maps; geocoding via `expo-location`. |
| RNF10 | Sem dados de cartão no banco | `src/lib/payments.ts (tokenizeCard)` — só token; PAN/CVV nunca persistidos. |
| RNF11 | Regras de segurança | Cliente não edita catálogo; cria pedido só com o **próprio uid**; lê só os **próprios pedidos**. Regras em `nexmarket--loja/firestore.rules`. |
| RNF12 | LGPD — exclusão de conta/dados | `app/(tabs)/profile.tsx` → `deleteCustomerData` + `deleteCurrentAuthUser`. |

---

## 🔌 Integração com o banco compartilhado

Leitura (tempo real) de `/supermarkets/{id}`, `…/gondolas`, `…/products`,
`…/promotions`, `…/deliveryConfig/main`, `…/settings/storeInfo`,
`…/storefront/{appConfig,config}` e `/drivers/{uid}` (rastreio).

Escrita **somente** em `/customers/{uid}` (perfil/endereços/favoritos) e em
`/supermarkets/{id}/orders/{id}` (criação do próprio pedido + respostas de
substituição/avaliação/cancelamento/pagamento, sempre dentro da *allowlist* das
regras). O ciclo de status (`pending → picking → ready → delivered`) e o
`deliveryStatus` do entregador são consumidos exatamente como a loja/entregador
os escrevem.

> As **Firestore Security Rules** vivem no repositório `nexmarket--loja`
> (`firestore.rules`) e foram estendidas neste trabalho com a coleção
> `/customers/{uid}` e o endurecimento de leitura/escrita de pedidos (RNF11).

## 🧱 Arquitetura

- **Estado:** `src/store/useAppStore.ts` (auth, cliente, catálogo, marca,
  pedidos) e `src/store/useCartStore.ts` (carrinho persistido em AsyncStorage,
  escopado por loja).
- **Dados:** `src/lib/{catalog,orders,customers,promotions,chat,storeHours,
  cep,payments,reorder,search}.ts`.
- **UI:** `src/components/ui/*` (Screen/Button/Card/Input/Badge) + componentes
  de feature (ProductCard, CartBar, OrderStatusTracker, MapPanel, StarRating,
  EmptyState).
