import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../services/pricing.dart';
import '../state/app_state.dart';
import '../state/cart_state.dart';
import '../theme.dart';

/// Imagem de produto com fallback amigável.
class ProductImage extends StatelessWidget {
  final String? url;
  final double size;
  final BoxFit fit;
  const ProductImage(this.url, {super.key, this.size = 72, this.fit = BoxFit.cover});

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      width: size,
      height: size,
      color: const Color(0xFFF0F0F0),
      child: Icon(Icons.shopping_basket_outlined, color: Colors.grey.shade400, size: size * .4),
    );
    if (url == null || url!.isEmpty) return placeholder;
    return Image.network(
      url!,
      width: size,
      height: size,
      fit: fit,
      errorBuilder: (_, _, _) => placeholder,
    );
  }
}

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? action;
  const EmptyState({super.key, required this.icon, required this.title, this.subtitle, this.action});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 64, color: Colors.grey.shade300),
            const SizedBox(height: 16),
            Text(title,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            if (subtitle != null) ...[
              const SizedBox(height: 8),
              Text(subtitle!,
                  textAlign: TextAlign.center, style: TextStyle(color: Colors.grey.shade600)),
            ],
            if (action != null) ...[const SizedBox(height: 20), action!],
          ],
        ),
      ),
    );
  }
}

/// Card de produto com preço "de/por", selo de % OFF e stepper de quantidade
/// (RF09/RF10 + RNF02 — botão "Adicionar" grande).
class ProductCard extends StatelessWidget {
  final Product product;
  final VoidCallback? onTap;
  const ProductCard({super.key, required this.product, this.onTap});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final cart = context.watch<CartState>();
    final unitPrice = Pricing.unitPrice(product, app.promotions);
    final discounted = unitPrice < product.price - 0.001;
    final badge = Pricing.promoBadge(product, app.promotions);
    final qty = cart.quantityOf(product.id);
    final out = product.outOfStock;

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Stack(
                  children: [
                    Center(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: ProductImage(product.imageUrl, size: 110),
                      ),
                    ),
                    if (badge != null)
                      Positioned(
                        top: 0,
                        left: 0,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.redAccent,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(badge,
                              style: const TextStyle(
                                  color: Colors.white, fontSize: 11, fontWeight: FontWeight.w900)),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 6),
              Text(product.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              if ((product.unit ?? '').isNotEmpty)
                Text(product.unit!, style: TextStyle(color: Colors.grey.shade500, fontSize: 11)),
              const SizedBox(height: 4),
              if (discounted)
                Text(money(product.price),
                    style: TextStyle(
                        color: Colors.grey.shade500,
                        fontSize: 11,
                        decoration: TextDecoration.lineThrough)),
              Text(money(unitPrice),
                  style: TextStyle(
                      color: discounted ? Colors.redAccent : Colors.black87,
                      fontWeight: FontWeight.w900,
                      fontSize: 15)),
              const SizedBox(height: 6),
              if (out)
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(36),
                        padding: EdgeInsets.zero,
                        side: BorderSide(color: Colors.grey.shade400)),
                    onPressed: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                        content: Text('Produto esgotado. Avisaremos quando voltar!'))),
                    child: const Text('Esgotado', style: TextStyle(fontSize: 12)),
                  ),
                )
              else if (qty == 0)
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(36), padding: EdgeInsets.zero),
                    onPressed: () => _add(context, 1),
                    child: const Text('Adicionar', style: TextStyle(fontSize: 13)),
                  ),
                )
              else
                QtyStepper(qty: qty, onDelta: (d) => _add(context, d)),
            ],
          ),
        ),
      ),
    );
  }

  void _add(BuildContext context, int delta) {
    final ok = context.read<CartState>().add(product, delta: delta);
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Limite de estoque: ${product.availableStock} un.')));
    }
  }
}

class QtyStepper extends StatelessWidget {
  final int qty;
  final void Function(int delta) onDelta;
  const QtyStepper({super.key, required this.qty, required this.onDelta});

  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;
    return Container(
      height: 36,
      decoration: BoxDecoration(
        border: Border.all(color: accent, width: 2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            padding: EdgeInsets.zero,
            iconSize: 18,
            icon: Icon(qty == 1 ? Icons.delete_outline : Icons.remove, color: accent),
            onPressed: () => onDelta(-1),
          ),
          Text('$qty', style: const TextStyle(fontWeight: FontWeight.w900)),
          IconButton(
            padding: EdgeInsets.zero,
            iconSize: 18,
            icon: Icon(Icons.add, color: accent),
            onPressed: () => onDelta(1),
          ),
        ],
      ),
    );
  }
}

/// Barra fixa do carrinho com subtotal dinâmico (RF11).
class CartBar extends StatelessWidget {
  final VoidCallback onTap;
  const CartBar({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final cart = context.watch<CartState>();
    if (cart.isEmpty) return const SizedBox.shrink();
    final subtotal = cart.subtotal(app.products, app.promotions);
    return SafeArea(
      minimum: const EdgeInsets.all(12),
      child: FilledButton(
        onPressed: onTap,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Ver carrinho (${cart.itemCount})'),
            Text(money(subtotal)),
          ],
        ),
      ),
    );
  }
}

class StarRating extends StatelessWidget {
  final int rating;
  final void Function(int)? onChanged;
  final double size;
  const StarRating({super.key, required this.rating, this.onChanged, this.size = 36});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) {
        final filled = i < rating;
        return IconButton(
          padding: EdgeInsets.zero,
          constraints: BoxConstraints(minWidth: size + 4),
          iconSize: size,
          icon: Icon(filled ? Icons.star_rounded : Icons.star_outline_rounded,
              color: filled ? Colors.amber : Colors.grey.shade400),
          onPressed: onChanged == null ? null : () => onChanged!(i + 1),
        );
      }),
    );
  }
}
