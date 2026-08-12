import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'auth.dart';
import 'order_screen.dart';

/// Histórico de pedidos (RF18) + repetir pedido em 1 toque (RF19).
class OrdersScreen extends StatelessWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();

    if (!app.isLoggedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Pedidos')),
        body: EmptyState(
          icon: Icons.receipt_long_outlined,
          title: 'Entre para ver seus pedidos',
          action: SizedBox(
            width: 200,
            child: FilledButton(
              onPressed: () => ensureLoggedIn(context),
              child: const Text('Entrar'),
            ),
          ),
        ),
      );
    }

    final active = app.orders.where((o) => o.isActive).toList();
    final finished = app.orders.where((o) => !o.isActive).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Pedidos')),
      body: app.orders.isEmpty
          ? const EmptyState(
              icon: Icons.receipt_long_outlined,
              title: 'Nenhum pedido ainda',
              subtitle: 'Seus pedidos aparecerão aqui.')
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (active.isNotEmpty) ...[
                  const Text('Em andamento',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 8),
                  for (final o in active) _OrderTile(order: o),
                  const SizedBox(height: 16),
                ],
                if (finished.isNotEmpty) ...[
                  const Text('Anteriores',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 8),
                  for (final o in finished) _OrderTile(order: o),
                ],
              ],
            ),
    );
  }
}

class _OrderTile extends StatelessWidget {
  final Order order;
  const _OrderTile({required this.order});

  @override
  Widget build(BuildContext context) {
    final label = order.isActive && order.status == 'ready' && order.deliveryStatus != null
        ? (deliveryStatusLabels[order.deliveryStatus] ?? order.deliveryStatus!)
        : (statusLabels[order.status] ?? order.status);
    final when = tsMillis(order.createdAt);
    final date = when > 0
        ? DateFormat("d 'de' MMM, HH:mm", 'pt_BR')
            .format(DateTime.fromMillisecondsSinceEpoch(when))
        : '';
    final color = order.status == 'cancelled'
        ? Colors.redAccent
        : order.isActive
            ? kGreenDark
            : Colors.grey.shade600;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Card(
        child: ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          leading: CircleAvatar(
            backgroundColor: kGreen.withValues(alpha: .12),
            backgroundImage: (order.storeLogoUrl ?? '').isNotEmpty
                ? NetworkImage(order.storeLogoUrl!)
                : null,
            child: (order.storeLogoUrl ?? '').isEmpty
                ? const Icon(Icons.store, color: kGreenDark)
                : null,
          ),
          title: Text(order.storeName,
              style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('$date · ${order.items.length} itens · ${money(order.total)}'),
              Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w700)),
              if (order.needsSubstitutionReview)
                const Text('Revisar substituições!',
                    style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.w700)),
            ],
          ),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => OrderScreen(
                  supermarketId: order.supermarketId, orderId: order.id))),
        ),
      ),
    );
  }
}
