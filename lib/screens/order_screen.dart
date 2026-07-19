import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models.dart';
import '../services/orders_repo.dart';
import '../state/app_state.dart';
import '../state/cart_state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'chat_screen.dart';

/// Acompanhamento do pedido em tempo real (RF20): status, entregador (RF21),
/// revisão de substituições, cancelamento e avaliação (RF23).
class OrderScreen extends StatelessWidget {
  final String supermarketId;
  final String orderId;
  const OrderScreen(
      {super.key, required this.supermarketId, required this.orderId});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<Order?>(
      stream: OrdersRepo.order(supermarketId, orderId),
      builder: (context, snap) {
        final order = snap.data;
        return Scaffold(
          appBar: AppBar(
            title: Text('Pedido #${orderId.substring(0, 6)}'),
            actions: [
              if (order != null)
                IconButton(
                  tooltip: 'Chat com a loja',
                  icon: const Icon(Icons.chat_bubble_outline),
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => ChatScreen(
                          supermarketId: supermarketId, orderId: orderId))),
                ),
            ],
          ),
          body: order == null
              ? (snap.connectionState == ConnectionState.waiting
                  ? const Center(child: CircularProgressIndicator())
                  : const EmptyState(
                      icon: Icons.receipt_long_outlined,
                      title: 'Pedido não encontrado'))
              : _OrderBody(order: order),
        );
      },
    );
  }
}

class _OrderBody extends StatelessWidget {
  final Order order;
  const _OrderBody({required this.order});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _StatusTracker(order: order),
        const SizedBox(height: 16),
        if (order.needsSubstitutionReview) _SubstitutionReview(order: order),
        if (order.status == 'ready' &&
            order.fulfillment == 'delivery' &&
            order.driverId != null &&
            order.deliveryStatus != 'delivered')
          _DriverPanel(order: order),
        if (order.deliveryPin != null &&
            order.fulfillment == 'delivery' &&
            !order.isFinished) ...[
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(Icons.pin_outlined, color: kGreenDark),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('PIN de entrega',
                            style: TextStyle(fontWeight: FontWeight.w800)),
                        Text('Informe ao entregador: ${order.deliveryPin}',
                            style: const TextStyle(
                                fontSize: 18, fontWeight: FontWeight.w900)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        const Text('Itens',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        const SizedBox(height: 8),
        Card(
          child: Column(
            children: [
              for (final item in order.items)
                ListTile(
                  dense: true,
                  leading: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: ProductImage(item.imageUrl, size: 40)),
                  title: Text(
                    item.substituted && item.customerDecision == 'accepted'
                        ? (item.substituteName ?? item.name)
                        : item.name,
                    style: TextStyle(
                      decoration: item.missing && item.customerDecision == 'rejected'
                          ? TextDecoration.lineThrough
                          : null,
                    ),
                  ),
                  subtitle: item.missing && item.customerDecision == 'rejected'
                      ? const Text('Removido (reembolsado)',
                          style: TextStyle(color: Colors.redAccent))
                      : null,
                  trailing: Text(
                      '${item.quantity}x ${money(item.substituted && item.substitutePrice != null && item.customerDecision == 'accepted' ? item.substitutePrice! : item.price)}'),
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _row('Subtotal', money(order.subtotal)),
                _row('Entrega',
                    order.deliveryFee == 0 ? 'Grátis' : money(order.deliveryFee)),
                if (order.discount > 0) _row('Desconto', '- ${money(order.discount)}'),
                if (order.tip > 0) _row('Gorjeta', money(order.tip)),
                const Divider(height: 20),
                _row('Total', money(order.total), bold: true),
                const SizedBox(height: 8),
                _row('Pagamento',
                    paymentLabels[order.paymentMethod] ?? order.paymentMethod),
                if (order.scheduledFor != null)
                  _row('Agendado', order.scheduledFor!),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        if ((order.paymentMethod == 'pix' || order.paymentMethod == 'card_online') &&
            order.paymentStatus == 'pending' &&
            !order.isFinished)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: FilledButton.icon(
              icon: const Icon(Icons.qr_code_2),
              label: Text(order.paymentMethod == 'pix'
                  ? 'Pagar com PIX (demo)'
                  : 'Pagar com cartão (demo)'),
              onPressed: () async {
                await OrdersRepo.markPaid(order);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Pagamento confirmado!')));
                }
              },
            ),
          ),
        if (order.canCancel)
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
                foregroundColor: Colors.redAccent,
                side: const BorderSide(color: Colors.redAccent, width: 2)),
            icon: const Icon(Icons.close),
            label: const Text('Cancelar pedido'),
            onPressed: () async {
              final ok = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Cancelar pedido?'),
                  content: const Text('Essa ação não pode ser desfeita.'),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text('Voltar')),
                    TextButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text('Cancelar pedido')),
                  ],
                ),
              );
              if (ok == true) await OrdersRepo.cancelOrder(order);
            },
          ),
        if (order.isFinished && order.status != 'cancelled')
          _RatingSection(order: order),
        if (order.isFinished) _ReorderButton(order: order),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _row(String label, String value, {bool bold = false}) {
    final style = TextStyle(
        fontWeight: bold ? FontWeight.w900 : FontWeight.w600,
        fontSize: bold ? 17 : 14);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Text(label, style: style), Text(value, style: style)],
      ),
    );
  }
}

