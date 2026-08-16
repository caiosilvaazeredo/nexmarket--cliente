import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'fire.dart';

/// Conversa com o servidor de identidade da plataforma.
///
/// O app do cliente cria a conta no Firebase Auth; logo depois avisa o
/// servidor para registrar o **papel** `cliente` na identidade unificada
/// (`identities/{email}`). É isso que impede o mesmo e-mail de virar contas
/// paralelas nos quatro apps — o uid passa a ser o mesmo em todos.
///
/// Configure a URL no build:
///   flutter run --dart-define=NEXMARKET_API=https://pagamentos.suaempresa.com
class IdentityApi {
  /// Valor fixado na compilação. Se o `--dart-define` for esquecido, ele vem
  /// vazio — e antes isso desligava tudo em silêncio: o papel não era
  /// registrado, o e-mail de boas-vindas não saía, e nada indicava o motivo.
  /// Um APK assim parecia funcionar, só não unificava a conta.
  static const _fromBuild = String.fromEnvironment('NEXMARKET_API');

  /// Endereço público do servidor da plataforma — não é segredo, é o mesmo
  /// que os quatro apps chamam. Serve de rede de proteção para o caso acima.
  static const _padrao = 'https://nexmarket-payments-60k3.onrender.com';

  static String get baseUrl => _fromBuild.isNotEmpty ? _fromBuild : _padrao;

  static bool get configured => baseUrl.isNotEmpty;

  /// A hospedagem hiberna sem uso e a primeira chamada do dia pode levar quase
  /// um minuto só para acordar o servidor.
  ///
  /// `claim` e `myRoles` usam o prazo curto porque a pessoa está esperando na
  /// tela e ambos são refeitos a cada login — a chamada que falha já deixa o
  /// servidor acordando para a próxima. Já a recuperação de senha não tem
  /// segunda chance: é ali que a pessoa espera o e-mail chegar, então vale
  /// aguardar de verdade.
  static const _prazoCurto = Duration(seconds: 20);
  static const _prazoLongo = Duration(seconds: 60);

  static Future<Map<String, String>?> _authHeaders() async {
    final token = await Fire.auth.currentUser?.getIdToken();
    if (token == null) return null;
    return {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    };
  }

  /// Registra (ou confirma) o papel desta conta. Falha de rede não bloqueia o
  /// cadastro — o app tenta de novo no próximo login.
  static Future<bool> claim({String role = 'cliente', String? name}) async {
    if (!configured) return false;
    try {
      final headers = await _authHeaders();
      if (headers == null) return false;
      final res = await http
          .post(
            Uri.parse('$baseUrl/api/identity/claim'),
            headers: headers,
            body: jsonEncode({'role': role, if (name != null) 'name': name}),
          )
          .timeout(_prazoCurto);
      if (res.statusCode == 409) {
        debugPrint('[identity] e-mail já pertence a outra conta: ${res.body}');
        return false;
      }
      return res.statusCode == 200;
    } catch (e) {
      debugPrint('[identity] claim falhou: $e');
      return false;
    }
  }

  /// Papéis da conta logada (cliente, loja, entregador, empresa).
  static Future<Map<String, bool>> myRoles() async {
    if (!configured) return const {};
    try {
      final headers = await _authHeaders();
      if (headers == null) return const {};
      final res = await http
          .get(Uri.parse('$baseUrl/api/identity/me'), headers: headers)
          .timeout(_prazoCurto);
      if (res.statusCode != 200) return const {};
      final roles = (jsonDecode(res.body) as Map)['roles'] as Map?;
      return roles?.map((k, v) => MapEntry(k.toString(), v == true)) ?? const {};
    } catch (_) {
      return const {};
    }
  }

  /// Dispara o e-mail de recuperação de senha pelo servidor (mesmo visual
  /// para os quatro apps). Retorna false quando a API não está configurada —
  /// aí o app cai no envio nativo do Firebase.
  static Future<bool> forgotPassword(String email, {String role = 'cliente'}) async {
    if (!configured) return false;
    try {
      final res = await http
          .post(
            Uri.parse('$baseUrl/api/auth/forgot-password'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'email': email, 'app': role}),
          )
          .timeout(_prazoLongo);
      return res.statusCode == 200;
    } catch (e) {
      debugPrint('[identity] forgot-password falhou: $e');
      return false;
    }
  }
}
