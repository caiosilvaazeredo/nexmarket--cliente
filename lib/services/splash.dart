/// Remoção da splash de carregamento do `web/index.html`.
///
/// A splash existe porque o bundle do Flutter tem alguns megabytes: sem ela,
/// quem abre o site no 4G encara segundos de tela branca. Mas ela só pode sair
/// quando o app **desenhou de verdade** — tirar antes apenas troca a splash
/// por uma tela branca, que é exatamente o problema que ela resolve.
///
/// Por isso quem manda tirar é o Dart, depois do primeiro frame, e não o
/// carregador em JavaScript: `onEntrypointLoaded` resolve quando o `main()`
/// *começa*, muito antes de existir qualquer pixel.
///
/// No Android/iOS o import condicional cai no stub e nada disso é compilado.
library;

export 'splash_stub.dart' if (dart.library.js_interop) 'splash_web.dart';
