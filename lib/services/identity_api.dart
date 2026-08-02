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
  static const baseUrl = String.fromEnvironment('NEXMARKET_API');

  static bool get configured => baseUrl.isNotEmpty;

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
          .timeout(const Duration(seconds: 10));
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
          .timeout(const Duration(seconds: 10));
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
          .timeout(const Duration(seconds: 10));
      return res.statusCode == 200;
    } catch (e) {
      debugPrint('[identity] forgot-password falhou: $e');
      return false;
    }
  }
}
