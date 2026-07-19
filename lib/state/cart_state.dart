import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models.dart';
import '../services/pricing.dart';

/// Linha do carrinho: snapshot do produto + quantidade.
class CartLine {
  final String productId;
  final String name;
  final double price;
  final String imageUrl;
  final String unit;
  int quantity;

  CartLine({
    required this.productId,
    required this.name,
    required this.price,
    this.imageUrl = '',
    this.unit = '',
    this.quantity = 1,
  });

  Map<String, dynamic> toJson() => {
        'productId': productId,
        'name': name,
        'price': price,
        'imageUrl': imageUrl,
        'unit': unit,
        'quantity': quantity,
      };

  factory CartLine.fromJson(Map<String, dynamic> m) => CartLine(
        productId: (m['productId'] as String?) ?? '',
        name: (m['name'] as String?) ?? '',
        price: (m['price'] as num?)?.toDouble() ?? 0,
        imageUrl: (m['imageUrl'] as String?) ?? '',
        unit: (m['unit'] as String?) ?? '',
        quantity: (m['quantity'] as num?)?.toInt() ?? 1,
      );
}

/// Carrinho persistido offline (RF10/RF11), escopado por loja.
class CartState extends ChangeNotifier {
  final Map<String, CartLine> _lines = {};
  String? _smId;
  String? couponCode;
  double couponDiscount = 0;
  bool couponFreeShipping = false;

  List<CartLine> get lines => _lines.values.toList();
  bool get isEmpty => _lines.isEmpty;
  int get itemCount => _lines.values.fold(0, (acc, l) => acc + l.quantity);

  int quantityOf(String productId) => _lines[productId]?.quantity ?? 0;

  Future<void> loadFor(String smId) async {
    if (_smId == smId) return;
    _smId = smId;
    _lines.clear();
    _clearCoupon(notify: false);
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('cart_$smId');
    if (raw != null) {
      try {
        final list = (jsonDecode(raw) as List).whereType<Map>();
        for (final m in list) {
          final line = CartLine.fromJson(Map<String, dynamic>.from(m));
          if (line.productId.isNotEmpty) _lines[line.productId] = line;
        }
      } catch (_) {}
    }
    notifyListeners();
  }

  Future<void> _persist() async {
    final smId = _smId;
    if (smId == null) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
        'cart_$smId', jsonEncode(_lines.values.map((l) => l.toJson()).toList()));
  }

  /// Adiciona respeitando o limite de estoque. Retorna false quando travou.
  bool add(Product product, {int delta = 1}) {
    final current = _lines[product.id];
    final nextQty = (current?.quantity ?? 0) + delta;
    if (nextQty <= 0) {
      _lines.remove(product.id);
    } else {
      final stock = product.availableStock;
      if (stock != null && nextQty > stock) return false;
      _lines[product.id] = CartLine(
        productId: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl ?? '',
        unit: product.unit ?? '',
        quantity: nextQty,
      );
    }
    _persist();
    notifyListeners();
    return true;
  }

  void remove(String productId) {
    _lines.remove(productId);
    _persist();
    notifyListeners();
  }

  Future<void> clear() async {
    _lines.clear();
    _clearCoupon(notify: false);
    await _persist();
    notifyListeners();
  }

  /// Subtotal com o motor de preços (promos idênticas às da loja).
  double subtotal(List<Product> products, List<Promotion> promotions) {
    double sum = 0;
    for (final line in _lines.values) {
      Product? p;
      for (final prod in products) {
        if (prod.id == line.productId) {
          p = prod;
          break;
        }
      }
      if (p != null) {
        sum += Pricing.lineTotal(p, line.quantity, promotions);
      } else {
        sum += line.price * line.quantity;
      }
    }
    return sum;
  }

  void applyCouponResult(CouponResult result) {
    if (!result.ok) return;
    couponCode = result.code;
    couponDiscount = result.discount;
    couponFreeShipping = result.freeShipping;
    notifyListeners();
  }

  void _clearCoupon({bool notify = true}) {
    couponCode = null;
    couponDiscount = 0;
    couponFreeShipping = false;
    if (notify) notifyListeners();
  }

  void clearCoupon() => _clearCoupon();
}
