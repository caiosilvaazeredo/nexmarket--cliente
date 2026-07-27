/// Validação e classificação de cartões **no dispositivo**.
///
/// RNF10: nada aqui persiste o número (PAN) ou o CVV. As funções recebem o
/// número digitado, respondem se ele é plausível e devolvem apenas bandeira e
/// últimos 4 dígitos — o que vai para o banco. Quando houver gateway
/// (Stripe), o PAN vai direto para o SDK dele e guardamos só o token.
library;

String onlyDigits(String input) => input.replaceAll(RegExp(r'\D'), '');

/// Algoritmo de Luhn — pega erros de digitação antes de chegar ao gateway.
bool isValidCardNumber(String input) {
  final digits = onlyDigits(input);
  if (digits.length < 13 || digits.length > 19) return false;
  var sum = 0;
  var double = false;
  for (var i = digits.length - 1; i >= 0; i--) {
    var d = digits.codeUnitAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 == 0;
}

/// Bandeira a partir dos prefixos (inclui Elo e Hipercard, usados no Brasil).
String detectBrand(String input) {
  final d = onlyDigits(input);
  if (d.isEmpty) return 'outro';

  bool startsWithAny(List<String> prefixes) =>
      prefixes.any((p) => d.startsWith(p));

  // Elo antes de Visa/Master: várias faixas Elo começam com 4 ou 5.
  const eloPrefixes = [
    '401178', '401179', '431274', '438935', '451416', '457393', '457631',
    '457632', '504175', '506699', '509', '627780', '636297', '636368', '650',
    '651652', '655000', '655001',
  ];
  if (startsWithAny(eloPrefixes)) return 'elo';
  if (startsWithAny(['606282', '3841'])) return 'hipercard';
  if (d.startsWith('4')) return 'visa';
  if (startsWithAny(['34', '37'])) return 'amex';
  final two = d.length >= 2 ? int.tryParse(d.substring(0, 2)) ?? 0 : 0;
  final four = d.length >= 4 ? int.tryParse(d.substring(0, 4)) ?? 0 : 0;
  if (two >= 51 && two <= 55) return 'mastercard';
  if (four >= 2221 && four <= 2720) return 'mastercard';
  return 'outro';
}

/// Últimos 4 dígitos — o único pedaço do número que pode ser guardado.
String last4Of(String input) {
  final d = onlyDigits(input);
  return d.length <= 4 ? d : d.substring(d.length - 4);
}

/// Agrupa o número para exibição enquanto o cliente digita.
String formatCardNumber(String input) {
  final d = onlyDigits(input);
  final isAmex = detectBrand(d) == 'amex';
  final groups = isAmex ? [4, 6, 5] : [4, 4, 4, 4, 3];
  final out = StringBuffer();
  var i = 0;
  for (final size in groups) {
    if (i >= d.length) break;
    if (out.isNotEmpty) out.write(' ');
    out.write(d.substring(i, (i + size).clamp(0, d.length)));
    i += size;
  }
  return out.toString();
}

/// CVV: 4 dígitos no Amex, 3 nas demais bandeiras.
bool isValidCvv(String cvv, String brand) {
  final d = onlyDigits(cvv);
  return brand == 'amex' ? d.length == 4 : d.length == 3;
}

/// Validade MM/AA (ou MM/AAAA) que ainda não passou.
bool isValidExpiry(String month, String year) {
  final m = int.tryParse(onlyDigits(month));
  final y = int.tryParse(onlyDigits(year));
  if (m == null || y == null || m < 1 || m > 12) return false;
  final fullYear = y < 100 ? 2000 + y : y;
  final now = DateTime.now();
  // Vale até o fim do mês informado.
  return !DateTime(fullYear, m + 1, 1).isBefore(DateTime(now.year, now.month, 1));
}

/// Validação de CPF (usada no cadastro de dados pessoais e do titular).
bool isValidCpf(String input) {
  final d = onlyDigits(input);
  if (d.length != 11) return false;
  if (RegExp(r'^(\d)\1{10}$').hasMatch(d)) return false;
  int digit(int len) {
    var sum = 0;
    for (var i = 0; i < len; i++) {
      sum += (d.codeUnitAt(i) - 48) * (len + 1 - i);
    }
    final rest = (sum * 10) % 11;
    return rest == 10 ? 0 : rest;
  }

  return digit(9) == d.codeUnitAt(9) - 48 && digit(10) == d.codeUnitAt(10) - 48;
}
