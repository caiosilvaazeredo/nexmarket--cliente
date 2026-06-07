import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import type { Order, OrderStatus, DeliveryStatus } from './types';

/**
 * Push / local notifications for order updates (RF22). Status changes detected
 * by the order listener fire a local notification (and, when an Expo push token
 * is registered, the backend/store can also push remotely). A handler shows
 * banners even in the foreground.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Atualizações de pedidos',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#58CC02',
      sound: 'default',
    });
  }
  return status === 'granted';
}

/** Get the Expo push token so the store/backend can target this device (RF22). */
export async function getPushToken(): Promise<string | null> {
  try {
    const granted = await ensureNotificationPermissions();
    if (!granted) return null;
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch (e) {
    console.warn('getPushToken failed', e);
    return null;
  }
}

const STATUS_COPY: Record<OrderStatus, { title: string; body: string } | null> = {
  pending: { title: 'Pedido recebido! 🛒', body: 'Estamos confirmando seu pagamento.' },
  picking: { title: 'Em separação 🧺', body: 'A loja está montando suas sacolas.' },
  waiting_substitution: { title: 'Item em falta ⚠️', body: 'Há uma sugestão de substituição. Toque para responder.' },
  ready: { title: 'Pedido pronto! ✅', body: 'Já já sai para entrega.' },
  delivered: { title: 'Pedido entregue 🎉', body: 'Bom apetite! Que tal avaliar sua compra?' },
  cancelled: { title: 'Pedido cancelado', body: 'Seu pedido foi cancelado. O estorno, se houver, já foi iniciado.' },
};

const DELIVERY_COPY: Partial<Record<DeliveryStatus, { title: string; body: string }>> = {
  going_to_store: { title: 'Entregador a caminho da loja 🛵', body: 'Logo seu pedido sai para você.' },
  going_to_customer: { title: 'Saiu para entrega 🚀', body: 'Acompanhe o entregador no mapa em tempo real.' },
  delivered: { title: 'Pedido entregue 🎉', body: 'Bom apetite! Que tal avaliar sua compra?' },
};

export async function notify(title: string, body: string, data?: any) {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default', data },
      trigger: null,
    });
  } catch {}
}

/**
 * Compare a fresh order against the last seen status and notify on change.
 * Returns the new signature to store for the next comparison.
 */
export function notifyOnStatusChange(order: Order, lastSig: string | undefined): string {
  const sig = `${order.status}|${order.deliveryStatus || ''}`;
  if (lastSig === undefined || lastSig === sig) return sig;

  const [prevStatus, prevDelivery] = lastSig.split('|');
  if (order.deliveryStatus && order.deliveryStatus !== prevDelivery && DELIVERY_COPY[order.deliveryStatus]) {
    const c = DELIVERY_COPY[order.deliveryStatus]!;
    notify(c.title, c.body, { orderId: order.id, smId: order.supermarketId });
  } else if (order.status !== prevStatus && STATUS_COPY[order.status]) {
    const c = STATUS_COPY[order.status]!;
    notify(c.title, c.body, { orderId: order.id, smId: order.supermarketId });
  }
  return sig;
}
