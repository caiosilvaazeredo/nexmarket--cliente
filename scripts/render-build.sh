#!/usr/bin/env bash
#
# Build do app Flutter para a web no Render.
#
# O ambiente de build do Render não tem Flutter, então baixamos o SDK aqui
# (tarball — bem mais rápido que clonar o repositório do Flutter). Quando o
# cache do Render preserva $HOME entre builds, o download é pulado.
#
# Variáveis usadas (defina no dashboard do Render):
#   NEXMARKET_API   URL do servidor de identidade/pagamentos. Sem ela o app
#                   ainda funciona, só não registra papéis nem usa o e-mail
#                   personalizado.
#   FLUTTER_VERSION versão do SDK (padrão abaixo).
set -euo pipefail

FLUTTER_VERSION="${FLUTTER_VERSION:-3.32.5}"
FLUTTER_DIR="${FLUTTER_DIR:-$HOME/flutter}"
NEXMARKET_API="${NEXMARKET_API:-}"

echo "▸ Flutter $FLUTTER_VERSION"

if [ ! -x "$FLUTTER_DIR/bin/flutter" ]; then
  echo "▸ Baixando o SDK…"
  rm -rf "$FLUTTER_DIR"
  mkdir -p "$(dirname "$FLUTTER_DIR")"
  curl -fsSL \
    "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION}-stable.tar.xz" \
    | tar -xJ -C "$(dirname "$FLUTTER_DIR")"
else
  echo "▸ SDK já em cache — pulando download."
fi

export PATH="$FLUTTER_DIR/bin:$PATH"
# O Render roda o build como root; sem isto o git recusa o diretório do SDK.
git config --global --add safe.directory "$FLUTTER_DIR" || true
flutter config --no-analytics >/dev/null 2>&1 || true
flutter --version

echo "▸ Dependências…"
flutter pub get

echo "▸ Compilando para a web…"
if [ -n "$NEXMARKET_API" ]; then
  echo "  API: $NEXMARKET_API"
  flutter build web --release --dart-define=NEXMARKET_API="$NEXMARKET_API"
else
  echo "  ⚠️  NEXMARKET_API não definida — o app cai no Firebase Auth nativo."
  flutter build web --release
fi

# CanvasKit servido pelo próprio site: o index.html aponta para `canvaskit/`
# em vez do CDN do Google, então a página abre mesmo onde o CDN é bloqueado.
echo "▸ Copiando CanvasKit…"
mkdir -p build/web/canvaskit
cp -r "$FLUTTER_DIR/bin/cache/flutter_web_sdk/canvaskit/." build/web/canvaskit/

echo "✓ Pronto: build/web ($(du -sh build/web | cut -f1))"
