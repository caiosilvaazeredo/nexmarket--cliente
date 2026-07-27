import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../services/cards.dart';
import '../services/customers_repo.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// Formas de pagamento do cliente: cartões salvos + as opções que a loja
/// aceita (PIX, dinheiro, vale). RNF10 — o número do cartão e o CVV são
/// usados só para validar na tela; o app guarda apenas bandeira, os últimos
/// 4 dígitos e a validade.
class PaymentMethodsScreen extends StatelessWidget {
  const PaymentMethodsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final profile = app.profile;
    final cards = profile?.cards ?? const <SavedCard>[];
    final pm = app.storeInfo?.paymentMethods ?? const {};
    bool accepts(String key) => pm.isEmpty || pm[key] == true;

    return Scaffold(
      appBar: AppBar(title: const Text('Formas de pagamento')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Meus cartões',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          if (cards.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    Icon(Icons.credit_card_off_outlined,
                        size: 40, color: Colors.grey.shade300),
                    const SizedBox(height: 8),
                    const Text('Nenhum cartão salvo',
                        style: TextStyle(fontWeight: FontWeight.w800)),
                    Text('Salve um cartão para agilizar o checkout.',
                        textAlign: TextAlign.center,
                        style:
                            TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                  ],
                ),
              ),
            )
          else
            for (final card in cards)
              _CardTile(
                card: card,
                isDefault: profile?.defaultPaymentMethod == 'card:${card.id}',
                onSetDefault: () => CustomersRepo.setDefaultPaymentMethod(
                    profile!.uid, 'card:${card.id}'),
                onDelete: () => _deleteCard(context, card),
              ),
          const SizedBox(height: 12),
          FilledButton.icon(
            icon: const Icon(Icons.add),
            label: const Text('Adicionar cartão'),
            onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const AddCardScreen())),
          ),

          const SizedBox(height: 24),
          const Text('Outras formas aceitas nesta loja',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                if (accepts('pix'))
                  _OptionTile(
                    icon: Icons.pix,
                    title: 'PIX',
                    subtitle: 'Pague na hora, sem taxas',
                    selected: profile?.defaultPaymentMethod == 'pix',
                    onTap: profile == null
                        ? null
                        : () => CustomersRepo.setDefaultPaymentMethod(
                            profile.uid, 'pix'),
                  ),
                _OptionTile(
                  icon: Icons.payments_outlined,
                  title: 'Dinheiro na entrega',
                  subtitle: 'Você informa o troco no checkout',
                  selected: profile?.defaultPaymentMethod == 'cash_delivery',
                  onTap: profile == null
                      ? null
                      : () => CustomersRepo.setDefaultPaymentMethod(
                          profile.uid, 'cash_delivery'),
                ),
                if (accepts('creditCardDelivery') || accepts('debitCardDelivery'))
                  _OptionTile(
                    icon: Icons.credit_card,
                    title: 'Cartão na entrega',
                    subtitle: 'Maquininha do entregador',
                    selected: profile?.defaultPaymentMethod == 'card_delivery',
                    onTap: profile == null
                        ? null
                        : () => CustomersRepo.setDefaultPaymentMethod(
                            profile.uid, 'card_delivery'),
                  ),
                if ((pm['vouchers'] as List?)?.isNotEmpty == true)
                  _OptionTile(
                    icon: Icons.card_giftcard,
                    title: 'Vale-alimentação',
                    subtitle: (pm['vouchers'] as List).join(', '),
                    selected:
                        profile?.defaultPaymentMethod == 'voucher_delivery',
                    onTap: profile == null
                        ? null
                        : () => CustomersRepo.setDefaultPaymentMethod(
                            profile.uid, 'voucher_delivery'),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Icon(Icons.lock_outline, size: 16, color: Colors.grey.shade500),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                    'Guardamos apenas a bandeira e os 4 últimos dígitos. '
                    'O número completo e o CVV nunca são salvos.',
                    style:
                        TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _deleteCard(BuildContext context, SavedCard card) async {
    final app = context.read<AppState>();
    final profile = app.profile;
    if (profile == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remover cartão?'),
        content: Text('O cartão ${card.label} será removido da sua conta.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancelar')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Remover',
                  style: TextStyle(color: Colors.redAccent))),
        ],
      ),
    );
    if (ok != true) return;
    final remaining = profile.cards.where((c) => c.id != card.id).toList();
    await CustomersRepo.saveCards(
      profile.uid,
      remaining,
      // Se o cartão removido era o padrão, limpa a preferência.
      defaultPaymentMethod:
          profile.defaultPaymentMethod == 'card:${card.id}' ? '' : null,
    );
  }
}

