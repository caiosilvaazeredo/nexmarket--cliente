# 🛒 Nexmarket Cliente

App do **cliente** da plataforma **Nexmarket**, no estilo *iFood / Uber Eats*,
**totalmente integrado** ao painel da loja (`nexmarket--loja`) e ao app do
entregador (`nexmarket--entregador`): os três compartilham o **mesmo projeto
Firebase e o mesmo banco Firestore**.

Construído na **mesma stack do app do entregador** — **Expo SDK 52 / React
Native 0.76 + TypeScript + expo-router + Firebase + Zustand** — reaproveitando a
identidade visual “Duolingo” (verde `#58CC02`, botões 3D, tipografia forte) e o
*kit* de UI. A marca é **white-label dinâmica**: cada supermercado re-skina o app
pelo GondolaAppBuilder (cor, nome e logo) sem rebuild (RNF01).

---

## ✨ Funcionalidades (mapa dos requisitos)

| RF | Funcionalidade | Onde |
|---|---|---|
| RF01 | Cadastro/login: e-mail, Google, Apple, Telefone (SMS) + visitante | `app/(auth)/*`, `src/lib/socialAuth.ts` |
| RF02 | Recuperação de senha | `app/(auth)/recovery.tsx` |
| RF03 | Catálogo de endereços (Casa, Trabalho…) | `app/address/*`, `src/lib/customers.ts` |
| RF04 | Auto-completar/validar por CEP ou GPS | `src/lib/cep.ts` |
| RF05 | Vitrine: gôndolas, categorias, destaques | `app/(tabs)/index.tsx` |
| RF06 | Busca global com *fuzzy search* (erros de digitação) | `src/lib/search.ts`, `app/(tabs)/search.tsx` |
| RF07 | Filtros (categoria, marca, preço, vegano, diet, promoção) | `app/(tabs)/search.tsx` |
| RF08 | Detalhe do produto (foto, unidade, descrição, tabela nutricional) | `app/product/[id].tsx` |
| RF09 | Preço “de/por” cortado + selo “% OFF” | `ProductCard`, `product/[id]` |
| RF10 | Adicionar/remover/alterar quantidade no carrinho | `src/lib/cart.ts`, `QuantityStepper` |
| RF11 | Subtotal dinâmico no rodapé/carrinho | `src/components/CartBar.tsx`, `app/cart.tsx` |
| RF12 | Cupom de desconto | `src/lib/coupons.ts` |
| RF13 | Frete automático + alerta de “frete grátis” | `src/lib/cart.ts (computeTotals)` |
| RF14 | Delivery ou Retirada na loja | `app/checkout.tsx` |
| RF15 | Pagamento: PIX, cartão online/na entrega, dinheiro | `app/checkout.tsx`, `src/lib/payments.ts` |
| RF16 | Agendamento de entrega | `app/checkout.tsx` |
| RF17 | Revisão final antes de confirmar | `app/checkout.tsx` (etapa 2) |
| RF18 | Histórico de pedidos | `app/(tabs)/orders.tsx` |
| RF19 | Repetir pedido (1 toque) | `src/lib/reorder.ts` |
| RF20 | Status em tempo real | `app/order/[id].tsx`, `OrderStatusTracker` |
| RF21 | Rastrear entregador no mapa | `app/order/[id].tsx` (react-native-maps) |
| RF22 | Push a cada mudança de status | `src/lib/notifications.ts` |
| RF23 | Avaliação 1–5★ + comentário (com motivos se nota baixa) | `app/rate/[id].tsx` |
| RF24 | FAQ / Suporte / WhatsApp / chat | `app/support.tsx`, `app/chat/[id].tsx` |

**Não funcionais:** white-label dinâmico (RNF01); botões “Adicionar” gigantes e
alto contraste (RNF02); checkout do cliente logado em **≤ 3 etapas** (RNF03);
imagens via CDN cacheadas no dispositivo (RNF05); **listeners em tempo real** de
estoque/preço/pedido (RNF06); Vite-livre — **Expo/React Native** nativo (RNF07);
auth + banco no **Firebase compartilhado** (RNF08); mapas Google/`expo-location`
(RNF09); **cartão nunca salvo** — tokenização no PSP (RNF10); *Security Rules*
restringindo escrita do cliente (RNF11, ver `docs/firestore.rules`); **LGPD** com
exclusão total de conta/dados (RNF12).

---

## 🧭 Jornada do cliente & fluxos alternativos

Todos os fluxos alternativos do brief estão implementados:

- **Modo visitante (guest):** o app entra automaticamente como anônimo — dá pra
  navegar e montar o carrinho sem conta. O *login firewall* só aparece ao
  **confirmar o pedido**; ao criar conta, a sessão anônima é **promovida com
  `linkWithCredential`**, preservando carrinho/endereços (mesmo `uid`).
- **Fora de cobertura / sem localização:** busca por CEP manual; retirada na loja
  como alternativa quando não há entrega.
