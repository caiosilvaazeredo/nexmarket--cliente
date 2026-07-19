import '../models.dart';

/// Motor de preços portado do storefront da loja — o app calcula preços
/// idênticos aos do painel (promos de produto + regras + cupons).
class Pricing {
  static bool _promoLive(dynamic promoEndsAt) {
    if (promoEndsAt == null) return true;
    final end = tsMillis(promoEndsAt);
    return end == 0 ? true : end > DateTime.now().millisecondsSinceEpoch;
  }

  /// Melhor promoção por regra (produto > subcategoria > categoria).
  static Promotion? rulePromotion(Product product, List<Promotion> promotions) {
    final applicable = promotions.where((p) {
      if ((p.couponCode ?? '').isNotEmpty) return false; // cupom só via carrinho
      if (p.targetType == 'product' && p.targetId == product.id) return true;
      if (p.targetType == 'subcategory' && p.targetId == product.subcategory) return true;
      if (p.targetType == 'category' && p.targetId == product.gondolaId) return true;
      return false;
    }).toList();
    if (applicable.isEmpty) return null;
    const rank = {'product': 1, 'subcategory': 2, 'category': 3};
    applicable.sort((a, b) => (rank[a.targetType] ?? 9).compareTo(rank[b.targetType] ?? 9));
    return applicable.first;
  }

  /// Preço unitário efetivo (menor entre promo do produto e regra).
  static double unitPrice(Product product, List<Promotion> promotions) {
    var price = product.price;
    if (product.inPromo && product.promoPrice != null && _promoLive(product.promoEndsAt)) {
      price = price < product.promoPrice! ? price : product.promoPrice!;
    }
    final rule = rulePromotion(product, promotions);
    if (rule != null) {
      if (rule.type == 'percentage') {
        final p = product.price * (1 - rule.value / 100);
        price = price < p ? price : p;
      } else if (rule.type == 'fixed') {
        final p = (product.price - rule.value).clamp(0, double.infinity).toDouble();
        price = price < p ? price : p;
      }
    }
    return price < 0 ? 0 : price;
  }

  /// Total da linha, aplicando promoções "leve X por Y" quando presentes.
  static double lineTotal(Product product, int qty, List<Promotion> promotions) {
    final rule = rulePromotion(product, promotions);
    if (rule != null && rule.type == 'quantity' && (rule.requiredQuantity ?? 0) > 0) {
      final sets = qty ~/ rule.requiredQuantity!;
      final remainder = qty % rule.requiredQuantity!;
      return sets * rule.value + remainder * product.price;
    }
    return unitPrice(product, promotions) * qty;
  }

  static bool hasDiscount(Product product, List<Promotion> promotions) =>
      unitPrice(product, promotions) < product.price - 0.001 ||
      rulePromotion(product, promotions) != null;

  /// Selo de desconto ("-15%" ou "OFERTA"), ou null.
  static String? promoBadge(Product product, List<Promotion> promotions) {
    final rule = rulePromotion(product, promotions);
    if (rule != null) {
      return rule.type == 'percentage' ? '-${rule.value.toStringAsFixed(0)}%' : 'OFERTA';
    }
    if (product.inPromo &&
        product.promoPrice != null &&
        _promoLive(product.promoEndsAt) &&
        product.promoPrice! < product.price) {
      final pct = ((1 - product.promoPrice! / product.price) * 100).round();
      return pct > 0 ? '-$pct%' : 'OFERTA';
    }
    return null;
  }
}

class CouponResult {
  final bool ok;
  final String code;
  final double discount;
  final bool freeShipping;
  final String message;
  CouponResult(this.ok, this.code, this.discount, this.freeShipping, this.message);
}

/// Valida e aplica um cupom (RF12 + fluxos alternativos).
CouponResult applyCoupon(
  String rawCode,
  double subtotal,
  List<Promotion> promotions, {
  bool? isFirstOrder,
  double deliveryFee = 0,
}) {
  final code = rawCode.trim().toUpperCase();
  CouponResult fail(String msg) => CouponResult(false, code, 0, false, msg);

  if (code.isEmpty) return fail('Digite um cupom.');

  Promotion? promo;
  for (final p in promotions) {
    if ((p.couponCode ?? '').toUpperCase() == code) {
      promo = p;
      break;
    }
  }
  if (promo == null) return fail('Cupom inválido ou expirado.');

  if (promo.firstOrderOnly && isFirstOrder == false) {
    return fail('Este cupom é exclusivo para novos clientes.');
  }

  final min = promo.minSubtotal ?? promo.requiredQuantity?.toDouble() ?? 0;
  if (min > 0 && subtotal < min) {
    final falta = (min - subtotal).toStringAsFixed(2).replaceAll('.', ',');
    return fail('Adicione mais R\$ $falta para usar este cupom.');
  }

  double discount = 0;
  var freeShipping = false;
  String label;

  if (promo.type == 'free_shipping') {
    freeShipping = true;
    discount = deliveryFee;
    label = 'frete grátis';
  } else if (promo.type == 'percentage') {
    discount = subtotal * (promo.value / 100);
    label = '${promo.value.toStringAsFixed(0)}% de desconto';
  } else {
    discount = promo.value;
    label = 'R\$ ${promo.value.toStringAsFixed(2).replaceAll('.', ',')} de desconto';
  }

  if (promo.maxDiscount != null && promo.type != 'free_shipping') {
    discount = discount > promo.maxDiscount! ? promo.maxDiscount! : discount;
  }
  discount = discount.clamp(0, subtotal + deliveryFee).toDouble();

  return CouponResult(true, code, discount, freeShipping, 'Cupom aplicado: $label!');
}