class _CardTile extends StatelessWidget {
  final SavedCard card;
  final bool isDefault;
  final VoidCallback onSetDefault;
  final VoidCallback onDelete;

  const _CardTile({
    required this.card,
    required this.isDefault,
    required this.onSetDefault,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final expired = card.isExpired;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Card(
        child: ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          leading: CircleAvatar(
            backgroundColor: kGreen.withValues(alpha: .15),
            child: const Icon(Icons.credit_card, color: kGreenDark),
          ),
          title: Row(
            children: [
              Flexible(
                child: Text(
                    card.nickname.isNotEmpty ? card.nickname : card.label,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
              if (isDefault)
                Container(
                  margin: const EdgeInsets.only(left: 8),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                      color: kGreen.withValues(alpha: .18),
                      borderRadius: BorderRadius.circular(8)),
                  child: const Text('Padrão',
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          color: kGreenDark)),
                ),
            ],
          ),
          subtitle: Text(
            [
              if (card.nickname.isNotEmpty) card.label,
              card.isCredit ? 'Crédito' : 'Débito',
              if (card.expiry.isNotEmpty)
                expired ? 'Vencido em ${card.expiry}' : 'Vence ${card.expiry}',
            ].join(' · '),
            style: TextStyle(
                fontSize: 12.5,
                color: expired ? Colors.redAccent : Colors.grey.shade600),
          ),
          trailing: PopupMenuButton<String>(
            onSelected: (v) => v == 'default' ? onSetDefault() : onDelete(),
            itemBuilder: (_) => [
              if (!isDefault)
                const PopupMenuItem(
                    value: 'default', child: Text('Definir como padrão')),
              const PopupMenuItem(value: 'delete', child: Text('Remover')),
            ],
          ),
        ),
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback? onTap;

  const _OptionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: selected ? kGreenDark : Colors.grey.shade600),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Text(subtitle, style: const TextStyle(fontSize: 12.5)),
      trailing: selected
          ? const Icon(Icons.check_circle, color: kGreen)
          : const Icon(Icons.radio_button_off, color: Colors.grey),
      onTap: onTap,
    );
  }
}

/// Cadastro de cartão. O número é validado por Luhn na tela e descartado —
/// só bandeira, últimos 4 e validade seguem para o banco (RNF10).
class AddCardScreen extends StatefulWidget {
  const AddCardScreen({super.key});

  @override
  State<AddCardScreen> createState() => _AddCardScreenState();
}

class _AddCardScreenState extends State<AddCardScreen> {
  final _number = TextEditingController();
  final _holder = TextEditingController();
  final _month = TextEditingController();
  final _year = TextEditingController();
  final _cvv = TextEditingController();
  final _nickname = TextEditingController();
  bool _isCredit = true;
  bool _saving = false;
  String? _error;

  String get _brand => detectBrand(_number.text);