class _StatusTracker extends StatelessWidget {
  final Order order;
  const _StatusTracker({required this.order});

  @override
  Widget build(BuildContext context) {
    if (order.status == 'cancelled') {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            const Icon(Icons.cancel, color: Colors.redAccent),
            const SizedBox(width: 12),
            Text('Pedido cancelado',
                style: TextStyle(
                    fontWeight: FontWeight.w900, color: Colors.red.shade700)),
          ]),
        ),
      );
    }

    final steps = order.fulfillment == 'pickup'
        ? const [
            ('pending', 'Recebido'),
            ('picking', 'Em separação'),
            ('ready', 'Pronto para retirada'),
            ('delivered', 'Retirado'),
          ]
        : const [
            ('pending', 'Recebido'),
            ('picking', 'Em separação'),
            ('ready', 'Saiu para entrega'),
            ('delivered', 'Entregue'),
          ];

    var currentIndex = steps.indexWhere((s) => s.$1 == order.status);
    if (order.status == 'waiting_substitution') currentIndex = 1;
    if (currentIndex < 0) currentIndex = 0;
    final delivered = order.status == 'delivered' || order.deliveryStatus == 'delivered';
    if (delivered) currentIndex = steps.length - 1;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < steps.length; i++)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Icon(
                      i < currentIndex || (i == currentIndex && delivered)
                          ? Icons.check_circle
                          : i == currentIndex
                              ? Icons.radio_button_checked
                              : Icons.radio_button_off,
                      color: i <= currentIndex ? kGreen : Colors.grey.shade300,
                    ),
                    const SizedBox(width: 10),
                    Text(steps[i].$2,
                        style: TextStyle(
                            fontWeight:
                                i == currentIndex ? FontWeight.w900 : FontWeight.w600,
                            color: i <= currentIndex
                                ? Colors.black87
                                : Colors.grey.shade500)),
                  ],
                ),
              ),
            if (order.status == 'ready' &&
                order.fulfillment == 'delivery' &&
                order.deliveryStatus != null &&
                !delivered)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  deliveryStatusLabels[order.deliveryStatus] ?? '',
                  style: const TextStyle(color: kGreenDark, fontWeight: FontWeight.w800),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Painel do entregador com rastreio ao vivo (RF21). Sem o mapa embutido,
