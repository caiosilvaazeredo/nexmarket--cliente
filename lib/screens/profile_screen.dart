import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/customers_repo.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'addresses_screen.dart';
import 'auth.dart';
import 'store_picker.dart';

/// Perfil: dados, endereços, suporte e LGPD (RNF12).
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();

    if (!app.isLoggedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Perfil')),
        body: EmptyState(
          icon: Icons.person_outline,
          title: 'Entre na sua conta',
          subtitle: 'Faça login para ver pedidos, endereços e mais.',
          action: SizedBox(
            width: 200,
            child: FilledButton(
                onPressed: () => ensureLoggedIn(context), child: const Text('Entrar')),
          ),
        ),
      );
    }

    final profile = app.profile;

    return Scaffold(
      appBar: AppBar(title: const Text('Perfil')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: kGreen.withValues(alpha: .15),
                child: const Icon(Icons.person, color: kGreenDark),
              ),
              title: Text(profile?.name ?? app.user?.displayName ?? 'Cliente',
                  style: const TextStyle(fontWeight: FontWeight.w800)),
              subtitle: Text(profile?.email ?? app.user?.email ?? ''),
            ),
          ),
          if ((profile?.walletBalance ?? 0) > 0)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Card(
                child: ListTile(
                  leading: const Icon(Icons.account_balance_wallet_outlined,
                      color: kGreenDark),
                  title: const Text('Carteira'),
                  trailing: Text(money(profile!.walletBalance),
                      style: const TextStyle(
                          fontWeight: FontWeight.w900, fontSize: 16)),
                ),
              ),
            ),
          const SizedBox(height: 16),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.place_outlined),
                  title: const Text('Meus endereços'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const AddressesScreen())),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.swap_horiz),
                  title: const Text('Trocar de loja'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const StorePickerScreen())),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.help_outline),
                  title: const Text('Ajuda e suporte'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _showSupport(context),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.logout),
                  title: const Text('Sair'),
                  onTap: () => app.signOut(),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.delete_forever_outlined,
                      color: Colors.redAccent),
                  title: const Text('Excluir minha conta e dados',
                      style: TextStyle(color: Colors.redAccent)),
                  onTap: () => _confirmDelete(context),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showSupport(BuildContext context) {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(8),
              child: Text('Como podemos ajudar?',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            ),
            ListTile(
              leading: const Icon(Icons.chat_bubble_outline),
              title: const Text('Chat do pedido'),
              subtitle: const Text('Abra um pedido e toque no ícone de chat'),
              onTap: () => Navigator.pop(ctx),
            ),
            ListTile(
              leading: const Icon(Icons.phone_outlined),
              title: const Text('WhatsApp da loja'),
              onTap: () {
                Navigator.pop(ctx);
                launchUrl(Uri.parse('https://wa.me/'),
                    mode: LaunchMode.externalApplication);
              },
            ),
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                  'Dúvidas frequentes: prazos de entrega, trocas e reembolsos são '
                  'tratados diretamente com a loja pelo chat do pedido.',
                  style: TextStyle(color: Colors.grey)),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context) async {
    final app = context.read<AppState>();
    final uid = app.user?.uid;
    if (uid == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Excluir conta?'),
        content: const Text(
            'Todos os seus dados (perfil, endereços, favoritos) serão apagados '
            'permanentemente (LGPD). Esta ação não pode ser desfeita.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancelar')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child:
                  const Text('Excluir', style: TextStyle(color: Colors.redAccent))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await CustomersRepo.deleteAccount(uid);
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text(
                'Faça login novamente antes de excluir a conta (exigência de segurança).')));
      }
    }
  }
}
