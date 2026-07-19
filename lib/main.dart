import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

import 'screens/home_tabs.dart';
import 'screens/store_picker.dart';
import 'services/fire.dart';
import 'state/app_state.dart';
import 'state/cart_state.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Fire.init();
  await initializeDateFormatting('pt_BR');
  runApp(const NexmarketClienteApp());
}

class NexmarketClienteApp extends StatelessWidget {
  const NexmarketClienteApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AppState()),
        ChangeNotifierProvider(create: (_) => CartState()),
      ],
      child: Consumer<AppState>(
        builder: (context, app, _) {
          // Carrega o carrinho persistido da loja selecionada.
          if (app.supermarketId != null) {
            context.read<CartState>().loadFor(app.supermarketId!);
          }
          return MaterialApp(
            title: app.storeName,
            debugShowCheckedModeBanner: false,
            theme: buildTheme(app.accentColor),
            home: app.hasStore ? const HomeTabs() : const StorePickerScreen(),
          );
        },
      ),
    );
  }
}
