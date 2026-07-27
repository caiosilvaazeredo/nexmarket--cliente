import 'package:flutter_test/flutter_test.dart';
import 'package:nexmarket_cliente/models.dart';
import 'package:nexmarket_cliente/services/cards.dart';

void main() {
  group('Validação de cartão (Luhn)', () {
    test('aceita números válidos das principais bandeiras', () {
      expect(isValidCardNumber('4111 1111 1111 1111'), isTrue); // Visa
      expect(isValidCardNumber('5555555555554444'), isTrue); // Mastercard
      expect(isValidCardNumber('378282246310005'), isTrue); // Amex
    });

    test('rejeita dígito trocado, tamanho inválido e texto', () {
      expect(isValidCardNumber('4111111111111112'), isFalse);
      expect(isValidCardNumber('411111'), isFalse);
      expect(isValidCardNumber(''), isFalse);
      expect(isValidCardNumber('abcd'), isFalse);
    });
  });

  group('Bandeira', () {
    test('detecta as bandeiras usadas no Brasil', () {
      expect(detectBrand('4111111111111111'), 'visa');
      expect(detectBrand('5555555555554444'), 'mastercard');
      expect(detectBrand('2223000048400011'), 'mastercard'); // faixa 2221-2720
      expect(detectBrand('378282246310005'), 'amex');
      expect(detectBrand('6362970000457013'), 'elo');
      expect(detectBrand('6062825624254001'), 'hipercard');
      expect(detectBrand('9999999999999999'), 'outro');
    });

    test('Elo tem prioridade sobre Visa/Master nos prefixos compartilhados', () {
      // 401178 é Elo apesar de começar com 4; 506699 apesar de começar com 5.
      expect(detectBrand('4011780000000000'), 'elo');
      expect(detectBrand('5066990000000000'), 'elo');
      // Fora das faixas Elo, o prefixo 5 volta a ser Mastercard.
      expect(detectBrand('5555555555554444'), 'mastercard');
    });
  });

  group('Dados guardados (RNF10)', () {
    test('last4Of devolve só os 4 últimos dígitos', () {
      expect(last4Of('4111 1111 1111 1234'), '1234');
      expect(last4Of('123'), '123');
    });

    test('formatCardNumber agrupa conforme a bandeira', () {
      expect(formatCardNumber('4111111111111111'), '4111 1111 1111 1111');
      expect(formatCardNumber('378282246310005'), '3782 822463 10005'); // Amex
    });
  });

  group('CVV e validade', () {
    test('CVV tem 3 dígitos (4 no Amex)', () {
      expect(isValidCvv('123', 'visa'), isTrue);
      expect(isValidCvv('1234', 'visa'), isFalse);
      expect(isValidCvv('1234', 'amex'), isTrue);
      expect(isValidCvv('12', 'amex'), isFalse);
    });

    test('validade aceita mês corrente e recusa vencidos', () {
      final now = DateTime.now();
      final nextYear = (now.year + 1).toString().substring(2);
      expect(isValidExpiry('12', nextYear), isTrue);
      expect(isValidExpiry(now.month.toString(), now.year.toString().substring(2)),
          isTrue); // vale até o fim do mês
      expect(isValidExpiry('01', '20'), isFalse);
      expect(isValidExpiry('13', '30'), isFalse); // mês inexistente
      expect(isValidExpiry('', ''), isFalse);
    });
  });

  group('CPF', () {
    test('valida dígitos verificadores', () {
      expect(isValidCpf('529.982.247-25'), isTrue);
      expect(isValidCpf('52998224726'), isFalse);
      expect(isValidCpf('111.111.111-11'), isFalse); // repetidos
      expect(isValidCpf('123'), isFalse);
    });
  });

  group('SavedCard', () {
    test('serializa sem número/CVV e rotula corretamente', () {
      final card = SavedCard(
        id: '1',
        brand: 'visa',
        last4: '1111',
        holderName: 'FULANO DE TAL',
        expMonth: '12',
        expYear: '30',
      );
      final map = card.toMap();
      expect(map['last4'], '1111');
      expect(map.containsKey('number'), isFalse);
      expect(map.containsKey('cvv'), isFalse);
      expect(card.label, 'Visa •••• 1111');
      expect(card.expiry, '12/30');
    });

    test('detecta cartão vencido', () {
      expect(
          SavedCard(id: '1', brand: 'visa', last4: '1', expMonth: '01', expYear: '20')
              .isExpired,
          isTrue);
      final nextYear = (DateTime.now().year + 1).toString().substring(2);
      expect(
          SavedCard(id: '2', brand: 'visa', last4: '2', expMonth: '12', expYear: nextYear)
              .isExpired,
          isFalse);
    });
  });
}