/// mostramos distância/status e abrimos o Google Maps com um toque.
class _DriverPanel extends StatelessWidget {
  final Order order;
  const _DriverPanel({required this.order});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<PublicDriver?>(
      stream: OrdersRepo.driver(order.driverId!),
      builder: (context, snap) {
        final driver = snap.data;
        final loc = driver?.location ?? order.driverLocation;
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const CircleAvatar(child: Icon(Icons.sports_motorsports)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(driver?.name ?? order.driverName ?? 'Entregador',
                          style: const TextStyle(fontWeight: FontWeight.w800)),
                      if (driver != null)
                        Text(
                            '★ ${driver.rating.toStringAsFixed(1)}'
                            '${driver.vehicleLabel.isNotEmpty ? ' · ${driver.vehicleLabel}' : ''}',
                            style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                    ],
                  ),
                ),
                if (loc != null)
                  IconButton.filledTonal(
                    tooltip: 'Ver no mapa',
                    icon: const Icon(Icons.map_outlined),
                    onPressed: () => launchUrl(
                        Uri.parse(
                            'https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}'),
                        mode: LaunchMode.externalApplication),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Revisão de substituições sugeridas pela loja, com estorno dos recusados.
class _SubstitutionReview extends StatefulWidget {
  final Order order;
  const _SubstitutionReview({required this.order});

  @override
  State<_SubstitutionReview> createState() => _SubstitutionReviewState();
}

class _SubstitutionReviewState extends State<_SubstitutionReview> {
  final _decisions = <int, String>{};
  bool _sending = false;

  @override
  Widget build(BuildContext context) {
    final pending = <int>[];
    for (var i = 0; i < widget.order.items.length; i++) {
      final it = widget.order.items[i];
      if ((it.missing || it.substituted) &&
          (it.customerDecision.isEmpty || it.customerDecision == 'pending')) {
        pending.add(i);
      }
    }
    if (pending.isEmpty) return const SizedBox.shrink();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Revisar substituições',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            Text('Alguns itens estão em falta. Itens recusados são estornados.',
                style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
            const SizedBox(height: 12),
            for (final i in pending) _itemRow(i),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _sending || _decisions.length < pending.length
                  ? null
                  : () async {
                      setState(() => _sending = true);
                      try {
                        await OrdersRepo.respondToSubstitutions(
                            widget.order, _decisions);
                      } finally {
                        if (mounted) setState(() => _sending = false);
                      }
                    },
              child: const Text('Enviar respostas'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _itemRow(int index) {
    final it = widget.order.items[index];
    final decision = _decisions[index];
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(it.name, style: const TextStyle(fontWeight: FontWeight.w700)),
          if (it.substituted && it.substituteName != null)
            Text(
                'Sugestão: ${it.substituteName} '
                '(${it.substitutePrice != null ? money(it.substitutePrice!) : 'mesmo preço'})',
                style: const TextStyle(fontSize: 13))
          else
            const Text('Item em falta — deseja remover?',
                style: TextStyle(fontSize: 13, color: Colors.redAccent)),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: ChoiceChip(
                  label: Text(it.substituted ? 'Aceitar troca' : 'Ok, remover'),
                  selected: decision == 'accepted' ||
                      (!it.substituted && decision == 'rejected'),
                  onSelected: (_) => setState(() =>
                      _decisions[index] = it.substituted ? 'accepted' : 'rejected'),
                ),
              ),
              if (it.substituted) ...[
                const SizedBox(width: 8),
                Expanded(
                  child: ChoiceChip(
                    label: const Text('Recusar (estornar)'),
                    selected: decision == 'rejected',
                    onSelected: (_) =>
                        setState(() => _decisions[index] = 'rejected'),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _RatingSection extends StatefulWidget {
  final Order order;
  const _RatingSection({required this.order});

  @override
  State<_RatingSection> createState() => _RatingSectionState();
}

class _RatingSectionState extends State<_RatingSection> {
  int _rating = 0;
  final _comment = TextEditingController();
  final _tags = <String>{};
  bool _sent = false;

  static const _problemTags = [
    'Atraso',
    'Item faltando',
    'Item danificado',
    'Atendimento',
    'Outro',
  ];

  @override
  Widget build(BuildContext context) {
    if (widget.order.rating != null || _sent) {
      final r = widget.order.rating ?? _rating;
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              const Text('Sua avaliação: ',
                  style: TextStyle(fontWeight: FontWeight.w800)),
              StarRating(rating: r, size: 22),
            ],
          ),
        ),
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Como foi seu pedido?',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            Center(
                child: StarRating(
                    rating: _rating, onChanged: (r) => setState(() => _rating = r))),
            if (_rating > 0 && _rating <= 3) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                children: [
                  for (final t in _problemTags)
                    FilterChip(
                      label: Text(t),
                      selected: _tags.contains(t),
                      onSelected: (v) =>
                          setState(() => v ? _tags.add(t) : _tags.remove(t)),
                    ),
                ],
              ),
            ],
            if (_rating > 0) ...[
              const SizedBox(height: 8),
              TextField(
                controller: _comment,
                maxLines: 2,
                decoration:
                    const InputDecoration(labelText: 'Comentário (opcional)'),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () async {
                  await OrdersRepo.rateOrder(widget.order,
                      rating: _rating,
                      comment: _comment.text.trim(),
                      tags: _tags.toList());
                  if (mounted) setState(() => _sent = true);
                },
                child: const Text('Enviar avaliação'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Repetir pedido em 1 toque, revalidando estoque/preço atuais (RF19).
class _ReorderButton extends StatelessWidget {
  final Order order;
  const _ReorderButton({required this.order});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: OutlinedButton.icon(
        icon: const Icon(Icons.replay),
        label: const Text('Repetir pedido'),
        onPressed: () {
          final app = context.read<AppState>();
          final cart = context.read<CartState>();
          var added = 0, skipped = 0;
          for (final item in order.items) {
            final p = app.productById(item.productId);
            if (p == null || !p.active || p.outOfStock) {
              skipped++;
              continue;
            }
            final stock = p.availableStock;
            final qty = stock != null && item.quantity > stock ? stock : item.quantity;
            final current = cart.quantityOf(p.id);
            if (cart.add(p, delta: qty - current > 0 ? qty - current : 0)) added++;
          }
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(skipped == 0
                  ? '$added itens adicionados ao carrinho!'
                  : '$added itens adicionados · $skipped indisponíveis.')));
          Navigator.of(context).popUntil((r) => r.isFirst);
        },
      ),
    );
  }
}
