import 'package:flutter_test/flutter_test.dart';
import 'package:nexmarket_cliente/models.dart';
import 'package:nexmarket_cliente/state/cart_state.dart';
import 'package:shared_preferences/shared_preferences.dart';

Product p(String id, {double price = 10, int? stock}) => Product(
      id: id,
      gondolaId: 'g1',
      name: 'Produto $id',
      price: price,
      stockQuantity: stock,
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('adicionar/remover/incrementar (RF10) e subtotal (RF11)', () async {
    final cart = CartState();
    await cart.loadFor('sm1');

    expect(cart.add(p('a')), isTrue);
    expect(cart.add(p('a')), isTrue);
    expect(cart.add(p('b', price: 4.5)), isTrue);
    expect(cart.itemCount, 3);
    expect(cart.subtotal([p('a'), p('b', price: 4.5)], []), closeTo(24.5, 0.001));

    cart.add(p('a'), delta: -2); // zera e remove a linha
    expect(cart.quantityOf('a'), 0);
    expect(cart.lines.length, 1);
  });

  test('trava no limite de estoque', () async {
    final cart = CartState();
    await cart.loadFor('sm1');
    final prod = p('a', stock: 2);
    expect(cart.add(prod), isTrue);
    expect(cart.add(prod), isTrue);
    expect(cart.add(prod), isFalse); // 3º excede o estoque
    expect(cart.quantityOf('a'), 2);
  });

  test('persiste offline por loja e restaura (carrinho offline)', () async {
    final cart = CartState();
    await cart.loadFor('sm1');
    cart.add(p('a'));
    cart.add(p('b', price: 3));
    // Aguarda o persist assíncrono terminar.
    await Future<void>.delayed(const Duration(milliseconds: 50));

    final restored = CartState();
    await restored.loadFor('sm1');
    expect(restored.itemCount, 2);
    expect(restored.quantityOf('a'), 1);

    // Outra loja começa vazia (carrinho escopado por loja).
    final other = CartState();
    await other.loadFor('sm2');
    expect(other.isEmpty, isTrue);
  });

  test('subtotal usa preço promocional ao vivo do catálogo', () async {
    final cart = CartState();
    await cart.loadFor('sm1');
    cart.add(p('a'));
    final live = [
      Product(
          id: 'a',
          gondolaId: 'g1',
          name: 'A',
          price: 10,
          inPromo: true,
          promoPrice: 6),
    ];
    expect(cart.subtotal(live, []), 6);
  });
}