- **Erro de digitação na busca:** *fuzzy search* + “Você quis dizer…”.
- **Esgotado:** card com selo “Esgotado” e botão vira “Avise-me quando chegar”.
- **Limite de estoque:** `+` trava no máximo com *haptic* e *toast*.
- **+18:** confirmação de idade antes de adicionar bebidas alcoólicas.
- **Carrinho offline:** persistido em `AsyncStorage` — sobrevive a quedas de rede
  e reinícios.
- **Mínimo não atingido / falta p/ frete grátis:** banners dinâmicos + carrossel
  “Leve também” (cross-sell).
- **Cupom inválido/condicionado:** mensagens específicas (primeira compra, valor
  mínimo, expirado).
- **PIX:** código copia-e-cola + expiração de 15 min.
- **Substituição de item:** card de aceitar/recusar na tela do pedido.
- **Pós-venda:** avaliação com captura de motivos quando a nota é baixa.

---

## 🔗 Integração com loja & entregador

> **Documentação completa:** [`docs/SCHEMA.md`](docs/SCHEMA.md) (coleções, contrato
> de catálogo, campos novos do pedido) e [`docs/firestore.rules`](docs/firestore.rules)
> (regras a publicar no projeto compartilhado).

Resumo das **mudanças de banco** introduzidas por este app:

| Mudança | Tipo | Ação necessária |
|---|---|---|
| `customers/{uid}` + `addresses` | ★ coleção nova | publicar Security Rules |
| `branding` em `supermarkets/{smId}` | campo novo | GondolaAppBuilder grava (RNF01) |
| `products` / `categories` / `coupons` | contrato de leitura | garantir os campos no loja |
| Campos novos no `Order` (pagamento, agendamento, método, opções) | aditivo/opcional | loja: webhook PIX → `payment.status='paid'`; escutar `substitutionAccepted` |
| Índice *collection-group* `orders` por `customerId` | índice | criar pelo link do console |

> ⚠️ As **Security Rules** são deployadas a partir do `nexmarket--loja` (dono das
> regras). Mescle o bloco de `docs/firestore.rules` lá **antes de ir a produção**.
> Nenhuma alteração de código nos outros dois apps é obrigatória — apenas as
> regras, o índice e (para o fluxo de substituição/PIX) os *hooks* já existentes.

---

## 🚀 Como rodar

Pré-requisitos: **Node 18+** e o app **Expo Go** (teste rápido) ou um **Dev
Build** (recomendado, por causa do mapa e do login social/SMS).

```bash
npm install
npx expo start          # abra no Expo Go (o mapa cai em placeholder)
```

### Modo demo (sem dados no Firebase)
Se o projeto Firebase ainda não tem lojas/produtos, o app entra em **modo demo**:
um catálogo de exemplo é carregado localmente e o pedido **simula** todo o ciclo
de status em tempo real (separação → pronto → a caminho → entregue). Ótimo para
ver a jornada completa de ponta a ponta sem configurar nada.

### Configuração para produção
1. **Mapa:** key do Google em `app.json` (`android.config.googleMaps.apiKey` e
   `ios.config.googleMapsApiKey`).
2. **Login social:** client IDs do Google em `app.json > extra.googleAuth`; Apple
   já habilitado via `expo-apple-authentication` (iOS). Para **SMS**, instale e
   configure `expo-firebase-recaptcha` (a tela detecta e orienta se faltar).
3. **Auth:** habilite no Firebase os provedores Anonymous, Email, Google, Apple
   e Phone.
4. **Security Rules + índices:** ver seção de integração acima.
5. **Pagamentos:** ligue `src/lib/payments.ts` ao SDK do seu PSP (Stripe /
   MercadoPago / Pagar.me) e o webhook de PIX no backend do loja.

---

## 🧱 Estrutura

```
app/                      # rotas (expo-router)
  (auth)/                 # login (e-mail/Google/Apple/SMS), cadastro, recuperação
  (tabs)/                 # início (vitrine), buscar, pedidos, perfil
  product/[id].tsx        # detalhe + opções + nutricional + +18
  category/[id].tsx       # listagem por categoria / promoções
  cart.tsx                # carrinho + cupom + cross-sell
  checkout.tsx            # entrega + pagamento + revisão (≤3 etapas)
  order/[id].tsx          # rastreio em tempo real + PIX + substituição + mapa
  address/                # catálogo de endereços (CEP/GPS)
  rate/[id].tsx           # avaliação 1–5★
  support.tsx             # FAQ + WhatsApp
  chat/[id].tsx           # chat do pedido
src/
  lib/                    # firebase, socialAuth, catalog, cart, orders, coupons,
                          # cep, payments, notifications, branding, search, types…
  components/             # ProductCard, CartBar, QuantityStepper, trackers, UI kit
  hooks/                  # useColors (white-label), useCatalog (listeners únicos)
  store/                  # estado global (zustand)
docs/                     # SCHEMA.md + firestore.rules (contrato de integração)
```

Stack: Expo SDK 52 · React Native 0.76 · expo-router · Firebase JS SDK · Zustand ·
react-native-maps · expo-location · expo-notifications · expo-auth-session ·
expo-apple-authentication · lucide-react-native.

`npm run lint` roda o type-check (`tsc --noEmit`).
