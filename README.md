# 🛒 Nexmarket Cliente (Flutter)

App do **cliente** da plataforma **Nexmarket**, no estilo *iFood / Uber Eats*,
**reescrito em Flutter** e totalmente integrado ao painel da loja
(`nexmarket--loja`) e ao app do entregador (`nexmarket--entregador`): os três
compartilham o **mesmo projeto Firebase e o mesmo banco Firestore (nomeado)**.

Identidade visual "Duolingo" (verde `#58CC02`, botões grandes, tipografia
forte) com **white-label dinâmico**: a cor, o nome e o logo vêm do
`storefront/appConfig` publicado pelo GondolaAppBuilder do painel — sem
rebuild.

---

## 🚀 Como rodar

Pré-requisitos: **Flutter 3.32+** (`flutter doctor` sem erros) e um emulador
Android ou dispositivo físico.

```bash
flutter pub get
flutter run          # escolha o dispositivo (a para Android)
```

Não precisa de `google-services.json`: a configuração do Firebase é passada em
código (`lib/firebase_options.dart`), com os mesmos valores dos outros repos,
incluindo o **banco Firestore nomeado** — o app conecta direto no banco
compartilhado da plataforma.

```bash
flutter analyze      # checagem estática (sem erros)
flutter build apk    # build de produção Android
flutter build ipa    # build iOS (requer macOS/Xcode)
```

---

## 🗺️ Jornada do cliente

| Fase | Implementação |
|---|---|
| **Descoberta** | `lib/screens/store_picker.dart` — escolha da loja; navegação **livre sem login** (o login só é exigido no checkout). |
| **Vitrine / gôndolas** | `home_screen.dart` (carrosséis por gôndola), `category_screen.dart`, `search_screen.dart` (busca tolerante + filtros), `product_screen.dart` (descrição, tabela nutricional, tags). |
| **Carrinho / checkout** | `cart_screen.dart` (cupom, frete, pedido mínimo) → `checkout_screen.dart` (entrega/retirada, pagamento, agendamento, gorjeta, revisão — tela única). |
| **Acompanhamento** | `order_screen.dart` — status em tempo real, rastreio do entregador, PIN de entrega, **revisão de substituições** com estorno, cancelamento, chat. |
| **Pós-venda** | Avaliação 1–5★ + tags de problema; **repetir pedido** em 1 toque revalidando estoque/preço. |

## 🧱 Arquitetura

```
lib/
  firebase_options.dart      # config Firebase + id do banco nomeado
  models.dart                # schema Firestore compartilhado
  theme.dart                 # tema white-label + formatação R$
  services/
    fire.dart                # init Firebase / Firestore nomeado
    catalog_repo.dart        # supermercados, gôndolas, produtos, promos (tempo real)
    pricing.dart             # motor de preços idêntico ao da loja + cupons
    orders_repo.dart         # criar pedido, substituições, avaliação, cancelamento
    customers_repo.dart      # perfil /customers/{uid}, endereços, ViaCEP, LGPD
    chat_repo.dart           # chat do pedido
  state/
    app_state.dart           # auth + loja + catálogo + pedidos (Provider)
    cart_state.dart          # carrinho persistido offline por loja
  screens/                   # store_picker, auth, tabs, cart, checkout, order…
  widgets/common.dart        # ProductCard, CartBar, StarRating, EmptyState…
```

- **Preços**: `services/pricing.dart` replica o motor do storefront web
  (promo de produto, regras por produto/subcategoria/categoria, "leve X por
  Y", cupons com mínimo/limite/primeira compra) — os apps calculam valores
  idênticos ao painel.
- **Pedidos**: o payload de `placeOrder` é o mesmo do app Expo anterior
  (`deliveryStatus: awaiting_driver`, `deliveryPin`, gorjeta etc.), então
  loja e entregador continuam funcionando sem nenhuma mudança.
- **Carrinho** persiste offline via `shared_preferences`, escopado por loja,
  com trava de limite de estoque.

## ⚙️ Observações

- **Mapa**: o rastreio mostra o entregador (nome, veículo, avaliação) e abre o
  Google Maps com a posição ao vivo em 1 toque. Para mapa embutido, adicione
  `google_maps_flutter` + API key.
- **Login social (Google/Apple/SMS)**: a base usa e-mail/senha; os pacotes
  `google_sign_in` / `sign_in_with_apple` podem ser plugados em
  `lib/screens/auth.dart`.
- **Security Rules**: continuam no repositório `nexmarket--loja`
  (`firestore.rules`).

---

## 🧪 Testes e builds

```bash
flutter test         # 34 testes: preços/cupons, carrinho, modelos e a
                     # jornada completa do pedido (Firestore fake em memória)
flutter analyze      # 0 issues
flutter build apk    # APK release Android
flutter build web    # versão para navegador (teste com: python3 -m http.server -d build/web)
```

O build web usa **CanvasKit e fontes auto-hospedados** (copie
`$FLUTTER_SDK/bin/cache/flutter_web_sdk/canvaskit` para `build/web/canvaskit`
se fizer deploy — ou rode o script abaixo) e o app mostra uma tela de
"tentar novamente" quando não há conexão, em vez de tela branca.

```bash
flutter build web --release && cp -r "$(dirname "$(which flutter)")/cache/flutter_web_sdk/canvaskit" build/web/canvaskit
```

Os testes de jornada (`test/journey_test.dart`) simulam as escritas do painel
da loja e do entregador exatamente como os outros sistemas fazem, validando o
contrato do banco compartilhado: criação do pedido, separação, substituições
com estorno, entrega com PIN, avaliação e cancelamento.
