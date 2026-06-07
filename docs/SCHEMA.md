# Nexmarket — Esquema de Banco & Pontos de Integração

Este documento descreve o **contrato de dados compartilhado** entre os três apps
da plataforma (todos no **mesmo projeto Firebase + mesma base nomeada do
Firestore**, definidos em `firebase-config.json`):

| App | Repositório | Papel no banco |
|---|---|---|
| Painel do gerente | `nexmarket--loja` | **Dono** do catálogo, lojas, branding, cupons; dono das *Security Rules* |
| App do entregador | `nexmarket--entregador` | Dono dos `drivers` e do `deliveryStatus` dos pedidos |
| **App do cliente** | `nexmarket--cliente` (este) | Dono de `customers`, cria `orders`, lê catálogo |

> Os tipos canônicos vivem em `src/lib/types.ts`. Esta página resume as coleções
> e **destaca o que é novo / precisa ser ajustado nos outros repositórios**.

---

## Coleções

```
/customers/{uid}                              ★ NOVO  (CustomerProfile)
/customers/{uid}/addresses/{addressId}        ★ NOVO  (Address)

/supermarkets/{smId}                                   (Supermarket + branding)
/supermarkets/{smId}/settings/storeInfo                (localização/endereço da loja)
/supermarkets/{smId}/deliveryConfig/main               (DeliveryConfig)
/supermarkets/{smId}/categories/{catId}       ⚠ contrato (Category / gôndola)
/supermarkets/{smId}/products/{productId}     ⚠ contrato (Product)
/supermarkets/{smId}/coupons/{CODE}           ⚠ contrato (Coupon, id = código)
/supermarkets/{smId}/orders/{orderId}                  (Order — cliente cria)
/supermarkets/{smId}/orders/{id}/messages/{m}          (ChatMessage)

/drivers/{uid}                                         (leitura do subset público)
```

★ = criado por este app · ⚠ = **precisa existir/coincidir no `nexmarket--loja`**

---

## ★ Novo: `customers`

```ts
CustomerProfile {
  uid, name, email, phone, photoUrl?, cpf?,
  defaultAddressId?, preferences { darkMode, pushEnabled, emailMarketing },
  paymentTokens?: SavedPaymentToken[],   // SÓ tokens do PSP, nunca o cartão (RNF10)
  pushTokens?: string[],                  // Expo push tokens p/ RF22
  favorites?: string[],                   // ids de produtos
  createdAt, updatedAt
}
Address { id, label('home'|'work'|'other'), title?, cep?, street, number,
          complement?, neighborhood?, city?, state?, reference?, lat?, lng?,
          isDefault?, createdAt }
```

O painel do gerente pode (opcionalmente) ler `customers` para CRM. Nenhuma
alteração é **obrigatória** no loja para esta coleção além das Security Rules.

---

## ⚠ Contrato de catálogo (o `nexmarket--loja` precisa expor)

O app do cliente **lê** estas coleções. Os campos abaixo são o contrato; o
GondolaAppBuilder/painel deve gravá-los. Campos ausentes degradam com elegância
(ex.: sem `originalPrice` não há selo de promoção).

### `supermarkets/{smId}` — branding white-label (RNF01)
```ts
{
  name, logoUrl?, bannerUrl?, description?, active: true, isOpen?,
  minOrder?: number, whatsapp?: string, location?: {lat,lng}, address?,
  branding?: {                 // ← parametrizado pelo GondolaAppBuilder
    primaryColor?: "#RRGGBB",
    primaryDark?, accentColor?, appName?, logoUrl?, bannerUrl?, fontFamily?
  }
}
```
> Se `branding` não existir, o app lê `primaryColor`/`name`/`logoUrl` do nível
> raiz como *fallback*.

### `supermarkets/{smId}/categories/{catId}` (gôndolas — RF05)
```ts
{ name, imageUrl?, icon?, order?: number, featured?: boolean }
```
`featured: true` ⇒ a categoria vira uma “gôndola” horizontal na home.

