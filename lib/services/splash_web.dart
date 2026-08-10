import 'dart:js_interop';

/// Definida em `web/index.html`. Chamar é seguro mesmo se a splash já tiver
/// saído (a função é idempotente do lado do JavaScript).
@JS('nexSplashDone')
external void _nexSplashDone();

void removeWebSplash() {
  try {
    _nexSplashDone();
  } catch (_) {
    // Página servida por um index.html antigo, sem a função: ignorar é o
    // certo — a splash tem um prazo de segurança próprio no HTML.
  }
}
