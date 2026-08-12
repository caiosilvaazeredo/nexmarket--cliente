import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../models.dart' as models;
import 'fire.dart';

/// Leitura/escrita de pedidos no banco compartilhado. O cliente cria pedidos
/// somente com o próprio uid e só altera campos permitidos pelas Security
/// Rules (substituição, avaliação, cancelamento, pagamento) — RNF11.
class OrdersRepo {
  static final _storeCache = <String, ({String name, String? logoUrl})>{};

  static Future<({String name, String? logoUrl})> _storeInfo(String smId) async {
    final cached = _storeCache[smId];
    if (cached != null) return cached;
    var info = (name: 'Loja', logoUrl: null as String?);
    try {
      final sm = await Fire.db.doc('supermarkets/$smId').get();
      if (sm.exists) {
        final d = sm.data()!;
        info = (name: (d['name'] as String?) ?? 'Loja', logoUrl: d['logoUrl'] as String?);
      }
    } catch (_) {}
    _storeCache[smId] = info;
    return info;
  }

  /// Todos os pedidos do cliente (ativos + histórico) — RF18.
  static Stream<List<models.Order>> myOrders(String uid) {
    return Fire.db
        .collectionGroup('orders')
        .where('customerId', isEqualTo: uid)
        .snapshots()
        .asyncMap((snap) async {
      final orders = <models.Order>[];
      for (final d in snap.docs) {
        final data = d.data();
        final smId = (data['supermarketId'] as String?) ?? '';
        final info = await _storeInfo(smId);
        orders.add(models.Order.fromMap(d.id, data,
            storeName: info.name, storeLogoUrl: info.logoUrl));
      }
      orders.sort((a, b) => models.tsMillis(b.createdAt).compareTo(models.tsMillis(a.createdAt)));
      return orders;
    });
  }

  /// Um pedido em tempo real (status, entregador, substituições) — RF20.
  static Stream<models.Order?> order(String smId, String orderId) {
    return Fire.db.doc('supermarkets/$smId/orders/$orderId').snapshots().asyncMap((d) async {
      if (!d.exists) return null;
      final info = await _storeInfo(smId);
      return models.Order.fromMap(d.id, d.data()!,
          storeName: info.name, storeLogoUrl: info.logoUrl);
    });
  }

  /// Entregador público para rastreio ao vivo (RF21).
  static Stream<models.PublicDriver?> driver(String uid) {
    return Fire.db.doc('drivers/$uid').snapshots().map(
        (d) => d.exists ? models.PublicDriver.fromMap(uid, d.data()!) : null);
  }

  static String _genId() {
    final rnd = Random();
    final a = DateTime.now().millisecondsSinceEpoch.toRadixString(36);
    final b = List.generate(6, (_) => '0123456789abcdefghijklmnopqrstuvwxyz'[rnd.nextInt(36)])
        .join();
    return (a + b).toUpperCase();
  }

  /// Cria um pedido atrelado ao uid autenticado (RNF11). O payload é idêntico
  /// ao que o app Expo escrevia, para manter compatibilidade com a loja.
  static Future<String> placeOrder({
    required String supermarketId,
    required List<models.OrderItem> items,
    required double subtotal,
    required double deliveryFee,
    required double discount,
    required double total,
    String couponCode = '',
    required String fulfillment, // delivery | pickup
    required String paymentMethod,
    required String customerName,
    required String customerPhone,
    Map<String, dynamic>? deliveryAddress,
    String? scheduledFor,
    double? changeFor,
    String notes = '',
    double tip = 0,
    /// Bandeira/últimos 4 do cartão escolhido — nunca o número (RNF10).
    Map<String, dynamic>? paymentCard,
  }) async {
    final uid = Fire.uid;
    if (uid == null) throw Exception('É necessário estar logado para finalizar o pedido.');

    final id = _genId();
    final isDelivery = fulfillment == 'delivery';

    final payload = <String, dynamic>{
      'supermarketId': supermarketId,
      'customerId': uid,
      'status': 'pending',
      'items': items
          .map((i) => {
                'productId': i.productId,
                'name': i.name,
                'quantity': i.quantity,
                'price': i.price,
                'imageUrl': i.imageUrl,
                'unit': i.unit,
                'separated': false,
                'missing': false,
              })
          .toList(),
      'subtotal': subtotal,
      'deliveryFee': deliveryFee,
      'discount': discount,
      'total': total,
      'couponCode': couponCode,
      'fulfillment': fulfillment,
      'paymentMethod': paymentMethod,
      'paymentStatus': 'pending',
      'customerName': customerName,
      'customerPhone': customerPhone,
      if (paymentCard != null) 'paymentCard': paymentCard,
      'notes': notes,
      'scheduledFor': scheduledFor,
      'changeFor': changeFor,
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };

    if (isDelivery) {
      payload['deliveryStatus'] = 'awaiting_driver';
      payload['deliveryAddress'] = deliveryAddress ?? {};
      payload['tip'] = tip;
      // PIN de confirmação de entrega: o cliente informa ao entregador.
      payload['deliveryPin'] = (1000 + Random().nextInt(9000)).toString();
    }

    await Fire.db.doc('supermarkets/$supermarketId/orders/$id').set(payload);
    return id;
  }

  static DocumentReference<Map<String, dynamic>> _ref(models.Order o) =>
      Fire.db.doc('supermarkets/${o.supermarketId}/orders/${o.id}');

  /// Responde às sugestões de substituição da loja e recalcula o total.
  static Future<void> respondToSubstitutions(
      models.Order order, Map<int, String> decisions) async {
    final items = <models.OrderItem>[];
    for (var i = 0; i < order.items.length; i++) {
      final it = order.items[i];
      final decision = decisions[i];
      if (decision == null) {
        items.add(it);
      } else if (decision == 'rejected') {
        items.add(it.copyWith(substituted: false, missing: true, customerDecision: 'rejected'));
      } else {
        items.add(it.copyWith(customerDecision: 'accepted'));
      }
    }

    double newSubtotal = 0;
    for (final it in items) {
      if (it.missing && it.customerDecision == 'rejected' && !it.substituted) continue;
      final price = it.substituted && it.substitutePrice != null ? it.substitutePrice! : it.price;
      newSubtotal += price * it.quantity;
    }
    final total = newSubtotal + order.deliveryFee - order.discount;

    await _ref(order).update({
      'items': items.map((e) => e.toMap()).toList(),
      'total': total < 0 ? 0 : total,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  static Future<void> cancelOrder(models.Order order) async {
    await _ref(order).update({
      'status': 'cancelled',
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Confirma pagamento online/PIX (demo — nunca gravamos dados de cartão).
  static Future<void> markPaid(models.Order order) async {
    await _ref(order).update({
      'paymentStatus': 'paid',
      'payment': {
        'provider': 'demo',
        'status': 'paid',
        'paidAt': DateTime.now().toIso8601String(),
      },
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Avalia um pedido concluído (RF23).
  static Future<void> rateOrder(models.Order order,
      {required int rating, String comment = '', List<String> tags = const []}) async {
    await _ref(order).update({
      'rating': rating,
      'ratingComment': comment,
      'ratingTags': tags,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }
}