  Future<void> _save() async {
    final app = context.read<AppState>();
    final profile = app.profile;
    if (profile == null) return;

    if (!isValidCardNumber(_number.text)) {
      setState(() => _error = 'Número de cartão inválido.');
      return;
    }
    if (_holder.text.trim().isEmpty) {
      setState(() => _error = 'Informe o nome impresso no cartão.');
      return;
    }
    if (!isValidExpiry(_month.text, _year.text)) {
      setState(() => _error = 'Validade inválida ou vencida.');
      return;
    }
    if (!isValidCvv(_cvv.text, _brand)) {
      setState(() => _error =
          'CVV inválido (${_brand == 'amex' ? '4' : '3'} dígitos).');
      return;
    }

    setState(() {
      _error = null;
      _saving = true;
    });
    try {
      final card = SavedCard(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        brand: _brand,
        // Só os 4 últimos: o PAN completo morre com esta tela.
        last4: last4Of(_number.text),
        holderName: _holder.text.trim(),
        expMonth: onlyDigits(_month.text).padLeft(2, '0'),
        expYear: onlyDigits(_year.text),
        nickname: _nickname.text.trim(),
        isCredit: _isCredit,
      );
      final cards = [...profile.cards, card];
      await CustomersRepo.saveCards(profile.uid, cards,
          // Primeiro cartão já vira o padrão.
          defaultPaymentMethod:
              profile.cards.isEmpty ? 'card:${card.id}' : null);
      if (mounted) Navigator.of(context).pop();
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final brandLabel = _number.text.isEmpty
        ? ''
        : SavedCard(id: '', brand: _brand, last4: '').brandLabel;

    return Scaffold(
      appBar: AppBar(title: const Text('Adicionar cartão')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _number,
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(19),
            ],
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: 'Número do cartão',
              hintText: '0000 0000 0000 0000',
              suffixText: brandLabel,
            ),
          ),
          if (_number.text.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6, left: 4),
              child: Text(formatCardNumber(_number.text),
                  style: TextStyle(
                      letterSpacing: 1.5,
                      color: Colors.grey.shade600,
                      fontWeight: FontWeight.w700)),
            ),
          const SizedBox(height: 12),
          TextField(
            controller: _holder,
            textCapitalization: TextCapitalization.characters,
            decoration:
                const InputDecoration(labelText: 'Nome impresso no cartão'),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _month,
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(2),
                  ],
                  decoration: const InputDecoration(labelText: 'Mês (MM)'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _year,
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(4),
                  ],
                  decoration: const InputDecoration(labelText: 'Ano (AA)'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _cvv,
                  keyboardType: TextInputType.number,
                  obscureText: true,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(4),
                  ],
                  decoration: const InputDecoration(labelText: 'CVV'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: true, label: Text('Crédito')),
              ButtonSegment(value: false, label: Text('Débito')),
            ],
            selected: {_isCredit},
            onSelectionChanged: (s) => setState(() => _isCredit = s.first),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _nickname,
            decoration: const InputDecoration(
                labelText: 'Apelido (opcional)', hintText: 'Ex.: Cartão do mês'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!,
                style: const TextStyle(
                    color: Colors.redAccent, fontWeight: FontWeight.w700)),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Salvar cartão'),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Icon(Icons.lock_outline, size: 16, color: Colors.grey.shade500),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                    'O número e o CVV são usados apenas para validar aqui e '
                    'não são gravados em nenhum servidor.',
                    style:
                        TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Favoritos do cliente (RF: lista de produtos favoritos).
class FavoritesScreen extends StatelessWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final ids = app.profile?.favorites ?? const <String>[];
    final products = ids
        .map(app.productById)
        .whereType<Product>()
        .where((p) => p.active)
        .toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Favoritos')),
      body: products.isEmpty
          ? EmptyState(
              icon: Icons.favorite_border,
              title: ids.isEmpty
                  ? 'Nenhum favorito ainda'
                  : 'Seus favoritos não estão nesta loja',
              subtitle: ids.isEmpty
                  ? 'Toque no coração de um produto para salvá-lo aqui.'
                  : 'Troque de mercado para vê-los.',
            )
          : GridView.builder(
              padding: const EdgeInsets.all(16),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: .62,
              ),
              itemCount: products.length,
              itemBuilder: (context, i) => ProductCard(product: products[i]),
            ),
    );
  }
}
