import 'package:flutter_test/flutter_test.dart';
import 'package:nexmarket_cliente/services/identity_api.dart';

/// Estes testes rodam SEM `--dart-define=NEXMARKET_API`, que é exatamente o
/// cenário de um build onde alguém esqueceu de passar a variável. Antes, isso
/// deixava o app mudo: o papel não era registrado na identidade unificada, o
/// e-mail de boas-vindas não saía, e nada na tela indicava o motivo — o APK
/// parecia funcionar, só não unificava a conta.
void main() {
  test('sem a variável de build, cai no servidor de produção', () {
    expect(IdentityApi.baseUrl, isNotEmpty);
    expect(IdentityApi.baseUrl, startsWith('https://'));
  });

  test('e por isso segue habilitado, em vez de virar um no-op silencioso', () {
    expect(IdentityApi.configured, isTrue);
  });

  test('a URL não termina em barra, para não gerar // ao concatenar a rota', () {
    expect(IdentityApi.baseUrl.endsWith('/'), isFalse);
  });
}
