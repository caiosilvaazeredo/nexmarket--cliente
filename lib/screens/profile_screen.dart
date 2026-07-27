import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models.dart';
import '../services/customers_repo.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'addresses_screen.dart';
import 'auth.dart';
import 'payment_methods_screen.dart';
import 'personal_data_screen.dart';
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

          // Conta
          const _SectionLabel('Conta'),
          Card(
            child: Column(
              children: [
                _tile(context,
                    icon: Icons.person_outline,
                    title: 'Dados pessoais',
                    subtitle: 'Nome, telefone e CPF',
                    screen: const PersonalDataScreen()),
                const Divider(height: 1),
                _tile(context,
                    icon: Icons.place_outlined,
                    title: 'Meus endereços',
                    subtitle: (profile?.addresses.length ?? 0) == 0
                        ? 'Nenhum endereço salvo'
                        : '${profile!.addresses.length} salvo(s)',
                    screen: const AddressesScreen()),
                const Divider(height: 1),
                _tile(context,
                    icon: Icons.credit_card,
                    title: 'Formas de pagamento',
                    subtitle: _paymentSubtitle(profile),
                    screen: const PaymentMethodsScreen()),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Compras
          const _SectionLabel('Compras'),
          Card(
            child: Column(
              children: [
                _tile(context,
                    icon: Icons.favorite_border,
                    title: 'Favoritos',
                    subtitle: (profile?.favorites.length ?? 0) == 0
                        ? 'Salve produtos que você sempre compra'
                        : '${profile!.favorites.length} produto(s)',
                    screen: const FavoritesScreen()),
                const Divider(height: 1),
                _tile(context,
                    icon: Icons.local_activity_outlined,
                    title: 'Cupons',
                    subtitle: 'Descontos disponíveis nesta loja',
                    screen: const CouponsScreen()),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.swap_horiz),
                  title: const Text('Trocar de loja'),
                  subtitle: Text(app.storeName,
                      style: const TextStyle(fontSize: 12.5)),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const StorePickerScreen())),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Preferências e ajuda
          const _SectionLabel('Preferências'),
          Card(
            child: Column(
              children: [
                _tile(context,
                    icon: Icons.notifications_outlined,
                    title: 'Notificações',
                    subtitle: 'Status do pedido e ofertas',
                    screen: const NotificationsScreen()),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.help_outline),
                  title: const Text('Ajuda e suporte'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _showSupport(context),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: const Text('Sobre o app'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => showAboutDialog(
                    context: context,
                    applicationName: 'Nexmarket',
                    applicationVersion: '1.0.0',
                    applicationLegalese:
                        'Suas compras do mercado, entregues onde você estiver.',
                  ),
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

  /// Resumo da forma de pagamento preferida para a linha do menu.
  static String _paymentSubtitle(CustomerProfile? profile) {
    if (profile == null) return 'Cartões, PIX e mais';
    final method = profile.defaultPaymentMethod ?? '';
    if (method.startsWith('card:')) {
      final card = profile.cardById(method.substring(5));
      if (card != null) return 'Padrão: ${card.label}';
    }
    final label = paymentLabels[method];
    if (label != null) return 'Padrão: $label';
    return profile.cards.isEmpty
        ? 'Cadastre um cartão ou escolha PIX'
        : '${profile.cards.length} cartão(ões) salvo(s)';
  }

  Widget _tile(BuildContext context,
      {required IconData icon,
      required String title,
      required String subtitle,
      required Widget screen}) {
    return ListTile(
      leading: Icon(icon),
      title: Text(title),
      subtitle: Text(subtitle, style: const TextStyle(fontSize: 12.5)),
      trailing: const Icon(Icons.chevron_right),
      onTap: () =>
          Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen)),
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


/// Rótulo de seção do menu de perfil.
class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(left: 4, bottom: 6),
        child: Text(text.toUpperCase(),
            style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w900,
                letterSpacing: .8,
                color: Colors.grey.shade500)),
      );
}
