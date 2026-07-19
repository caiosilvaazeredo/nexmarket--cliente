import 'dart:convert';

import '../models.dart';
import 'fire.dart';

/// Leitura em tempo real do catálogo compartilhado (RNF06).
class CatalogRepo {
  static Stream<List<Supermarket>> supermarkets() {
    return Fire.db.collection('supermarkets').snapshots().map((snap) {
      final list = snap.docs.map((d) => Supermarket.fromMap(d.id, d.data())).toList();
      list.sort((a, b) => a.name.compareTo(b.name));
      return list;
    });
  }

  static Stream<Supermarket?> supermarket(String smId) {
    return Fire.db.doc('supermarkets/$smId').snapshots().map(
        (d) => d.exists ? Supermarket.fromMap(d.id, d.data()!) : null);
  }

  static Stream<List<Gondola>> gondolas(String smId) {
    return Fire.db.collection('supermarkets/$smId/gondolas').snapshots().map((snap) {
      final list = snap.docs.map((d) => Gondola.fromMap(d.id, d.data())).toList();
      list.sort((a, b) => a.order.compareTo(b.order));
      return list;
    });
  }

  static Stream<List<Product>> products(String smId) {
    return Fire.db.collection('supermarkets/$smId/products').snapshots().map((snap) {
      final list = snap.docs.map((d) => Product.fromMap(d.id, d.data())).toList();
      list.sort((a, b) => a.order.compareTo(b.order));
      return list;
    });
  }

  static Stream<List<Promotion>> promotions(String smId) {
    return Fire.db.collection('supermarkets/$smId/promotions').snapshots().map((snap) =>
        snap.docs.map((d) => Promotion.fromMap(d.id, d.data())).where((p) => p.active).toList());
  }

  static Stream<DeliveryConfig?> deliveryConfig(String smId) {
    return Fire.db.doc('supermarkets/$smId/deliveryConfig/main').snapshots().map(
        (d) => d.exists ? DeliveryConfig.fromMap(d.data()!) : null);
  }

  static Stream<StoreInfo?> storeInfo(String smId) {
    return Fire.db.doc('supermarkets/$smId/settings/storeInfo').snapshots().map(
        (d) => d.exists ? StoreInfo.fromMap(d.data()!) : null);
  }

  /// Config white-label do GondolaAppBuilder — vem serializada em `configJson`.
  static Stream<AppConfig?> appConfig(String smId) {
    return Fire.db.doc('supermarkets/$smId/storefront/appConfig').snapshots().map((d) {
      if (!d.exists) return null;
      try {
        final parsed = jsonDecode(d.data()!['configJson'] as String);
        return AppConfig.fromMap(Map<String, dynamic>.from(parsed as Map));
      } catch (_) {
        return null;
      }
    });
  }
}
