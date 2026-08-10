import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nexmarket_cliente/services/geocoding.dart';

void main() {
  setUp(() => Geocoding.clientFactory = http.Client.new);
  tearDown(() => Geocoding.clientFactory = http.Client.new);

  void mock(Future<http.Response> Function(http.Request) handler) {
    Geocoding.clientFactory = () => MockClient(handler);
  }

  group('addressQuery', () {
    test('junta rua com número e vai afunilando', () {
      final q = addressQuery(
        street: 'Av. Rio Branco',
        number: '156',
        neighborhood: 'Centro',
        city: 'Rio de Janeiro',
        state: 'RJ',
      );
      expect(q, 'Av. Rio Branco, 156, Centro, Rio de Janeiro, RJ');
    });

    test('ignora campos vazios sem deixar vírgula solta', () {
      final q = addressQuery(
          street: 'Rua A', number: '1', neighborhood: '', city: 'Niterói');
      expect(q, 'Rua A, 1, Niterói');
      expect(q, isNot(contains(', ,')));
    });

    test('sem número, a rua entra sozinha', () {
      expect(addressQuery(street: 'Rua A', number: '', city: 'Niterói'),
          'Rua A, Niterói');
    });
  });

  group('search', () {
    test('lê lat/lon, que o Nominatim manda como texto', () async {
      mock((_) async => http.Response(
          jsonEncode([
            {'lat': '-22.9068467', 'lon': '-43.1728965'}
          ]),
          200));

      final r = await Geocoding.search('Av. Rio Branco, 156, Rio de Janeiro');
      expect(r, isNotNull);
      expect(r!.lat, closeTo(-22.9068, 0.001));
      expect(r.lng, closeTo(-43.1728, 0.001));
    });

    test('restringe ao Brasil e pede um só resultado', () async {
      Uri? seen;
      mock((req) async {
        seen = req.url;
        return http.Response('[]', 200);
      });

      await Geocoding.search('Rua São João, 100, São Paulo');
      expect(seen!.queryParameters['countrycodes'], 'br');
      expect(seen!.queryParameters['limit'], '1');
      expect(seen!.queryParameters['format'], 'jsonv2');
    });

    test('identifica a aplicação, como a política do Nominatim exige',
        () async {
      String? ua;
      mock((req) async {
        ua = req.headers['User-Agent'];
        return http.Response('[]', 200);
      });

      await Geocoding.search('Av. Rio Branco, 156, Rio de Janeiro');
      expect(ua, isNotNull);
      expect(ua, contains('Nexmarket'));
    });

    test('lista vazia vira null, não exceção', () async {
      mock((_) async => http.Response('[]', 200));
      expect(await Geocoding.search('Rua Inexistente, 9999, Xique-Xique'),
          isNull);
    });

    test('erro HTTP vira null — salvar o endereço não pode quebrar', () async {
      mock((_) async => http.Response('rate limited', 429));
      expect(
          await Geocoding.search('Av. Rio Branco, 156, Rio de Janeiro'), isNull);
    });

    test('rede caindo vira null, não exceção', () async {
      mock((_) async => throw const SocketExceptionLike());
      expect(
          await Geocoding.search('Av. Rio Branco, 156, Rio de Janeiro'), isNull);
    });

    test('texto curto demais nem consulta — não gasta a cota', () async {
      var chamou = false;
      mock((_) async {
        chamou = true;
        return http.Response('[]', 200);
      });

      expect(await Geocoding.search('Rua A'), isNull);
      expect(chamou, isFalse);
    });

    test('resposta com lat ilegível vira null', () async {
      mock((_) async => http.Response(
          jsonEncode([
            {'lat': 'nao-e-numero', 'lon': '-43.17'}
          ]),
          200));
      expect(
          await Geocoding.search('Av. Rio Branco, 156, Rio de Janeiro'), isNull);
    });

    test('acento no endereço sobrevive à codificação da URL', () async {
      Uri? seen;
      mock((req) async {
        seen = req.url;
        return http.Response('[]', 200);
      });

      await Geocoding.search('Rua Conceição, 45, São Gonçalo');
      expect(seen!.queryParameters['q'], 'Rua Conceição, 45, São Gonçalo');
    });
  });
}

/// Exceção qualquer de rede — o `search` não pode deixar vazar nenhuma.
class SocketExceptionLike implements Exception {
  const SocketExceptionLike();
}