### `supermarkets/{smId}/products/{productId}` (RF07–RF09)
```ts
{
  name, description?, imageUrl? | images?: string[], price: number,
  originalPrice?: number,            // preço “de” p/ selo de % OFF (RF09)
  discountPercent?: number,          // calculado se ausente
  categoryId?, categoryName?, brand?, unit?: "kg"|"un"|...,
  stock?: number, active: true,
  tags?: ["vegano"|"diet"|"promocao"|...],   // filtros RF07
  barcode?, nutrition?: { servingSize?, calories?, table?: [{label,value}] },
  ageRestricted?: boolean,           // bloqueio +18 (bebidas)
  options?: ProductOptionGroup[],    // customização (RF: opções)
  rating?, ratingCount?
}
```

### `supermarkets/{smId}/coupons/{CODE}` (RF12)
Doc id = código em MAIÚSCULAS.
```ts
{ type: "percent"|"fixed"|"free_shipping", value: number, minSubtotal?,
  maxDiscount?, firstOrderOnly?: boolean, active?: boolean, expiresAt?, description? }
```
> O app valida localmente para feedback instantâneo; **o loja deve revalidar no
> servidor** ao confirmar o pedido.

---

## Pedidos — campos novos gravados pelo cliente

O `Order` é compartilhado. Hoje o entregador/loja já usam `status`,
`deliveryStatus`, `items[]`, `total`, `deliveryAddress`, `customerId/Name/Phone`,
`deliveryFee`, `driver*`, `proofOfDelivery`, `rating`, `ratingComment`.

**Este app adiciona** os campos abaixo na criação (todos opcionais p/ quem lê):
```ts
subtotal, discount?, couponCode?,
deliveryMethod: "delivery"|"pickup",
scheduledFor?: string|null,                 // agendamento (RF16)
payment: { method, status, provider?, tokenId?, pixCode?, pixExpiresAt?, changeFor? },
items[].options?, items[].notes?, items[].substitutionAccepted?,  // resposta à substituição
deliveryRating?, ratedAt?,
storeName?/storeLogoUrl?/storeLocation?      // desnormalização p/ histórico
```

Ciclo de status (inalterado, agora **iniciado pelo cliente**):
```
cliente cria  → status: "pending"  (+ deliveryStatus: "awaiting_driver" se delivery)
loja          → "picking" → ("waiting_substitution") → "ready"
entregador    → going_to_store → arrived_store → picked_up → going_to_customer → delivered
loja/entregador→ status: "delivered"  |  qualquer um → "cancelled"
```

### ⚠ Ajuste recomendado no `nexmarket--loja`
1. **Fluxo de substituição:** quando faltar um item, o loja grava em
   `items[i]`: `{ missing: true, substituted: true, substituteName, substitutePrice }`
   e (opcional) `status: "waiting_substitution"`. O cliente responde gravando
   `items[i].substitutionAccepted = true|false` — **o loja deve escutar esse
   campo** para repor/estornar.
2. **Pagamento PIX/online:** o `payment.status` começa `"pending"`. O webhook do
   PSP (no loja/Functions) deve virar para `"paid"` e então liberar a separação.
3. **Índices Firestore:** a *collection-group query* `orders` por
   `customerId` (histórico do cliente) precisa de índice — o console sugere o
   link no primeiro uso.

---

## Endpoints externos (sem backend próprio)

| Função | Serviço | Chave? |
|---|---|---|
| Auto-completar endereço por CEP (RF04) | ViaCEP (`viacep.com.br`) | não |
| Geocodificação / GPS reverso (RF04, RNF09) | `expo-location` (Google quando há key) | opcional |
| Mapa de rastreio do entregador (RF21) | `react-native-maps` (Google) | `app.json` |
| Notificações push (RF22) | Expo Push / FCM-APNs | config nativa |
| Tokenização de pagamento (RNF10) | Stripe / MercadoPago / Pagar.me | conta do PSP |
| Login social (RF01) | Google / Apple | `app.json > extra.googleAuth` |

> **Pagamentos e push são *seams* prontos**: `src/lib/payments.ts` e
> `src/lib/notifications.ts` isolam a chamada ao provedor. Em
> desenvolvimento/preview tudo funciona com *stubs* e com o **modo demo** (ver
> README), sem tocar no banco.
