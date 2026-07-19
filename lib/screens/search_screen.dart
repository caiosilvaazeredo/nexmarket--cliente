import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../services/pricing.dart';
import '../state/app_state.dart';
import '../widgets/common.dart';
import 'product_screen.dart';

/// Busca global com correspondência tolerante + filtros (RF06/RF07).
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  String _query = '';
  String? _gondolaId;
  bool _promoOnly = false;
  String _sort = 'relevance'; // relevance | price_asc | price_desc

  String _normalize(String s) {
    const from = 'áàãâäéèêëíìîïóòõôöúùûüçñ';
    const to = 'aaaaaeeeeiiiiooooouuuucn';
    var out = s.toLowerCase();
    for (var i = 0; i < from.length; i++) {
      out = out.replaceAll(from[i], to[i]);
    }
    return out;
  }

  /// Pontuação simples de relevância: prefixo > contém > tokens.
  int _score(Product p, String q) {
    final name = _normalize(p.name);
    final brand = _normalize(p.brand ?? '');
    if (name.startsWith(q)) return 100;
    if (name.contains(q)) return 60;
    if (brand.contains(q)) return 40;
    final tokens = q.split(' ').where((t) => t.length > 1);
    var hits = 0;
    for (final t in tokens) {
      if (name.contains(t)) hits++;
    }
    return hits > 0 ? 20 + hits : 0;
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final q = _normalize(_query.trim());

    var results = app.products.where((p) => p.active).toList();
    if (_gondolaId != null) {
      results = results.where((p) => p.gondolaId == _gondolaId).toList();
    }
    if (_promoOnly) {
      results = results.where((p) => Pricing.hasDiscount(p, app.promotions)).toList();
    }
    if (q.isNotEmpty) {
      final scored = <(Product, int)>[];
      for (final p in results) {
        final s = _score(p, q);
        if (s > 0) scored.add((p, s));
      }
      scored.sort((a, b) => b.$2.compareTo(a.$2));
      results = scored.map((e) => e.$1).toList();
    }
    if (_sort == 'price_asc') {
      results.sort((a, b) => Pricing.unitPrice(a, app.promotions)
          .compareTo(Pricing.unitPrice(b, app.promotions)));
    } else if (_sort == 'price_desc') {
      results.sort((a, b) => Pricing.unitPrice(b, app.promotions)
          .compareTo(Pricing.unitPrice(a, app.promotions)));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Buscar')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: TextField(
              onChanged: (v) => setState(() => _query = v),
              decoration: const InputDecoration(
                hintText: 'O que você precisa hoje?',
                prefixIcon: Icon(Icons.search),
              ),
            ),
          ),
          SizedBox(
            height: 56,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              children: [
                FilterChip(
                  label: const Text('Promoções'),
                  selected: _promoOnly,
                  onSelected: (v) => setState(() => _promoOnly = v),
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: const Text('Menor preço'),
                  selected: _sort == 'price_asc',
                  onSelected: (v) =>
                      setState(() => _sort = v ? 'price_asc' : 'relevance'),
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: const Text('Maior preço'),
                  selected: _sort == 'price_desc',
                  onSelected: (v) =>
                      setState(() => _sort = v ? 'price_desc' : 'relevance'),
                ),
                const SizedBox(width: 8),
                for (final g in app.gondolas) ...[
                  FilterChip(
                    label: Text(g.name),
                    selected: _gondolaId == g.id,
                    onSelected: (v) => setState(() => _gondolaId = v ? g.id : null),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          Expanded(
            child: results.isEmpty
                ? const EmptyState(
                    icon: Icons.search_off,
                    title: 'Nada encontrado',
                    subtitle: 'Tente outra palavra ou remova os filtros.')
                : GridView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      childAspectRatio: .62,
                    ),
                    itemCount: results.length,
                    itemBuilder: (context, i) {
                      final p = results[i];
                      return ProductCard(
                        product: p,
                        onTap: () => Navigator.of(context).push(MaterialPageRoute(
                            builder: (_) => ProductScreen(productId: p.id))),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
