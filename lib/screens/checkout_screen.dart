import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../services/orders_repo.dart';
import '../services/pricing.dart';
import '../state/app_state.dart';
import '../state/cart_state.dart';
import '../theme.dart';
import 'addresses_screen.dart';
import 'order_screen.dart';

/// Checkout em tela única (≤3 etapas — RNF03): entrega/retirada, pagamento,
/// agendamento e revisão final (RF14–RF17).
class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  String _fulfillment = 'delivery';
  String? _payment;
  SavedAddress? _address;
  String? _scheduledFor;
  final _notes = TextEditingController();
  final _changeFor = TextEditingController();
  double _tip = 0;
  bool _placing = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final profile = context.read<AppState>().profile;
    _address ??= profile?.defaultAddress;
    // Já vem marcada a forma de pagamento preferida do perfil.
    _payment ??= profile?.defaultPaymentMethod?.isNotEmpty == true
        ? profile!.defaultPaymentMethod
        : null;
  }

  /// Opções de pagamento: cartões salvos do cliente primeiro, depois as
  /// formas que a loja aceita.
  List<(String, String)> _paymentOptions(AppState app) {
    final pm = app.storeInfo?.paymentMethods ?? const {};
    bool on(String key, {bool fallback = true}) =>
        pm.isEmpty ? fallback : pm[key] == true;
    return <(String, String)>[
      if (on('creditCardOnline'))
        for (final card in app.profile?.cards ?? const <SavedCard>[])
          if (!card.isExpired)
            ('card:${card.id}',
                card.nickname.isNotEmpty ? '${card.nickname} (${card.label})' : card.label),
      if (on('pix')) ('pix', 'PIX'),
      if (on('creditCardOnline')) ('card_online', 'Outro cartão (online)'),
      if (on('creditCardDelivery') || on('debitCardDelivery'))
        ('card_delivery', 'Cartão na entrega'),
      ('cash_delivery', 'Dinheiro'),
      if ((pm['vouchers'] as List?)?.isNotEmpty == true)
        ('voucher_delivery', 'Vale-alimentação'),
    ];
  }

  Future<void> _placeOrder() async {
    final app = context.read<AppState>();
    final cart = context.read<CartState>();

    if (_fulfillment == 'delivery' && _address == null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Escolha um endereço de entrega.')));
      return;
    }
    if (_payment == null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Escolha a forma de pagamento.')));
      return;
    }

    setState(() => _placing = true);
    try {
      final subtotal = cart.subtotal(app.products, app.promotions);
      final baseFee =
          _fulfillment == 'delivery' ? (app.deliveryConfig?.deliveryFee ?? 0) : 0.0;
      final deliveryFee = cart.couponFreeShipping ? 0.0 : baseFee;
      final discount = cart.couponDiscount;
      final total = (subtotal + deliveryFee - discount + _tip)
          .clamp(0, double.infinity)
          .toDouble();

      final items = cart.lines.map((l) {
        final p = app.productById(l.productId);
        final price = p != null
            ? Pricing.unitPrice(p, app.promotions)
            : l.price;
        return OrderItem(
          productId: l.productId,
          name: l.name,
          quantity: l.quantity,
          price: price,
          imageUrl: l.imageUrl,
          unit: l.unit,
        );
      }).toList();

      final profile = app.profile;
      // Cartão salvo vira `card_online` + os dados exibíveis do cartão, que
      // é o que a loja e o painel entendem (RNF10: sem número/CVV).
      final selectedCard = _payment!.startsWith('card:')
          ? profile?.cardById(_payment!.substring(5))
          : null;
      final orderId = await OrdersRepo.placeOrder(
        supermarketId: app.supermarketId!,
        items: items,
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        discount: discount,
        total: total,
        couponCode: cart.couponCode ?? '',
        fulfillment: _fulfillment,
        paymentMethod: selectedCard != null ? 'card_online' : _payment!,
        paymentCard: selectedCard == null
            ? null
            : {
                'brand': selectedCard.brand,
                'last4': selectedCard.last4,
                'isCredit': selectedCard.isCredit,
              },
        customerName: profile?.name ?? app.user?.displayName ?? '',
        customerPhone: profile?.phone ?? '',
        deliveryAddress: _fulfillment == 'delivery' ? _address!.toMap() : null,
        scheduledFor: _scheduledFor,
        changeFor: double.tryParse(_changeFor.text.replaceAll(',', '.')),
        notes: _notes.text.trim(),
        tip: _tip,
      );

      await cart.clear();
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(
          builder: (_) =>
              OrderScreen(supermarketId: app.supermarketId!, orderId: orderId)));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Não foi possível criar o pedido: $e')));
      }
    } finally {
      if (mounted) setState(() => _placing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final cart = context.watch<CartState>();

    final subtotal = cart.subtotal(app.products, app.promotions);
    final baseFee =
        _fulfillment == 'delivery' ? (app.deliveryConfig?.deliveryFee ?? 0) : 0.0;
    final deliveryFee = cart.couponFreeShipping ? 0.0 : baseFee;
    final total = (subtotal + deliveryFee - cart.couponDiscount + _tip)
        .clamp(0, double.infinity)
        .toDouble();

    return Scaffold(
      appBar: AppBar(title: const Text('Finalizar pedido')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 1 — Entrega ou retirada (RF14)
          const _SectionTitle('1 · Como quer receber?'),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(
                  value: 'delivery',
                  label: Text('Entrega'),
                  icon: Icon(Icons.delivery_dining)),
              ButtonSegment(
                  value: 'pickup', label: Text('Retirada'), icon: Icon(Icons.store)),
            ],
            selected: {_fulfillment},
            onSelectionChanged: (s) => setState(() => _fulfillment = s.first),
          ),
          const SizedBox(height: 12),
          if (_fulfillment == 'delivery')
            Card(
              child: ListTile(
                leading: const Icon(Icons.place_outlined),
                title: Text(_address == null
                    ? 'Escolher endereço'
                    : (_address!.nickname?.isNotEmpty == true
                        ? _address!.nickname!
                        : _address!.label)),
                subtitle: _address == null ? null : Text(_address!.oneLine),
                trailing: const Icon(Icons.chevron_right),
                onTap: () async {
                  final picked = await Navigator.of(context).push<SavedAddress>(
                      MaterialPageRoute(
                          builder: (_) => const AddressesScreen(pickMode: true)));
                  if (picked != null) setState(() => _address = picked);
                },
              ),
            )
          else
            Card(
              child: ListTile(
                leading: const Icon(Icons.store),
                title: Text(app.storeName),
                subtitle: Text(app.storeInfo?.address ?? 'Retire no balcão'),
              ),
            ),

          // 2 — Pagamento (RF15, RNF10: nunca armazenamos dados de cartão)
          const _SectionTitle('2 · Pagamento'),
          for (final (value, label) in _paymentOptions(app))
            RadioListTile<String>(
              value: value,
              groupValue: _payment,
              onChanged: (v) => setState(() => _payment = v),
              title: Text(label),
              contentPadding: EdgeInsets.zero,
            ),
          if (_payment == 'cash_delivery')
            TextField(
              controller: _changeFor,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Troco para quanto? (opcional)'),
            ),

          // 3 — Agendamento (RF16) + revisão (RF17)
          const _SectionTitle('3 · Agendamento (opcional)'),
          Wrap(
            spacing: 8,
            children: [
              ChoiceChip(
                label: const Text('O quanto antes'),
                selected: _scheduledFor == null,
                onSelected: (_) => setState(() => _scheduledFor = null),
              ),
              for (final slot in _scheduleSlots())
                ChoiceChip(
                  label: Text(slot),
                  selected: _scheduledFor == slot,
                  onSelected: (_) => setState(() => _scheduledFor = slot),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (_fulfillment == 'delivery') ...[
            const _SectionTitle('Gorjeta do entregador (opcional)'),
            Wrap(
              spacing: 8,
              children: [
                for (final v in [0.0, 2.0, 5.0, 10.0])
                  ChoiceChip(
                    label: Text(v == 0 ? 'Sem gorjeta' : money(v)),
                    selected: _tip == v,
                    onSelected: (_) => setState(() => _tip = v),
                  ),
              ],
            ),
            const SizedBox(height: 12),
          ],
          TextField(
            controller: _notes,
            maxLines: 2,
            decoration:
                const InputDecoration(labelText: 'Observações para a loja (opcional)'),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _row('Subtotal', money(subtotal)),
                  _row('Entrega', deliveryFee == 0 ? 'Grátis' : money(deliveryFee)),
                  if (cart.couponDiscount > 0)
                    _row('Desconto', '- ${money(cart.couponDiscount)}', color: kGreenDark),
                  if (_tip > 0) _row('Gorjeta', money(_tip)),
                  const Divider(height: 20),
                  _row('Total', money(total), bold: true),
                ],
              ),
            ),
          ),
          const SizedBox(height: 90),
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.all(16),
        child: FilledButton(
          onPressed: _placing ? null : _placeOrder,
          child: _placing
              ? const SizedBox(
                  width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
              : Text('Confirmar pedido · ${money(total)}'),
        ),
      ),
    );
  }

  List<String> _scheduleSlots() {
    final now = DateTime.now();
    final slots = <String>[];
    var t = DateTime(now.year, now.month, now.day, now.hour + 2);
    for (var i = 0; i < 4; i++) {
      final end = t.add(const Duration(hours: 1));
      slots.add(
          'Hoje ${t.hour.toString().padLeft(2, '0')}:00–${end.hour.toString().padLeft(2, '0')}:00');
      t = end;
      if (end.hour >= 21) break;
    }
    return slots;
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

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 16, bottom: 8),
        child:
            Text(text, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
      );
}
