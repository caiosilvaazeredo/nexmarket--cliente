import 'package:flutter_test/flutter_test.dart';
import 'package:nexmarket_cliente/models.dart';
import 'package:nexmarket_cliente/services/pricing.dart';

Product p({
  String id = 'p1',
  String gondolaId = 'g1',
  double price = 10,
  bool inPromo = false,
  double? promoPrice,
  dynamic promoEndsAt,
  String? subcategory,
}) =>
    Product(
      id: id,
      gondolaId: gondolaId,
      name: 'Produto',
      price: price,
      inPromo: inPromo,
      promoPrice: promoPrice,
      promoEndsAt: promoEndsAt,
      subcategory: subcategory,
    );

Promotion promo({
  String id = 'promo1',
  String targetType = 'product',
  String targetId = 'p1',
  String type = 'percentage',
  double value = 10,
  int? requiredQuantity,
  String? couponCode,
  double? minSubtotal,
  double? maxDiscount,
  bool firstOrderOnly = false,
}) =>
    Promotion(
      id: id,
      active: true,
      targetType: targetType,
      targetId: targetId,
      type: type,
      value: value,
      requiredQuantity: requiredQuantity,
      couponCode: couponCode,
      minSubtotal: minSubtotal,
      maxDiscount: maxDiscount,
      firstOrderOnly: firstOrderOnly,
    );

void main() {
  group('Motor de preços (idêntico ao storefront da loja)', () {
    test('sem promoção usa o preço cheio', () {
      expect(Pricing.unitPrice(p(), []), 10);
      expect(Pricing.hasDiscount(p(), []), isFalse);
      expect(Pricing.promoBadge(p(), []), isNull);
    });

    test('promo do produto (promoPrice) vence quando menor', () {
      final prod = p(inPromo: true, promoPrice: 7.5);
      expect(Pricing.unitPrice(prod, []), 7.5);
      expect(Pricing.promoBadge(prod, []), '-25%');
    });

    test('promo do produto expirada é ignorada', () {
      final past = DateTime.now().millisecondsSinceEpoch - 1000;
      final prod = p(inPromo: true, promoPrice: 5, promoEndsAt: past);
      expect(Pricing.unitPrice(prod, []), 10);
    });

    test('regra percentual sobre o produto', () {
      final rules = [promo(type: 'percentage', value: 20)];
      expect(Pricing.unitPrice(p(), rules), closeTo(8, 0.001));
      expect(Pricing.promoBadge(p(), rules), '-20%');
    });

    test('regra fixa nunca deixa preço negativo', () {
      final rules = [promo(type: 'fixed', value: 15)];
      expect(Pricing.unitPrice(p(), rules), 0);
    });

    test('prioridade: produto > subcategoria > categoria', () {
      final rules = [
        promo(id: 'cat', targetType: 'category', targetId: 'g1', value: 5),
        promo(id: 'prod', targetType: 'product', targetId: 'p1', value: 30),
        promo(
            id: 'sub',
            targetType: 'subcategory',
            targetId: 'laticinios',
            value: 10),
      ];
      final prod = p(subcategory: 'laticinios');
      // A regra de produto (30%) tem prioridade.
      expect(Pricing.unitPrice(prod, rules), closeTo(7, 0.001));
    });

    test('promo por quantidade (leve 3 por R\$ 25)', () {
      final rules = [
        promo(type: 'quantity', value: 25, requiredQuantity: 3),
      ];
      expect(Pricing.lineTotal(p(), 3, rules), 25);
      expect(Pricing.lineTotal(p(), 4, rules), 35); // 25 + 1x10
      expect(Pricing.lineTotal(p(), 7, rules), 60); // 2x25 + 1x10
    });

    test('promoção com couponCode NÃO se aplica automaticamente', () {
      final rules = [promo(value: 50, couponCode: 'SO NO CARRINHO')];
      expect(Pricing.unitPrice(p(), rules), 10);
    });
  });

  group('Cupons (RF12)', () {
    final promos = [
      promo(id: 'c10', type: 'percentage', value: 10, couponCode: 'DEZ'),
      promo(
          id: 'cmax',
          type: 'percentage',
          value: 50,
          couponCode: 'METADE',
          maxDiscount: 20),
      promo(id: 'cfix', type: 'fixed', value: 15, couponCode: 'QUINZE', minSubtotal: 50),
      promo(id: 'cship', type: 'free_shipping', value: 0, couponCode: 'FRETEGRATIS'),
      promo(
          id: 'cnew',
          type: 'percentage',
          value: 25,
          couponCode: 'PRIMEIRA',
          firstOrderOnly: true),
    ];

    test('cupom inválido', () {
      final r = applyCoupon('NAOEXISTE', 100, promos);
      expect(r.ok, isFalse);
    });

    test('percentual simples', () {
      final r = applyCoupon('dez', 100, promos);
      expect(r.ok, isTrue);
      expect(r.discount, closeTo(10, 0.001));
    });

    test('maxDiscount limita o desconto', () {
      final r = applyCoupon('METADE', 100, promos);
      expect(r.discount, 20);
    });

    test('minSubtotal bloqueia abaixo do mínimo', () {
      expect(applyCoupon('QUINZE', 40, promos).ok, isFalse);
      expect(applyCoupon('QUINZE', 60, promos).ok, isTrue);
    });

    test('frete grátis desconta o valor do frete', () {
      final r = applyCoupon('FRETEGRATIS', 100, promos, deliveryFee: 8.9);
      expect(r.ok, isTrue);
      expect(r.freeShipping, isTrue);
      expect(r.discount, closeTo(8.9, 0.001));
    });

    test('firstOrderOnly bloqueia quem já comprou', () {
      expect(applyCoupon('PRIMEIRA', 100, promos, isFirstOrder: false).ok, isFalse);
      expect(applyCoupon('PRIMEIRA', 100, promos, isFirstOrder: true).ok, isTrue);
    });
  });
}
