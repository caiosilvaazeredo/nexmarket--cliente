import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexmarket_cliente/models.dart';
import 'package:nexmarket_cliente/services/fire.dart';
import 'package:nexmarket_cliente/services/orders_repo.dart';

/// Jornada completa do pedido no banco COMPARTILHADO, simulando as escritas
/// da loja (painel) e do entregador exatamente como os outros sistemas fazem.
void main() {
  late FakeFirebaseFirestore db;

  Future<void> seedStore() async {
    await db.doc('supermarkets/sm1').set({'name': 'Mercado Teste'});
    await db.doc('supermarkets/sm1/settings/storeInfo').set({
      'storeLocation': {'address': 'Rua da Loja, 1', 'lat': -22.9, 'lng': -43.2},
    });
  }

  setUp(() async {
    db = FakeFirebaseFirestore();
    Fire.overrideForTests(db, uid: 'cliente1');
    await seedStore();
  });

  List<OrderItem> items() => [
        OrderItem(productId: 'p1', name: 'Arroz 5kg', quantity: 2, price: 20),
        OrderItem(productId: 'p2', name: 'Feijão 1kg', quantity: 1, price: 8),
      ];

  Future<String> place() => OrdersRepo.placeOrder(
        supermarketId: 'sm1',
        items: items(),
        subtotal: 48,
        deliveryFee: 8,
        discount: 0,
        total: 56,
        fulfillment: 'delivery',
        paymentMethod: 'pix',
        customerName: 'Cliente Teste',
        customerPhone: '21999999999',
        deliveryAddress: {
          'street': 'Rua do Cliente',
          'number': '42',
          'lat': -22.91,
          'lng': -43.21,
        },
      );

  test('checkout escreve o contrato exato que a loja e o entregador esperam',
      () async {
    final id = await place();
    final doc = await db.doc('supermarkets/sm1/orders/$id').get();
    expect(doc.exists, isTrue);
    final d = doc.data()!;

    // Contrato com o painel da loja (OrdersManager).
    expect(d['status'], 'pending');
    expect(d['customerId'], 'cliente1');
    expect(d['supermarketId'], 'sm1');
    expect(d['paymentStatus'], 'pending');
    expect(d['fulfillment'], 'delivery');
    expect((d['items'] as List).length, 2);
    final item = (d['items'] as List).first as Map;
    expect(item['separated'], isFalse);
    expect(item['missing'], isFalse);

    // Contrato com o app do entregador (pool de corridas).
    expect(d['deliveryStatus'], 'awaiting_driver');
    expect(d['deliveryAddress'], isA<Map>());
    expect(d['deliveryPin'], matches(RegExp(r'^\d{4}$')));
    expect(d['total'], 56);
    expect(d['deliveryFee'], 8);
  });

  test('pedido de retirada NÃO entra no pool de entregadores', () async {
    final id = await OrdersRepo.placeOrder(
      supermarketId: 'sm1',
      items: items(),
      subtotal: 48,
      deliveryFee: 0,
      discount: 0,
      total: 48,
      fulfillment: 'pickup',
      paymentMethod: 'cash_delivery',
      customerName: 'Cliente Teste',
      customerPhone: '21999999999',
    );
    final d = (await db.doc('supermarkets/sm1/orders/$id').get()).data()!;
    expect(d.containsKey('deliveryStatus'), isFalse);
    expect(d.containsKey('deliveryPin'), isFalse);
  });

  test('cliente vê os próprios pedidos com o nome da loja (RF18)', () async {
    await place();
    final orders = await OrdersRepo.myOrders('cliente1').first;
    expect(orders.length, 1);
    expect(orders.first.storeName, 'Mercado Teste');
    expect(orders.first.isActive, isTrue);
  });

  test('jornada feliz: loja separa → entregador entrega → cliente avalia',
      () async {
    final id = await place();
    final ref = db.doc('supermarkets/sm1/orders/$id');

    // Loja: começa a separar e marca pronto (como o OrdersManager faz).
    await ref.update({'status': 'picking'});
    await ref.update({'status': 'ready'});

    // Entregador: aceita e conduz o ciclo de entrega.
    await ref.update({
      'driverId': 'driver1',
      'driverName': 'João Motoboy',
      'deliveryStatus': 'going_to_store',
      'driverEarnings': 8,
    });
    await ref.update({'deliveryStatus': 'arrived_store'});
    await ref.update({'deliveryStatus': 'going_to_customer'});

    var order = (await OrdersRepo.order('sm1', id).first)!;
    expect(order.isActive, isTrue);
    expect(order.driverName, 'João Motoboy');
    expect(order.deliveryStatus, 'going_to_customer');

    // Entrega concluída.
    await ref.update({'status': 'delivered', 'deliveryStatus': 'delivered'});
    order = (await OrdersRepo.order('sm1', id).first)!;
    expect(order.isFinished, isTrue);

    // Pós-venda: avaliação (RF23).
    await OrdersRepo.rateOrder(order, rating: 5, comment: 'Rápido!', tags: []);
    final rated = (await ref.get()).data()!;
    expect(rated['rating'], 5);
    expect(rated['ratingComment'], 'Rápido!');
  });

  test('fluxo alternativo: substituição sugerida, aceita e recusada com estorno',
      () async {
    final id = await place();
    final ref = db.doc('supermarkets/sm1/orders/$id');

    // Loja sugere: substituir o arroz (2x20) por outro (2x22) e marca o
    // feijão como em falta.
    final d = (await ref.get()).data()!;
    final raw = List<Map<String, dynamic>>.from(
        (d['items'] as List).map((e) => Map<String, dynamic>.from(e as Map)));
    raw[0]['substituted'] = true;
    raw[0]['substituteName'] = 'Arroz Premium 5kg';
    raw[0]['substitutePrice'] = 22.0;
    raw[1]['missing'] = true;
    await ref.update({'items': raw, 'status': 'waiting_substitution'});

    var order = (await OrdersRepo.order('sm1', id).first)!;
    expect(order.needsSubstitutionReview, isTrue);

    // Cliente aceita a troca do arroz e confirma a remoção do feijão.
    await OrdersRepo.respondToSubstitutions(order, {0: 'accepted', 1: 'rejected'});

    order = (await OrdersRepo.order('sm1', id).first)!;
    expect(order.needsSubstitutionReview, isFalse);
    expect(order.items[0].customerDecision, 'accepted');
    expect(order.items[1].customerDecision, 'rejected');
    // Total recalculado: 2x22 (substituto) + frete 8 — feijão estornado.
    expect(order.total, closeTo(2 * 22.0 + 8, 0.001));
  });

  test('cancelamento enquanto cancelável + pagamento PIX confirmado', () async {
    final id = await place();
    var order = (await OrdersRepo.order('sm1', id).first)!;
    expect(order.canCancel, isTrue);

    await OrdersRepo.markPaid(order);
    var d = (await db.doc('supermarkets/sm1/orders/$id').get()).data()!;
    expect(d['paymentStatus'], 'paid');
    expect((d['payment'] as Map)['status'], 'paid');

    await OrdersRepo.cancelOrder(order);
    d = (await db.doc('supermarkets/sm1/orders/$id').get()).data()!;
    expect(d['status'], 'cancelled');
  });

  test('rastreio do entregador em /drivers/{uid} (RF21)', () async {
    await db.doc('drivers/driver1').set({
      'name': 'João Motoboy',
      'rating': 4.8,
      'vehicle': {'type': 'moto', 'model': 'CG 160', 'plate': 'ABC1D23'},
      'location': {'lat': -22.95, 'lng': -43.25},
    });
    final driver = await OrdersRepo.driver('driver1').first;
    expect(driver, isNotNull);
    expect(driver!.name, 'João Motoboy');
    expect(driver.location!.lat, -22.95);
    expect(driver.vehicleLabel, contains('CG 160'));
  });
}
