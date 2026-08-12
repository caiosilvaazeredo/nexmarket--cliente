import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../state/app_state.dart';
import '../widgets/common.dart';
import 'cart_screen.dart';
import 'product_screen.dart';

/// Todos os produtos de uma gôndola (RF05).
class CategoryScreen extends StatelessWidget {
  final Gondola gondola;
  const CategoryScreen({super.key, required this.gondola});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final products = app.productsInGondola(gondola.id);

    return Scaffold(
      appBar: AppBar(title: Text(gondola.name)),
      bottomSheet: CartBar(
          onTap: () => Navigator.of(context)
              .push(MaterialPageRoute(builder: (_) => const CartScreen()))),
      body: products.isEmpty
          ? const EmptyState(icon: Icons.category_outlined, title: 'Sem produtos nesta gôndola')
          : GridView.builder(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: .62,
              ),
              itemCount: products.length,
              itemBuilder: (context, i) {
                final p = products[i];
                return ProductCard(
                  product: p,
                  onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => ProductScreen(productId: p.id))),
                );
              },
            ),
    );
  }
}
