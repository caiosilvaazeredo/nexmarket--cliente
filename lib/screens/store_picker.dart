import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../services/catalog_repo.dart';
import '../state/app_state.dart';
import '../theme.dart';

/// Escolha do supermercado (descoberta/onboarding). A navegação é livre sem
/// login — o login só é exigido no checkout.
class StorePickerScreen extends StatelessWidget {
  const StorePickerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: kGreen,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Icon(Icons.storefront, color: Colors.white, size: 36),
                  ),
                  const SizedBox(height: 16),
                  const Text('Bem-vindo!',
                      style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 4),
                  Text('Escolha o mercado para começar as compras',
                      style: TextStyle(fontSize: 16, color: Colors.grey.shade600)),
                ],
              ),
            ),
            Expanded(
              child: StreamBuilder<List<Supermarket>>(
                stream: CatalogRepo.supermarkets(),
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final stores = snap.data ?? [];
                  if (stores.isEmpty) {
                    return const Center(child: Text('Nenhuma loja disponível no momento.'));
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.all(20),
                    itemCount: stores.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, i) {
                      final sm = stores[i];
                      return Card(
                        child: ListTile(
                          contentPadding:
                              const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          leading: CircleAvatar(
                            backgroundColor: kGreen.withValues(alpha: .15),
                            backgroundImage: (sm.logoUrl ?? '').isNotEmpty
                                ? NetworkImage(sm.logoUrl!)
                                : null,
                            child: (sm.logoUrl ?? '').isEmpty
                                ? const Icon(Icons.store, color: kGreenDark)
                                : null,
                          ),
                          title: Text(sm.name,
                              style: const TextStyle(fontWeight: FontWeight.w800)),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => context.read<AppState>().selectSupermarket(sm.id),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
