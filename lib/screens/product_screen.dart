import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/pricing.dart';
import '../state/app_state.dart';
import '../state/cart_state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'cart_screen.dart';

/// Detalhe do produto: foto, unidade, descrição e tabela nutricional (RF08),
/// preço "de/por" (RF09). Assina o produto ao vivo — preço/estoque atualizam
/// em tempo real (RNF06).
class ProductScreen extends StatelessWidget {
  final String productId;
  const ProductScreen({super.key, required this.productId});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final cart = context.watch<CartState>();
    final product = app.productById(productId);

    if (product == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const EmptyState(
            icon: Icons.inventory_2_outlined, title: 'Produto indisponível'),
      );
    }

    final unitPrice = Pricing.unitPrice(product, app.promotions);
    final discounted = unitPrice < product.price - 0.001;
    final badge = Pricing.promoBadge(product, app.promotions);
    final qty = cart.quantityOf(product.id);
    final stock = product.availableStock;

    return Scaffold(
      appBar: AppBar(title: Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis)),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 120),
        children: [
          Stack(
            children: [
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: ProductImage(product.imageUrl, size: 240),
                  ),
                ),
              ),
              if (badge != null)
                Positioned(
                  top: 20,
                  left: 20,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                        color: Colors.redAccent, borderRadius: BorderRadius.circular(10)),
                    child: Text(badge,
                        style: const TextStyle(
                            color: Colors.white, fontWeight: FontWeight.w900)),
                  ),
                ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(product.name,
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
                if ((product.brand ?? '').isNotEmpty || (product.unit ?? '').isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      [product.brand, product.unit]
                          .where((s) => (s ?? '').isNotEmpty)
                          .join(' · '),
                      style: TextStyle(color: Colors.grey.shade600),
                    ),
                  ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (discounted)
                      Padding(
                        padding: const EdgeInsets.only(right: 8, bottom: 3),
                        child: Text(money(product.price),
                            style: TextStyle(
                                color: Colors.grey.shade500,
                                decoration: TextDecoration.lineThrough)),
                      ),
                    Text(money(unitPrice),
                        style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w900,
                            color: discounted ? Colors.redAccent : Colors.black87)),
                  ],
                ),
                if (stock != null && stock > 0 && stock <= 5)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('Só $stock em estoque!',
                        style: const TextStyle(
                            color: Colors.orange, fontWeight: FontWeight.w700)),
                  ),
                if (product.tags.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Wrap(
                      spacing: 6,
                      children: [
                        for (final t in product.tags)
                          Chip(
                              label: Text(t),
                              visualDensity: VisualDensity.compact,
                              backgroundColor: kGreen.withValues(alpha: .12)),
                      ],
                    ),
                  ),
                if ((product.description ?? '').isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const Text('Descrição',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  Text(product.description!,
                      style: TextStyle(color: Colors.grey.shade700, height: 1.4)),
                ],
                if (product.nutrition.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const Text('Tabela nutricional',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        children: [
                          for (final e in product.nutrition.entries)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 3),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(e.key),
                                  Text(e.value,
                                      style:
                                          const TextStyle(fontWeight: FontWeight.w700)),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.all(16),
        child: product.outOfStock
            ? OutlinedButton.icon(
                icon: const Icon(Icons.notifications_outlined),
                label: const Text('Avise-me quando chegar'),
                onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Beleza! Vamos te avisar quando voltar.'))),
              )
            : qty == 0
                ? FilledButton(
                    onPressed: () => cart.add(product),
                    child: Text('Adicionar · ${money(unitPrice)}'),
                  )
                : Row(
                    children: [
                      SizedBox(width: 140, child: QtyStepper(qty: qty, onDelta: (d) {
                        final ok = cart.add(product, delta: d);
                        if (!ok) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                              content:
                                  Text('Limite de estoque: ${product.availableStock} un.')));
                        }
                      })),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton(
                          onPressed: () => Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => const CartScreen())),
                          child: const Text('Ver carrinho'),
                        ),
                      ),
                    ],
                  ),
      ),
    );
  }
}
