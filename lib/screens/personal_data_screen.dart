import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../services/cards.dart';
import '../services/customers_repo.dart';
import '../state/app_state.dart';
import '../theme.dart';

/// Dados pessoais do cliente (nome, telefone, CPF). O e-mail vem da conta e
/// não é editável aqui.
class PersonalDataScreen extends StatefulWidget {
  const PersonalDataScreen({super.key});

  @override
  State<PersonalDataScreen> createState() => _PersonalDataScreenState();
}

class _PersonalDataScreenState extends State<PersonalDataScreen> {
  late final TextEditingController _name;
  late final TextEditingController _phone;
  late final TextEditingController _cpf;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final p = context.read<AppState>().profile;
    _name = TextEditingController(text: p?.name ?? '');
    _phone = TextEditingController(text: p?.phone ?? '');
    _cpf = TextEditingController(text: p?.cpf ?? '');
  }

  Future<void> _save() async {
    final app = context.read<AppState>();
    final uid = app.user?.uid;
    if (uid == null) return;

    if (_name.text.trim().isEmpty) {
      setState(() => _error = 'Informe seu nome.');
      return;
    }
    final phoneDigits = onlyDigits(_phone.text);
    if (phoneDigits.length < 10) {
      setState(() => _error = 'Telefone incompleto (com DDD).');
      return;
    }
    if (_cpf.text.trim().isNotEmpty && !isValidCpf(_cpf.text)) {
      setState(() => _error = 'CPF inválido.');
      return;
    }

    setState(() {
      _error = null;
      _saving = true;
    });
    try {
      await CustomersRepo.update(uid, {
        'name': _name.text.trim(),
        'phone': _phone.text.trim(),
        'cpf': onlyDigits(_cpf.text),
      });
      await app.user?.updateDisplayName(_name.text.trim());
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Dados atualizados!')));
        Navigator.of(context).pop();
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();

    return Scaffold(
      appBar: AppBar(title: const Text('Dados pessoais')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _name,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Nome completo'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
                labelText: 'Celular (com DDD)', hintText: '(21) 99999-9999'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _cpf,
            keyboardType: TextInputType.number,
            inputFormatters: [LengthLimitingTextInputFormatter(14)],
            decoration: const InputDecoration(
                labelText: 'CPF (opcional)',
                helperText: 'Usado para nota fiscal'),
          ),
          const SizedBox(height: 12),
          TextField(
            enabled: false,
            controller: TextEditingController(
                text: app.profile?.email ?? app.user?.email ?? ''),
            decoration: const InputDecoration(
                labelText: 'E-mail', helperText: 'Vinculado à sua conta'),
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
                : const Text('Salvar'),
          ),
        ],
      ),
    );
  }
}

/// Notificações e privacidade (LGPD — opt-in de marketing separado).
class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final profile = app.profile;
    final prefs = profile?.preferences;
    if (profile == null || prefs == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Notificações')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Column(
              children: [
                SwitchListTile(
                  secondary: const Icon(Icons.notifications_active_outlined),
                  title: const Text('Status dos pedidos'),
                  subtitle: const Text(
                      'Avisos quando o pedido é separado, sai e chega'),
                  value: prefs.pushEnabled,
                  onChanged: (v) => CustomersRepo.savePreferences(
                      profile.uid, prefs.copyWith(pushEnabled: v)),
                ),
                const Divider(height: 1),
                SwitchListTile(
                  secondary: const Icon(Icons.local_offer_outlined),
                  title: const Text('Ofertas e novidades'),
                  subtitle: const Text('Promoções da loja e cupons'),
                  value: prefs.marketingOptIn,
                  onChanged: (v) => CustomersRepo.savePreferences(
                      profile.uid, prefs.copyWith(marketingOptIn: v)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(
              'Você pode mudar isso quando quiser. Avisos de status são '
              'importantes para acompanhar a entrega.',
              style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600)),
        ],
      ),
    );
  }
}

/// Cupons disponíveis na loja atual — o cliente copia e usa no carrinho.
class CouponsScreen extends StatelessWidget {
  const CouponsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final coupons = app.promotions
        .where((p) => (p.couponCode ?? '').isNotEmpty)
        .toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Cupons')),
      body: coupons.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.local_activity_outlined,
                        size: 64, color: Colors.grey.shade300),
                    const SizedBox(height: 12),
                    const Text('Nenhum cupom disponível',
                        style: TextStyle(fontWeight: FontWeight.w800)),
                    Text('Volte depois — a loja publica cupons por aqui.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.grey.shade600)),
                  ],
                ),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: coupons.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final c = coupons[i];
                final desc = switch (c.type) {
                  'percentage' => '${c.value.toStringAsFixed(0)}% de desconto',
                  'free_shipping' => 'Frete grátis',
                  _ => '${money(c.value)} de desconto',
                };
                final rules = <String>[
                  if ((c.minSubtotal ?? 0) > 0)
                    'Pedido mínimo ${money(c.minSubtotal!)}',
                  if ((c.maxDiscount ?? 0) > 0)
                    'Limite ${money(c.maxDiscount!)}',
                  if (c.firstOrderOnly) 'Só na 1ª compra',
                ];
                return Card(
                  child: ListTile(
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    leading: CircleAvatar(
                      backgroundColor: kGreen.withValues(alpha: .15),
                      child: const Icon(Icons.local_activity, color: kGreenDark),
                    ),
                    title: Text(c.title?.isNotEmpty == true ? c.title! : desc,
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: Text(
                        [desc, ...rules].join(' · '),
                        style: const TextStyle(fontSize: 12.5)),
                    trailing: TextButton.icon(
                      icon: const Icon(Icons.copy, size: 16),
                      label: Text(c.couponCode!),
                      onPressed: () {
                        Clipboard.setData(
                            ClipboardData(text: c.couponCode!));
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                            content: Text(
                                'Cupom ${c.couponCode} copiado! Use no carrinho.')));
                      },
                    ),
                  ),
                );
              },
            ),
    );
  }
}
