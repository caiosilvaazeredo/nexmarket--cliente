import 'package:flutter_test/flutter_test.dart';
import 'package:nexmarket_cliente/models.dart';

void main() {
  group('Product', () {
    test('lê stockQuantity e o legado stock', () {
      final a = Product.fromMap('a', {'name': 'A', 'price': 5, 'stockQuantity': 3});
      final b = Product.fromMap('b', {'name': 'B', 'price': 5, 'stock': 0});
      final c = Product.fromMap('c', {'name': 'C', 'price': 5});
      expect(a.availableStock, 3);
      expect(b.outOfStock, isTrue);
      expect(c.availableStock, isNull); // loja não controla estoque
      expect(c.outOfStock, isFalse);
    });

    test('tolera price como string e active ausente', () {
      final p = Product.fromMap('x', {'name': 'X', 'price': '12.5'});
      expect(p.price, 12.5);
      expect(p.active, isTrue);
    });
  });

  group('DeliveryConfig (frete/mínimo — RF13)', () {
    test('frete transparente com surge', () {
      final c = DeliveryConfig.fromMap(
          {'shippingType': 'transparent', 'flatFeeValue': 8, 'surgeMultiplier': 1.5});
      expect(c.deliveryFee, 12);
      expect(c.surgeActive, isTrue);
      expect(c.minimum, 0);
    });

    test('frete diluído: frete zero, mínimo aplicado', () {
      final c = DeliveryConfig.fromMap(
          {'shippingType': 'free_diluted', 'minimumOrderValue': 60, 'flatFeeValue': 8});
      expect(c.deliveryFee, 0);
      expect(c.minimum, 60);
    });
  });

  group('StoreInfo (horários)', () {
    Map<String, dynamic> allDays(bool open, [String o = '00:00', String c = '23:59']) => {
          'openingHours': {
            for (final k in ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])
              k: {'isOpen': open, 'openTime': o, 'closeTime': c}
          }
        };

    test('sem horários configurados = aberta', () {
      expect(StoreInfo.fromMap({}).isOpenNow, isTrue);
    });

    test('todos os dias abertos 24h', () {
      expect(StoreInfo.fromMap(allDays(true)).isOpenNow, isTrue);
    });

    test('fechada hoje', () {
      final info = StoreInfo.fromMap(allDays(false));
      expect(info.isOpenNow, isFalse);
      expect(info.todayLabel, 'Fechado hoje');
    });
  });

  group('Order (status e fluxos alternativos)', () {
    test('needsSubstitutionReview só com decisão pendente', () {
      final o = Order.fromMap('o1', {
        'supermarketId': 'sm1',
        'customerId': 'c1',
        'status': 'waiting_substitution',
        'total': 10,
        'items': [
          {'productId': 'p1', 'name': 'A', 'quantity': 1, 'price': 10, 'missing': true},
        ],
      });
      expect(o.needsSubstitutionReview, isTrue);

      final done = Order.fromMap('o2', {
        'supermarketId': 'sm1',
        'customerId': 'c1',
        'status': 'waiting_substitution',
        'total': 10,
        'items': [
          {
            'productId': 'p1',
            'name': 'A',
            'quantity': 1,
            'price': 10,
            'missing': true,
            'customerDecision': 'rejected',
          },
        ],
      });
      expect(done.needsSubstitutionReview, isFalse);
    });

    test('ciclo ativo/finalizado e cancelamento', () {
      Order mk(String status, [String? ds]) => Order.fromMap('o', {
            'supermarketId': 'sm1',
            'customerId': 'c1',
            'status': status,
            if (ds != null) 'deliveryStatus': ds,
            'total': 1,
            'items': const [],
          });
      expect(mk('pending').isActive, isTrue);
      expect(mk('pending').canCancel, isTrue);
      expect(mk('picking').canCancel, isTrue);
      expect(mk('ready').canCancel, isFalse);
      expect(mk('ready', 'going_to_customer').isActive, isTrue);
      expect(mk('ready', 'delivered').isActive, isFalse);
      expect(mk('delivered').isFinished, isTrue);
      expect(mk('cancelled').isFinished, isTrue);
    });
  });
}
