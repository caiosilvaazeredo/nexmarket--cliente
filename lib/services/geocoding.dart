import 'dart:convert';

import 'package:http/http.dart' as http;

/// Endereço em texto → coordenadas, pelo Nominatim (serviço de busca oficial
/// da OpenStreetMap).
///
/// Sem isso o pedido chega ao entregador só com o endereço escrito, e o mapa
/// da entrega não tem para onde apontar. Pior: o Waze e o Google Maps
/// precisam adivinhar o endereço a partir do texto, e em rua com nome
/// repetido na cidade eles erram de bairro com frequência.
///
/// **Política de uso do Nominatim** (nominatim.org/release-docs/latest/api/):
/// é gratuito, mas exige identificar a aplicação e pede no máximo 1 consulta
/// por segundo — proíbe geocodificação em massa. O uso aqui cabe: uma
/// consulta quando a pessoa **salva** um endereço, não a cada pedido. Se a
/// operação crescer, troque a URL por um provedor contratado; o resto do
/// código não muda.
class Geocoding {
  static const _endpoint = 'https://nominatim.openstreetmap.org/search';

  /// Exigido pela política do Nominatim: pedidos sem identificação são
  /// bloqueados.
  static const _userAgent = 'NexmarketCliente/1.0 (contato@nexmarkt.com.br)';

  /// Espaçamento mínimo entre consultas, para respeitar 1/s mesmo se a tela
  /// disparar duas buscas seguidas.
  static const _minInterval = Duration(seconds: 1);
  static DateTime _lastCall = DateTime.fromMillisecondsSinceEpoch(0);

  /// Injetável nos testes — evita bater na rede.
  static http.Client Function() clientFactory = http.Client.new;

  /// Devolve `null` quando não encontra, quando a rede falha ou quando o
  /// endereço está vazio demais para valer uma consulta.
  ///
  /// Nunca lança: quem chama está salvando um endereço, e uma falha de
  /// geocodificação não pode impedir o cadastro — o endereço escrito continua
  /// valendo, só fica sem o ponto no mapa.
  static Future<({double lat, double lng})?> search(String query) async {
    final q = query.trim();
    // Um punhado de caracteres não identifica endereço nenhum, e consultar
    // isso só gastaria a cota.
    if (q.length < 8) return null;

    final wait = _minInterval - DateTime.now().difference(_lastCall);
    if (!wait.isNegative) await Future.delayed(wait);
    _lastCall = DateTime.now();

    final uri = Uri.parse('$_endpoint'
        '?q=${Uri.encodeQueryComponent(q)}'
        '&format=jsonv2'
        '&limit=1'
        // Restringe ao Brasil: sem isso "Rua São João, 100" acha resultado em
        // Portugal antes do brasileiro.
        '&countrycodes=br');

    final client = clientFactory();
    try {
      final res = await client
          .get(uri, headers: {'User-Agent': _userAgent})
          .timeout(const Duration(seconds: 8));
      if (res.statusCode != 200) return null;

      final body = jsonDecode(utf8.decode(res.bodyBytes));
      if (body is! List || body.isEmpty) return null;

      final first = body.first;
      if (first is! Map) return null;
      // O Nominatim devolve as coordenadas como texto.
      final lat = double.tryParse('${first['lat']}');
      final lng = double.tryParse('${first['lon']}');
      if (lat == null || lng == null) return null;
      return (lat: lat, lng: lng);
    } catch (_) {
      return null;
    } finally {
      client.close();
    }
  }
}

/// Monta a linha de busca a partir dos campos do formulário.
///
/// A ordem importa para a qualidade do resultado: rua e número primeiro,
/// depois o funil bairro → cidade → estado. Complemento (apartamento, bloco)
/// fica de fora de propósito — não ajuda a localizar o prédio e só atrapalha
/// a busca.
String addressQuery({
  required String street,
  required String number,
  String? neighborhood,
  String? city,
  String? state,
  String? cep,
}) {
  final parts = <String>[
    if (street.trim().isNotEmpty)
      number.trim().isNotEmpty
          ? '${street.trim()}, ${number.trim()}'
          : street.trim(),
    if ((neighborhood ?? '').trim().isNotEmpty) neighborhood!.trim(),
    if ((city ?? '').trim().isNotEmpty) city!.trim(),
    if ((state ?? '').trim().isNotEmpty) state!.trim(),
    if ((cep ?? '').trim().isNotEmpty) cep!.trim(),
  ];
  return parts.join(', ');
}
