import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

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
          if (app.storeInfo != null) _StoreInfoCard(info: app.storeInfo!),
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

/// Horário de funcionamento e endereço da loja atual, no topo da vitrine.
/// Toque abre a semana inteira e a opção de ver no mapa.
class _StoreInfoCard extends StatelessWidget {
  final StoreInfo info;
  const _StoreInfoCard({required this.info});

  @override
  Widget build(BuildContext context) {
    final open = info.isOpenNow;
    final hours = info.todayRange;
    final address = info.address ?? '';
    if (hours.isEmpty && address.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _showDetails(context),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Icon(open ? Icons.schedule : Icons.schedule_outlined,
                    color: open ? kGreenDark : Colors.redAccent),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        open ? 'Aberto agora · $hours' : 'Fechado · $hours',
                        style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 13.5,
                            color: open ? kGreenDark : Colors.redAccent),
                      ),
                      if (address.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(address,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                  fontSize: 12.5, color: Colors.grey.shade600)),
                        ),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, color: Colors.grey.shade400),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showDetails(BuildContext context) {
    final address = info.address ?? '';
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Horário de funcionamento',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
              const SizedBox(height: 10),
              for (final d in info.weeklyHours)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(d.day,
                          style: TextStyle(
                              fontWeight:
                                  d.isToday ? FontWeight.w900 : FontWeight.w600)),
                      Text(d.label,
                          style: TextStyle(
                              fontWeight:
                                  d.isToday ? FontWeight.w900 : FontWeight.w600,
                              color: d.label == 'Fechado'
                                  ? Colors.grey.shade500
                                  : null)),
                    ],
                  ),
                ),
              if (address.isNotEmpty) ...[
                const Divider(height: 28),
                const Text('Endereço',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                const SizedBox(height: 6),
                Text(address, style: TextStyle(color: Colors.grey.shade700)),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  icon: const Icon(Icons.map_outlined),
                  label: const Text('Ver no mapa'),
                  onPressed: () {
                    final query = info.lat != null && info.lng != null
                        ? '${info.lat},${info.lng}'
                        : Uri.encodeComponent(address);
                    launchUrl(
                        Uri.parse(
                            'https://www.google.com/maps/search/?api=1&query=$query'),
                        mode: LaunchMode.externalApplication);
                  },
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
