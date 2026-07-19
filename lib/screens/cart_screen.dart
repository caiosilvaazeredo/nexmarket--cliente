import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/pricing.dart';
import '../state/app_state.dart';
import '../state/cart_state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'auth.dart';
import 'checkout_screen.dart';

/// Carrinho: cupom, frete, pedido mínimo e subtotal dinâmico (RF10–RF13).
class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  final _coupon = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final cart = context.watch<CartState>();

    final subtotal = cart.subtotal(app.products, app.promotions);
    final config = app.deliveryConfig;
    final baseFee = config?.deliveryFee ?? 0;
    final deliveryFee = cart.couponFreeShipping ? 0.0 : baseFee;
    final discount = cart.couponDiscount;
    final total = (subtotal + deliveryFee - discount).clamp(0, double.infinity).toDouble();

    final minimum = config?.minimum ?? 0;
    final missingForMin = (minimum - subtotal).clamp(0, double.infinity).toDouble();

    return Scaffold(
      appBar: AppBar(title: const Text('Carrinho')),
      body: cart.isEmpty
          ? const EmptyState(
              icon: Icons.shopping_cart_outlined,
              title: 'Seu carrinho está vazio',
              subtitle: 'Explore as gôndolas e adicione produtos.')
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                for (final line in cart.lines) _CartLineTile(line: line),
                const SizedBox(height: 16),
                // Cupom (RF12)
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _coupon,
                        textCapitalization: TextCapitalization.characters,
                        decoration: InputDecoration(
                          labelText: 'Cupom de desconto',
                          suffixIcon: cart.couponCode != null
                              ? IconButton(
                                  icon: const Icon(Icons.close),
                                  onPressed: () {
                                    cart.clearCoupon();
                                    _coupon.clear();
                                  })
                              : null,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 110,
                      child: FilledButton(
                        onPressed: () {
                          final res = applyCoupon(
                            _coupon.text,
                            subtotal,
                            app.promotions,
                            isFirstOrder: app.isLoggedIn ? app.isFirstOrder : null,
                            deliveryFee: baseFee,
                          );
                          cart.applyCouponResult(res);
                          ScaffoldMessenger.of(context)
                              .showSnackBar(SnackBar(content: Text(res.message)));
                        },
                        child: const Text('Aplicar'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                if (missingForMin > 0)
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                        color: Colors.orange.shade50,
                        borderRadius: BorderRadius.circular(12)),
                    child: Text(
                        'Faltam ${money(missingForMin)} para o pedido mínimo de ${money(minimum)}.',
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                  ),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        _row('Subtotal', money(subtotal)),
                        _row('Entrega',
                            deliveryFee == 0 ? 'Grátis' : money(deliveryFee)),
                        if (discount > 0)
                          _row('Desconto (${cart.couponCode})', '- ${money(discount)}',
                              color: kGreenDark),
                        const Divider(height: 20),
                        _row('Total', money(total), bold: true),
                      ],
                    ),
                  ),
                ),
              ],
            ),
      bottomNavigationBar: cart.isEmpty
          ? null
          : SafeArea(
              minimum: const EdgeInsets.all(16),
              child: FilledButton(
                onPressed: missingForMin > 0
                    ? null
                    : () async {
                        // Login só é exigido aqui (navegação livre como visitante).
                        final ok = await ensureLoggedIn(context);
                        if (ok && context.mounted) {
                          Navigator.of(context).push(MaterialPageRoute(
                              builder: (_) => const CheckoutScreen()));
                        }
                      },
                child: Text('Fechar pedido · ${money(total)}'),
              ),
            ),
    );
  }

  Widget _row(String label, String value, {bool bold = false, Color? color}) {
    final style = TextStyle(
        fontWeight: bold ? FontWeight.w900 : FontWeight.w600,
        fontSize: bold ? 17 : 14,
        color: color);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Text(label, style: style), Text(value, style: style)],
      ),
    );
  }
}

class _CartLineTile extends StatelessWidget {
  final CartLine line;
  const _CartLineTile({required this.line});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final cart = context.watch<CartState>();
    final product = app.productById(line.productId);
    final lineTotal = product != null
        ? Pricing.lineTotal(product, line.quantity, app.promotions)
        : line.price * line.quantity;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: ProductImage(
                    product?.imageUrl ?? line.imageUrl, size: 56),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(line.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    Text(money(lineTotal),
                        style: const TextStyle(fontWeight: FontWeight.w900)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 120,
                child: product != null
                    ? QtyStepper(
                        qty: line.quantity,
                        onDelta: (d) {
                          final ok = cart.add(product, delta: d);
                          if (!ok) {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                content: Text(
                                    'Limite de estoque: ${product.availableStock} un.')));
                          }
                        })
                    : IconButton(
                        icon: const Icon(Icons.delete_outline),
                        onPressed: () => cart.remove(line.productId)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
