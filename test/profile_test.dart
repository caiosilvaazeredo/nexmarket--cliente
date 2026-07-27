import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexmarket_cliente/models.dart';
import 'package:nexmarket_cliente/services/customers_repo.dart';
import 'package:nexmarket_cliente/services/fire.dart';

/// Perfil do cliente: cartões, favoritos e preferências em /customers/{uid}.
void main() {
  late FakeFirebaseFirestore db;

  setUp(() {
    db = FakeFirebaseFirestore();
    Fire.overrideForTests(db, uid: 'cliente1');
  });

  Future<Map<String, dynamic>> profileDoc() async =>
      (await db.doc('customers/cliente1').get()).data()!;

  test('salva cartão sem número nem CVV (RNF10)', () async {
    final card = SavedCard(
      id: 'c1',
      brand: 'visa',
      last4: '1111',
      holderName: 'FULANO',
      expMonth: '12',
      expYear: '30',
    );
    await CustomersRepo.saveCards('cliente1', [card],
        defaultPaymentMethod: 'card:c1');

    final data = await profileDoc();
    final saved = (data['cards'] as List).first as Map;
    expect(saved['brand'], 'visa');
    expect(saved['last4'], '1111');
    // O documento inteiro não pode conter o PAN nem o CVV.
    expect(data.toString().contains('4111'), isFalse);
    expect(saved.containsKey('number'), isFalse);
    expect(saved.containsKey('cvv'), isFalse);
    expect(data['defaultPaymentMethod'], 'card:c1');
  });

  test('remove cartão e limpa a preferência quando era o padrão', () async {
    final a = SavedCard(id: 'c1', brand: 'visa', last4: '1111');
    final b = SavedCard(id: 'c2', brand: 'elo', last4: '2222');
    await CustomersRepo.saveCards('cliente1', [a, b],
        defaultPaymentMethod: 'card:c1');

    await CustomersRepo.saveCards('cliente1', [b], defaultPaymentMethod: '');

    final data = await profileDoc();
    expect((data['cards'] as List).length, 1);
    expect(data['defaultPaymentMethod'], '');

    final profile = CustomerProfile.fromMap('cliente1', data);
    expect(profile.cards.single.id, 'c2');
    expect(profile.cardById('c1'), isNull);
    expect(profile.cardById('c2')?.brandLabel, 'Elo');
  });

  test('formas sem cartão (PIX/dinheiro) também viram padrão', () async {
    await CustomersRepo.setDefaultPaymentMethod('cliente1', 'pix');
    expect((await profileDoc())['defaultPaymentMethod'], 'pix');
  });

  test('favoritos alternam e persistem', () async {
    await CustomersRepo.toggleFavorite('cliente1', [], 'p1');
    expect((await profileDoc())['favorites'], ['p1']);

    await CustomersRepo.toggleFavorite('cliente1', ['p1'], 'p2');
    expect((await profileDoc())['favorites'], ['p1', 'p2']);

    await CustomersRepo.toggleFavorite('cliente1', ['p1', 'p2'], 'p1');
    expect((await profileDoc())['favorites'], ['p2']);

    final profile = CustomerProfile.fromMap('cliente1', await profileDoc());
    expect(profile.isFavorite('p2'), isTrue);
    expect(profile.isFavorite('p1'), isFalse);
  });

  test('preferências de notificação salvam e recarregam', () async {
    await CustomersRepo.savePreferences('cliente1',
        CustomerPreferences(pushEnabled: false, marketingOptIn: true));

    final profile = CustomerProfile.fromMap('cliente1', await profileDoc());
    expect(profile.preferences.pushEnabled, isFalse);
    expect(profile.preferences.marketingOptIn, isTrue);
  });

  test('perfil novo tem defaults seguros', () {
    final profile = CustomerProfile.fromMap('novo', {});
    expect(profile.cards, isEmpty);
    expect(profile.favorites, isEmpty);
    expect(profile.preferences.pushEnabled, isTrue);
    expect(profile.preferences.marketingOptIn, isFalse); // opt-in explícito
    expect(profile.defaultPaymentMethod, isNull);
  });

  test('dados pessoais atualizam sem apagar o resto do perfil', () async {
    await CustomersRepo.saveCards(
        'cliente1', [SavedCard(id: 'c1', brand: 'visa', last4: '1111')]);
    await CustomersRepo.update('cliente1',
        {'name': 'Maria', 'phone': '21999998888', 'cpf': '52998224725'});

    final profile = CustomerProfile.fromMap('cliente1', await profileDoc());
    expect(profile.name, 'Maria');
    expect(profile.cpf, '52998224725');
    expect(profile.cards.length, 1); // cartão preservado
  });
}
