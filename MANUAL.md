# 📘 Manual — Nexmarket Cliente (app de compras · Expo/React Native)

App do consumidor final: catálogo, carrinho, checkout com **pagamento online real via
Stripe** (cartão + PIX), acompanhamento do pedido em tempo real, chat e avaliações.

## 🧩 Integração com os outros sistemas

Os 4 apps usam o **mesmo projeto Firebase** (config em `firebase-config.json`):

- Pedidos criados aqui aparecem na **Loja** (separação) e no painel **Empresa**.
- Pagamentos online passam pelo **servidor de pagamentos** (repo `nexmarket--Empresa`,
  pasta `server/`) — o app nunca vê a chave secreta da Stripe.
- Entregas são feitas pelo app **Entregador**, com localização ao vivo no mapa.

## ▶️ Rodar localmente

Requisitos: **Node.js 18+**, npm e o app **Expo Go** no celular (ou emulador).

```bash
npm install
cp .env.example .env        # preencha (ver Pagamentos abaixo)
npm start                   # abre o Expo; escaneie o QR com o Expo Go
```

Atalhos: `npm run android` · `npm run ios` · `npm run web` · `npm run lint` (typecheck).

### Habilitar pagamentos reais (Stripe) em desenvolvimento

1. Suba o servidor de pagamentos (repo `nexmarket--Empresa`):
   ```bash
   cd ../nexmarket--Empresa/server && cp .env.example .env  # preencha as chaves
   npm install && npm start                                  # porta 8787
   ```
2. No `.env` deste app, aponte para ele **usando o IP da sua máquina** (o celular
   precisa alcançar o servidor):
   ```
   EXPO_PUBLIC_PAYMENTS_API_URL="http://192.168.0.10:8787"
   ```
   (ou um túnel: `ngrok http 8787` / `cloudflared tunnel --url http://localhost:8787`)
3. Reinicie o `npm start`. Sem essa variável o checkout roda em **modo demonstração**.

Cartão de teste Stripe: `4242 4242 4242 4242`, validade futura, CVV qualquer.
PIX exige ativação na conta Stripe (Dashboard → Settings → Payment methods → Pix);
sem ele o app oferece cartão automaticamente.

## 🏗️ Build (renderizar)

O projeto usa **Expo SDK 52** (managed). Para gerar binários use o **EAS Build**:

```bash
npm i -g eas-cli
eas login
eas build:configure

# Android (APK de teste)
eas build -p android --profile preview
# Android (AAB para a Play Store)
eas build -p android --profile production
# iOS (precisa de conta Apple Developer)
eas build -p ios --profile production
```

> As variáveis `EXPO_PUBLIC_*` são embutidas no build — configure-as também em
> `eas.json` (env por perfil) ou via `eas secret:create`.

Versão web (opcional): `npx expo export -p web` gera `dist/` estático.

## 🚀 Publicar

1. **Lojas de aplicativos**: `eas submit -p android` / `eas submit -p ios`
   (exige contas Google Play Console / App Store Connect).
2. **Atualizações OTA** (sem passar pela loja, para mudanças JS):
   ```bash
   eas update --branch production --message "ajustes"
   ```
3. **Web** (se exportado): hospede `dist/` no Firebase Hosting / Vercel / Netlify.

Antes de publicar em produção:
- Troque `EXPO_PUBLIC_PAYMENTS_API_URL` para a URL pública do servidor (https).
- Configure a Google Maps API key (`.env` + `app.json`) para o mapa Android.
- Faça o deploy das `firestore.rules` (repo `nexmarket--Empresa`).

## 💳 Como o pagamento funciona neste app

