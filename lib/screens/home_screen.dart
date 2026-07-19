import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'category_screen.dart';
import 'order_screen.dart';
import 'product_screen.dart';
import 'store_picker.dart';

/// Vitrine: gôndolas em carrossel, destaques e status da loja (RF05).
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final open = app.storeInfo?.isOpenNow ?? true;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(app.storeName, maxLines: 1, overflow: TextOverflow.ellipsis),
            Text(
              open ? (app.storeInfo?.todayLabel ?? '') : 'Loja fechada agora',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: open ? Colors.grey.shade600 : Colors.redAccent),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Trocar de loja',
            icon: const Icon(Icons.swap_horiz),
            onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const StorePickerScreen())),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 96),
        children: [
          for (final order in app.activeOrders.take(2))
            _ActiveOrderBanner(order: order),
          if (app.deliveryConfig?.surgeActive == true)
            Container(
              margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.orange.shade50,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(children: [
                Icon(Icons.bolt, color: Colors.orange),
                SizedBox(width: 8),
                Expanded(
                    child: Text('Alta demanda: o frete pode estar mais caro agora.',
                        style: TextStyle(fontWeight: FontWeight.w600))),
              ]),
            ),
          if (app.gondolas.isEmpty && app.products.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 120),
              child: Center(child: CircularProgressIndicator()),
            ),
          for (final gondola in app.gondolas)
            _GondolaSection(gondola: gondola, products: app.productsInGondola(gondola.id)),
        ],
      ),
    );
  }
}

class _ActiveOrderBanner extends StatelessWidget {
  final Order order;
  const _ActiveOrderBanner({required this.order});

  @override
  Widget build(BuildContext context) {
    final label = order.deliveryStatus != null && order.status == 'ready'
        ? (deliveryStatusLabels[order.deliveryStatus] ?? order.deliveryStatus!)
        : (statusLabels[order.status] ?? order.status);
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Material(
        color: kGreen.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => OrderScreen(
                  supermarketId: order.supermarketId, orderId: order.id))),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                const Icon(Icons.delivery_dining, color: kGreenDark),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Pedido #${order.id.substring(0, 6)} — $label',
                          style: const TextStyle(fontWeight: FontWeight.w800)),
                      if (order.needsSubstitutionReview)
                        const Text('Toque para revisar substituições!',
                            style: TextStyle(color: Colors.redAccent, fontSize: 12)),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: kGreenDark),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _GondolaSection extends StatelessWidget {
  final Gondola gondola;
  final List<Product> products;
  const _GondolaSection({required this.gondola, required this.products});

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(gondola.name,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => CategoryScreen(gondola: gondola))),
                child: const Text('Ver tudo'),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 250,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: products.length.clamp(0, 10),
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (context, i) {
              final p = products[i];
              return SizedBox(
                width: 150,
                child: ProductCard(
                  product: p,
                  onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => ProductScreen(productId: p.id))),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
