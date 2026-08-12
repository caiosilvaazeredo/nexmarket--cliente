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
| **Descoberta** | `lib/screens/store_picker.dart` — escolha da loja com **busca por nome e filtros** (abertos agora, frete grátis) e **ordenação por distância** (GPS), menor frete ou A–Z. Cada card mostra **status (aberto/fechado), horário de hoje, endereço, distância e frete**; mercados **sem produtos cadastrados não aparecem**. Navegação **livre sem login** (o login só é exigido no checkout). |
| **Vitrine / gôndolas** | `home_screen.dart` (carrosséis por gôndola + card de **horário/endereço da loja**, que abre a semana inteira e o mapa), `category_screen.dart`, `search_screen.dart` (busca tolerante + filtros), `product_screen.dart` (descrição, tabela nutricional, tags). |
| **Carrinho / checkout** | `cart_screen.dart` (cupom, frete, pedido mínimo) → `checkout_screen.dart` (entrega/retirada, pagamento, agendamento, gorjeta, revisão — tela única). |
| **Acompanhamento** | `order_screen.dart` — status em tempo real, rastreio do entregador, PIN de entrega, **revisão de substituições** com estorno, cancelamento, chat. |
| **Pós-venda** | Avaliação 1–5★ + tags de problema; **repetir pedido** em 1 toque revalidando estoque/preço. |
| **Perfil** | `profile_screen.dart` — dados pessoais (nome/telefone/CPF), endereços, **formas de pagamento** (cartões salvos + PIX/dinheiro/vale, com padrão que já vem marcado no checkout), favoritos, cupons da loja, notificações e exclusão de conta (LGPD). |

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

### 💳 Cartões salvos e RNF10

O cadastro de cartão (`lib/screens/payment_methods_screen.dart`) valida o
número por **Luhn** e detecta a bandeira **no dispositivo**
(`lib/services/cards.dart`); o que é persistido em `/customers/{uid}.cards` é
apenas **bandeira, últimos 4 dígitos, validade e apelido**. O número completo
(PAN) e o CVV nunca são gravados — nem no Firestore, nem em cache local. O
pedido leva só `paymentCard: {brand, last4}` para a loja exibir.

Para cobrança online real, plugue o SDK do gateway (ex.: Stripe) no lugar do
formulário: o PAN vai direto para o SDK e o token retornado preenche o campo
`token` de `SavedCard`, que já existe no modelo.

---

## 👤 Conta única na plataforma

O mesmo e-mail é **uma só pessoa** nos quatro apps da Nexmarket. Após o
cadastro e o login, o app chama `POST /api/identity/claim` no servidor
(`nexmarket--Empresa/server`) registrando o papel `cliente` — assim quem já é
entregador, por exemplo, entra como cliente com o **mesmo uid**, sem criar
conta paralela. A recuperação de senha também passa pelo servidor, e a nova
senha vale para todos os apps.

Configure a URL do servidor no build:

```bash
flutter run   --dart-define=NEXMARKET_API=https://pagamentos.seudominio.com
flutter build apk --dart-define=NEXMARKET_API=https://pagamentos.seudominio.com
```

Sem essa variável o app continua funcionando normalmente (login pelo Firebase
Auth nativo), apenas sem o registro de papéis e sem o e-mail personalizado.

---

## 👤 Conta única na plataforma

O mesmo e-mail é **uma só pessoa** nos quatro apps. Após cadastro e login o
app chama `POST /api/identity/claim` registrando o papel `entregador` — quem
já é cliente vira entregador com o **mesmo uid**, sem conta paralela. A
recuperação de senha passa pelo servidor e a nova senha vale para todos os
apps.

```bash
flutter run   --dart-define=NEXMARKET_API=https://pagamentos.seudominio.com
flutter build apk --dart-define=NEXMARKET_API=https://pagamentos.seudominio.com
```

---

## 🌐 Publicar na web (Render)

O mesmo código do APK roda no navegador. É a forma mais rápida de colocar o
app na mão das pessoas sem esperar revisão da Play Store — e, como o Flutter
web gera um PWA, o cliente pode **instalar na tela inicial** do celular
(Chrome: "Adicionar à tela inicial"; Safari: Compartilhar → "Adicionar à Tela
de Início"). O APK continua valendo para a distribuição nativa.

O repositório traz um `render.yaml` pronto:

1. No Render: **New → Blueprint** e aponte para este repositório.
2. Escolha a branch onde está o `render.yaml`
   (`claude/flutter-client-delivery-apps-m8lmbw`, ou `main` depois do merge).
3. Preencha a variável `NEXMARKET_API` com a URL do servidor de pagamentos
   (o serviço `nexmarket-payments`, do repositório `nexmarket--Empresa`).
   Ela fica em branco no Blueprint de propósito.

O build usa `scripts/render-build.sh`, que baixa o SDK do Flutter, compila em
release e copia o CanvasKit para dentro do site — assim a página abre mesmo em
redes onde o CDN do Google é bloqueado.

### Diferenças da web para o APK

| | Web (PWA) | APK |
|---|---|---|
| Instalação | link, sem loja | arquivo / Play Store |
| Atualização | automática no reload | reinstalar |
| Notificação push | depende do navegador (iOS só ≥ 16.4, instalado) | nativa |
| GPS em segundo plano | não | sim |

Para o **cliente** isso não atrapalha: o acompanhamento do pedido acontece com
o app aberto.

---

## 📍 Coordenadas do endereço de entrega

Ao salvar um endereço o app tenta obter o ponto no mapa, e mostra na tela se
conseguiu. Duas formas, porque nenhuma serve sempre:

- **Buscar pelo endereço** — geocodificação pelo Nominatim (OpenStreetMap).
  Funciona de qualquer lugar, mas erra quando o nome da rua se repete na
  cidade. É o que roda automaticamente ao salvar, se ainda não houver ponto.
- **Estou aqui agora** — GPS do aparelho. Exato, mas só vale se a pessoa
  estiver no endereço; por isso não é automático.

Sem coordenadas, o pedido chega ao entregador só com o texto: o mapa da
entrega fica sem destino e o Waze/Google Maps precisa adivinhar a rua. Falhar
a busca **não impede salvar** — o endereço escrito continua valendo.

O Nominatim é gratuito, mas pede no máximo 1 consulta por segundo e proíbe
geocodificação em massa (`lib/services/geocoding.dart` respeita o intervalo e
se identifica). O uso aqui cabe: uma consulta ao salvar um endereço, não por
pedido. Se a operação crescer, troque a URL por um provedor contratado — o
resto do código não muda.