| Método | Fluxo |
|---|---|
| PIX | o servidor cria a cobrança na Stripe → app mostra **QR code real + copia-e-cola** → confirmação automática (polling + webhook) |
| Cartão online | abre o **Stripe Checkout** no navegador (página segura da Stripe) → ao voltar, o app confirma o status |
| **Cartão salvo (1 toque)** | marque "Salvar cartão" no primeiro pagamento; depois pague direto no app sem redigitar (fallback 3DS → Checkout) |
| **Apple Pay / Google Pay** | botão nativo dentro do app (dev build) e automático na página do Stripe Checkout |
| **PicPay** | QR + abrir no app do PicPay, confirmação automática (aparece quando a plataforma configura o token) |
| **NuPay (Nubank)** | pagar pelo app do Nubank (aparece quando a plataforma conclui o credenciamento) |
| **Saldo da carteira** | cashback acumulado vira desconto no checkout (pode cobrir o pedido inteiro) |
| Cartão/dinheiro/vale na entrega | sem cobrança online; a loja recebe na entrega |

- Nenhum dado de cartão passa pelo app ou pelo Firestore (RNF10 / PCI-DSS) —
  cartões salvos ficam no **Stripe Customer**; gerencie-os no Perfil.
- Pedido online só entra em separação na loja **depois de pago**.
- Estornos feitos pelo painel Empresa aparecem na tela do pedido ("Pagamento estornado").

## ✨ Outras funcionalidades (ver ROADMAP.md no repo Empresa)

- **Gorjeta ao entregador** no checkout e pós-entrega (100% vai para ele).
- **Reembolso self-service**: entregou com item errado/faltando? "Problema com
  algum item?" na tela do pedido → estorno parcial automático até o teto.
- **PIN de entrega**: código de 4 dígitos exibido no pedido; informe ao
  entregador (anti-fraude).
- **Busca em todas as lojas**: aba Buscar → "🌎 Em todas as lojas" compara
  preços por item e permite trocar de loja.
- **Recomendações**: "Compre de novo", "Mais vendidos" e vitrine por horário.
- **Cashback**: % definido pela plataforma cai na carteira a cada entrega.
- **Push transacional**: requer projectId EAS (`eas build:configure`); sem ele
  o app usa apenas notificações locais.

## 🍎🤖 Apple Pay e Google Pay

Dois caminhos, ambos já integrados:

1. **Página do Stripe Checkout (funciona hoje, inclusive no Expo Go):** as
   carteiras já estão ativas na configuração da conta Stripe e aparecem
   automaticamente na página segura quando o aparelho suporta (Safari/iPhone →
   Apple Pay; Chrome/Android com GPay → Google Pay).
2. **Botão nativo dentro do app** (`@stripe/stripe-react-native`, já instalado
   e configurado no `app.json`):
   - Requer **dev build** — o módulo é nativo e não existe no Expo Go
     (o app detecta e simplesmente esconde o botão):
     ```bash
     npx expo prebuild            # ou: eas build --profile development
     npx expo run:android         # / run:ios
     ```
   - **Google Pay**: funciona em teste com `testEnv` (cartão de teste na conta
     Google do aparelho). Em produção, ative o Google Pay no dashboard Stripe.
   - **Apple Pay**: crie o Merchant ID `merchant.com.nexmarket.cliente` no
     Apple Developer, habilite a capability *Apple Pay* no app e registre o
     merchant no dashboard Stripe (Settings → Payment methods → Apple Pay).
     Depois só rebuildar.
   - O botão "Pagar com Apple Pay/Google Pay" aparece na folha de pagamento do
     cartão quando o aparelho suporta; a cobrança usa um PaymentIntent criado
     pelo servidor (`/api/payments/payment-intent`) e confirmado pela folha
     nativa da carteira — nenhum dado de cartão passa pelo app.

## 🆘 Problemas comuns

| Sintoma | Correção |
|---|---|
| Checkout em "modo demonstração" | preencha `EXPO_PUBLIC_PAYMENTS_API_URL` e reinicie o Expo |
| "Não foi possível gerar o PIX" | ative o Pix na conta Stripe ou pague com cartão |
| Pagamento não confirma após o cartão | toque em "Verificar pagamento"; confira o webhook no servidor |
| Servidor inacessível no celular físico | use o IP da máquina (não `localhost`) ou um túnel |
