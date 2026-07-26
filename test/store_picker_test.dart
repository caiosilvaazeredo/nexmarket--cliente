import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexmarket_cliente/screens/store_picker.dart';
import 'package:nexmarket_cliente/services/fire.dart';
import 'package:nexmarket_cliente/state/app_state.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late FakeFirebaseFirestore db;
  late AppState app;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    db = FakeFirebaseFirestore();
    Fire.overrideForTests(db, uid: 'cliente1');
    app = AppState();

    // Duas lojas: uma aberta 24h com frete grátis, outra fechada e com frete.
    await db.doc('supermarkets/sm1').set({'name': 'Mercado Alfa'});
    await db.doc('supermarkets/sm1/settings/storeInfo').set({
      'openingHours': {
        for (final k in ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])
          k: {'isOpen': true, 'openTime': '00:00', 'closeTime': '23:59'}
      },
      'storeLocation': {'lat': -22.90, 'lng': -43.20},
    });
    await db.doc('supermarkets/sm1/deliveryConfig/main').set({
      'shippingType': 'free_diluted',
      'minimumOrderValue': 50,
    });

    await db.doc('supermarkets/sm2').set({'name': 'Beta Supermercados'});
    await db.doc('supermarkets/sm2/settings/storeInfo').set({
      'openingHours': {
        for (final k in ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])
          k: {'isOpen': false, 'openTime': '08:00', 'closeTime': '20:00'}
      },
    });
    await db.doc('supermarkets/sm2/deliveryConfig/main').set({
      'shippingType': 'transparent',
      'flatFeeValue': 9.9,
    });
  });

  /// Monta o picker empurrado por cima de outra tela — o caso de "trocar de
  /// mercado", que é onde estava o bug.
  Future<void> pumpAsSwitcher(WidgetTester tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider<AppState>.value(
        value: app,
        child: MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: ElevatedButton(
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => const StorePickerScreen())),
                child: const Text('Trocar de loja'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Trocar de loja'));
    await tester.pumpAndSettle();
  }

  testWidgets('escolher um mercado troca a loja E fecha a tela', (tester) async {
    await app.selectSupermarket('sm1');
    await pumpAsSwitcher(tester);

    expect(find.text('Trocar de mercado'), findsOneWidget);
    expect(find.text('Beta Supermercados'), findsOneWidget);

    await tester.tap(find.text('Beta Supermercados'));
    await tester.pumpAndSettle();

    // A loja mudou...
    expect(app.supermarketId, 'sm2');
    // ...e o seletor saiu da tela (era isto que não acontecia).
    expect(find.text('Trocar de mercado'), findsNothing);
    expect(find.text('Trocar de loja'), findsOneWidget);
  });

  testWidgets('tocar no mercado atual apenas fecha a tela', (tester) async {
    await app.selectSupermarket('sm1');
    await pumpAsSwitcher(tester);

    await tester.tap(find.text('Mercado Alfa'));
    await tester.pumpAndSettle();

    expect(app.supermarketId, 'sm1');
    expect(find.text('Trocar de mercado'), findsNothing);
  });

  testWidgets('marca o mercado atual na lista', (tester) async {
    await app.selectSupermarket('sm2');
    await pumpAsSwitcher(tester);

    expect(find.text('Atual'), findsOneWidget);
    expect(find.byIcon(Icons.check_circle), findsOneWidget);
  });

  testWidgets('busca por nome filtra a lista', (tester) async {
    await pumpAsSwitcher(tester);

    await tester.enterText(find.byType(TextField), 'beta');
    await tester.pumpAndSettle();

    expect(find.text('Beta Supermercados'), findsOneWidget);
    expect(find.text('Mercado Alfa'), findsNothing);
  });

  testWidgets('filtro "Abertos agora" esconde a loja fechada', (tester) async {
    await pumpAsSwitcher(tester);

    await tester.tap(find.text('Abertos agora'));
    await tester.pumpAndSettle();

    expect(find.text('Mercado Alfa'), findsOneWidget);
    expect(find.text('Beta Supermercados'), findsNothing);
  });

  testWidgets('filtro "Frete grátis" usa a política de entrega da loja',
      (tester) async {
    await pumpAsSwitcher(tester);

    await tester.tap(find.text('Frete grátis'));
    await tester.pumpAndSettle();

    expect(find.text('Mercado Alfa'), findsOneWidget); // free_diluted => grátis
    expect(find.text('Beta Supermercados'), findsNothing); // frete 9,90
  });

  testWidgets('mostra status e frete de cada mercado', (tester) async {
    await pumpAsSwitcher(tester);

    expect(find.textContaining('Aberto agora'), findsOneWidget);
    expect(find.textContaining('Fechado'), findsOneWidget);
    expect(find.textContaining('Frete grátis'), findsWidgets);
  });

  testWidgets('sem resultados oferece limpar os filtros', (tester) async {
    await pumpAsSwitcher(tester);

    await tester.enterText(find.byType(TextField), 'inexistente');
    await tester.pumpAndSettle();

    expect(find.text('Nenhum mercado com esses filtros'), findsOneWidget);
    await tester.tap(find.text('Limpar filtros'));
    await tester.pumpAndSettle();
    expect(find.text('Mercado Alfa'), findsOneWidget);
  });
}
