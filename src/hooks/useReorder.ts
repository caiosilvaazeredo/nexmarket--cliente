import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../store/useAppStore';
import { useCartStore } from '../store/useCartStore';
import { buildReorderLines } from '../lib/reorder';
import { successHaptic } from '../lib/notifications';
import type { Order, Product } from '../lib/types';

/**
 * One-tap reorder (RF19): re-adds a past order's items to the cart, revalidating
 * prices/stock against the live catalog and handling a store switch when the
 * order is from a different supermarket than the one currently open.
 */
export function useReorder() {
  const router = useRouter();
  const products = useAppStore((s) => s.products);
  const currentSmId = useAppStore((s) => s.currentSmId);
  const setCurrentSmId = useAppStore((s) => s.setCurrentSmId);
  const addItem = useCartStore((s) => s.addItem);
  const clear = useCartStore((s) => s.clear);

  return (order: Order) => {
    const apply = (catalog: Product[]) => {
      const { lines, unavailable, capped } = buildReorderLines(order, catalog);
      if (lines.length === 0) {
        Alert.alert('Indisponível', 'Nenhum item deste pedido está disponível no momento.');
        return;
      }
      lines.forEach((l) => addItem(l.product, l.quantity));
      successHaptic();
      const notes: string[] = [];
      if (unavailable.length) notes.push(`Fora de estoque: ${unavailable.join(', ')}.`);
      if (capped) notes.push('Algumas quantidades foram ajustadas ao estoque disponível.');
      if (notes.length) Alert.alert('Carrinho atualizado', notes.join('\n'));
      router.push('/cart');
    };

    if (order.supermarketId !== currentSmId) {
      Alert.alert(
        'Repetir pedido',
        `Este pedido é da loja ${order.storeName || ''}. Vamos trocar para essa loja e montar seu carrinho.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Continuar',
            onPress: () => {
              clear();
              setCurrentSmId(order.supermarketId);
              // New store's catalog isn't loaded yet; reconstruct from the order.
              setTimeout(() => apply([]), 60);
            },
          },
        ],
      );
    } else {
      apply(products);
    }
  };
}
