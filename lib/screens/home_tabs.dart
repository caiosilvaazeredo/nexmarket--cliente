import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import '../widgets/common.dart';
import 'cart_screen.dart';
import 'home_screen.dart';
import 'orders_screen.dart';
import 'profile_screen.dart';
import 'search_screen.dart';

class HomeTabs extends StatefulWidget {
  const HomeTabs({super.key});

  @override
  State<HomeTabs> createState() => _HomeTabsState();
}

class _HomeTabsState extends State<HomeTabs> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final ordersBadge = app.activeOrders.length;

    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: const [
          HomeScreen(),
          SearchScreen(),
          OrdersScreen(),
          ProfileScreen(),
        ],
      ),
      bottomSheet: _index <= 1
          ? CartBar(
              onTap: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => const CartScreen())))
          : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          const NavigationDestination(icon: Icon(Icons.storefront_outlined), label: 'Início'),
          const NavigationDestination(icon: Icon(Icons.search), label: 'Buscar'),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: ordersBadge > 0,
              label: Text('$ordersBadge'),
              child: const Icon(Icons.receipt_long_outlined),
            ),
            label: 'Pedidos',
          ),
          const NavigationDestination(icon: Icon(Icons.person_outline), label: 'Perfil'),
        ],
      ),
    );
  }
}
